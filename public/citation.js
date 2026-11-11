const citation = document.querySelector('#citation-text');
const copyButton = document.querySelector('[data-copy-citation]');
const status = document.querySelector('.citation-status');

if (citation && copyButton && status && typeof navigator.clipboard?.writeText === 'function') {
  const english = document.documentElement.lang.toLowerCase().split('-')[0] === 'en';
  const messages = english
    ? { success: 'Citation copied.', failure: 'Copy failed. You can select and copy the citation text.' }
    : { success: 'Citat je kopiran.', failure: 'Kopiranje nije uspjelo. Citat možete kopirati ručno.' };

  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(citation.textContent.trim());
      status.textContent = messages.success;
    } catch {
      status.textContent = messages.failure;
    }
  });
}
