import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { englishWorkTypes, locales } from "./locales.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = join(root, "dist");
const { profile, papers } = JSON.parse(await readFile(join(root, "research.json"), "utf8"));
const english = JSON.parse(await readFile(join(root, "research.en.json"), "utf8"));
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
const englishEvidence = { "Puni tekst": "Full text", "Sažetak": "Abstract" };
const pageIds = {
  hr: {
    content: "sadrzaj", areas: "istrazivanja", catalog: "radovi", sources: "izvori",
    areasHeading: "podrucja", catalogHeading: "katalog", sourcesHeading: "bibliografija",
  },
  en: {
    content: "content", areas: "research", catalog: "publications", sources: "sources",
    areasHeading: "areas-heading", catalogHeading: "catalog-heading", sourcesHeading: "sources-heading",
  },
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

function route(language, slug) {
  if (!slug) return language === "en" ? "/en" : "/";
  return language === "en" ? `/en/papers/${slug}` : `/radovi/${slug}`;
}

function translatePapers() {
  const translations = new Map(english.papers.map((paper) => [paper.slug, paper]));
  if (translations.size !== papers.length || english.papers.length !== papers.length) {
    throw new Error("Svaki rad mora imati jedan engleski prijevod.");
  }
  return papers.map((paper) => {
    const translated = translations.get(paper.slug);
    if (!translated?.title?.trim() || translated.findings.length !== paper.findings.length
        || (paper.scope && !translated.scope?.trim()) || !englishWorkTypes[paper.type]
        || !englishEvidence[paper.evidence]) {
      throw new Error(`Nedostaje engleski sadržaj za rad ${paper.slug}.`);
    }
    const findings = paper.findings.map((finding, index) => {
      const { question, answer, locator } = translated.findings[index];
      if (![question, answer, locator].every((value) => typeof value === "string" && value.trim())) {
        throw new Error(`Nepotpun engleski nalaz ${index + 1} za rad ${paper.slug}.`);
      }
      return { ...finding, question, answer, locator };
    });
    return {
      ...paper,
      originalTitle: paper.title,
      title: translated.title,
      scope: translated.scope,
      typeLabel: englishWorkTypes[paper.type],
      evidenceLabel: englishEvidence[paper.evidence],
      findings,
    };
  });
}

function translateProfile() {
  if (!english.profile.intro?.trim() || english.profile.areas.length !== profile.areas.length
      || english.profile.referenceLabels.length !== profile.references.length) {
    throw new Error("Nedostaje dio engleskog istraživačkog profila.");
  }
  return {
    ...profile,
    intro: english.profile.intro,
    areas: english.profile.areas,
    references: profile.references.map(([, url], index) => [english.profile.referenceLabels[index], url]),
  };
}

function doiUrl(paper) {
  return paper.doi ? `https://doi.org/${paper.doi}` : "";
}

function authorsText(paper, language) {
  return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(paper.authors);
}

function person(author) {
  const details = { "@type": "Person", name: author };
  if (author === name || author === "Karolina Krajček") {
    details.sameAs = "https://orcid.org/0000-0003-1403-428X";
    if (author === name) details.alternateName = "Karolina Krajček";
  }
  return details;
}

function page(locale, { title, description, slug, content, about }) {
  const { language } = locale;
  const ids = pageIds[language];
  const home = route(language);
  const other = language === "en" ? "hr" : "en";
  const canonical = origin ? origin + route(language, slug) : "";
  const alternates = canonical ? Object.keys(locales).map((lang) =>
    `<link rel="alternate" hreflang="${lang}" href="${escape(origin + route(lang, slug))}">`,
  ).join("\n  ") : "";
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    inLanguage: language,
    ...(canonical && { url: canonical }),
    about,
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  ${canonical ? `<link rel="canonical" href="${escape(canonical)}">` : ""}
  ${alternates}
  ${preview ? '<meta name="robots" content="noindex, follow">' : ""}
  <link rel="stylesheet" href="/site.css">
  <script type="application/ld+json">${schema}</script>
  <script src="${slug ? "/citation.js" : "/search.js"}" defer></script>
</head>
<body>
  <a class="skip-link" href="#${ids.content}">${locale.skip}</a>
  <header class="site-header">
    <div class="shell header-inner">
      <a class="brand" href="${home}">${escape(name)}</a>
      <nav class="site-nav" aria-label="${locale.navigation}">
        <a href="${home}#${ids.areas}">${locale.areas}</a>
        <a href="${home}#${ids.catalog}">${locale.catalog}</a>
        <a class="language-switch" href="${route(other, slug)}" hreflang="${other}" lang="${other}" aria-label="${locale.switchTitle}">${locale.switchLabel}</a>
      </nav>
    </div>
  </header>
  ${content}
  <footer class="site-footer">
    <div class="shell"><a href="${home}#${ids.sources}">${locale.sources}</a></div>
  </footer>
</body>
</html>
`;
}

function publicationCard(locale, paper) {
  const authors = authorsText(paper, locale.language);
  const type = paper.typeLabel || paper.type;
  const terms = [
    paper.year, paper.title, paper.originalTitle, authors, type, paper.venue, paper.doi,
    ...paper.findings.flatMap(({ question, answer }) => [question, answer]),
  ].join(" ");
  return `<li class="publication-card" data-publication data-year="${paper.year}" data-search="${escape(terms)}">
    <p class="publication-meta"><span>${paper.year}</span> <span>${escape(type)}</span></p>
    <h3><a href="${route(locale.language, paper.slug)}">${escape(paper.title)}</a></h3>
    <p class="publication-authors">${escape(authors)}</p>
    <ul class="publication-questions">
      ${paper.findings.map(({ question }) => `<li>${escape(question)}</li>`).join("\n      ")}
    </ul>
  </li>`;
}

function home(locale, catalog) {
  const ids = pageIds[locale.language];
  return page(locale, {
    title: `${name} | ${locale.homeTitle}`,
    description: catalog.profile.intro,
    about: person(name),
    content: `<main id="${ids.content}">
    <section class="hero" aria-labelledby="profil">
      <div class="shell hero-inner">
        <div class="hero-copy">
          <h1 id="profil">${escape(name)}</h1>
          <p class="hero-intro">${escape(catalog.profile.intro)}</p>
        </div>
      </div>
    </section>
    <section class="shell section" id="${ids.areas}" aria-labelledby="${ids.areasHeading}">
      <div class="section-heading"><h2 id="${ids.areasHeading}">${locale.areasHeading}</h2></div>
      <div class="areas-grid">
        ${catalog.profile.areas.map(({ title, question }) =>
          `<div class="area"><h3>${escape(title)}</h3><p>${escape(question)}</p></div>`,
        ).join("\n        ")}
      </div>
    </section>
    <section class="shell section publications" id="${ids.catalog}" aria-labelledby="${ids.catalogHeading}">
      <div class="section-heading">
        <h2 id="${ids.catalogHeading}">${locale.catalog}</h2>
        <p>${locale.catalogSummary(papers.length, answerCount)}</p>
      </div>
      <form class="catalog-tools" id="catalog-tools" role="search" aria-label="${locale.search}" hidden>
        <div>
          <label for="catalog-search">${locale.search}</label>
          <input type="search" id="catalog-search" placeholder="${locale.searchPlaceholder}" autocomplete="off">
        </div>
        <div>
          <label for="catalog-year">${locale.year}</label>
          <select id="catalog-year">
            <option value="">${locale.allYears}</option>
            ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
          </select>
        </div>
        <p class="catalog-count" id="catalog-count" role="status">${locale.count(papers.length)}</p>
      </form>
      <p class="catalog-empty" id="catalog-empty" hidden>${locale.empty}</p>
      <ul class="catalog-list">
        ${catalog.papers.map((paper) => publicationCard(locale, paper)).join("\n        ")}
      </ul>
    </section>
    <section class="shell section" id="${ids.sources}" aria-labelledby="${ids.sourcesHeading}">
      <div class="section-heading"><h2 id="${ids.sourcesHeading}">${locale.sources}</h2></div>
      <p>${locale.sourcesIntro}</p>
      <ul>${catalog.profile.references.map(([label, url]) =>
        `<li><a href="${escape(url)}">${escape(label)}</a></li>`,
      ).join("")}</ul>
    </section>
  </main>`,
  });
}

function paperPage(locale, paper) {
  const { language } = locale;
  const ids = pageIds[language];
  const originalDoi = doiUrl(paper);
  const originalTitle = paper.originalTitle || paper.title;
  const authors = authorsText(paper, language);
  const venue = language === "en" ? paper.venue.replace(/\bstr\./g, "pp.") : paper.venue;
  const citationTitle = /[.?!]$/.test(originalTitle) ? originalTitle : `${originalTitle}.`;
  const citation = `${paper.authors.join(", ")} (${paper.year}). ${citationTitle} ${venue.replace(/\.$/, "")}. ${originalDoi || paper.url}`;
  const [first] = paper.findings;
  const about = {
    "@type": workTypes[paper.type] || "ScholarlyArticle",
    name: originalTitle,
    author: paper.authors.map(person),
    url: originalDoi || paper.url,
    ...(originalDoi && {
      sameAs: originalDoi,
      identifier: { "@type": "PropertyValue", propertyID: "DOI", value: paper.doi },
    }),
  };
  return page(locale, {
    title: `${paper.title} | ${name}`,
    description: `${first.question} ${first.answer}`.slice(0, 290),
    slug: paper.slug,
    about,
    content: `<main id="${ids.content}" class="shell paper-main">
    <nav class="breadcrumbs" aria-label="${locale.breadcrumb}"><a href="${route(language)}#${ids.catalog}">${locale.allPapers}</a></nav>
    <article>
      <header class="paper-header">
        <p class="paper-meta">${paper.year} · ${escape(paper.typeLabel || paper.type)} · ${escape(paper.evidenceLabel || paper.evidence)}</p>
        <h1>${escape(paper.title)}</h1>
        ${originalTitle !== paper.title ? `<p class="paper-original-title">${locale.originalTitle} · <cite lang="hr">${escape(originalTitle)}</cite></p>` : ""}
        <p class="paper-authors">${escape(authors)}</p>
        <p class="paper-meta">${escape(venue)}</p>
        <div class="source-links">
          ${originalDoi ? `<a href="${escape(originalDoi)}" rel="cite">DOI ${escape(paper.doi)}</a>` : ""}
          <a href="${escape(paper.url)}" rel="cite">${paper.evidence === "Puni tekst" ? locale.fullSource : locale.abstractSource}</a>
        </div>
        <details class="citation">
          <summary>${locale.citation}</summary>
          <p class="citation-text" id="citation-text">${escape(citation)}</p>
          <button type="button" data-copy-citation hidden>${locale.copyCitation}</button>
          <p class="citation-status" role="status"></p>
        </details>
        ${paper.scope ? `<p class="scope-note">${escape(paper.scope)}</p>` : ""}
      </header>
      <div class="findings">
        ${paper.findings.map(({ question, answer, locator, url }, index) => `<section class="finding" id="${locale.findingId}-${index + 1}">
          <h2>${escape(question)}</h2>
          <p>${escape(answer)}</p>
          <p class="finding-source">${locale.source} <a href="${escape(url || paper.url)}" rel="cite">${escape(locator)}</a></p>
        </section>`).join("\n        ")}
      </div>
    </article>
  </main>`,
  });
}

async function writePage(path, content) {
  const file = join(output, path === "/" ? "index.html" : `${path.slice(1)}.html`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

checkContent();
const catalogs = {
  hr: { profile, papers },
  en: { profile: translateProfile(), papers: translatePapers() },
};
const urls = [];
await rm(output, { recursive: true, force: true });
await cp(join(root, "public"), output, { recursive: true });
for (const locale of Object.values(locales)) {
  const { language } = locale;
  const catalog = catalogs[language];
  const homePath = route(language);
  urls.push(homePath, ...catalog.papers.map((paper) => route(language, paper.slug)));
  await writePage(homePath, home(locale, catalog));
  await Promise.all(catalog.papers.map((paper) =>
    writePage(route(language, paper.slug), paperPage(locale, paper)),
  ));
}
if (origin) {
  await writeFile(join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${escape(origin + path)}</loc></url>`).join("\n")}
</urlset>
`);
}
await writeFile(join(output, "robots.txt"), `User-agent: *\nAllow: /\n${origin ? `\nSitemap: ${origin}/sitemap.xml\n` : ""}`);
console.log(`Izrađena ${urls.length} URL-a. ${papers.length} radova i ${answerCount} odgovora po jeziku.`);
