# 🎾 Concrete Verrijkingsvoorstellen voor Padel Klassement

Na een grondige inspectie van de codebase (waarin al prachtige systemen voor Elo, notificaties, speelpolls en Coach Rudy-roasts aanwezig zijn) zijn hier vier concrete features uitgewerkt die de webapp oprecht verrijken. Deze features versterken de sociale dynamiek en de competitie binnen vriendengroepen.

---

## 1. ⚔️ Speler Duel & Vergelijker (Head-to-Head Dashboard)
### Wat is het?
Een interactieve bottom-sheet of pagina waarin spelers hun statistieken rechtstreeks naast elkaar kunnen leggen. Dit kan direct worden geopend vanaf een spelersprofiel via een nieuwe knop: **"⚔️ Vergelijk met mij"**.

### Functionaliteiten:
* **Interactieve Selectie:** Toont standaard de ingelogde gebruiker vs. de bekeken speler, maar laat de gebruiker via een dropdown eenvoudig elke andere speler uit de groep kiezen.
* **Side-by-Side Statistieken:** Visuele vergelijking van:
  - Elo rating (inclusief Tier Badges, waarbij de hogere rating oplicht).
  - Klassementpositie, totaal verdiende punten en gespeelde wedstrijden.
  - Huidige vormreeks (bijv. `🔥 3W` vs. `📉 2L`) en aantal verdiende badges.
* **Onderlinge Balans:**
  - **Als Tegenstanders:** Aantal onderlinge duels, gewonnen/verloren/gelijk verhouding met een gekleurde ratio-balk.
  - **Als Partners:** Aantal keer samen gespeeld en de gezamenlijke winrate.
* **Gezamenlijke Match-historie:** Een chronologische lijst van de laatste 10 wedstrijden waarin beide spelers op de baan stonden (als rivalen of als duo) inclusief setstanden.

> [!TIP]
> **Sociale waarde:** Dit lost direct discussies in de groepsapp op over "wie er nu echt de overhand heeft" en wakkert de rivaliteit aan.

---

## 2. 🏆 Live Americano & Mexicano Toernooiplanner
### Wat is het?
De app heeft al basis-algoritmes voor Americano en Mexicano, maar deze zijn nu statisch. Dit voorstel integreert een live toernooimodus binnen groepen.

### Functionaliteiten:
* **Live Toernooischema:** Genereer rondes waarbij spelers automatisch van partners en tegenstanders wisselen.
* **Mexicano Dynamiek:** Automatische scheduling voor volgende rondes op basis van de actuele stand (leiders spelen tegen leiders, achterblijvers tegen achterblijvers).
* **Direct Score Loggen:** Spelers voeren ter plekke setpunten in (bijv. 15-9), waarna de toernooistand live herrekent.
* **Rudy's Toernooicommentaar:** Coach Rudy die na elke ronde de stand roast of prijst in de groepsfeed.

> [!IMPORTANT]
> **Sociale waarde:** Americano/Mexicano is dé manier waarop vriendengroepen padelavonden organiseren. Een soepele in-app tracker maakt pen-en-papier of externe toernooisites overbodig.

---

## 3. 📈 Geavanceerde Trends & Partner-synergie
### Wat is het?
Een uitbreiding van het tabblad **Statistieken** op het spelersprofiel dat dieper graaft in patronen en data-analyse.

### Functionaliteiten:
* **Partner-synergie Matrix:** Een tabel die de winrate toont per partner-combinatie. Dit onthult direct je "Dream Team" (hoogste winrate) en je "Choke Combo" (laagste winrate).
* **Baan- & Tijdvoorkeuren:** Statistieken over of je beter presteert op specifieke baantypes (zoals panoramabanden) of tijdstippen (bijv. "Avondkracht" vs. "Ochtenddip").
* **Milestone Chronologie:** Een tijdlijn met historische mijlpalen (bijv. *"1200 Elo behaald op 12 Juni"*, *"Big Daddy geworden op 1 Juli"*).

---

## 4. 🔮 Dynamische Toto Standings & Coach Rudy Tips
### Wat is het?
Een verrijking van het huidige Toto-voorspellingssysteem om de betrokkenheid rondom geplande wedstrijden te vergroten.

### Functionaliteiten:
* **Toto Streaks:** Volg wie de langste reeks correcte voorspellingen heeft.
* **Coach Rudy's Toto-advies:** Rudy die cynische tips geeft bij het invullen van je voorspelling (bijv. *"Speler A heeft al 4 matches op rij verloren, voorspellen dat zij winnen is een vorm van blind optimisme"*).
* **Ludieke Toto Badges:** Badges zoals *"Master Predictor"* (voor 80%+ correct) of *"Valse Profeet"* (altijd fout voorspellen).
