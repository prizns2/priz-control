(() => {
  const SEARCH_PLACEHOLDER = 'Поиск: магазин, продавец...';
  const SEARCH_TITLE = 'Поиск по магазину, продавцу, менеджеру и оператору';

  // Не показываем старую надпись «фабула» даже на один кадр.
  const style = document.createElement('style');
  style.id = 'prizTerminologyStyles';
  style.textContent = `
    #content #q:not([data-priz-wording-ready="1"]) {
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);

  function replaceUiText(value) {
    let s = String(value ?? '');

    s = s
      .replace(/Сотрудник\s*\/\s*продавец/g, 'Продавец')
      .replace(/СОТРУДНИК\s*\/\s*ПРОДАВЕЦ/g, 'ПРОДАВЕЦ')
      .replace(/Сотрудник(?=\s*:|\s*$)/g, 'Продавец')
      .replace(/СОТРУДНИК(?=\s*:|\s*$)/g, 'ПРОДАВЕЦ')
      .replace(/Автор(?=\s*:|\s*$)/g, 'Оператор')
      .replace(/АВТОР(?=\s*:|\s*$)/g, 'ОПЕРАТОР');

    return s;
  }

  function prepareSearch(input) {
    if (!input || input.id !== 'q') return;
    if (input.placeholder !== SEARCH_PLACEHOLDER) input.placeholder = SEARCH_PLACEHOLDER;
    if (input.title !== SEARCH_TITLE) input.title = SEARCH_TITLE;
    input.dataset.prizWordingReady = '1';
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return;

    const raw = node.nodeValue || '';
    const trimmed = raw.trim();

    const isUiLabel =
      trimmed === 'Автор' ||
      trimmed === 'АВТОР' ||
      trimmed === 'Сотрудник' ||
      trimmed === 'СОТРУДНИК' ||
      trimmed === 'Сотрудник / продавец' ||
      trimmed === 'СОТРУДНИК / ПРОДАВЕЦ' ||
      /(^|·\s*)Автор\s*:/.test(trimmed) ||
      /(^|·\s*)АВТОР\s*:/.test(trimmed) ||
      /^Сотрудник\s*:/.test(trimmed) ||
      /^СОТРУДНИК\s*:/.test(trimmed);

    if (!isUiLabel) return;

    const next = replaceUiText(raw);
    if (next !== raw) node.nodeValue = next;
  }

  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    prepareSearch(el);

    for (const attr of ['placeholder', 'title', 'aria-label']) {
      if (!el.hasAttribute(attr)) continue;

      const current = el.getAttribute(attr) || '';
      let next = replaceUiText(current);

      if (attr === 'placeholder') {
        next = next
          .replace(/Поиск:\s*магазин,\s*фабула,?\s*продавец/gi, 'Поиск: магазин, продавец')
          .replace(/магазин,\s*фабула/gi, 'магазин');
      }

      if (next !== current) el.setAttribute(attr, next);
    }

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) processTextNode(node);

    // Если за один раз вставили целую панель с поиском внутри.
    const nestedSearch = el.querySelector?.('#q');
    if (nestedSearch) prepareSearch(nestedSearch);
  }

  function apply(root = document.body) {
    if (!root) return;

    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }

    processElement(root);
  }

  function start() {
    apply(document.body);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          processTextNode(mutation.target);
          continue;
        }

        if (mutation.type === 'attributes') {
          processElement(mutation.target);
          continue;
        }

        for (const node of mutation.addedNodes) apply(node);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
