(() => {
  // PRIZ Control — ROLE / UI STABILITY v13
  // Replaces v12. Load LAST, after priz-exact-ui.js.
  if (window.__prizRoleUiStabilityV13Installed) return;
  window.__prizRoleUiStabilityV13Installed = true;

  const BLOCKED_ATTENDANCE = new Set(['chernihiv', 'chernigov', 'poltava', 'sumy', 'sumi']);
  const PARENT_HINTS = {
    chernihiv: ['kyiv','kiev','киев','київ'],
    chernigov: ['kyiv','kiev','киев','київ'],
    poltava:   ['kharkiv','harkiv','харьков','харків'],
    sumy:      ['kharkiv','harkiv','харьков','харків'],
    sumi:      ['kharkiv','harkiv','харьков','харків']
  };

  let managerLoginGuardUntil = 0;

  function roleNow() {
    try { return currentUser?.role || ''; }
    catch (_) { return window.currentUser?.role || ''; }
  }

  function selectedRegionCode() {
    return document.getElementById('regionSelect')?.value || 'all';
  }

  function norm(v) {
    return String(v || '').trim().toLowerCase();
  }

  function regionName(code) {
    try { return norm(REGIONS?.[code]?.name || REGIONS?.[code]?.eyebrow || code); }
    catch (_) { return norm(code); }
  }

  function blockedAttendanceRegion(code) {
    const c = norm(code);
    if (BLOCKED_ATTENDANCE.has(c)) return true;
    const name = regionName(code);
    return (
      name.includes('чернигов') || name.includes('чернігів') ||
      name.includes('полтава') ||
      name.includes('сумы') || name.includes('суми')
    );
  }

  function findRegionCodeByHints(hints) {
    try {
      for (const [code, r] of Object.entries(REGIONS || {})) {
        const hay = `${norm(code)} ${norm(r?.name)} ${norm(r?.eyebrow)}`;
        if (hints.some(h => hay.includes(h))) return code;
      }
    } catch (_) {}
    return null;
  }

  function parentAttendanceRegion(code) {
    const c = norm(code);

    if (c === 'chernihiv' || c === 'chernigov' ||
        regionName(code).includes('чернигов') || regionName(code).includes('чернігів')) {
      return findRegionCodeByHints(PARENT_HINTS.chernihiv);
    }

    if (c === 'poltava' || regionName(code).includes('полтава')) {
      return findRegionCodeByHints(PARENT_HINTS.poltava);
    }

    if (c === 'sumy' || c === 'sumi' ||
        regionName(code).includes('сумы') || regionName(code).includes('суми')) {
      return findRegionCodeByHints(PARENT_HINTS.sumy);
    }

    return code;
  }

  function allowedCodes() {
    try {
      if (typeof allowedRegionCodes === 'function') {
        const list = allowedRegionCodes().filter(Boolean);
        if (list.length) return list;
      }
    } catch (_) {}

    try {
      if (currentUser?.region && currentUser.region !== 'all') return [currentUser.region];
    } catch (_) {}

    return [];
  }

  function optionExists(code) {
    const select = document.getElementById('regionSelect');
    if (!select || !code) return false;
    return [...select.options].some(o => o.value === code);
  }

  function firstAllowedAttendanceRegion() {
    const select = document.getElementById('regionSelect');
    if (!select) return null;

    const options = [...select.options]
      .map(o => o.value)
      .filter(v => v && v !== 'all' && !blockedAttendanceRegion(v));

    return options[0] || null;
  }

  function shouldShowAttendanceNav() {
    const role = roleNow();

    if (role === 'manager') return false;
    if (role === 'owner' || role === 'boss') return true;

    const selected = selectedRegionCode();

    // For normal operators / seniors the nav follows the region they are viewing.
    if (selected && selected !== 'all') {
      return !blockedAttendanceRegion(selected);
    }

    const allowed = allowedCodes();
    return allowed.some(code => !blockedAttendanceRegion(code));
  }

  function makeAttendanceNavButton() {
    const nav = document.getElementById('nav');
    if (!nav) return null;

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.page = 'attendance';
    btn.innerHTML = '<span class="nav-ico">▦</span><span>Табель</span>';
    btn.onclick = () => {
      if (typeof go === 'function') go('attendance');
    };

    const recordsBtn = nav.querySelector('[data-page="records"]');
    if (recordsBtn?.nextSibling) nav.insertBefore(btn, recordsBtn.nextSibling);
    else if (recordsBtn) nav.appendChild(btn);
    else nav.prepend(btn);

    return btn;
  }

  function syncAttendanceNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const existing = nav.querySelector('[data-page="attendance"]');

    if (shouldShowAttendanceNav()) {
      if (!existing) makeAttendanceNavButton();
    } else {
      existing?.remove();

      try {
        if (typeof currentPage !== 'undefined' && currentPage === 'attendance') {
          setTimeout(() => {
            try { if (typeof go === 'function') go('records'); } catch (_) {}
          }, 0);
        }
      } catch (_) {}
    }
  }

  function restoreAttendanceOptions() {
    const select = document.getElementById('regionSelect');
    if (!select) return;

    [...select.options].forEach(option => {
      if (option.dataset.prizAttendanceHidden === '1') {
        option.hidden = false;
        option.disabled = false;
        delete option.dataset.prizAttendanceHidden;
      }
    });
  }

  function filterAttendanceOptions() {
    const role = roleNow();
    if (role === 'owner' || role === 'boss' || role === 'manager') return;

    const select = document.getElementById('regionSelect');
    if (!select) return;

    [...select.options].forEach(option => {
      if (!option.value || option.value === 'all') return;

      if (blockedAttendanceRegion(option.value)) {
        option.hidden = true;
        option.disabled = true;
        option.dataset.prizAttendanceHidden = '1';
      }
    });
  }

  function normalizeAttendanceSelection() {
    const role = roleNow();
    if (role === 'owner' || role === 'boss') return true;

    const select = document.getElementById('regionSelect');
    if (!select) return false;

    let code = select.value;

    if (code === 'all' || !code) {
      const first = firstAllowedAttendanceRegion();
      if (!first) return false;
      select.value = first;
      code = first;
    }

    if (!blockedAttendanceRegion(code)) return true;

    const parent = parentAttendanceRegion(code);

    if (parent && optionExists(parent)) {
      select.value = parent;
      return true;
    }

    const fallback = firstAllowedAttendanceRegion();
    if (fallback) {
      select.value = fallback;
      return true;
    }

    return false;
  }

  function syncAttendancePageOptions() {
    restoreAttendanceOptions();

    try {
      if (typeof currentPage !== 'undefined' && currentPage === 'attendance') {
        normalizeAttendanceSelection();
        filterAttendanceOptions();
      }
    } catch (_) {}
  }

  function bindRegionSelect() {
    const select = document.getElementById('regionSelect');
    if (!select || select.dataset.prizAttendanceV13Bound === '1') return;
    select.dataset.prizAttendanceV13Bound = '1';

    // CAPTURE: correct a blocked attendance region before the application's
    // own onchange/renderPage logic sees it.
    select.addEventListener('change', () => {
      try {
        if (typeof currentPage !== 'undefined' && currentPage === 'attendance') {
          normalizeAttendanceSelection();
          filterAttendanceOptions();
        }
      } catch (_) {}

      setTimeout(() => {
        syncAttendanceNav();
        syncAttendancePageOptions();
      }, 0);
    }, true);
  }

  function syncRoleMarker() {
    const role = roleNow();
    if (role) document.documentElement.dataset.prizRole = role;
    else delete document.documentElement.dataset.prizRole;
  }

  function ensureProfileAvatar() {
    const card = document.getElementById('userCard');
    if (!card) return;

    if (!card.querySelector('.priz-profile-avatar')) {
      const avatar = document.createElement('span');
      avatar.className = 'priz-profile-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.innerHTML = '<b>P</b><i></i>';
      card.prepend(avatar);
    }
  }

  function injectV13Styles() {
    if (document.getElementById('prizRoleUiV13Styles')) return;

    const style = document.createElement('style');
    style.id = 'prizRoleUiV13Styles';
    style.textContent = `
      /* Manager: hide technical record ID BEFORE the dialog can paint. */
      html[data-priz-role="manager"] #viewDialogBody .dialog-head > div > h3{
        display:none!important;
      }

      /* Manager: remove the redundant large manager banner above Records. */
      html[data-priz-role="manager"] .manager-records-head{
        display:none!important;
      }

      /* Stable fallback avatar. */
      #userCard .priz-profile-avatar{
        position:absolute!important;
        left:14px!important;
        top:16px!important;
        width:42px!important;
        height:42px!important;
        display:grid!important;
        place-items:center!important;
        border-radius:50%!important;
        overflow:visible!important;
      }

      #userCard .priz-profile-avatar > b{
        display:none!important;
      }

      #userCard .priz-profile-avatar::before{
        content:"P";
        display:block;
        color:#fff;
        font-size:17px;
        line-height:1;
        font-weight:900;
      }

      #userCard > span:not(.priz-profile-avatar){
        position:static!important;
        width:auto!important;
        height:auto!important;
        min-width:0!important;
        min-height:0!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        border-radius:0!important;
        background:none!important;
        box-shadow:none!important;
        transform:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  async function refreshDeletionBadgeFast() {
    try {
      const badge = document.getElementById('delreqBadge');
      if (!badge) return;

      const { data, error } = await sb.rpc('deletion_requests_badge');
      if (error) return;

      const n = Number(data || 0);
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.toggle('show', n > 0);
    } catch (_) {}
  }

  function ensureDeletionRequestDialog() {
    let d = document.getElementById('deletionRequestDialog');
    if (d) return d;

    d = document.createElement('dialog');
    d.id = 'deletionRequestDialog';
    d.className = 'dialog';
    d.innerHTML = `
      <form method="dialog" class="dialog-card delreq-dialog-card" id="deletionRequestForm">
        <div class="dialog-head">
          <div>
            <div class="eyebrow">ЗАЯВКА НА УДАЛЕНИЕ</div>
            <h3 style="margin-top:6px">Причина удаления</h3>
          </div>
          <button class="close-x" value="cancel">×</button>
        </div>
        <p class="muted small">Коротко объясните руководителю, почему запись нужно удалить. Минимум 5 символов.</p>
        <label>
          Причина
          <textarea id="deletionRequestReason" maxlength="1000"
                    placeholder="Например: запись внесена дважды" required></textarea>
        </label>
        <div class="dialog-actions">
          <button value="cancel" class="btn ghost">Отмена</button>
          <button type="button" id="deletionRequestSend" class="btn danger">Отправить руководителю</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    return d;
  }

  function openDeletionRequestFast(recordId) {
    const d = ensureDeletionRequestDialog();
    const reason = document.getElementById('deletionRequestReason');
    const send = document.getElementById('deletionRequestSend');
    if (!reason || !send) return;

    reason.value = '';
    d.showModal();
    setTimeout(() => reason.focus(), 0);

    send.onclick = async () => {
      const text = reason.value.trim();

      if (text.length < 5) {
        toast('Укажите причину удаления', true);
        return;
      }

      setBusy(send, true, 'Отправляем…');

      try {
        const { error } = await sb.rpc('deletion_request_create', {
          p_record_id: recordId,
          p_reason: text
        });
        if (error) throw error;

        d.close();
        toast('Заявка отправлена руководителю');
        window.prizInvalidateNavigationCache?.(['deletionRequests']);
        await refreshDeletionBadgeFast();
      } catch (e) {
        const msg = String(e?.message || e || '');
        toast(
          msg.includes('active request')
            ? 'На эту запись уже есть активная заявка'
            : 'Не удалось отправить заявку: ' + msg,
          true
        );
      } finally {
        setBusy(send, false);
      }
    };
  }

  function installImmediateSeniorDeleteButton(recordId) {
    if (roleNow() !== 'senior') return false;

    const root = document.getElementById('viewDialogBody');
    const actions = root?.querySelector('.dialog-actions');
    if (!actions) return false;

    let cached = null;
    try { cached = (recordCache || []).find(x => x.id === recordId) || null; } catch (_) {}

    const isEvaluation =
      cached?.kind === 'eval' ||
      !!root.querySelector('.badge.eval');

    if (isEvaluation) return true;
    if (actions.querySelector('.delreq-request-button')) return true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn danger delreq-request-button';
    btn.textContent = 'Запросить удаление';
    btn.onclick = () => openDeletionRequestFast(recordId);
    actions.insertBefore(btn, actions.firstChild);
    return true;
  }

  function watchSeniorRecordDialog(recordId) {
    if (roleNow() !== 'senior') return () => {};

    const root = document.getElementById('viewDialogBody');
    if (!root) return () => {};

    let done = false;

    const observer = new MutationObserver(() => {
      if (installImmediateSeniorDeleteButton(recordId)) {
        done = true;
        observer.disconnect();
      }
    });

    observer.observe(root, { childList:true, subtree:true });

    if (installImmediateSeniorDeleteButton(recordId)) {
      done = true;
      observer.disconnect();
    }

    const timer = setTimeout(() => {
      if (!done) observer.disconnect();
    }, 5000);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }

  async function managerRecordPreflight(id) {
    let cached = null;
    try { cached = (recordCache || []).find(x => x.id === id) || null; } catch (_) {}

    if (cached) return { exists:true, regionId:cached.regionId || null };

    try {
      const { data, error } = await sb
        .from('records')
        .select('id,region_id')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { exists:!!data, regionId:data?.region_id || null };
    } catch (err) {
      console.warn('Manager record preflight failed:', err);
      return { exists:true, regionId:null };
    }
  }

  /* ------- SHOW APP ------- */
  const baseShowApp = typeof showApp === 'function' ? showApp : window.showApp;

  if (typeof baseShowApp === 'function') {
    const fixedShowApp = function (...args) {
      syncRoleMarker();

      try { window.prizInvalidateNavigationCache?.('all'); } catch (_) {}
      try { window.prizInvalidateReadCache?.('all'); } catch (_) {}

      if (roleNow() === 'manager') {
        managerLoginGuardUntil = Date.now() + 8000;
      }

      const result = baseShowApp.apply(this, args);

      setTimeout(() => {
        syncRoleMarker();
        ensureProfileAvatar();
        bindRegionSelect();
        syncAttendanceNav();
        syncAttendancePageOptions();
      }, 0);

      return result;
    };

    try { showApp = fixedShowApp; } catch (_) {}
    window.showApp = fixedShowApp;
  }

  /* ------- BUILD SHELL ------- */
  const baseBuildShell = typeof buildShell === 'function' ? buildShell : window.buildShell;

  if (typeof baseBuildShell === 'function') {
    const fixedBuildShell = function (...args) {
      syncRoleMarker();
      const result = baseBuildShell.apply(this, args);

      ensureProfileAvatar();
      bindRegionSelect();
      syncAttendanceNav();
      syncAttendancePageOptions();

      return result;
    };

    try { buildShell = fixedBuildShell; } catch (_) {}
    window.buildShell = fixedBuildShell;
  }

  /* ------- GO ------- */
  const baseGo = typeof go === 'function' ? go : window.go;

  if (typeof baseGo === 'function') {
    const fixedGo = function (page, ...rest) {
      if (page === 'attendance') {
        if (!shouldShowAttendanceNav()) {
          page = 'records';
        } else if (!normalizeAttendanceSelection()) {
          page = 'records';
        }
      }

      if (page !== 'attendance') restoreAttendanceOptions();

      const result = baseGo.call(this, page, ...rest);

      setTimeout(() => {
        syncAttendanceNav();
        syncAttendancePageOptions();
      }, 0);

      return result;
    };

    try { go = fixedGo; } catch (_) {}
    window.go = fixedGo;
  }

  /* ------- VIEW RECORD ------- */
  const baseViewRecord = typeof viewRecord === 'function' ? viewRecord : window.viewRecord;

  if (typeof baseViewRecord === 'function') {
    const fixedViewRecord = async function (id) {
      const stopSeniorWatch = watchSeniorRecordDialog(id);

      try {
        if (roleNow() === 'manager') {
          const check = await managerRecordPreflight(id);

          if (!check.exists) {
            if (Date.now() >= managerLoginGuardUntil) {
              toast('Эта запись больше не существует', true);
            }
            return;
          }

          if (check.regionId) {
            try {
              const code =
                typeof regionCodeFromUuid === 'function'
                  ? regionCodeFromUuid(check.regionId)
                  : null;

              const select = document.getElementById('regionSelect');

              if (code && select && [...select.options].some(o => o.value === code)) {
                select.value = code;
              }
            } catch (_) {}
          }
        }

        return await baseViewRecord.apply(this, arguments);
      } finally {
        setTimeout(stopSeniorWatch, 1200);
      }
    };

    try { viewRecord = fixedViewRecord; } catch (_) {}
    window.viewRecord = fixedViewRecord;
  }

  /* ------- OBSERVERS ------- */
  const userCard = document.getElementById('userCard');
  if (userCard) {
    const profileObserver = new MutationObserver(() => ensureProfileAvatar());
    profileObserver.observe(userCard, { childList:true, subtree:false });
  }

  const nav = document.getElementById('nav');
  if (nav) {
    let navSyncing = false;

    const navObserver = new MutationObserver(() => {
      if (navSyncing) return;
      navSyncing = true;
      requestAnimationFrame(() => {
        navSyncing = false;
        syncAttendanceNav();
      });
    });

    navObserver.observe(nav, { childList:true, subtree:false });
  }

  injectV13Styles();
  syncRoleMarker();
  ensureProfileAvatar();
  bindRegionSelect();
  syncAttendanceNav();
  syncAttendancePageOptions();
})();
