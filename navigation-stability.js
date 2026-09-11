(() => {
  // Защита PRIZ Control от одновременной перерисовки нескольких вкладок.
  // Быстрые клики теперь объединяются: текущая загрузка спокойно заканчивается,
  // после чего отрисовывается только последняя выбранная страница/регион.

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
          await baseRenderPage.apply(context, args);
        } catch (err) {
          // Если во время загрузки пользователь уже ушёл на другую вкладку,
          // ошибка старой страницы не должна ломать новую.
          const afterError = snapshot();
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

      // На случай клика ровно между последней проверкой и finally.
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

  // Классические script-файлы PRIZ Control используют глобальную переменную renderPage.
  window.renderPage = stableRenderPage;
  try { renderPage = stableRenderPage; } catch (_) {}
})();
