## Wat verandert er

<!-- Korte beschrijving van de wijziging. -->

## Gekoppelde issues

<!--
  ⚠️ Branch-flow: GitHub sluit een issue alleen automatisch bij een merge naar
  de default branch `main`. Feature-PR's mergen naar `develop`, dus daar sluit
  `Closes #…` NIETS.

  • Feature-PR (→ develop): gebruik "Refs #…" zodat het issue gelinkt is maar
    open blijft.
  • Release-PR (develop → main): zet hier "Closes #…" voor ELK issue dat in deze
    release zit. Dan sluiten ze automatisch bij de merge naar `main`.
-->

Refs #…

## Checklist

- [ ] `npm run lint`, `npm run build` en `npm test` slagen lokaal
- [ ] Schema gewijzigd? → migration gegenereerd (`supabase db diff`) en pgTAP-tests bijgewerkt
- [ ] Getest op mobiel formaat (≤390px)
- [ ] Nieuwe teksten zijn Nederlands
- [ ] Release-PR (→ main)? → `Closes #…` staat hierboven voor elk meegeleverd issue
