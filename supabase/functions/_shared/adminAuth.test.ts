import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTIES,
  ADMIN_INHOUD_ACTIES,
  bepaalToegang,
  isAdminActie,
  isInhoudActie,
  isInhoudMuterend,
  isMuterend,
  MUTERENDE_ACTIES,
  MUTERENDE_INHOUD_ACTIES,
} from "./adminAuth.ts";

const UID = "d0000000-0000-0000-0000-000000000002";

describe("bepaalToegang", () => {
  it("weigert zonder sessie met 401, ook bij een geldige actie", () => {
    // Fail-closed: geen uid betekent weigeren, niet "dan maar zonder check".
    expect(bepaalToegang({ uid: null, isAdmin: false, actie: "list_users" })).toEqual({
      soort: "weiger",
      status: 401,
      fout: "Niet ingelogd",
    });
    // Ook een beheerder zonder geldige sessie komt er niet in.
    expect(bepaalToegang({ uid: null, isAdmin: true, actie: "list_users" })).toMatchObject({
      status: 401,
    });
  });

  it("beantwoordt whoami voor elke ingelogde gebruiker, ook een niet-beheerder", () => {
    // Zonder deze uitzondering kan de client niet beslissen of het menu-item
    // getoond moet worden — en dat is de enige reden dat ze bestaat.
    expect(bepaalToegang({ uid: UID, isAdmin: false, actie: "whoami" })).toEqual({
      soort: "voer-uit",
      actie: "whoami",
      uid: UID,
    });
  });

  it("weigert een niet-beheerder met 403", () => {
    expect(bepaalToegang({ uid: UID, isAdmin: false, actie: "list_users" })).toEqual({
      soort: "weiger",
      status: 403,
      fout: "Geen toegang",
    });
  });

  it("geeft een niet-beheerder exact hetzelfde antwoord voor een bestaande en een onbekende actie", () => {
    // De 403 valt bewust vóór de actie-validatie. Zou hij erna vallen, dan
    // verraadt het verschil tussen 400 en 403 welke acties er bestaan.
    const bestaand = bepaalToegang({ uid: UID, isAdmin: false, actie: "user_detail" });
    const onzin = bepaalToegang({ uid: UID, isAdmin: false, actie: "drop_everything" });
    expect(bestaand).toEqual(onzin);
    expect(onzin).toMatchObject({ status: 403, fout: "Geen toegang" });
  });

  it("weigert een onbekende actie van een beheerder met 400", () => {
    expect(bepaalToegang({ uid: UID, isAdmin: true, actie: "drop_everything" })).toEqual({
      soort: "weiger",
      status: 400,
      fout: "Onbekende actie",
    });
  });

  it("weigert een ontbrekende of niet-tekstuele actie", () => {
    for (const actie of [undefined, null, 42, {}, ["list_users"]]) {
      expect(bepaalToegang({ uid: UID, isAdmin: true, actie })).toMatchObject({
        soort: "weiger",
        status: 400,
      });
    }
  });

  it("laat elke actie uit ADMIN_ACTIES door voor een beheerder", () => {
    // Vangt het geval waarin er een actie bijkomt die nergens gedispatcht wordt
    // — of andersom, een dispatch zonder plek in de lijst.
    for (const actie of ADMIN_ACTIES) {
      expect(bepaalToegang({ uid: UID, isAdmin: true, actie })).toEqual({
        soort: "voer-uit",
        actie,
        uid: UID,
      });
    }
  });
});

describe("MUTERENDE_ACTIES", () => {
  it("bevat elke actie die een account verandert, en geen enkele leesactie", () => {
    // Deze lijst bepaalt wat er in het auditspoor terechtkomt. Valt er een
    // muterende actie buiten, dan gebeurt er iets met iemands account zonder
    // spoor — en dat is precies wat het logboek moest voorkomen.
    expect([...MUTERENDE_ACTIES].sort()).toEqual(
      [
        "delete_user",
        "fix_email",
        "recovery_link",
        "resend_reset",
        "sign_out_all",
        "temp_password",
      ].sort(),
    );
    for (const lees of ["whoami", "list_users", "user_detail", "audit_log"] as const) {
      expect(isMuterend(lees)).toBe(false);
    }
  });

  it("noemt alleen acties die de function ook echt kent", () => {
    for (const actie of MUTERENDE_ACTIES) {
      expect(isAdminActie(actie)).toBe(true);
    }
  });
});

