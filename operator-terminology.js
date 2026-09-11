(() => {
  const TEXT_REPLACEMENTS = [
    [/(?<![\p{L}\p{N}_])Автор(?![\p{L}\p{N}_])/gu, 'Оператор'],
    [/(?<![\p{L}\p{N}_])АВТОР(?![\p{L}\p{N}_])/gu, 'ОПЕРАТОР']
  ];

  function replaceText(value) {
    let out = String(value ?? '');
    for (const [re, replacement] of TEXT_REPLACEMENTS) out = out.replace(re, replacement);
    return out;
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (parent && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return;
    const next = replaceText(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }

  function processElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    for (const attr of ['placeholder', 'title', 'aria-label']) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr) || '';
      const next = replaceText(current);
      if (next !== current) el.setAttribute(attr, next);
    }

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) processTextNode(node);
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
        for (const node of mutation.addedNodes) apply(node);
        if (mutation.type === 'attributes') processElement(mutation.target);
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
