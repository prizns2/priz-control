(() => {
  const PLACEHOLDERS = [
    /^Вставь или напиши фабулу(?:\.{3}|…)?$/i,
    /^Вставится из фабулы автоматически$/i,
    /^Подставится по магазину$/i
  ];

  const HINT_RE = /^1\s*[+·•]\s*1В\s*[+·•]\s*1Л$/i;

  const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();

  function cleanElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    if (el.hasAttribute('placeholder')) {
      const value = norm(el.getAttribute('placeholder'));
      if (PLACEHOLDERS.some(re => re.test(value))) {
        el.setAttribute('placeholder', '');
      }
    }

    if (HINT_RE.test(norm(el.textContent))) {
      el.remove();
    }
  }

  function cleanTree(root) {
    if (!root) return;

    if (root.nodeType === Node.ELEMENT_NODE) {
      cleanElement(root);
      if (!document.documentElement.contains(root)) return;
      root.querySelectorAll('*').forEach(cleanElement);
      return;
    }

    if (root.nodeType === Node.TEXT_NODE) {
      const parent = root.parentElement;
      if (parent && HINT_RE.test(norm(parent.textContent))) parent.remove();
    }
  }

  function start() {
    cleanTree(document.body);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          cleanElement(mutation.target);
          continue;
        }

        if (mutation.type === 'characterData') {
          cleanTree(mutation.target);
          continue;
        }

        mutation.addedNodes.forEach(cleanTree);
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
