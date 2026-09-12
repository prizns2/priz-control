(() => {
  const SEARCH_PLACEHOLDER = 'Поиск: магазин, продавец...';
  const SEARCH_TITLE = 'Поиск по магазину, продавцу, менеджеру и оператору';

  const REMOVE_EXACT = new Set([
    'Режим руководителя: просмотр записей, медиа и истории без возможности редактирования.',
    'Категория 1 + Категория 2',
    'Показываются только реальные изменения и удаления записей.',
    'Нарушение, фабула, ущерб, возмещение, фото и видео.',
    'Операционные нарушения с отдельным справочником типов.',
    '5 критериев: только 0 или 2 балла.',
    'Можно заполнять и исправлять отметки.',
    'Режим просмотра. Изменение табеля недоступно.',
    'Здесь видны ваши заявки и их текущий статус.',
    'Согласуйте или отклоните заявки старших операторов.',
    'Удаление доступно только после согласования руководителем.',
    'После согласования заявка автоматически перейдёт Owner для окончательного удаления.',
    'Цепочка: старший оператор → руководитель → Owner.'
  ]);

  const REMOVE_PREFIXES = ['Быстрый ввод:'];

  const style = document.createElement('style');
  style.id = 'prizTerminologyStyles';
  style.textContent = `
    #content #q:not([data-priz-wording-ready="1"]) {
      visibility: hidden !important;
    }

    .attendance-fast-hint {
      display: none !important;
    }

    /* Убираем служебные подсказки формы без ожидания MutationObserver. */
    #recordDialogBody .story-tools {
      display: none !important;
    }

    #recordDialogBody .upload-box .file-hint {
      display: none !important;
    }

    /* Убираем подпись "1 + 1В + 1Л" под колонкой "Смен". */
    .attendance-table .att-summary-head small {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function shouldRemoveText(value) {
    const text = normalizeText(value);
    if (!text) return false;
    if (REMOVE_EXACT.has(text)) return true;
    return REMOVE_PREFIXES.some(prefix => text.startsWith(prefix));
  }

  function removeHelperElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const text = normalizeText(el.textContent);
    if (!shouldRemoveText(text)) return false;
    el.remove();
    return true;
  }

  function replaceUiText(value) {
    let s = String(value ?? '');

    s = s
      .replace(/Ф\.\s*И\.\s*О\.\s*сотрудника/gi, m =>
        m === m.toUpperCase() ? 'Ф.И.О. ПРОДАВЦА' : 'Ф.И.О. продавца'
      )
      .replace(/ФИО\s+сотрудника/gi, m =>
        m === m.toUpperCase() ? 'ФИО ПРОДАВЦА' : 'ФИО продавца'
      )
      .replace(/Сотрудник\s*\/\s*продавец/g, 'Продавец')
      .replace(/СОТРУДНИК\s*\/\s*ПРОДАВЕЦ/g, 'ПРОДАВЕЦ')
      .replace(/Сотрудник(?=\s*:|\s*$)/g, 'Продавец')
      .replace(/СОТРУДНИК(?=\s*:|\s*$)/g, 'ПРОДАВЕЦ')
      .replace(/Содержание(?=\s*:|\s*$)/g, 'Фабула')
      .replace(/СОДЕРЖАНИЕ(?=\s*:|\s*$)/g, 'ФАБУЛА')
      .replace(/Автор(?=\s*:|\s*$)/g, 'Оператор')
      .replace(/АВТОР(?=\s*:|\s*$)/g, 'ОПЕРАТОР')
      .replace(/Запросил(?=\s*:|\s*$)/g, 'Запросил(а)')
      .replace(/ЗАПРОСИЛ(?=\s*:|\s*$)/g, 'ЗАПРОСИЛ(А)');

    return s;
  }

  function prepareSearch(input) {
    if (!input || input.id !== 'q') return;
    if (input.placeholder !== SEARCH_PLACEHOLDER) input.placeholder = SEARCH_PLACEHOLDER;
    if (input.title !== SEARCH_TITLE) input.title = SEARCH_TITLE;
    input.dataset.prizWordingReady = '1';
  }

  function cleanRecordFormHints(root) {
    const scope = root?.querySelectorAll ? root : document;

    scope.querySelectorAll?.('#recordDialogBody input[name="manager"]').forEach(el => {
      if (el.placeholder) el.placeholder = '';
      if (el.title === 'Менеджер подставляется автоматически') el.removeAttribute('title');
    });

    scope.querySelectorAll?.('#recordDialogBody input[name="employee"]').forEach(el => {
      if (el.placeholder) el.placeholder = '';
    });

    scope.querySelectorAll?.('#recordDialogBody textarea[name="story"]').forEach(el => {
      if (el.placeholder) el.placeholder = '';
    });

    // Физически удаляем строку распознавания фабулы.
    scope.querySelectorAll?.('#recordDialogBody .story-tools').forEach(el => el.remove());

    // Физически удаляем подпись про Backblaze.
    scope.querySelectorAll?.('#recordDialogBody .upload-box .file-hint').forEach(el => el.remove());

    // Убираем служебную подпись под "Смен".
    scope.querySelectorAll?.('.attendance-table .att-summary-head small').forEach(el => el.remove());
  }

  function isUiLabelText(trimmed) {
    return (
      trimmed === 'Автор' || trimmed === 'АВТОР' ||
      trimmed === 'Сотрудник' || trimmed === 'СОТРУДНИК' ||
      trimmed === 'Сотрудник / продавец' || trimmed === 'СОТРУДНИК / ПРОДАВЕЦ' ||
      trimmed === 'Ф.И.О. сотрудника' || trimmed === 'Ф.И.О. СОТРУДНИКА' ||
      trimmed === 'ФИО сотрудника' || trimmed === 'ФИО СОТРУДНИКА' ||
      trimmed === 'Содержание' || trimmed === 'СОДЕРЖАНИЕ' ||
      trimmed === 'Запросил' || trimmed === 'ЗАПРОСИЛ' ||
      /(^|·\s*)Автор\s*:/.test(trimmed) || /(^|·\s*)АВТОР\s*:/.test(trimmed) ||
      /^Сотрудник\s*:/.test(trimmed) || /^СОТРУДНИК\s*:/.test(trimmed) ||
      /^Ф\.\s*И\.\s*О\.\s*сотрудника\s*:?\s*$/i.test(trimmed) ||
      /^ФИО\s+сотрудника\s*:?\s*$/i.test(trimmed) ||
      /^Содержание\s*:?\s*$/i.test(trimmed) ||
      /^Запросил\s*:/.test(trimmed) || /^ЗАПРОСИЛ\s*:/.test(trimmed)
    );
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return;

    if (shouldRemoveText(parent.textContent)) {
      parent.remove();
      return;
    }

    const raw = node.nodeValue || '';
    const trimmed = raw.trim();
    if (!isUiLabelText(trimmed)) return;

    const next = replaceUiText(raw);
    if (next !== raw) node.nodeValue = next;
  }

  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    if (removeHelperElement(el)) return;

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

    cleanRecordFormHints(el);

    const descendants = Array.from(el.querySelectorAll('*'));
    for (const child of descendants) {
      if (!document.body.contains(child)) continue;
      removeHelperElement(child);
    }

    if (!document.body.contains(el)) return;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) processTextNode(node);

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
    cleanRecordFormHints(document);
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

      cleanRecordFormHints(document);
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
