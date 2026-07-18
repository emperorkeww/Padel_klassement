# 🎾 Concrete Verrijkingsvoorstellen voor Padel Klassement

Na een grondige inspectie van de codebase (waarin al prachtige systemen voor Elo, notificaties, speelpolls en Coach Rudy-roasts aanwezig zijn) zijn hier in totaal acht concrete features uitgewerkt die de webapp oprecht verrijken. Deze features versterken de sociale dynamiek, gamificatie en de competitie binnen vriendengroepen.

---

## 1. ⚔️ Speler Duel & Vergelijker (Head-to-Head Dashboard)
### Wat is het?
Een interactieve bottom-sheet of pagina waarin spelers hun statistieken rechtstreeks naast elkaar kunnen leggen. Dit kan direct worden geopend vanaf een spelersprofiel via een nieuwe knop: **"⚔️ Vergelijk met mij"**.

### Functionaliteiten:
* **Interactieve Selectie:** Toont standaard de ingelogde gebruiker vs. de bekeken speler, maar laat de gebruiker via een dropdown eenvoudig elke andere speler uit de groep kiezen.
* **Side-by-Side Statistieken:** Visuele vergelijking van Elo rating (inclusief Tier Badges), klassementpositie, totaal verdiende punten en gespeelde wedstrijden.
* **Onderlinge Balans:**
  - *Als Tegenstanders:* Aantal onderlinge duels, gewonnen/verloren/gelijk verhouding met een gekleurde ratio-balk.
  - *Als Partners:* Aantal keer samen gespeeld en de gezamenlijke winrate.
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
* **Ludieke Toto Badges:** Badges zoals *"Master Predictor"* (voor 80%+ correct) of *"Valse Profeet"* (alleen maar fout voorspellen).

---

## 5. 📊 Padel Paspoort & Spelers-Archetypes (FIFA-stijl Spelerskaart)
### Wat is het?
Een visuele spelerskaart op het profiel dat de speelstijl en sterke punten van de speler samenvat op basis van zijn match-historie.

### Functionaliteiten:
* **Radar Chart (Sterkte/Zwakte):** Een radarchart met vijf assen: *Consistentie*, *Aanvalskracht*, *Defensie*, *Clutch* (winstpercentage van Golden Points), en *Activiteit*.
* **Deterministische Spelers-Archetypes:** Rudy kent een archetype toe op basis van statistieken:
  - *De Marathonman:* Veel gespeelde matches, lange wedstrijden.
  - *Het Golden Boy:* Clutch winrate op Golden Points > 70%.
  - *De Lift-Speler:* Rating die constant hevig stijgt en daalt.
  - *De Schaduwheerser:* Hoge winrate maar lage absolute marge.
* **Rudy's Paspoort Rating:** Rudy geeft je speelstijl een cynische rating out of 10.

---

## 6. 🏆 Dynamische Seizoensafsluiting & Hall of Fame
### Wat is het?
Elk kwartaal eindigt er een seizoen in de app, maar momenteel is de overgang vrij geruisloos. Deze feature maakt van de seizoenswisseling een sociaal event.

### Functionaliteiten:
* **Hall of Fame:** Een permanente pagina binnen groepen met historische seizoenswinnaars (Big Daddies), de Pias van dat seizoen en memorabele records.
* **Quarterly Wrapped:** Een swipebaar seizoensoverzicht (Lente/Zomer/Herfst/Winter Wrapped) met seizoensspecifieke stats (bijv. *"Je favoriete slachtoffer van dit seizoen"*).
* **Virtuele Medaille-uitreiking:** Deelbare posters voor groepsapps met awards zoals *"Beste Aanvaller"*, *"Koning van het Golden Point"* en *"Grootste Comeback van het Seizoen"*.

---

## 7. 📅 "Speler Gezocht" (Matchmaking-buddyzoeker) & Kalendersync
### Wat is het?
Een logistieke tool om het plannen van wedstrijden soepeler te maken als je net één of twee spelers tekortkomt.

### Functionaliteiten:
* **Matchmaking Alerts:** Flag een geplande match als *"Speler Gezocht"*. Dit stuurt direct een pushnotificatie naar groepsleden of vrienden die die dag als "beschikbaar" staan gemarkeerd.
* **Agenda Export (.ics):** Exporteer geplande wedstrijden direct naar Apple Calendar, Google Calendar of Outlook.
* **Tarieven & Splitsing:** Toont de baanhuur (opgehaald uit Playtomic) en berekent automatisch de prijs per persoon inclusief een Tikkie/betaallink-generator.

---

## 8. 🧱 "De Muur der Smoesjes" (Excuse-ranking)
### Wat is het?
Er is al een tabel en invoer voor smoesjes (`match_smoesjes`). Deze feature maakt hier een interactief en sociaal element van binnen de groep.

### Functionaliteiten:
* **Sociale Excuse Wall:** Een overzichtstabel met alle excuses die spelers hebben opgegeven na een verliespartij.
* **Stemmen op Creativiteit:** Groepsleden kunnen stemmen op excuses (bijv. *"Meest legitiem"* vs. *"Meest triest"*).
* **Rudy's Beoordeling:** Rudy die automatisch een cijfer plakt op je excuus (bijv. *"Racketspanning niet goed: 2/10. Rudy zegt: Leer gewoon de bal te raken"*).
* **Excuus Badges:** Badges zoals *"Excuuskoning"* (10+ smoesjes ingediend) of *"Stille Lijer"* (verliest altijd zonder excuses op te geven).
