(() => {
  // PRIZ Control — immediate UI refresh after successful writes.
  //
  // IMPORTANT LOAD ORDER:
  // performance-cache.js
  // live-refresh-fix.js  <-- this file
  // navigation-stability.js
  //
  // We capture the last renderPage BEFORE navigation-stability wraps it.
  // After all synchronous scripts finish, we wrap the navigation renderer and
  // use this raw renderer only when the CURRENT visible page was invalidated.
  if (window.__prizLiveRefreshFixBootstrapped) return;
  window.__prizLiveRefreshFixBootstrapped = true;

  const rawRenderPage =
    typeof window.renderPage === 'function'
      ? window.renderPage
      : (typeof renderPage === 'function' ? renderPage : null);

  if (typeof rawRenderPage !== 'function') return;

  function currentPageName() {
    try {
      return typeof currentPage !== 'undefined'
        ? String(currentPage || 'dashboard')
        : 'dashboard';
    } catch (_) {
      return 'dashboard';
    }
  }

  function currentRegionCode() {
    return document.getElementById('regionSelect')?.value || 'all';
  }

  function currentKey() {
    return `${currentPageName()}|${currentRegionCode()}`;
  }

  // Attendance write RPCs that change what attendance_month_payload returns.
  const ATTENDANCE_WRITES = new Set([
    'attendance_set_entry',
    'attendance_set_status_quick',
    'attendance_apply_2x2',
    'attendance_clear_month'
  ]);

  /*
   * performance-cache.js already wraps sb.rpc. Wrap that cached RPC layer once
   * more so ALL attendance mutations invalidate its read cache after success.
   *
   * This fixes:
   * - "2/2 с сегодня"
   * - quick status editing
   * - clearing the month
   * - the regular attendance edit dialog
   */
  if (
    typeof sb !== 'undefined' &&
    typeof sb.rpc === 'function' &&
    !window.__prizAttendanceWriteInvalidationInstalled
  ) {
    window.__prizAttendanceWriteInvalidationInstalled = true;

    const cachedRpc = sb.rpc.bind(sb);

    sb.rpc = function prizLiveRefreshRpc(fn, args, options) {
      const result = cachedRpc(fn, args, options);

      if (!ATTENDANCE_WRITES.has(fn)) {
        return result;
      }

      return Promise.resolve(result).then(response => {
        if (!response?.error) {
          try {
            window.prizInvalidateReadCache?.('attendance');
          } catch (err) {
            console.warn('Attendance cache invalidation failed:', err);
          }
        }
        return response;
      });
    };
  }

  /*
   * navigation-stability.js is loaded AFTER this file.
   * Install the visible-page dirty handling after all synchronous scripts have
   * had a chance to load.
   */
  setTimeout(() => {
    if (window.__prizLiveRefreshFixInstalled) return;
    window.__prizLiveRefreshFixInstalled = true;

    const stableRenderPage = window.renderPage;

    if (typeof stableRenderPage !== 'function') return;

    let dirtyVisibleKey = null;

    const baseInvalidateNavigation =
      typeof window.prizInvalidateNavigationCache === 'function'
        ? window.prizInvalidateNavigationCache
        : null;

    if (baseInvalidateNavigation) {
      window.prizInvalidateNavigationCache = function prizInvalidateNavigationCacheLive(scope = 'all') {
        const page = currentPageName();
        let affectsVisible = false;

        if (scope === 'all') {
          affectsVisible = true;
        } else {
          const pages = new Set(Array.isArray(scope) ? scope : [scope]);
          affectsVisible = pages.has(page);
        }

        if (affectsVisible) {
          dirtyVisibleKey = currentKey();
        }

        return baseInvalidateNavigation(scope);
      };
    }

    const liveRenderPage = async function (...args) {
      const key = currentKey();

      // If user navigated somewhere else before the refresh happened,
      // navigation-stability already had its detached cache invalidated.
      // Do NOT bypass navigation for the new page.
      if (dirtyVisibleKey && dirtyVisibleKey !== key) {
        dirtyVisibleKey = null;
      }

      if (dirtyVisibleKey === key) {
        dirtyVisibleKey = null;

        // Refresh the already-visible real page slot directly.
        // This bypasses only the "same key => nothing to do" optimisation,
        // not any application renderer or role/security logic.
        return rawRenderPage.apply(window, args);
      }

      return stableRenderPage.apply(window, args);
    };

    window.renderPage = liveRenderPage;
    try { renderPage = liveRenderPage; } catch (_) {}

    window.prizLiveRefreshState = () => ({
      dirtyVisibleKey,
      currentKey: currentKey(),
      installed: true
    });
  }, 0);
})();
