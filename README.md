# Karolina Krajček Nikolić

Istraživački profil s pregledom 35 radova i 89 pitanja s odgovorima na hrvatskom i engleskom. Podstranica svakog rada navodi bibliografske podatke, DOI kad postoji i mjesto provjere svakog odgovora. Pitanja, odgovori i bibliografski navodi dostupni su u statičkom HTML-u.

## Lokalni pregled

Uz Node.js 20 ili noviji pokreni:

```bash
npm run dev
```

Otvori http://localhost:4173. Za izradu samo statičkih datoteka pokreni `npm run build`. Izlaz je u `dist/`. Projekt nema vanjskih paketa ni tajnih ključeva.

## Objava na Vercelu

U Vercelu odaberi **Add New → Project** i uvezi ovaj GitHub repozitorij. `vercel.json` postavlja okvir **Other**, naredbu `npm run build` i izlazni direktorij `dist`. Pokreni **Deploy** kad želiš objaviti stranicu.

Na produkcijskom buildu generator preuzima domenu iz Vercelove varijable `VERCEL_PROJECT_PRODUCTION_URL` i dodaje kanonske URL-ove, uzajamne `hreflang` poveznice za oba jezika te `sitemap.xml` s oba skupa URL-ova. Adresa sitemapa navedena je u `robots.txt`. Za vlastitu domenu po potrebi postavi `SITE_URL` na punu HTTPS adresu domene. Ako Vercelov projekt ne izlaže sistemske varijable, postavi `SITE_URL` ili omogući njihovo izlaganje.

Nakon objave otvori `/sitemap.xml` na javnoj produkcijskoj domeni i provjeri koristi li tu domenu za sve URL-ove. Sitemap možeš predati u [Google Search Consoleu](https://search.google.com/search-console/) i [Bing Webmaster Toolsu](https://www.bing.com/webmasters/).

## Uređivanje radova

Bibliografski podaci i hrvatski sadržaj nalaze se u `research.json`, a engleski prijevod u `research.en.json`. Za svaki novi rad dodaj jedinstveni `slug`, bibliografske podatke i polje `findings`. U engleski zapis s istim identifikatorom unesi prijevod nalaza istim redoslijedom. Obje verzije koriste isti DOI i poveznice na izvore. Postojeći `slug` određuje javnu adresu rada.
