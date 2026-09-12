(() => {
  // PRIZ Control — navigation architecture v6.
  // True page slots. No View Transition, no screenshots, no cloned overlays.
  // One page is visible at a time. A new page is rendered in a hidden real DOM slot,
  // then swapped in a single paint. Cached slots keep their real nodes and handlers.

  if (window.__prizNavigationStabilityInstalled) return;
  window.__prizNavigationStabilityInstalled = true;

  const baseRenderPage = window.renderPage;
  if (typeof baseRenderPage !== 'function') return;

  const CACHE_TTL = 120_000;
  const CACHE_MAX = 12;
  const pageCache = new Map();

  let visibleKey = null;
  let visibleRenderedAt = 0;
  let requestedSeq = 0;
  let runningPromise = null;
  let lastArgs = [];

  function keyNow() {
    const page = typeof currentPage !== 'undefined' ? currentPage : 'dashboard';
    const region = document.getElementById('regionSelect')?.value || 'all';
    return `${page}|${region}`;
  }

  function pageFromKey(key) {
    return String(key || '').split('|', 1)[0] || '';
  }

  function setupHost() {
    const original = document.getElementById('content');
    if (!original) return null;

    // Already converted.
    if (original.parentElement?.id === 'prizPageHost') {
      return original.parentElement;
    }

    // The original .content element becomes a permanent host.
    original.id = 'prizPageHost';
    original.setAttribute('data-priz-page-host', '1');

    const firstSlot = document.createElement('section');
    firstSlot.id = 'content';
    firstSlot.className = 'priz-page-slot priz-page-active';

    while (original.firstChild) {
      firstSlot.appendChild(original.firstChild);
    }

    original.appendChild(firstSlot);

    // If navigation was installed after the first screen had already rendered,
    // treat that screen as the initial cached/visible page.
    if (firstSlot.childNodes.length) {
      visibleKey = keyNow();
      visibleRenderedAt = Date.now();
      firstSlot.dataset.prizKey = visibleKey;
    }

    return original;
  }

  const host = setupHost();
  if (!host) return;

  function injectStyles() {
    document.getElementById('prizNavigationV4Styles')?.remove();
    document.getElementById('prizNavigationV5Styles')?.remove();

    if (document.getElementById('prizNavigationV6Styles')) return;

    const style = document.createElement('style');
    style.id = 'prizNavigationV6Styles';
    style.textContent = `
      #prizPageHost {
        position: relative;
        min-width: 0;
      }

      .priz-page-slot {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }

      .priz-page-slot.priz-page-preparing {
        position: absolute !important;
        inset: 0 auto auto 0 !important;
        width: 100% !important;
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
        z-index: -1 !important;
      }

      .priz-page-slot.priz-page-enter {
        animation: priz-page-enter 72ms ease-out both;
      }

      @keyframes priz-page-enter {
        from { opacity: .965; }
        to   { opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .priz-page-slot.priz-page-enter {
          animation: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectStyles();

  function activeSlot() {
    return host.querySelector(':scope > .priz-page-active') ||
           host.querySelector(':scope > #content');
  }

  function captureScroll(slot) {
    const main = document.querySelector('.main');
    const scrollers = [...(slot?.querySelectorAll(
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

  function restoreScroll(slot, state) {
    if (!state) return;

    const main = document.querySelector('.main');
    if (main) main.scrollTop = state.mainTop || 0;

    const list = [...(slot?.querySelectorAll(
      '.table-wrap,.attendance-table-wrap,[data-priz-keep-scroll]'
    ) || [])];

    list.forEach((el, i) => {
      const saved = state.scrollers?.[i];
      if (!saved) return;
      el.scrollTop = saved.top || 0;
      el.scrollLeft = saved.left || 0;
    });

    if (state.windowY) {
      try {
        window.scrollTo({ top: state.windowY, behavior: 'instant' });
      } catch (_) {
        window.scrollTo(0, state.windowY);
      }
    }
  }

  function parkIds(slot) {
    if (!slot) return () => {};

    const saved = [];

    // Root #content must temporarily belong to the hidden render slot.
    if (slot.id) {
      saved.push([slot, slot.id]);
      slot.removeAttribute('id');
    }

    slot.querySelectorAll('[id]').forEach(el => {
      saved.push([el, el.id]);
      el.removeAttribute('id');
    });

    return () => {
      for (const [el, id] of saved) {
        if (el && !el.id) el.id = id;
      }
    };
  }

  function beginHeaderBuffer() {
    const title = document.getElementById('pageTitle');
    const eyebrow = document.getElementById('pageEyebrow');

    if (!title || !eyebrow) {
      return {
        finish: () => ({ title: '', eyebrow: '' }),
        cancel: () => {}
      };
    }

    const oldTitleId = title.id;
    const oldEyebrowId = eyebrow.id;

    title.id = 'prizVisiblePageTitle';
    eyebrow.id = 'prizVisiblePageEyebrow';

    const titleProxy = document.createElement('span');
    titleProxy.id = oldTitleId;
    titleProxy.hidden = true;
    titleProxy.textContent = title.textContent || '';

    const eyebrowProxy = document.createElement('span');
    eyebrowProxy.id = oldEyebrowId;
    eyebrowProxy.hidden = true;
    eyebrowProxy.textContent = eyebrow.textContent || '';

    document.body.append(titleProxy, eyebrowProxy);

    let closed = false;

    function close(apply) {
      if (closed) {
        return {
          title: title.textContent || '',
          eyebrow: eyebrow.textContent || ''
        };
      }
      closed = true;

      const next = {
        title: titleProxy.textContent || '',
        eyebrow: eyebrowProxy.textContent || ''
      };

      titleProxy.remove();
      eyebrowProxy.remove();

      title.id = oldTitleId;
      eyebrow.id = oldEyebrowId;

      if (apply) {
        title.textContent = next.title;
        eyebrow.textContent = next.eyebrow;
      }

      return next;
    }

    return {
      finish: () => close(true),
      cancel: () => close(false)
    };
  }

  function prune() {
    const now = Date.now();

    for (const [key, entry] of pageCache) {
      if (now - entry.renderedAt > CACHE_TTL) {
        pageCache.delete(key);
      }
    }

    while (pageCache.size > CACHE_MAX) {
      const first = pageCache.keys().next().value;
      if (first === undefined) break;
      pageCache.delete(first);
    }
  }

  function cacheDetachedSlot(key, slot, meta) {
    if (!key || !slot) return;

    slot.classList.remove(
      'priz-page-active',
      'priz-page-preparing',
      'priz-page-enter'
    );
    slot.removeAttribute('id');
    slot.remove();

    pageCache.delete(key);
    pageCache.set(key, {
      slot,
      renderedAt: meta?.renderedAt || Date.now(),
      title: meta?.title || '',
      eyebrow: meta?.eyebrow || '',
      scroll: meta?.scroll || null
    });

    prune();
  }

  function takeCached(key) {
    prune();

    const entry = pageCache.get(key);
    if (!entry) return null;

    pageCache.delete(key);
    return entry;
  }

  function animateNewOnly(slot) {
    if (!slot) return;
    slot.classList.remove('priz-page-enter');
    // Force a style boundary without touching the old page.
    void slot.offsetWidth;
    slot.classList.add('priz-page-enter');
    setTimeout(() => slot.classList.remove('priz-page-enter'), 90);
  }

  function showCached(key, entry) {
    const old = activeSlot();
    if (!entry?.slot) return false;

    const oldKey = visibleKey;
    const oldMeta = old ? {
      renderedAt: visibleRenderedAt || Date.now(),
      title: document.getElementById('pageTitle')?.textContent || '',
      eyebrow: document.getElementById('pageEyebrow')?.textContent || '',
      scroll: captureScroll(old)
    } : null;

    let restoreOldIds = () => {};
    if (old) restoreOldIds = parkIds(old);

    const target = entry.slot;
    target.id = 'content';
    target.dataset.prizKey = key;
    target.classList.add('priz-page-active');

    // Same JS task: browser cannot paint between old removal and new insertion.
    if (old) {
      old.classList.remove('priz-page-active');
      old.remove();
      restoreOldIds();
      cacheDetachedSlot(oldKey, old, oldMeta);
    }

    host.appendChild(target);

    const title = document.getElementById('pageTitle');
    const eyebrow = document.getElementById('pageEyebrow');
    if (title && entry.title) title.textContent = entry.title;
    if (eyebrow && entry.eyebrow) eyebrow.textContent = entry.eyebrow;

    visibleKey = key;
    visibleRenderedAt = entry.renderedAt || Date.now();

    requestAnimationFrame(() => {
      restoreScroll(target, entry.scroll);
      animateNewOnly(target);
    });

    return true;
  }

  async function renderFresh(key, seq, args) {
    const old = activeSlot();
    const oldKey = visibleKey;

    // No previous page (first screen after login): render normally.
    if (!old || !old.childNodes.length || !oldKey) {
      if (old && !old.id) old.id = 'content';
      await baseRenderPage.apply(window, args);
      visibleKey = keyNow();
      visibleRenderedAt = Date.now();
      if (old) {
        old.dataset.prizKey = visibleKey;
        old.classList.add('priz-page-active');
      }
      return;
    }

    const oldMeta = {
      renderedAt: visibleRenderedAt || Date.now(),
      title: document.getElementById('pageTitle')?.textContent || '',
      eyebrow: document.getElementById('pageEyebrow')?.textContent || '',
      scroll: captureScroll(old)
    };

    // Keep the old real page visible, but temporarily park its IDs so all
    // existing render code resolves IDs only inside the hidden target page.
    const restoreOldIds = parkIds(old);
    old.classList.add('priz-page-active');

    const target = document.createElement('section');
    target.id = 'content';
    target.className = 'priz-page-slot priz-page-preparing';
    target.dataset.prizKey = key;
    host.appendChild(target);

    const headerBuffer = beginHeaderBuffer();

    try {
      await baseRenderPage.apply(window, args);

      // Let post-render wrappers/MutationObservers complete the immediate DOM work.
      await new Promise(resolve =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );

      // A newer click arrived while this page was loading: never flash stale content.
      if (seq !== requestedSeq || keyNow() !== key) {
        target.remove();
        headerBuffer.cancel();
        restoreOldIds();
        if (!old.id) old.id = 'content';
        return;
      }

      // Prepare target while still invisible.
      target.classList.remove('priz-page-preparing');
      target.classList.add('priz-page-active');

      // One JS task, one paint boundary:
      // old disappears, target becomes visible. They are never both painted.
      old.classList.remove('priz-page-active');
      old.remove();

      restoreOldIds();
      cacheDetachedSlot(oldKey, old, oldMeta);

      headerBuffer.finish();

      // target already owns #content
      visibleKey = key;
      visibleRenderedAt = Date.now();

      requestAnimationFrame(() => animateNewOnly(target));
    } catch (err) {
      target.remove();
      headerBuffer.cancel();
      restoreOldIds();
      if (!old.id) old.id = 'content';
      throw err;
    }
  }

  async function drain(args) {
    while (true) {
      const seq = requestedSeq;
      const key = keyNow();

      if (visibleKey === key && activeSlot()?.childNodes.length) {
        if (seq === requestedSeq) return;
        continue;
      }

      const cached = takeCached(key);
      if (cached) {
        showCached(key, cached);
      } else {
        await renderFresh(key, seq, args);
      }

      if (seq === requestedSeq && visibleKey === keyNow()) {
        return;
      }
    }
  }

  const stableRenderPage = function (...args) {
    requestedSeq += 1;
    lastArgs = args;

    if (!runningPromise) {
      runningPromise = drain(args).finally(() => {
        runningPromise = null;

        if (visibleKey !== keyNow()) {
          stableRenderPage(...lastArgs);
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
      if (pages.has(pageFromKey(key))) {
        pageCache.delete(key);
      }
    }
  }

  window.prizInvalidateNavigationCache = invalidateNavigationCache;
  window.prizNavigationCacheStats = () => ({
    visibleKey,
    entries: [...pageCache.keys()],
    ttlMs: CACHE_TTL,
    mode: 'page-slots-v6'
  });

  window.renderPage = stableRenderPage;
  try { renderPage = stableRenderPage; } catch (_) {}
})();