describe("isAdminActie", () => {
  it("herkent enkel de acties uit de lijst", () => {
    expect(isAdminActie("whoami")).toBe(true);
    expect(isAdminActie("list_users")).toBe(true);
    expect(isAdminActie("Whoami")).toBe(false);
    expect(isAdminActie("")).toBe(false);
    expect(isAdminActie(undefined)).toBe(false);
  });
});

// ---- admin-content (#1159) --------------------------------------------------

describe("bepaalToegang met de inhoudsacties", () => {
  const inhoud = { bekend: ADMIN_INHOUD_ACTIES } as const;

  it("laat elke actie uit ADMIN_INHOUD_ACTIES door voor een beheerder", () => {
    for (const actie of ADMIN_INHOUD_ACTIES) {
      expect(bepaalToegang({ uid: UID, isAdmin: true, actie, ...inhoud })).toEqual({
        soort: "voer-uit",
        actie,
        uid: UID,
      });
    }
  });

  it("kent de acties van de andere function niet", () => {
    // Elke function kent alleen zijn eigen lijst. Vraag admin-content om een
    // gebruikersactie en je krijgt terecht een 400 — anders zou de dispatcher
    // stilzwijgend in zijn default belanden.
    expect(
      bepaalToegang({ uid: UID, isAdmin: true, actie: "delete_user", ...inhoud }),
    ).toMatchObject({ soort: "weiger", status: 400 });
  });

  it("geeft whoami hier géén vrijgeleide", () => {
    // De uitzondering bestaat om het menu-item te kunnen tonen, en dat gebeurt
    // via admin-users. Zou ze ook hier gelden, dan kreeg een niet-beheerder een
    // "voer-uit" voor een actie die deze function niet eens heeft.
    expect(
      bepaalToegang({ uid: UID, isAdmin: false, actie: "whoami", ...inhoud }),
    ).toEqual({ soort: "weiger", status: 403, fout: "Geen toegang" });
  });

  it("geeft een niet-beheerder hetzelfde antwoord voor een bestaande en een onzin-actie", () => {
    const bestaand = bepaalToegang({
      uid: UID,
      isAdmin: false,
      actie: "delete_match",
      ...inhoud,
    });
    const onzin = bepaalToegang({
      uid: UID,
      isAdmin: false,
      actie: "drop_everything",
      ...inhoud,
    });
    expect(bestaand).toEqual(onzin);
    expect(onzin).toMatchObject({ status: 403 });
  });

  it("weigert zonder sessie met 401", () => {
    expect(
      bepaalToegang({ uid: null, isAdmin: true, actie: "delete_match", ...inhoud }),
    ).toMatchObject({ status: 401 });
  });
});

describe("MUTERENDE_INHOUD_ACTIES", () => {
  it("bevat elke actie die iets verandert, en geen enkele leesactie", () => {
    expect([...MUTERENDE_INHOUD_ACTIES].sort()).toEqual(
      [
        "delete_group",
        "delete_match",
        "delete_poll",
        "move_match",
        "remove_group_member",
        "set_group_owner",
        "set_poll_status",
        "update_match_score",
      ].sort(),
    );
    for (const lees of [
      "list_matches",
      "list_polls",
      "list_group_members",
      "audit_recent",
    ] as const) {
      expect(isInhoudMuterend(lees)).toBe(false);
    }
  });

  it("noemt alleen acties die de function ook echt kent", () => {
    for (const actie of MUTERENDE_INHOUD_ACTIES) {
      expect(isInhoudActie(actie)).toBe(true);
    }
  });

  it("houdt de twee lijsten uit elkaar", () => {
    for (const actie of ADMIN_INHOUD_ACTIES) {
      expect(isAdminActie(actie)).toBe(false);
    }
    for (const actie of ADMIN_ACTIES) {
      expect(isInhoudActie(actie)).toBe(false);
    }
  });
});
