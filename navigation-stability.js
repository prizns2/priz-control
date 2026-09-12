(() => {
  // PRIZ Control — плавная навигация без мерцания.
  // Пока новая страница загружается, пользователь продолжает видеть
  // предыдущую полностью готовую страницу. После завершения загрузки
  // старый снимок мягко убирается.

  if (window.__prizNavigationStabilityInstalled) return;
  window.__prizNavigationStabilityInstalled = true;

  const baseRenderPage = window.renderPage;
  if (typeof baseRenderPage !== 'function') return;

  let running = false;
  let pending = false;
  let requestNo = 0;
  let waiters = [];

  function snapshot() {
    return {
      page: typeof currentPage !== 'undefined' ? currentPage : null,
      region: document.getElementById('regionSelect')?.value || null
    };
  }

  function sameSnapshot(a, b) {
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

  function removeIds(root) {
    if (!root) return;
    if (root.id) root.removeAttribute('id');
    root.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  }

  function createTransitionCover() {
    const content = document.getElementById('content');
    const app = document.getElementById('appView');

    if (!content || !app || app.classList.contains('hidden')) return null;
    if (!content.childNodes.length) return null;

    // На первом экране загрузки ничего не маскируем.
    const onlyLoading =
      content.children.length === 1 &&
      content.firstElementChild?.classList.contains('loading-line');

    if (onlyLoading) return null;

    const rect = content.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;

    const cover = content.cloneNode(true);
    removeIds(cover);

    cover.id = 'prizNavigationTransitionCover';
    cover.setAttribute('aria-hidden', 'true');
    cover.inert = true;

    const contentStyle = getComputedStyle(content);
    const parentStyle = content.parentElement
      ? getComputedStyle(content.parentElement)
      : null;

    let background = contentStyle.backgroundColor;
    if (!background || background === 'rgba(0, 0, 0, 0)' || background === 'transparent') {
      background = parentStyle?.backgroundColor || '#090a0f';
    }

    Object.assign(cover.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${Math.max(rect.height, window.innerHeight - Math.max(0, rect.top))}px`,
      margin: '0',
      boxSizing: 'border-box',
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: '9990',
      background,
      opacity: '1',
      transition: 'opacity 90ms ease'
    });

    // Клонированные sticky/fixed элементы не должны вылезать из снимка.
    cover.querySelectorAll('*').forEach(el => {
      const p = getComputedStyle(el).position;
      if (p === 'fixed') el.style.position = 'absolute';
    });

    document.body.appendChild(cover);
    return cover;
  }

  function removeTransitionCover(cover) {
    if (!cover?.isConnected) return;

    requestAnimationFrame(() => {
      cover.style.opacity = '0';
      setTimeout(() => {
        if (cover.isConnected) cover.remove();
      }, 100);
    });
  }

  async function renderSmoothly(context, args) {
    const oldCover = document.getElementById('prizNavigationTransitionCover');
    if (oldCover) oldCover.remove();

    const cover = createTransitionCover();

    try {
      await baseRenderPage.apply(context, args);

      // Даём браузеру один кадр на отрисовку полностью готового DOM,
      // и только затем открываем новую страницу.
      await new Promise(resolve =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );
    } finally {
      removeTransitionCover(cover);
    }
  }

  async function drain(context, args) {
    if (running) return;
    running = true;

    let finalError = null;

    try {
      while (pending) {
        pending = false;

        const runNo = requestNo;
        const before = snapshot();

        try {
          await renderSmoothly(context, args);
        } catch (err) {
          const afterError = snapshot();

          // Ошибка устаревшего перехода не должна ломать последнюю вкладку.
          if (runNo === requestNo && sameSnapshot(before, afterError)) {
            finalError = err;
            console.error(err);
          } else {
            console.debug('PRIZ Control: устаревшая загрузка отменена', err);
          }
        }

        const after = snapshot();

        if (runNo !== requestNo || !sameSnapshot(before, after)) {
          pending = true;
          finalError = null;
        }
      }
    } finally {
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
