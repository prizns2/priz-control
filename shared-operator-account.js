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

  function writeSelectedOperator(choice) {
    const key = keyForCurrentAccount();
    if (!key) return;
    sessionStorage.setItem(key, JSON.stringify({
      id: choice.operator_profile_id,
      fullName: choice.full_name,
      selectedAt: new Date().toISOString()
    }));
  }

  function clearSelectedOperator() {
    const key = keyForCurrentAccount();
    if (key) sessionStorage.removeItem(key);
  }

  function removeChooser() {
    document.getElementById(CHOOSER_ID)?.remove();
  }

  function getRegionName() {
    if (currentUser?.regionId && REGION_BY_UUID[currentUser.regionId]?.name) {
      return REGION_BY_UUID[currentUser.regionId].name;
    }
    if (currentUser?.region && REGIONS[currentUser.region]?.name) {
      return REGIONS[currentUser.region].name;
    }
    return 'Регион';
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
        <span>${esc(getRegionName())}</span>
        <div class="role-pill">Оператор</div>
        <div class="sync-pill">Сервер подключён</div>
      `;
    }

    const regionSelect = document.getElementById('regionSelect');
    if (regionSelect) regionSelect.disabled = true;

    const logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.textContent = 'Сменить оператора';
      logout.title = 'Выбрать другого оператора этого региона';
      logout.onclick = () => {
        clearSelectedOperator();
        paintSharedUserCard();
        showOperatorChooser(true);
      };
    }
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

    const selected = readSelectedOperator();
    if (!force && selected && choices.some(x => x.operator_profile_id === selected.id)) {
      paintSharedUserCard();
      removeChooser();
      return true;
    }

    clearSelectedOperator();
    removeChooser();

    const overlay = document.createElement('div');
    overlay.id = CHOOSER_ID;
    overlay.innerHTML = `
      <div class="shared-operator-card">
        <div class="shared-operator-head">
          <h2>Кто сейчас работает?</h2>
          <p>${esc(getRegionName())} · выберите себя</p>
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
      button.addEventListener('click', () => {
        const choice = choices.find(x => x.operator_profile_id === button.dataset.operatorId);
        if (!choice) return;
        writeSelectedOperator(choice);
        removeChooser();
        paintSharedUserCard();
        toast(`Оператор: ${choice.full_name}`);
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
      if (data?.region_id) profile.regionId = data.region_id;
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
