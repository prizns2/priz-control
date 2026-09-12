(() => {
  // PRIZ Control — read cache + request de-duplication + warm prefetch.
  // Caches ONLY known read-only RPC calls. Mutations always go directly to Supabase.
  if (window.__prizPerformanceCacheInstalled) return;
  window.__prizPerformanceCacheInstalled = true;

  if (typeof sb === 'undefined' || typeof sb.rpc !== 'function') return;

  const READ_TTL = Object.freeze({
    dashboard_payload: 15_000,
    attendance_month_payload: 25_000,
    attendance_archive_months: 180_000,
    attendance_entry_history: 15_000,
    record_filter_operators: 600_000,
    search_records_secure_v2: 20_000,
    search_records_secure: 15_000,
    owner_usage_stats: 30_000
  });

  const CACHE_MAX = 160;
  const rpcCache = new Map();
  const inflight = new Map();
  const originalRpc = sb.rpc.bind(sb);

  function stable(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }

  function cacheKey(fn, args) {
    return `${fn}|${stable(args || {})}`;
  }

  function prune() {
    const now = Date.now();
    for (const [key, entry] of rpcCache) {
      if (entry.expires <= now) rpcCache.delete(key);
    }
    while (rpcCache.size > CACHE_MAX) {
      const first = rpcCache.keys().next().value;
      if (first === undefined) break;
      rpcCache.delete(first);
    }
  }

  function clearMatching(names) {
    const wanted = new Set(Array.isArray(names) ? names : [names]);
    for (const key of [...rpcCache.keys()]) {
      const fn = key.slice(0, key.indexOf('|'));
      if (wanted.has(fn)) rpcCache.delete(key);
    }
    for (const key of [...inflight.keys()]) {
      const fn = key.slice(0, key.indexOf('|'));
      if (wanted.has(fn)) inflight.delete(key);
    }
  }

  function invalidateScope(scope = 'all') {
    if (scope === 'records') {
      clearMatching([
        'dashboard_payload',
        'search_records_secure_v2',
        'search_records_secure',
        'record_filter_operators',
        'owner_usage_stats'
      ]);
      window.prizInvalidateNavigationCache?.(['dashboard', 'records', 'audit', 'settings']);
      return;
    }

    if (scope === 'attendance') {
      clearMatching(['attendance_month_payload', 'attendance_archive_months', 'attendance_entry_history']);
      window.prizInvalidateNavigationCache?.(['attendance', 'audit']);
      return;
    }

    rpcCache.clear();
    inflight.clear();
    window.prizInvalidateNavigationCache?.('all');
  }

  window.prizInvalidateReadCache = invalidateScope;

  sb.rpc = function prizCachedRpc(fn, args, options) {
    const ttl = READ_TTL[fn];

    // Every RPC not explicitly listed above keeps the original Supabase behaviour.
    if (!ttl) {
      const result = originalRpc(fn, args, options);

      // Attendance is a known write RPC. Invalidate only after a successful write.
      if (fn === 'attendance_set_entry') {
        return Promise.resolve(result).then(response => {
          if (!response?.error) invalidateScope('attendance');
          return response;
        });
      }

      return result;
    }

    const key = cacheKey(fn, args);
    const now = Date.now();
    const hit = rpcCache.get(key);

    if (hit && hit.expires > now) {
      hit.touched = now;
      return Promise.resolve(hit.value);
    }

    if (hit) rpcCache.delete(key);
    if (inflight.has(key)) return inflight.get(key);

    const promise = Promise.resolve(originalRpc(fn, args, options))
      .then(response => {
        if (!response?.error) {
          rpcCache.set(key, {
            value: response,
            expires: Date.now() + ttl,
            touched: Date.now()
          });
          prune();
        }
        return response;
      })
      .finally(() => inflight.delete(key));

    inflight.set(key, promise);
    return promise;
  };

  // Record writes must invalidate page/data caches, but keep the existing safe-save wrapper.
  const baseSaveRecord = typeof window.saveRecord === 'function' ? window.saveRecord : null;
  if (baseSaveRecord) {
    const cachedSafeSave = async function (...args) {
      const result = await baseSaveRecord.apply(this, args);
      invalidateScope('records');
      return result;
    };
    window.saveRecord = cachedSafeSave;
    try { saveRecord = cachedSafeSave; } catch (_) {}
  }

  const baseDeleteRecordServer = typeof window.deleteRecordServer === 'function' ? window.deleteRecordServer : null;
  if (baseDeleteRecordServer) {
    const cachedSafeDelete = async function (...args) {
      const result = await baseDeleteRecordServer.apply(this, args);
      invalidateScope('records');
      return result;
    };
    window.deleteRecordServer = cachedSafeDelete;
    try { deleteRecordServer = cachedSafeDelete; } catch (_) {}
  }

  function selectedRegionCodeSafe() {
    return document.getElementById('regionSelect')?.value || 'all';
  }

  function regionIdForSelection(code) {
    return code === 'all' ? null : (window.REGIONS?.[code]?.id || REGIONS?.[code]?.id || null);
  }

  function currentDateKyivSafe() {
    try {
      if (typeof window.todayKyiv === 'function') return window.todayKyiv();
      if (typeof todayKyiv === 'function') return todayKyiv();
    } catch (_) {}
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }

  function warmCurrentRegion() {
    if (!window.currentUser && typeof currentUser === 'undefined') return;

    const code = selectedRegionCodeSafe();
    const regionId = regionIdForSelection(code);
    const date = currentDateKyivSafe();

    // Fire-and-forget. Errors here must never affect the visible app.
    const jobs = [
      sb.rpc('dashboard_payload', { p_region_id: regionId, p_date: date }),
      sb.rpc('search_records_secure_v2', {
        p_region_id: regionId,
        p_kind: null,
        p_person: null,
        p_manager: null,
        p_from: null,
        p_to: null,
        p_query: null,
        p_violation_type: null,
        p_offset: 0,
        p_limit: 100
      }),
      sb.rpc('record_filter_operators', { p_region_id: regionId })
    ];

    let attendanceRegionId = regionId;
    if (!attendanceRegionId) {
      try {
        const defaultCode = typeof selectedRegionCode === 'function' ? selectedRegionCode() : null;
        attendanceRegionId = defaultCode ? (REGIONS?.[defaultCode]?.id || null) : null;
      } catch (_) {}
    }

    if (attendanceRegionId) {
      jobs.push(sb.rpc('attendance_month_payload', {
        p_region_id: attendanceRegionId,
        p_month_start: null
      }));
    }

    if ((window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null))?.role === 'owner') {
      jobs.push(sb.rpc('attendance_archive_months'));
      jobs.push(sb.rpc('owner_usage_stats'));
    }

    Promise.allSettled(jobs).catch(() => {});
  }

  let warmedFor = '';
  let warmTimer = null;

  function scheduleWarm() {
    clearTimeout(warmTimer);
    warmTimer = setTimeout(() => {
      const app = document.getElementById('appView');
      if (!app || app.classList.contains('hidden')) return;
      const code = selectedRegionCodeSafe();
      const user = window.currentUser || (typeof currentUser !== 'undefined' ? currentUser : null);
      const signature = `${user?.id || 'user'}|${code}`;
      if (signature === warmedFor) return;
      warmedFor = signature;
      warmCurrentRegion();
    }, 140);
  }

  const appView = document.getElementById('appView');
  if (appView) {
    new MutationObserver(scheduleWarm).observe(appView, { attributes: true, attributeFilter: ['class'] });
  }

  document.getElementById('regionSelect')?.addEventListener('change', () => {
    warmedFor = '';
    scheduleWarm();
  });

  window.addEventListener('focus', () => {
    // Keep warm data fresh after the browser was in the background.
    if (document.visibilityState === 'visible') {
      warmedFor = '';
      scheduleWarm();
    }
  });

  scheduleWarm();
})();
