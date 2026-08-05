import { describe, expect, it } from "vitest";
import { ADMIN_ACTIES, bepaalToegang, isAdminActie } from "./adminAuth.ts";

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

describe("isAdminActie", () => {
  it("herkent enkel de acties uit de lijst", () => {
    expect(isAdminActie("whoami")).toBe(true);
    expect(isAdminActie("list_users")).toBe(true);
    expect(isAdminActie("Whoami")).toBe(false);
    expect(isAdminActie("")).toBe(false);
    expect(isAdminActie(undefined)).toBe(false);
  });
});
