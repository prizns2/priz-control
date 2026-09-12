(() => {
  'use strict';

  const KEY_PREFIX = 'priz.sharedOperator.';
  const STATE_FIELD = 'regionSwitchCode';
  const POLL_MS = 350;

  let activeKey = '';
  let cachedRegions = [];
  let requestToken = 0;

  function isSharedOperatorAccount() {
    return !!(
      window.currentUser &&
      currentUser.role === 'operator' &&
      currentUser.isSharedRegionAccount
    );
  }

  function storageKey() {
    return currentUser?.id ? `${KEY_PREFIX}${currentUser.id}` : null;
  }

  function readSelectedOperator() {
    if (!isSharedOperatorAccount()) return null;
    const key = storageKey();
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value?.id || !value?.fullName) return null;
      return value;
    } catch {
      return null;
    }
  }

  function saveSelectedOperator(value) {
    const key = storageKey();
    if (!key || !value) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function updateCurrentUser(regionCode, rows) {
    const region = REGIONS?.[regionCode];
    if (!region) return;

    currentUser.region = regionCode;
    currentUser.regionId = region.id;
    currentUser.regions = rows.map(x => x.code);
    currentUser.regionIds = rows.map(x => x.id);
  }

  function updateUserCard(regionCode) {
    const card = document.getElementById('userCard');
    const regionText = card?.querySelector('span');
    if (regionText && REGIONS?.[regionCode]) {
      regionText.textContent = REGIONS[regionCode].name;
    }
  }

  function normalizeRows(data) {
    const out = [];
    const seen = new Set();

    for (const row of Array.isArray(data) ? data : []) {
      const code = row.region_code || REGION_BY_UUID?.[row.region_id]?.code;
      const id = row.region_id || REGIONS?.[code]?.id;
      if (!code || !id || !REGIONS?.[code] || seen.has(code)) continue;
      seen.add(code);
      out.push({
        id,
        code,
        name: row.region_name || REGIONS[code].name || code
      });
    }

    return out;
  }

  function applyRegions(rows, selected) {
    const select = document.getElementById('regionSelect');
    if (!select || !rows.length || !selected) return;

    const codes = rows.map(x => x.code);
    let wanted = selected[STATE_FIELD];

    if (!codes.includes(wanted)) {
      if (codes.includes(select.value)) wanted = select.value;
      else if (codes.includes(currentUser?.region)) wanted = currentUser.region;
      else wanted = codes[0];
    }

    const signature = rows.map(x => `${x.id}:${x.code}`).join('|');

    if (select.dataset.sharedRegionSwitchSignature !== signature) {
      select.innerHTML = rows.map(row =>
        `<option value="${esc(row.code)}">${esc(row.name)}</option>`
      ).join('');
      select.dataset.sharedRegionSwitchSignature = signature;
    }

    if (select.value !== wanted) select.value = wanted;
    select.disabled = rows.length <= 1;

    selected[STATE_FIELD] = wanted;
    saveSelectedOperator(selected);

    updateCurrentUser(wanted, rows);
    updateUserCard(wanted);
  }

  async function loadRegionsForSelected(selected, force = false) {
    if (!selected?.id || !isSharedOperatorAccount()) return;

    const key = `${currentUser.id}:${selected.id}`;
    if (!force && key === activeKey && cachedRegions.length) {
      applyRegions(cachedRegions, selected);
      return;
    }

    activeKey = key;
    cachedRegions = [];

    const token = ++requestToken;

    try {
      const { data, error } = await sb.rpc('shared_operator_region_choices', {
        p_operator_profile_id: selected.id
      });
      if (error) throw error;
      if (token !== requestToken) return;

      const rows = normalizeRows(data);
      if (!rows.length) return;

      cachedRegions = rows;
      applyRegions(rows, selected);
    } catch (err) {
      console.error('shared-region-switch:', err);
    }
  }

  function resetLocalState() {
    activeKey = '';
    cachedRegions = [];
    requestToken++;
  }

  async function reconcile() {
    if (!isSharedOperatorAccount()) {
      resetLocalState();
      return;
    }

    const selected = readSelectedOperator();
    if (!selected) {
      resetLocalState();
      return;
    }

    await loadRegionsForSelected(selected);
  }

  document.addEventListener('change', event => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || select.id !== 'regionSelect') return;
    if (!isSharedOperatorAccount()) return;

    const selected = readSelectedOperator();
    if (!selected || !cachedRegions.length) return;

    const row = cachedRegions.find(x => x.code === select.value);
    if (!row) return;

    selected[STATE_FIELD] = row.code;
    saveSelectedOperator(selected);

    updateCurrentUser(row.code, cachedRegions);
    updateUserCard(row.code);
  }, true);

  window.addEventListener('focus', () => {
    reconcile();
  });

  setInterval(reconcile, POLL_MS);
  setTimeout(reconcile, 0);
})();
