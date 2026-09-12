(() => {
  // PRIZ Control — navigation architecture v5.
  // Цель: старый экран виден до полной готовности нового, затем один мгновенный кадр.
  // Никакого cross-fade и одновременного показа старой/новой страницы.
  // Live DOM cache, быстрые повторные переходы и coalescing быстрых кликов сохранены.

  if (window.__prizNavigationStabilityInstalled) return;
  window.__prizNavigationStabilityInstalled = true;

  const baseRenderPage = window.renderPage;
  if (typeof baseRenderPage !== 'function') return;

  const PAGE_CACHE_TTL = 120_000;
  const PAGE_CACHE_MAX = 12;
  const pageCache = new Map();

  let visibleKey = null;
  let visibleRenderedAt = 0;
  let requestedSeq = 0;
  let runningPromise = null;
  let progressTimer = null;

  function injectStyles() {
    if (document.getElementById('prizNavigationV5Styles')) return;

    // Удаляем стили предыдущей версии, если браузер держал их в текущем DOM.
    document.getElementById('prizNavigationV4Styles')?.remove();

    const style = document.createElement('style');
    style.id = 'prizNavigationV5Styles';
    style.textContent = `
      /*
       * Используем только ROOT View Transition.
       * Старый viewport браузер держит во время async-render.
       * Когда новый DOM готов — старый снимок сразу исчезает, новый сразу виден.
       * Нет двух полупрозрачных слоёв и нет визуального смешивания.
       */
      ::view-transition-group(root) {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
      }

      ::view-transition-old(root) {
        animation: none !important;
        opacity: 0 !important;
      }

      ::view-transition-new(root) {
        animation: none !important;
        opacity: 1 !important;
      }

      #prizNavProgress {
        position: fixed;
        z-index: 2147483000;
        left: 0;
        top: 0;
        height: 2px;
        width: 100%;
        pointer-events: none;
        opacity: 0;
        transform: scaleX(.08);
        transform-origin: left center;
        background: currentColor;
        color: #8b5cf6;
        transition: opacity 90ms ease, transform 700ms cubic-bezier(.2,.8,.2,1);
      }

      #prizNavProgress.show {
        opacity: .85;
        transform: scaleX(.76);
      }

      #prizNavProgress.done {
        opacity: 0;
        transform: scaleX(1);
        transition: opacity 130ms ease, transform 90ms ease;
      }

      @media (prefers-reduced-motion: reduce) {
        #prizNavProgress { transition: none !important; }
      }
    `;
    document.head.appendChild(style);

    let bar = document.getElementById('prizNavProgress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'prizNavProgress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }
  }

  injectStyles();

  function progressStart() {
    const bar = document.getElementById('prizNavProgress');
    if (!bar) return;
    clearTimeout(progressTimer);
    bar.classList.remove('show', 'done');

    // На действительно быстрых переходах индикатор вообще не появляется.
    progressTimer = setTimeout(() => bar.classList.add('show'), 150);
  }

  function progressEnd() {
    const bar = document.getElementById('prizNavProgress');
    if (!bar) return;
    clearTimeout(progressTimer);

    if (!bar.classList.contains('show')) {
      bar.classList.remove('done');
      return;
    }

    bar.classList.remove('show');
    bar.classList.add('done');
    setTimeout(() => bar.classList.remove('done'), 150);
  }

  function regionValue() {
    return document.getElementById('regionSelect')?.value || 'all';
  }

  function targetKey() {
    const page = typeof currentPage !== 'undefined' ? currentPage : 'dashboard';
    return `${page}|${regionValue()}`;
  }

  function pageNameFromKey(key) {
    return String(key || '').split('|', 1)[0] || '';
  }

  function captureScroll(root) {
    const main = document.querySelector('.main');
    const scrollers = [...(root?.querySelectorAll(
      '.table-wrap,.attendance-table-wrap,[data-priz-keep-scroll]'
    ) || [])].map(el => ({
      top: el.scrollTop,
      left: el.scrollLeft
    }));

    return {
      windowY: window.scrollY,
      mainTop: main?.scrollTop || 0,
      scrollers
    };
  }

  function restoreScroll(root, state) {
    if (!state) return;

    const main = document.querySelector('.main');
    if (main) main.scrollTop = state.mainTop || 0;

    const list = [...(root?.querySelectorAll(
      '.table-wrap,.attendance-table-wrap,[data-priz-keep-scroll]'
    ) || [])];

    list.forEach((el, i) => {
      const saved = state.scrollers?.[i];
      if (!saved) return;
      el.scrollTop = saved.top || 0;
      el.scrollLeft = saved.left || 0;
    });

    if (state.windowY) {
      window.scrollTo({ top: state.windowY, behavior: 'instant' });
    }
  }

  function pruneCache() {
    while (pageCache.size > PAGE_CACHE_MAX) {
      const first = pageCache.keys().next().value;
      if (first === undefined) break;
      pageCache.delete(first);
    }
  }

  function stashVisible() {
    const content = document.getElementById('content');
    if (!content || !visibleKey || !content.childNodes.length) return;

    const scroll = captureScroll(content);
    const fragment = document.createDocumentFragment();

    while (content.firstChild) {
      fragment.appendChild(content.firstChild);
    }

    pageCache.delete(visibleKey);
    pageCache.set(visibleKey, {
      fragment,
      renderedAt: visibleRenderedAt || Date.now(),
      title: document.getElementById('pageTitle')?.textContent || '',
      eyebrow: document.getElementById('pageEyebrow')?.textContent || '',
      scroll
    });

    pruneCache();
  }

  function takeCached(key) {
    const entry = pageCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.renderedAt > PAGE_CACHE_TTL) {
      pageCache.delete(key);
      return null;
    }

    pageCache.delete(key);
    return entry;
  }

  function restoreCached(key, entry) {
    const content = document.getElementById('content');
    if (!content || !entry) return false;

    content.replaceChildren(entry.fragment);

    const title = document.getElementById('pageTitle');
    const eyebrow = document.getElementById('pageEyebrow');

    if (title && entry.title) title.textContent = entry.title;
    if (eyebrow && entry.eyebrow) eyebrow.textContent = entry.eyebrow;

    visibleKey = key;
    visibleRenderedAt = entry.renderedAt;

    requestAnimationFrame(() => restoreScroll(content, entry.scroll));
    return true;
  }

  async function renderLatest(args) {
    let completedSeq = -1;

    while (completedSeq !== requestedSeq) {
      completedSeq = requestedSeq;
      const key = targetKey();

      if (visibleKey !== key) {
        stashVisible();

        const cached = takeCached(key);
        if (cached) {
          restoreCached(key, cached);
          continue;
        }
      }

      await baseRenderPage.apply(window, args);

      // Даём браузеру закончить layout нового экрана до его показа.
      await new Promise(resolve => requestAnimationFrame(resolve));

      visibleKey = key;
      visibleRenderedAt = Date.now();
    }
  }

  async function run(args) {
    progressStart();

    try {
      if (typeof document.startViewTransition === 'function') {
        /*
         * startViewTransition замораживает старый viewport,
         * пока async callback полностью строит новый экран.
         * CSS выше делает финальный переход нулевой длительности:
         * OLD -> NEW за один кадр, без cross-fade.
         */
        const transition = document.startViewTransition(() => renderLatest(args));

        await transition.updateCallbackDone;

        // Если движок всё же подготовил стандартную анимацию,
        // принудительно завершаем её. Новый DOM к этому моменту уже готов.
        try { transition.skipTransition(); } catch (_) {}

        try { await transition.finished; } catch (_) {}
      } else {
        // Fallback для браузера без View Transition API.
        await renderLatest(args);
      }
    } finally {
      progressEnd();
    }
  }

  const stableRenderPage = function (...args) {
    requestedSeq += 1;

    if (!runningPromise) {
      runningPromise = run(args).finally(() => {
        runningPromise = null;

        // Клик мог прийти в очень маленьком окне после финальной проверки.
        const expectedKey = targetKey();
        if (visibleKey !== expectedKey) {
          stableRenderPage(...args);
        }
      });
    }

    return runningPromise;
  };

  function invalidateNavigationCache(scope = 'all') {
    if (scope === 'all') {
      pageCache.clear();
      return;
    }

    const pages = new Set(Array.isArray(scope) ? scope : [scope]);

    for (const key of [...pageCache.keys()]) {
      if (pages.has(pageNameFromKey(key))) {
        pageCache.delete(key);
      }
    }
  }

  window.prizInvalidateNavigationCache = invalidateNavigationCache;
  window.prizNavigationCacheStats = () => ({
    visibleKey,
    entries: [...pageCache.keys()],
    ttlMs: PAGE_CACHE_TTL
  });

  window.renderPage = stableRenderPage;
  try { renderPage = stableRenderPage; } catch (_) {}
})();
