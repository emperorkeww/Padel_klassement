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

// De sjablonen zoals ze in config.toml gekoppeld horen te zijn: sleutel ->
// bestandsnaam. Nieuwe sjablonen moeten hier ook bij, anders zegt test 6 er wat van.
const SJABLONEN = {
  recovery: "wachtwoord-herstellen.html",
  confirmation: "bevestig-aanmelding.html",
  email_change: "bevestig-nieuw-adres.html",
  invite: "uitnodiging.html",
  magic_link: "inloglink.html",
};

const BESTANDEN = Object.entries(SJABLONEN);

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

  it.each(BESTANDEN)("%s bevat de actielink twee keer: knop én platte tekst", (
    sleutel,
  ) => {
    const voorkomens = html[sleutel].match(/\{\{ \.ConfirmationURL \}\}/g) ?? [];
    // De knop, de href van de platte link en die link als zichtbare tekst.
    expect(voorkomens.length).toBeGreaterThanOrEqual(3);
    expect(platteTekst(html[sleutel])).toContain(
      "Werkt de knop niet? Kopieer dan deze link naar je browser",
    );
  });

  it("bevestig-nieuw-adres benoemt het oude én het nieuwe adres", () => {
    expect(html.email_change).toContain("{{ .Email }}");
    expect(html.email_change).toContain("{{ .NewEmail }}");
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
    // Supabase kent geen partials, dus de vijf bestanden zijn kopieën van
    // elkaar. Deze markers vangen af dat er eentje achterloopt.
    expect(bron).toMatch(/^<!doctype html>/i);
    expect(bron).toContain('<html lang="nl"');
    expect(bron).toContain('<meta name="color-scheme" content="light" />');
    expect(bron).toContain("max-width: 600px"); // één kolom op telefoonbreedte
    expect(bron).toContain('bgcolor="#0c8a5f"'); // knop-td, ook voor Outlook
    const tekst = platteTekst(bron);
    expect(tekst).toContain("Dan kun je deze mail negeren"); // de geruststelling
    expect(tekst).toContain("Je krijgt deze mail omdat"); // waaróm hij aankomt
    expect(tekst).toContain("Vamos! · vamos-padel.net");
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

  it.each(BESTANDEN)("%s heeft een knop die Outlook ook krijgt", (sleutel) => {
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

  it("koppelt elk sjabloon precies één keer in config.toml", () => {
    for (const [sleutel, naam] of BESTANDEN) {
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
    expect(gekoppeld.sort()).toEqual(Object.values(SJABLONEN).sort());
  });

  it("geeft elk sjabloon een Nederlands onderwerp", () => {
    const onderwerpen = [
      ...configToml.matchAll(
        /\[auth\.email\.template\.(\w+)\]\nsubject = "([^"]+)"/g,
      ),
    ];
    expect(onderwerpen).toHaveLength(BESTANDEN.length);
    for (const [, , subject] of onderwerpen) {
      expect(subject.length).toBeGreaterThan(0);
      // De Engelse standaardonderwerpen van Supabase, als vangnet tegen een
      // half teruggedraaide wijziging.
      expect(subject).not.toMatch(
        /^(Reset Password|Confirm Your Signup|Confirm Email Change|You have been invited|Your Magic Link)$/i,
      );
    }
  });
});
