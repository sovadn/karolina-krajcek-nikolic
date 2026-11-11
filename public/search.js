const tools = document.querySelector('#catalog-tools');

if (tools) {
  const language = document.documentElement.lang.toLowerCase().split('-')[0] === 'en' ? 'en' : 'hr';
  const search = document.querySelector('#catalog-search');
  const year = document.querySelector('#catalog-year');
  const count = document.querySelector('#catalog-count');
  const empty = document.querySelector('#catalog-empty');
  const entries = [...document.querySelectorAll('[data-publication]')].map((element) => ({
    element,
    text: normalize(element.dataset.search ?? element.textContent),
    year: element.dataset.year,
  }));

  function normalize(value) {
    return value
      .toLocaleLowerCase(language)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function update() {
    const terms = normalize(search.value).split(' ').filter(Boolean);
    const selectedYear = year.value;
    let visibleCount = 0;

    for (const entry of entries) {
      const matchesYear = !selectedYear || selectedYear === 'all' || selectedYear === entry.year;
      const isVisible = matchesYear && terms.every((term) => entry.text.includes(term));
      entry.element.hidden = !isVisible;
      visibleCount += Number(isVisible);
    }

    count.textContent = language === 'en'
      ? `Showing ${visibleCount} of ${entries.length} publications.`
      : `Prikazano ${visibleCount} od ${entries.length} radova.`;
    empty.hidden = visibleCount > 0;
  }

  tools.addEventListener('submit', (event) => {
    event.preventDefault();
    update();
  });
  search.addEventListener('input', update);
  search.addEventListener('search', update);
  year.addEventListener('change', update);
  update();
  tools.hidden = false;
}
