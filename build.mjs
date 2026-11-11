import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = join(root, "dist");
const { profile, papers } = JSON.parse(await readFile(join(root, "research.json"), "utf8"));
const { name } = profile;
const origin = productionOrigin();
const preview = process.env.VERCEL_ENV === "preview";
const years = [...new Set(papers.map(({ year }) => year))].sort((a, b) => b - a);
const answerCount = papers.reduce((total, paper) => total + paper.findings.length, 0);
const workTypes = {
  "Diplomski rad": "Thesis",
  "Doktorska disertacija": "Thesis",
  "Konferencijsko izlaganje sa sažetkom": "CreativeWork",
  "Nastavna zbirka": "Book",
  "Tehničko izvješće": "Report",
  "Terminološki rječnik": "Book",
};

function productionOrigin() {
  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const configured = process.env.SITE_URL || (domain && `https://${domain}`);
  if (!configured) return "";
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_URL mora biti HTTPS adresa domene bez putanje.");
  }
  return url.origin;
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function assertPublicLink(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`Nevaljana javna poveznica: ${value}`);
  }
}

function checkContent() {
  const slugs = new Set();
  for (const [label, url] of profile.references) {
    if (!label) throw new Error("Nedostaje naziv bibliografskog izvora.");
    assertPublicLink(url);
  }
  for (const paper of papers) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(paper.slug) || slugs.has(paper.slug)) {
      throw new Error(`Nevaljana ili ponovljena putanja: ${paper.slug}`);
    }
    slugs.add(paper.slug);
    if (!paper.title || !paper.authors.length || !Number.isInteger(paper.year)
        || !paper.type || !paper.venue || !paper.evidence || !paper.findings.length) {
      throw new Error(`Nedostaju podaci za rad ${paper.slug}.`);
    }
    if (paper.doi && !/^10\.\d{4,9}\/\S+$/.test(paper.doi)) {
      throw new Error(`Nevaljan DOI za ${paper.slug}.`);
    }
    assertPublicLink(paper.url);
    for (const finding of paper.findings) {
      if (!finding.question || !finding.answer || !finding.locator) {
        throw new Error(`Nedostaje pitanje, odgovor ili mjesto provjere u radu ${paper.slug}.`);
      }
      assertPublicLink(finding.url || paper.url);
    }
  }
}

function paperPath(paper) {
  return `/radovi/${paper.slug}`;
}

function doiUrl(paper) {
  return paper.doi ? `https://doi.org/${paper.doi}` : "";
}

function authorsText(paper) {
  return new Intl.ListFormat("hr", { style: "long", type: "conjunction" }).format(paper.authors);
}

function person(author) {
  const details = { "@type": "Person", name: author };
  if (author === name || author === "Karolina Krajček") {
    details.sameAs = "https://orcid.org/0000-0003-1403-428X";
    if (author === name) details.alternateName = "Karolina Krajček";
  }
  return details;
}

