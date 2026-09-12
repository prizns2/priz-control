(() => {
  const KEY_PREFIX = 'priz.sharedOperator.';
  const CHOOSER_ID = 'sharedOperatorChooser';

  const originalLoadProfileShared = loadProfile;
  const originalBuildShellShared = buildShell;
  const originalShowAppShared = showApp;
  const originalToDbRecordShared = toDbRecord;
  const originalOpenTypePickerShared = openTypePicker;
  const originalOpenRegionPickerShared = openRegionPicker;
  const originalOpenRecordFormShared = openRecordForm;

  function keyForCurrentAccount() {
    return currentUser?.id ? `${KEY_PREFIX}${currentUser.id}` : null;
  }

  function readSelectedOperator() {
    if (!currentUser?.isSharedRegionAccount) return null;
    const key = keyForCurrentAccount();
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
    const key = keyForCurrentAccount();
    if (!key || !value?.id || !value?.fullName) return;
    sessionStorage.setItem(key, JSON.stringify({
      id: value.id,
      fullName: value.fullName,
      regionCodes: Array.isArray(value.regionCodes) ? value.regionCodes : [],
      regionIds: Array.isArray(value.regionIds) ? value.regionIds : [],
      lastRegion: value.lastRegion || null,
      selectedAt: value.selectedAt || new Date().toISOString()
    }));
  }

  function clearSelectedOperator() {
    const key = keyForCurrentAccount();
    if (key) sessionStorage.removeItem(key);
  }

  function removeChooser() {
    document.getElementById(CHOOSER_ID)?.remove();
  }

  function homeRegionCode() {
    if (currentUser?.sharedHomeRegionCode && REGIONS[currentUser.sharedHomeRegionCode]) {
      return currentUser.sharedHomeRegionCode;
    }
    if (currentUser?.sharedHomeRegionId && REGION_BY_UUID[currentUser.sharedHomeRegionId]) {
      return REGION_BY_UUID[currentUser.sharedHomeRegionId].code;
    }
    if (currentUser?.region && REGIONS[currentUser.region]) return currentUser.region;
    return null;
  }

  function homeRegionName() {
    const code = homeRegionCode();
    return code && REGIONS[code] ? REGIONS[code].name : 'Регион';
  }

  function restoreHomeRegionContext() {
    const code = homeRegionCode();
    if (!code || !REGIONS[code]) return;
    currentUser.region = code;
    currentUser.regionId = REGIONS[code].id;
    currentUser.regions = [code];
    currentUser.regionIds = [REGIONS[code].id];
  }

  function ensureStyles() {
    if (document.getElementById('sharedOperatorStyles')) return;
    const style = document.createElement('style');
    style.id = 'sharedOperatorStyles';
    style.textContent = `
      #${CHOOSER_ID} {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(5,7,10,.9);
        backdrop-filter: blur(10px);
      }
      #${CHOOSER_ID} .shared-operator-card {
        width: min(700px,100%);
        max-height: min(760px,calc(100vh - 48px));
        overflow: auto;
        border: 1px solid rgba(255,255,255,.09);
        border-radius: 24px;
        padding: 26px;
        background: #111318;
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
      }
      #${CHOOSER_ID} .shared-operator-head { text-align:center; margin-bottom:20px; }
      #${CHOOSER_ID} .shared-operator-head h2 { margin:0 0 7px; font-size:25px; }
      #${CHOOSER_ID} .shared-operator-head p { margin:0; opacity:.68; }
      #${CHOOSER_ID} .shared-operator-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }
      #${CHOOSER_ID} .shared-operator-choice {
        min-height:58px;
        border:1px solid rgba(255,255,255,.09);
        border-radius:14px;
        padding:12px 14px;
        background:rgba(255,255,255,.035);
        color:inherit;
        font:inherit;
        font-weight:700;
        text-align:left;
        cursor:pointer;
      }
      #${CHOOSER_ID} .shared-operator-choice:hover {
        border-color:rgba(255,255,255,.2);
        background:rgba(255,255,255,.07);
      }
      #${CHOOSER_ID} .shared-operator-choice:disabled {
        opacity:.55;
        cursor:wait;
      }
      #${CHOOSER_ID} .shared-operator-footer {
        display:flex;
        justify-content:center;
        margin-top:18px;
      }
      #${CHOOSER_ID} .shared-operator-empty {
        padding:20px;
        text-align:center;
        border:1px dashed rgba(255,255,255,.12);
        border-radius:14px;
        opacity:.75;
      }
      @media (max-width:650px) {
        #${CHOOSER_ID} .shared-operator-grid { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  async function loadChoices() {
    const { data, error } = await sb.rpc('shared_operator_choices');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function loadOperatorRegions(operatorId) {
    const { data, error } = await sb.rpc('shared_operator_region_choices', {
      p_operator_profile_id: operatorId
    });
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const regionCodes = [];
    const regionIds = [];

    for (const row of rows) {
      const code = row.region_code || REGION_BY_UUID[row.region_id]?.code;
      if (!code || !REGIONS[code] || regionCodes.includes(code)) continue;
      regionCodes.push(code);
      regionIds.push(row.region_id || REGIONS[code].id);
    }

    return { regionCodes, regionIds };
  }

  function updateUserCardRegionText() {
    const card = document.getElementById('userCard');
    const span = card?.querySelector('span');
    const select = document.getElementById('regionSelect');
    if (!span || !select) return;
    const code = select.value;
    span.textContent = REGIONS[code]?.name || homeRegionName();
  }

  function configureRegionSelect(selected) {
    const select = document.getElementById('regionSelect');
    if (!select) return;

    let codes = Array.isArray(selected?.regionCodes)
      ? selected.regionCodes.filter(code => !!REGIONS[code])
      : [];

    if (!codes.length) {
      const home = homeRegionCode();
      if (home && REGIONS[home]) codes = [home];
    }

    codes = [...new Set(codes)];

    const current = select.value;
    const home = homeRegionCode();
    const wanted =
      (selected?.lastRegion && codes.includes(selected.lastRegion) && selected.lastRegion) ||
      (current && codes.includes(current) && current) ||
      (home && codes.includes(home) && home) ||
      codes[0] ||
      '';

    select.innerHTML = codes.map(code =>
      `<option value="${esc(code)}">${esc(REGIONS[code]?.name || code)}</option>`
    ).join('');

    select.value = wanted;
    select.disabled = codes.length <= 1;

    if (wanted && REGIONS[wanted]) {
      currentUser.region = wanted;
      currentUser.regionId = REGIONS[wanted].id;
      currentUser.regions = codes;
      currentUser.regionIds = codes.map(code => REGIONS[code]?.id).filter(Boolean);
    }

    if (!select.dataset.sharedRegionSwitchBound) {
      select.dataset.sharedRegionSwitchBound = '1';
      select.addEventListener('change', () => {
        if (!currentUser?.isSharedRegionAccount) return;
        const value = select.value;
        const picked = readSelectedOperator();
        if (!picked || !picked.regionCodes?.includes(value)) return;

        picked.lastRegion = value;
        saveSelectedOperator(picked);

        currentUser.region = value;
        currentUser.regionId = REGIONS[value]?.id || currentUser.regionId;
        currentUser.regions = [...picked.regionCodes];
        currentUser.regionIds = [...(picked.regionIds || [])];

        updateUserCardRegionText();
      });
    }
  }

  async function fullLogout() {
    clearSelectedOperator();
    removeChooser();
    await sb.auth.signOut();
    currentUser = null;
    recordCache = [];
    showLogin();
  }

  function paintSharedUserCard() {
    if (!currentUser?.isSharedRegionAccount) return;

    const selected = readSelectedOperator();
    const card = document.getElementById('userCard');

    if (card) {
      card.innerHTML = `
        <b>${esc(selected?.fullName || 'Выберите оператора')}</b>
        <span>${esc(homeRegionName())}</span>
        <div class="role-pill">Оператор</div>
        <div class="sync-pill">Сервер подключён</div>
      `;
    }

    if (selected) {
      configureRegionSelect(selected);
      updateUserCardRegionText();
    } else {
      restoreHomeRegionContext();
      const select = document.getElementById('regionSelect');
      const home = homeRegionCode();
      if (select && home && REGIONS[home]) {
        select.innerHTML = `<option value="${esc(home)}">${esc(REGIONS[home].name)}</option>`;
        select.value = home;
        select.disabled = true;
      }
    }

    const logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.textContent = 'Сменить оператора';
      logout.title = 'Выбрать другого оператора';
      logout.onclick = () => {
        clearSelectedOperator();
        paintSharedUserCard();
        showOperatorChooser(true);
      };
    }
  }

  async function hydrateSelectedOperator(selected) {
    if (!selected?.id || !selected?.fullName) return null;
    const fresh = await loadOperatorRegions(selected.id);
    if (!fresh.regionCodes.length) return null;

    const home = homeRegionCode();
    const lastRegion =
      (selected.lastRegion && fresh.regionCodes.includes(selected.lastRegion) && selected.lastRegion) ||
      (home && fresh.regionCodes.includes(home) && home) ||
      fresh.regionCodes[0];

    const value = {
      id: selected.id,
      fullName: selected.fullName,
      regionCodes: fresh.regionCodes,
      regionIds: fresh.regionIds,
      lastRegion,
      selectedAt: selected.selectedAt || new Date().toISOString()
    };

    saveSelectedOperator(value);
    return value;
  }

  async function showOperatorChooser(force = false) {
    if (!currentUser?.isSharedRegionAccount) return true;
    ensureStyles();

    let choices = [];
    try {
      choices = await loadChoices();
    } catch (err) {
      console.error(err);
      toast(err.message || 'Не удалось загрузить список операторов', true);
      return false;
    }

    let selected = readSelectedOperator();
    const selectedStillAvailable =
      selected && choices.some(x => x.operator_profile_id === selected.id);

    if (!force && selectedStillAvailable) {
      try {
        selected = await hydrateSelectedOperator(selected);
      } catch (err) {
        console.error(err);
        selected = null;
      }

      if (selected) {
        paintSharedUserCard();
        removeChooser();
        return true;
      }
    }

    clearSelectedOperator();
    restoreHomeRegionContext();
    removeChooser();

    const overlay = document.createElement('div');
    overlay.id = CHOOSER_ID;
    overlay.innerHTML = `
      <div class="shared-operator-card">
        <div class="shared-operator-head">
          <h2>Кто сейчас работает?</h2>
          <p>${esc(homeRegionName())} · выберите себя</p>
        </div>
        ${choices.length ? `
          <div class="shared-operator-grid">
            ${choices.map(x => `
              <button type="button" class="shared-operator-choice" data-operator-id="${esc(x.operator_profile_id)}">
                ${esc(x.full_name)}
              </button>
            `).join('')}
          </div>
        ` : `
          <div class="shared-operator-empty">В этом регионе пока нет доступных операторов.</div>
        `}
        <div class="shared-operator-footer">
          <button type="button" class="btn ghost" id="sharedOperatorFullLogout">Выйти из регионального аккаунта</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('[data-operator-id]').forEach(button => {
      button.addEventListener('click', async () => {
        const choice = choices.find(x => x.operator_profile_id === button.dataset.operatorId);
        if (!choice) return;

        const buttons = [...overlay.querySelectorAll('[data-operator-id]')];
        buttons.forEach(b => b.disabled = true);

        try {
          const fresh = await loadOperatorRegions(choice.operator_profile_id);
          if (!fresh.regionCodes.length) throw new Error('Для оператора не назначены регионы');

          const home = homeRegionCode();
          const lastRegion =
            (home && fresh.regionCodes.includes(home) && home) ||
            fresh.regionCodes[0];

          saveSelectedOperator({
            id: choice.operator_profile_id,
            fullName: choice.full_name,
            regionCodes: fresh.regionCodes,
            regionIds: fresh.regionIds,
            lastRegion,
            selectedAt: new Date().toISOString()
          });

          removeChooser();
          paintSharedUserCard();
          toast(`Оператор: ${choice.full_name}`);
        } catch (err) {
          console.error(err);
          buttons.forEach(b => b.disabled = false);
          toast(err.message || 'Не удалось загрузить регионы оператора', true);
        }
      });
    });

    document.getElementById('sharedOperatorFullLogout')?.addEventListener('click', fullLogout);
    return false;
  }

  function requireSelectedOperator() {
    if (!currentUser?.isSharedRegionAccount) return true;
    if (readSelectedOperator()) return true;
    showOperatorChooser(true);
    return false;
  }

  loadProfile = async function (...args) {
    const profile = await originalLoadProfileShared.apply(this, args);
    if (!profile) return profile;

    try {
      const { data, error } = await sb
        .from('profiles')
        .select('is_shared_region_account,region_id')
        .eq('id', profile.id)
        .maybeSingle();

      if (error) throw error;

      profile.isSharedRegionAccount = !!data?.is_shared_region_account;

      if (data?.region_id) {
        profile.regionId = data.region_id;
        profile.sharedHomeRegionId = data.region_id;
        profile.sharedHomeRegionCode = regionCodeFromUuid(data.region_id);
      }
    } catch (err) {
      console.warn('shared operator profile check failed', err);
      profile.isSharedRegionAccount = false;
    }

    return profile;
  };

  buildShell = function (...args) {
    const result = originalBuildShellShared.apply(this, args);

    if (currentUser?.isSharedRegionAccount && currentUser.role === 'operator') {
      paintSharedUserCard();
    } else {
      const regionSelect = document.getElementById('regionSelect');
      if (regionSelect) regionSelect.disabled = false;
    }

    return result;
  };

  showApp = function (...args) {
    const result = originalShowAppShared.apply(this, args);
    if (currentUser?.isSharedRegionAccount) {
      setTimeout(() => showOperatorChooser(false), 0);
    }
    return result;
  };

  toDbRecord = function (...args) {
    const payload = originalToDbRecordShared.apply(this, args);

    if (currentUser?.isSharedRegionAccount) {
      const selected = readSelectedOperator();
      if (!selected?.id) throw new Error('Сначала выберите оператора');

      const regionCode = selectedRegionCode();
      if (!selected.regionCodes?.includes(regionCode)) {
        throw new Error('Этот оператор не работает в выбранном регионе');
      }

      payload.operator_profile_id = selected.id;
    }

    return payload;
  };

  openTypePicker = function (...args) {
    if (!requireSelectedOperator()) return;
    return originalOpenTypePickerShared.apply(this, args);
  };

  openRegionPicker = function (...args) {
    if (!requireSelectedOperator()) return;
    return originalOpenRegionPickerShared.apply(this, args);
  };

  openRecordForm = function (...args) {
    if (!requireSelectedOperator()) return;
    return originalOpenRecordFormShared.apply(this, args);
  };

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') removeChooser();
  });
})();
