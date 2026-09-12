(() => {
  // PRIZ Control — navigation architecture v4.
  // 1) Native View Transitions: old screen stays visible until the new one is fully ready.
  // 2) Live DOM page cache: revisiting a page restores the real nodes + event handlers instantly.
  // 3) Fast-click coalescing: intermediate pages are never shown.
  // No cloned overlays, no duplicate IDs, no fake screenshots.

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
    if (document.getElementById('prizNavigationV4Styles')) return;
    const style = document.createElement('style');
    style.id = 'prizNavigationV4Styles';
    style.textContent = `
      #content { view-transition-name: priz-content; }

      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation: none !important;
      }

      ::view-transition-old(priz-content) {
        animation: priz-nav-out 70ms ease-out both;
      }

      ::view-transition-new(priz-content) {
        animation: priz-nav-in 90ms ease-out both;
      }

      @keyframes priz-nav-out {
        from { opacity: 1; }
        to   { opacity: .985; }
      }

      @keyframes priz-nav-in {
        from { opacity: .985; }
        to   { opacity: 1; }
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
        transition: opacity 100ms ease, transform 900ms cubic-bezier(.2,.8,.2,1);
      }

      #prizNavProgress.show {
        opacity: .9;
        transform: scaleX(.78);
      }

      #prizNavProgress.done {
        opacity: 0;
        transform: scaleX(1);
        transition: opacity 160ms ease, transform 120ms ease;
      }

      @media (prefers-reduced-motion: reduce) {
        ::view-transition-old(priz-content),
        ::view-transition-new(priz-content) { animation: none !important; }
        #prizNavProgress { transition: none !important; }
      }
    `;
    document.head.appendChild(style);

    const bar = document.createElement('div');
    bar.id = 'prizNavProgress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }

  injectStyles();

  function progressStart() {
    const bar = document.getElementById('prizNavProgress');
    if (!bar) return;
    clearTimeout(progressTimer);
    bar.classList.remove('show', 'done');
    progressTimer = setTimeout(() => bar.classList.add('show'), 120);
  }

  function progressEnd() {
    const bar = document.getElementById('prizNavProgress');
    if (!bar) return;
    clearTimeout(progressTimer);
    if (!bar.classList.contains('show')) return;
    bar.classList.remove('show');
    bar.classList.add('done');
    setTimeout(() => bar.classList.remove('done'), 180);
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
    const scrollers = [...(root?.querySelectorAll('.table-wrap,.attendance-table-wrap,[data-priz-keep-scroll]') || [])]
      .map(el => ({ top: el.scrollTop, left: el.scrollLeft }));
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
    const list = [...(root?.querySelectorAll('.table-wrap,.attendance-table-wrap,[data-priz-keep-scroll]') || [])];
    list.forEach((el, i) => {
      const saved = state.scrollers?.[i];
      if (!saved) return;
      el.scrollTop = saved.top || 0;
      el.scrollLeft = saved.left || 0;
    });
    if (state.windowY) window.scrollTo({ top: state.windowY, behavior: 'instant' });
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

    const fragment = document.createDocumentFragment();
    while (content.firstChild) fragment.appendChild(content.firstChild);

    pageCache.delete(visibleKey);
    pageCache.set(visibleKey, {
      fragment,
      renderedAt: visibleRenderedAt || Date.now(),
      title: document.getElementById('pageTitle')?.textContent || '',
      eyebrow: document.getElementById('pageEyebrow')?.textContent || '',
      scroll: captureScroll(fragment)
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

  async function renderLatestInsideTransition(args) {
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
      visibleKey = key;
      visibleRenderedAt = Date.now();
    }
  }

  async function run(args) {
    progressStart();
    try {
      if (typeof document.startViewTransition === 'function') {
        const transition = document.startViewTransition(() => renderLatestInsideTransition(args));
        await transition.updateCallbackDone;
        try { await transition.finished; } catch (_) {}
      } else {
        // Older browser fallback. Brave/Chrome uses the branch above.
        await renderLatestInsideTransition(args);
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
        // Request could arrive in the tiny gap after the final loop check.
        const expectedKey = targetKey();
        if (visibleKey !== expectedKey) stableRenderPage(...args);
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
      if (pages.has(pageNameFromKey(key))) pageCache.delete(key);
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
