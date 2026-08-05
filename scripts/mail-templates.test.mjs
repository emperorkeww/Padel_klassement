// Controle op de auth-mailsjablonen in supabase/templates/ (#1037).
//
// De HTML in die map is de bron van waarheid voor wat Supabase verstuurt, maar
// niets in de app importeert hem — een fout valt dus niet vanzelf om. Deze test
// vangt de drie manieren waarop dat stilletjes misgaat:
//
//   1. een placeholder die wegvalt, waardoor de knop nergens heen leidt;
//   2. een externe verwijzing (CDN, webfont, script) die erin sluipt en door
//      mailclients geblokkeerd of gestript wordt;
//   3. een kleur die niet meer overeenkomt met de tokens in src/app/index.css,
//      bijvoorbeeld doordat iemand daar een token hernoemt of bijstelt.
//
// Draait mee in `npm test` via de scripts/**/*.test.mjs-include in vite.config.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Paden vanaf de projectroot: onder vitest is import.meta.url geen file-URL, dus
// new URL(..., import.meta.url) werkt hier niet zoals in contrast-check.mjs.
const lees = (pad) => readFileSync(join(process.cwd(), pad), "utf8");

const configToml = lees("supabase/config.toml");
const css = lees("src/app/index.css");

// Actiesjablonen: de gebruiker moet iets bevestigen, dus knop + ConfirmationURL.
// Gekoppeld via [auth.email.template.<sleutel>], met een pad vanaf de
// projectroot.
const ACTIE = {
  recovery: "wachtwoord-herstellen.html",
  confirmation: "bevestig-aanmelding.html",
  email_change: "bevestig-nieuw-adres.html",
  invite: "uitnodiging.html",
  magic_link: "inloglink.html",
};

// Notificatiesjablonen (#1037 deel 2): meldingen achteraf, er valt niets te
// bevestigen. Dus géén knop en géén ConfirmationURL. Gekoppeld via
// [auth.email.notification.<sleutel>] — let op: dát pad rekent Supabase
// relatief aan supabase/, niet aan de projectroot. Zie ook de vorm in
// config.toml; de CLI faalt hard op de verkeerde variant.
const NOTIFICATIE = {
  password_changed: "wachtwoord-gewijzigd.html",
  email_changed: "adres-gewijzigd.html",
};

const SJABLONEN = { ...ACTIE, ...NOTIFICATIE };
const BESTANDEN = Object.entries(SJABLONEN);
const ACTIE_BESTANDEN = Object.entries(ACTIE);
const NOTIFICATIE_BESTANDEN = Object.entries(NOTIFICATIE);

const html = Object.fromEntries(
  BESTANDEN.map(([sleutel, naam]) => [
    sleutel,
    lees(`supabase/templates/${naam}`),
  ]),
);

// Zinnen in mail-HTML lopen over meerdere regels; zoeken op letterlijke tekst
// zou dan omvallen op een herformattering in plaats van op een echte wijziging.
const platteTekst = (bron) => bron.replace(/\s+/g, " ");

// Toelichtend commentaar eruit vóór de kleurcheck: een issueverwijzing als
// #1037 leest anders als hexkleur. De mso-conditionals blijven staan — de
// VML-knop haalt zijn kleuren daaruit en hoort dus wél meegecontroleerd.
const zonderToelichting = (bron) => bron.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");

// Tokens uit het lichte thema, met dezelfde parse als scripts/contrast-check.mjs.
// Hernoemt of wijzigt iemand een token, dan valt deze test om in plaats van dat
// de mail stil van de huisstijl afdrijft.
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const tokens = Object.fromEntries(
  [...rootBlock.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
    m[1],
    m[2].trim().toLowerCase(),
  ]),
);

// De kleuren die een mailsjabloon mag gebruiken. Bewust een korte lijst: mail
// heeft geen thema-omschakeling, dus meer palet betekent alleen meer drift.
const TOEGESTANE_TOKENS = [
  "bg", // paginavlak achter de kaart
  "surface", // de kaart zelf
  "line", // haarlijnen en kaartrand
  "accent", // kopband, knop, links
  "accent-ink", // tekst op de kopband en de knop
  "ink", // lopende tekst
  "ink-soft", // voettekst en hulptekst
];

