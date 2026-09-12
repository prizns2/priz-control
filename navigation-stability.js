(() => {
  // PRIZ Control — стабильная навигация без пустых кадров.
  // Новая страница полностью отрисовывается скрыто, пока пользователь
  // продолжает видеть предыдущую готовую страницу. После завершения
  // загрузки содержимое меняется одним кадром.

  if (window.__prizNavigationStabilityInstalled) return;
  window.__prizNavigationStabilityInstalled = true;

  const baseRenderPage = window.renderPage;
  if (typeof baseRenderPage !== 'function') return;

  let running = false;
  let pending = false;
  let requestNo = 0;
  let waiters = [];

  function routeSnapshot() {
    return {
      page: typeof currentPage !== 'undefined' ? currentPage : null,
      region: document.getElementById('regionSelect')?.value || null
    };
  }

  function sameRoute(a, b) {
    return a?.page === b?.page && a?.region === b?.region;
  }

  function settleWaiters(error = null) {
    const list = waiters;
    waiters = [];
    for (const item of list) {
      if (error) item.reject(error);
      else item.resolve();
    }
  }

  function ensureProgressBar() {
    let bar = document.getElementById('prizRouteProgress');
    if (bar) return bar;

    const style = document.createElement('style');
    style.id = 'prizRouteProgressStyles';
    style.textContent = `
      #prizRouteProgress{
        position:fixed;
        left:0;
        top:0;
        width:100%;
        height:2px;
        z-index:12000;
        pointer-events:none;
        opacity:0;
        overflow:hidden;
      }
      #prizRouteProgress::before{
        content:"";
        display:block;
        width:100%;
        height:100%;
        transform:scaleX(0);
        transform-origin:left center;
        background:linear-gradient(90deg,#6d4aff,#9b7cff,#6d4aff);
        box-shadow:0 0 12px rgba(139,92,246,.55);
      }
      #prizRouteProgress.loading,
      #prizRouteProgress.done{
        opacity:1;
      }
      #prizRouteProgress.loading::before{
        animation:prizRouteProgress 1.05s cubic-bezier(.2,.7,.2,1) infinite;
      }
      #prizRouteProgress.done::before{
        animation:none;
        transform:scaleX(1);
        transition:transform .12s ease;
      }
      @keyframes prizRouteProgress{
        0%{transform:translateX(-70%) scaleX(.28)}
        55%{transform:translateX(8%) scaleX(.62)}
        100%{transform:translateX(100%) scaleX(.18)}
      }
      @media (prefers-reduced-motion: reduce){
        #prizRouteProgress.loading::before{animation:none;transform:scaleX(.72)}
      }
    `;
    document.head.appendChild(style);

    bar = document.createElement('div');
    bar.id = 'prizRouteProgress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    return bar;
  }

  function startProgress() {
    const bar = ensureProgressBar();
    bar.style.opacity = '';
    bar.classList.remove('done');
    bar.classList.add('loading');
  }

  function finishProgress() {
    const bar = ensureProgressBar();
    bar.classList.remove('loading');
    bar.classList.add('done');
    setTimeout(() => {
      bar.classList.remove('done');
      bar.style.opacity = '0';
    }, 140);
  }

  function isOnlyLoading(content) {
    return (
      content?.children?.length === 1 &&
      content.firstElementChild?.classList?.contains('loading-line')
    );
  }

  function syncScrollPositions(source, clone) {
    try {
      clone.scrollTop = source.scrollTop;
      clone.scrollLeft = source.scrollLeft;

      const sourceNodes = source.querySelectorAll('*');
      const cloneNodes = clone.querySelectorAll('*');
      const count = Math.min(sourceNodes.length, cloneNodes.length);

      for (let i = 0; i < count; i++) {
        if (sourceNodes[i].scrollTop || sourceNodes[i].scrollLeft) {
          cloneNodes[i].scrollTop = sourceNodes[i].scrollTop;
          cloneNodes[i].scrollLeft = sourceNodes[i].scrollLeft;
        }
      }
    } catch (_) {}
  }

  function beginHiddenRender() {
    const content = document.getElementById('content');
    const app = document.getElementById('appView');

    if (!content || !app || app.classList.contains('hidden')) {
      return { content: null, snapshot: null, oldDisplay: '' };
    }

    if (!content.childNodes.length || isOnlyLoading(content)) {
      return { content, snapshot: null, oldDisplay: content.style.display };
    }

    const snapshot = content.cloneNode(true);
    snapshot.removeAttribute('id');
    snapshot.id = 'prizRouteSnapshot';
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.inert = true;
    snapshot.style.pointerEvents = 'none';
    snapshot.style.userSelect = 'none';

    // Вставляем снимок ПОСЛЕ оригинала. Оригинал остаётся первым в DOM,
    // поэтому все querySelector/getElementById во время скрытой отрисовки
    // продолжают работать с настоящей новой страницей, а не со снимком.
    content.insertAdjacentElement('afterend', snapshot);
    syncScrollPositions(content, snapshot);

    const oldDisplay = content.style.display;
    content.style.display = 'none';

    return { content, snapshot, oldDisplay };
  }

  function revealRenderedContent(stage) {
    const { content, snapshot, oldDisplay } = stage || {};
    if (!content) return;

    content.style.display = oldDisplay || '';

    if (snapshot?.isConnected) {
      snapshot.remove();
    }
  }

  function nextPaint() {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  async function drain(context, args) {
    if (running) return;
    running = true;

    let finalError = null;
    let stage = null;

    startProgress();

    try {
      stage = beginHiddenRender();

      for (;;) {
        while (pending) {
          pending = false;

          const runNo = requestNo;
          const before = routeSnapshot();

          try {
            await baseRenderPage.apply(context, args);
          } catch (err) {
            const afterError = routeSnapshot();

            if (runNo === requestNo && sameRoute(before, afterError)) {
              finalError = err;
              console.error(err);
            } else {
              console.debug('PRIZ Control: устаревшая загрузка отменена', err);
            }
          }

          const after = routeSnapshot();

          if (runNo !== requestNo || !sameRoute(before, after)) {
            pending = true;
            finalError = null;
          }
        }

        // Браузер получает время построить layout новой скрытой страницы.
        await nextPaint();

        // Если пользователь нажал другую вкладку прямо во время подготовки
        // кадра — не показываем промежуточную страницу, а сразу рендерим последнюю.
        if (pending) continue;

        break;
      }
    } finally {
      revealRenderedContent(stage);
      finishProgress();
      running = false;
      settleWaiters(finalError);

      if (pending) queueMicrotask(() => drain(context, args));
    }
  }

  const stableRenderPage = function (...args) {
    requestNo += 1;
    pending = true;

    const promise = new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
    });

    drain(this, args);
    return promise;
  };

  window.renderPage = stableRenderPage;
  try { renderPage = stableRenderPage; } catch (_) {}
})();