function page({ title, description, path, content, about, search = false }) {
  const canonical = origin ? `${origin}${path}` : "";
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    inLanguage: "hr",
    ...(canonical && { url: canonical }),
    about,
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  ${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ""}
  ${preview ? '<meta name="robots" content="noindex, follow">' : ""}
  <link rel="stylesheet" href="/site.css">
  <script type="application/ld+json">${schema}</script>
  ${search ? '<script src="/search.js" defer></script>' : ""}
</head>
<body>
  <a class="skip-link" href="#sadrzaj">Preskoči na sadržaj</a>
  <header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="/">${escape(name)}</a>
      <nav class="site-nav" aria-label="Glavna navigacija">
        <a href="/#istrazivanja">Istraživanja</a>
        <a href="/#radovi">Radovi</a>
      </nav>
    </div>
  </header>
  ${content}
  <footer class="site-footer">
    <div class="shell"><a href="/#izvori">Bibliografski izvori</a></div>
  </footer>
</body>
</html>
`;
}

function publicationCard(paper) {
  const terms = [
    paper.year, paper.title, authorsText(paper), paper.type, paper.venue, paper.doi,
    ...paper.findings.flatMap(({ question, answer }) => [question, answer]),
  ].join(" ");
  return `<li class="publication-card" data-publication data-year="${paper.year}" data-search="${escape(terms)}">
    <p class="publication-meta"><span>${paper.year}</span> <span>${escape(paper.type)}</span></p>
    <h3><a href="${paperPath(paper)}">${escape(paper.title)}</a></h3>
    <p class="publication-authors">${escape(authorsText(paper))}</p>
    <ul class="publication-questions">
      ${paper.findings.map(({ question }) => `<li>${escape(question)}</li>`).join("\n      ")}
    </ul>
  </li>`;
}

function home() {
  return page({
    title: `${name} | Istraživanja i radovi`,
    description: profile.intro,
    path: "/",
    search: true,
    about: person(name),
    content: `<main id="sadrzaj">
    <section class="hero" aria-labelledby="profil">
      <div class="shell hero-inner">
        <div class="hero-copy">
          <h1 id="profil">${escape(name)}</h1>
          <p class="hero-intro">${escape(profile.intro)}</p>
        </div>
      </div>
    </section>
    <section class="shell section" id="istrazivanja" aria-labelledby="podrucja">
      <div class="section-heading"><h2 id="podrucja">Istraživačka područja i pitanja</h2></div>
      <div class="areas-grid">
        ${profile.areas.map(({ title, question }) =>
          `<div class="area"><h3>${escape(title)}</h3><p>${escape(question)}</p></div>`,
        ).join("\n        ")}
      </div>
    </section>
    <section class="shell section publications" id="radovi" aria-labelledby="katalog">
      <div class="section-heading">
        <h2 id="katalog">Radovi</h2>
        <p>${papers.length} radova i ${answerCount} pitanja s odgovorima i izvorima.</p>
      </div>
      <form class="catalog-tools" id="catalog-tools" role="search" aria-label="Pretraži radove" hidden>
        <div>
          <label for="catalog-search">Pretraži radove</label>
          <input type="search" id="catalog-search" placeholder="Naslov, autor, tema ili DOI" autocomplete="off">
        </div>
        <div>
          <label for="catalog-year">Godina</label>
          <select id="catalog-year">
            <option value="">Sve godine</option>
            ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
          </select>
        </div>
        <p class="catalog-count" id="catalog-count" role="status">${papers.length} radova</p>
      </form>
      <p class="catalog-empty" id="catalog-empty" hidden>Nema radova za unesene filtre.</p>
      <ul class="catalog-list">
        ${papers.map(publicationCard).join("\n        ")}
      </ul>
    </section>
    <section class="shell section" id="izvori" aria-labelledby="bibliografija">
      <div class="section-heading"><h2 id="bibliografija">Bibliografski izvori</h2></div>
      <p>Uz svaki rad navedeno je temelji li se pregled na punom tekstu ili sažetku.</p>
      <ul>${profile.references.map(([label, url]) =>
        `<li><a href="${escape(url)}">${escape(label)}</a></li>`,
      ).join("")}</ul>
    </section>
  </main>`,
  });
}

function paperPage(paper) {
  const originalDoi = doiUrl(paper);
  const [first] = paper.findings;
  const about = {
    "@type": workTypes[paper.type] || "ScholarlyArticle",
    name: paper.title,
    author: paper.authors.map(person),
    url: originalDoi || paper.url,
    ...(originalDoi && {
      sameAs: originalDoi,
      identifier: { "@type": "PropertyValue", propertyID: "DOI", value: paper.doi },
    }),
  };
  return page({
    title: `${paper.title} | ${name}`,
    description: `${first.question} ${first.answer}`.slice(0, 290),
    path: paperPath(paper),
    about,
    content: `<main id="sadrzaj" class="shell paper-main">
    <nav class="breadcrumbs" aria-label="Putanja stranice"><a href="/#radovi">Svi radovi</a></nav>
    <article>
      <header class="paper-header">
        <p class="paper-meta">${paper.year} · ${escape(paper.type)} · ${escape(paper.evidence)}</p>
        <h1>${escape(paper.title)}</h1>
        <p class="paper-authors">${escape(authorsText(paper))}</p>
        <p class="paper-meta">${escape(paper.venue)}</p>
        <div class="source-links">
          ${originalDoi ? `<a href="${escape(originalDoi)}" rel="cite">DOI ${escape(paper.doi)}</a>` : ""}
          <a href="${escape(paper.url)}" rel="cite">${paper.evidence === "Puni tekst" ? "Puni tekst ili zapis izdavača" : "Sažetak ili bibliografski zapis"}</a>
        </div>
        ${paper.scope ? `<p class="scope-note">${escape(paper.scope)}</p>` : ""}
      </header>
      <div class="findings">
        ${paper.findings.map(({ question, answer, locator, url }, index) => `<section class="finding" id="pitanje-${index + 1}">
          <h2>${escape(question)}</h2>
          <p>${escape(answer)}</p>
          <p class="finding-source">U izvoru <a href="${escape(url || paper.url)}" rel="cite">${escape(locator)}</a></p>
        </section>`).join("\n        ")}
      </div>
    </article>
  </main>`,
  });
}

checkContent();
await rm(output, { recursive: true, force: true });
await mkdir(join(output, "radovi"), { recursive: true });
await cp(join(root, "public"), output, { recursive: true });
await writeFile(join(output, "index.html"), home());
await Promise.all(papers.map((paper) =>
  writeFile(join(output, "radovi", `${paper.slug}.html`), paperPage(paper)),
));
if (origin) {
  const urls = ["/", ...papers.map(paperPath)];
  await writeFile(join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${escape(origin + path)}</loc></url>`).join("\n")}
</urlset>
`);
}
await writeFile(join(output, "robots.txt"), `User-agent: *\nAllow: /\n${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ""}`);
console.log(`Izrađeno ${papers.length} stranica radova i ${answerCount} odgovora.`);