describe("auth-mailsjablonen", () => {
  it("kent alle gebruikte tokens (anders klopt de rest van deze test niet)", () => {
    for (const naam of TOEGESTANE_TOKENS) {
      expect(tokens[naam], `token --${naam} ontbreekt in src/app/index.css`).toMatch(
        /^#[0-9a-f]{3,8}$/,
      );
    }
  });

  it.each(ACTIE_BESTANDEN)("%s bevat de actielink twee keer: knop én platte tekst", (
    sleutel,
  ) => {
    const voorkomens = html[sleutel].match(/\{\{ \.ConfirmationURL \}\}/g) ?? [];
    // De knop, de href van de platte link en die link als zichtbare tekst.
    expect(voorkomens.length).toBeGreaterThanOrEqual(3);
    expect(platteTekst(html[sleutel])).toContain(
      "Werkt de knop niet? Kopieer dan deze link naar je browser",
    );
  });

  it.each(NOTIFICATIE_BESTANDEN)("%s is een melding, geen actie", (sleutel) => {
    // Zonder toelichting: het commentaar bovenaan noemt deze placeholders juist
    // om uit te leggen waarom ze er niet zijn.
    const bron = zonderToelichting(html[sleutel]);
    // Er valt niets te bevestigen, dus geen knop en geen actielink. Stond die
    // er wél, dan zou Supabase hem niet invullen — de notificatiesjablonen
    // krijgen die variabele niet mee en Go's html/template rendert een
    // onbekende variabele als "<no value>", zichtbaar in de mail.
    expect(bron).not.toContain("{{ .ConfirmationURL }}");
    expect(bron).not.toContain('bgcolor="#0c8a5f"');
    // Wél een weg terug voor wie de wijziging niet zelf deed: dat is het hele
    // bestaansrecht van deze twee mails.
    expect(bron).toContain("https://vamos-padel.net/login");
    expect(platteTekst(bron)).toMatch(/Was jij dit niet\?/);
  });

  it("bevestig-nieuw-adres benoemt het oude én het nieuwe adres", () => {
    expect(html.email_change).toContain("{{ .Email }}");
    expect(html.email_change).toContain("{{ .NewEmail }}");
  });

  it("adres-gewijzigd gebruikt de variabelen van de notificatiesjablonen", () => {
    // Notificaties krijgen andere variabelen dan actiesjablonen: hier
    // {{ .OldEmail }} en {{ .Email }} (afgelezen van het standaardsjabloon in
    // het gehoste project). {{ .NewEmail }} bestaat hier níét en zou als
    // "<no value>" in de mail belanden.
    const adres = zonderToelichting(html.email_changed);
    expect(adres).toContain("{{ .OldEmail }}");
    expect(adres).toContain("{{ .Email }}");
    expect(adres).not.toContain("{{ .NewEmail }}");
    // De wachtwoordmelding heeft bewust helemaal geen variabelen: welke daar
    // beschikbaar zijn kon niet geverifieerd worden, en fout gokken is zichtbaar.
    expect(zonderToelichting(html.password_changed)).not.toMatch(/\{\{/);
  });

  it.each(BESTANDEN)("%s heeft geen externe stylesheet, script of webfont", (
    sleutel,
  ) => {
    const bron = html[sleutel];
    expect(bron).not.toMatch(/<script/i);
    expect(bron).not.toMatch(/<link\b/i);
    expect(bron).not.toMatch(/@import/i);
    expect(bron).not.toMatch(/<style/i); // alle styling hoort inline
    expect(bron).not.toMatch(/@font-face/i);
    expect(bron).not.toMatch(/\bOutfit\b/); // self-hosted webfont, laadt niet in mail
  });

  it.each(BESTANDEN)("%s verwijst alleen naar ons eigen domein", (sleutel) => {
    const urls = html[sleutel].match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
    for (const url of urls) {
      expect(url, `onverwachte externe verwijzing: ${url}`).toMatch(
        /^https:\/\/vamos-padel\.net\//,
      );
    }
    // De afbeelding is een absolute https-URL: data-URI's worden door meerdere
    // clients gestript, en relatieve paden bestaan niet in een mail.
    expect(html[sleutel]).toContain("https://vamos-padel.net/mail-logo.png");
  });

  it.each(BESTANDEN)("%s gebruikt alleen kleuren uit de tokens", (sleutel) => {
    const toegestaan = new Set(TOEGESTANE_TOKENS.map((naam) => tokens[naam]));
    const kleuren = new Set(
      (zonderToelichting(html[sleutel]).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(
        (k) => k.toLowerCase(),
      ),
    );
    for (const kleur of kleuren) {
      expect(
        toegestaan.has(kleur),
        `${kleur} hoort bij geen van de tokens ${TOEGESTANE_TOKENS.map((t) => `--${t}`).join(", ")}`,
      ).toBe(true);
    }
  });

  it.each(BESTANDEN)("%s houdt de gedeelde romp aan", (sleutel) => {
    const bron = html[sleutel];
    // Supabase kent geen partials, dus de zeven bestanden zijn kopieën van
    // elkaar. Deze markers vangen af dat er eentje achterloopt.
    expect(bron).toMatch(/^<!doctype html>/i);
    expect(bron).toContain('<html lang="nl"');
    expect(bron).toContain('<meta name="color-scheme" content="light" />');
    expect(bron).toContain("max-width: 600px"); // één kolom op telefoonbreedte
    const tekst = platteTekst(bron);
    expect(tekst).toContain("Je krijgt deze mail omdat"); // waaróm hij aankomt
    expect(tekst).toContain("Vamos! · vamos-padel.net");
  });

  it.each(ACTIE_BESTANDEN)("%s stelt gerust wie hem niet aanvroeg", (sleutel) => {
    // Bij een actiemail is niets doen de juiste reactie; die zin is het verschil
    // tussen een mail die vertrouwd wordt en een die gemeld wordt. Bij de
    // notificaties klopt hij juist níet — daar moet je wél iets doen.
    expect(platteTekst(html[sleutel])).toContain("Dan kun je deze mail negeren");
  });

  // GoTrue rendert deze bestanden met Go's html/template, en dat pakket strippt
  // álle HTML-commentaar uit de uitvoer. Lokaal nagemeten in Mailpit: van een
  // <!--[if mso]>-blok komt niets aan. Een fallback die op een conditional
  // leunt is daardoor onzichtbaar stuk — de bron ziet er goed uit, de mail niet.
  // Vandaar: geen conditionals, en de knop is een tabel met bgcolor + padding,
  // wat Outlook zonder trucs rendert.
  it.each(BESTANDEN)("%s leunt nergens op een conditional comment", (sleutel) => {
    expect(html[sleutel]).not.toContain("[if ");
    expect(html[sleutel]).not.toContain("[endif]");
    expect(html[sleutel]).not.toContain("v:roundrect");
  });

  it.each(ACTIE_BESTANDEN)("%s heeft een knop die Outlook ook krijgt", (sleutel) => {
    // De <td> draagt de kleur en de padding, niet de <a>: Outlook negeert
    // padding op inline elementen, waardoor een gestylede <a> daar verschrompelt
    // tot gekleurde tekst zonder knopvlak.
    const knopTd = html[sleutel].match(
      /<td\s+align="center"\s+bgcolor="#0c8a5f"[\s\S]*?<\/td>/,
    );
    expect(knopTd, "knop-td met bgcolor niet gevonden").not.toBeNull();
    expect(knopTd[0]).toContain("padding: 14px 28px"); // ≥44px raakvlak
    expect(knopTd[0]).toContain("{{ .ConfirmationURL }}");
  });

  it("koppelt de actiesjablonen precies één keer in config.toml", () => {
    for (const [sleutel, naam] of ACTIE_BESTANDEN) {
      expect(configToml).toContain(`[auth.email.template.${sleutel}]`);
      const pad = `content_path = "./supabase/templates/${naam}"`;
      expect(configToml.split(pad).length - 1, `${naam} niet exact 1× gekoppeld`).toBe(
        1,
      );
    }
    // Andersom: geen enkel content_path mag naar een bestand wijzen dat we hier
    // niet kennen — anders staat er een sjabloon buiten het bereik van deze test.
    const gekoppeld = [
      ...configToml.matchAll(/^content_path = "\.\/supabase\/templates\/(.+)"$/gm),
    ].map((m) => m[1]);
    expect(gekoppeld.sort()).toEqual(Object.values(ACTIE).sort());
  });

  it("koppelt de notificatiesjablonen en zet ze aan", () => {
    for (const [sleutel, naam] of NOTIFICATIE_BESTANDEN) {
      const blok = configToml.match(
        new RegExp(`\\[auth\\.email\\.notification\\.${sleutel}\\]\\n([^[]*)`),
      );
      expect(blok, `blok voor ${sleutel} ontbreekt`).not.toBeNull();
      // Zonder enabled = true blijft Supabase de Engelse standaardmail sturen,
      // ook al staat het sjabloon er.
      expect(blok[1]).toContain("enabled = true");
      // Let op de padvorm: notificaties rekenen vanaf supabase/, de sjablonen
      // hierboven vanaf de projectroot. De CLI faalt hard op de verkeerde.
      expect(blok[1]).toContain(`content_path = "./templates/${naam}"`);
      expect(blok[1]).not.toContain('content_path = "./supabase/');
    }
  });

  it("geeft elk sjabloon een Nederlands onderwerp", () => {
    const onderwerpen = [
      ...configToml.matchAll(
        /\[auth\.email\.(?:template|notification)\.(\w+)\]\n(?:enabled = true\n)?subject = "([^"]+)"/g,
      ),
    ];
    expect(onderwerpen).toHaveLength(BESTANDEN.length);
    for (const [, , subject] of onderwerpen) {
      expect(subject.length).toBeGreaterThan(0);
      // De Engelse standaardonderwerpen van Supabase, als vangnet tegen een
      // half teruggedraaide wijziging. Afgelezen van wat er écht in het gehoste
      // project stond, niet uit de documentatie.
      expect(subject).not.toMatch(
        /^(Reset your password|Confirm your email address|Confirm your new email address|You've been invited|Your sign-in link|Your password was changed|Your email address was changed)$/i,
      );
    }
  });

  // Zonder [remotes.production] duwt `config push` de lokale waarden naar het
  // gehoste project: site_url naar localhost, de mail-rate-limit van 50 naar 2
  // en e-mailbevestiging uit. Die override is dus geen nettigheid maar de enige
  // rem. Er bestaat geen `config pull`, dus niets anders bewaakt dit.
  it("houdt de productie-overrides in config.toml", () => {
    const blok = configToml.slice(configToml.indexOf("[remotes.production]"));
    expect(blok, "[remotes.production] ontbreekt").not.toBe("");
    expect(blok).toContain('site_url = "https://vamos-padel.net"');
    expect(blok).toContain("email_sent = 50");
    expect(blok).toContain("enable_confirmations = true");
    expect(blok).toContain('sender_name = "Vamos!"');
    // De sleutel hoort nooit in de repo.
    expect(blok).toContain('pass = "env(RESEND_API_KEY)"');
    expect(configToml).not.toMatch(/re_[A-Za-z0-9_]{20,}/);
    // MFA staat in productie aan en lokaal uit; zonder deze override zet een
    // push hem uit en sluit dat gebruikers buiten die hem al gebruiken.
    expect(blok).toContain("[remotes.production.auth.mfa.totp]");
    expect(blok).toMatch(/enroll_enabled = true/);
  });
});
