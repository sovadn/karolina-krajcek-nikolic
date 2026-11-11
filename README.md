# Karolina Krajček Nikolić

Istraživački profil s pregledom 35 radova i 89 pitanja s odgovorima. Podstranica svakog rada navodi bibliografske podatke, DOI kad postoji i mjesto provjere svakog odgovora. Sav sadržaj dostupan je u HTML-u, uključujući pregled radova i poveznice.

## Lokalni pregled

Uz Node.js 20 ili noviji pokreni:

```bash
npm run dev
```

Otvori http://localhost:4173. Za izradu samo statičkih datoteka pokreni `npm run build`. Izlaz je u `dist/`. Projekt nema vanjskih paketa ni tajnih ključeva.

## Objava na Vercelu

U Vercelu odaberi **Add New → Project** i uvezi ovaj GitHub repozitorij. `vercel.json` postavlja okvir **Other**, naredbu `npm run build` i izlazni direktorij `dist`. Pokreni **Deploy** kad želiš objaviti stranicu.

Na produkcijskom buildu generator preuzima domenu iz Vercelove varijable `VERCEL_PROJECT_PRODUCTION_URL` i dodaje kanonske URL-ove, `sitemap.xml` i njegovu adresu u `robots.txt`. Za vlastitu domenu po potrebi postavi `SITE_URL` na punu HTTPS adresu domene. Ako Vercelov projekt ne izlaže sistemske varijable, postavi `SITE_URL` ili omogući njihovo izlaganje.

## Uređivanje radova

Uvod, područja i pitanja nalaze se u `research.json`. Za svaki novi rad dodaj jedinstveni `slug`, bibliografske podatke i polje `findings`. Pitanje, odgovor i mjesto provjere obvezni su za svaki nalaz. Postojeći `slug` određuje javnu adresu rada.
