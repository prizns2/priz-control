(() => {
  // PRIZ Control — ROLE / UI STABILITY v15
  // Replaces v13. Load LAST, after priz-exact-ui.js.
  if (window.__prizRoleUiStabilityV15Installed) return;
  window.__prizRoleUiStabilityV15Installed = true;

  const BLOCKED_ATTENDANCE = new Set([
    'chernihiv','chernigov',
    'poltava',
    'sumy','sumi'
  ]);

  const PARENT_HINTS = {
    chernihiv: ['kyiv','kiev','киев','київ'],
    chernigov: ['kyiv','kiev','киев','київ'],
    poltava: ['kharkiv','harkiv','харьков','харків'],
    sumy: ['kharkiv','harkiv','харьков','харків'],
    sumi: ['kharkiv','harkiv','харьков','харків']
  };

  let managerLoginGuardUntil = 0;

  function roleNow() {
    try { return currentUser?.role || ''; }
    catch (_) { return window.currentUser?.role || ''; }
  }

  function norm(v) {
    return String(v || '').trim().toLowerCase();
  }

  function selectedRegionCode() {
    return document.getElementById('regionSelect')?.value || 'all';
  }

  function regionName(code) {
    try {
      return norm(REGIONS?.[code]?.name || REGIONS?.[code]?.eyebrow || code);
    } catch (_) {
      return norm(code);
    }
  }

  function blockedAttendanceRegion(code) {
    const c = norm(code);
    if (BLOCKED_ATTENDANCE.has(c)) return true;

    const n = regionName(code);
    return (
      n.includes('чернигов') ||
      n.includes('чернігів') ||
      n.includes('полтава') ||
      n.includes('сумы') ||
      n.includes('суми')
    );
  }

  function findRegionCodeByHints(hints) {
    try {
      for (const [code, region] of Object.entries(REGIONS || {})) {
        const hay = `${norm(code)} ${norm(region?.name)} ${norm(region?.eyebrow)}`;
        if (hints.some(h => hay.includes(h))) return code;
      }
    } catch (_) {}
    return null;
  }

  function parentAttendanceRegion(code) {
    const c = norm(code);
    const name = regionName(code);

    if (
      c === 'chernihiv' ||
      c === 'chernigov' ||
      name.includes('чернигов') ||
      name.includes('чернігів')
    ) {
      return findRegionCodeByHints(PARENT_HINTS.chernihiv);
    }

    if (c === 'poltava' || name.includes('полтава')) {
      return findRegionCodeByHints(PARENT_HINTS.poltava);
    }

    if (
      c === 'sumy' ||
      c === 'sumi' ||
      name.includes('сумы') ||
      name.includes('суми')
    ) {
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
      if (currentUser?.region && currentUser.region !== 'all') {
        return [currentUser.region];
      }
    } catch (_) {}

    return [];
  }

  function optionExists(code) {
    const select = document.getElementById('regionSelect');
    if (!select || !code) return false;
    return [...select.options].some(o => o.value === code);
  }

  function allowedAttendanceOptions() {
    const select = document.getElementById('regionSelect');
    if (!select) return [];

    return [...select.options]
      .map(o => o.value)
      .filter(v => v && v !== 'all' && !blockedAttendanceRegion(v));
  }

  function preferredAttendanceRegion() {
    const options = allowedAttendanceOptions();

    // Owner / boss: prefer Kharkiv as the central default if available.
    if (['owner','boss'].includes(roleNow())) {
      const kharkiv = options.find(code => {
        const hay = `${norm(code)} ${regionName(code)}`;
        return hay.includes('kharkiv') || hay.includes('harkiv') ||
               hay.includes('харьков') || hay.includes('харків');
      });
      if (kharkiv) return kharkiv;
    }

    return options[0] || null;
  }

  function shouldShowAttendanceNav() {
    const role = roleNow();

    if (role === 'manager') return false;

    // Owner / boss always keep the Attendance section,
    // but blocked regions are removed INSIDE Attendance.
    if (role === 'owner' || role === 'boss') return true;

    const selected = selectedRegionCode();

    if (selected && selected !== 'all') {
      return !blockedAttendanceRegion(selected);
    }

    return allowedCodes().some(code => !blockedAttendanceRegion(code));
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

    if (recordsBtn?.nextSibling) {
      nav.insertBefore(btn, recordsBtn.nextSibling);
    } else if (recordsBtn) {
      nav.appendChild(btn);
    } else {
      nav.prepend(btn);
    }

    return btn;
  }

  function syncAttendanceNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const existing = nav.querySelector('[data-page="attendance"]');

    if (shouldShowAttendanceNav()) {
      if (!existing) makeAttendanceNavButton();
      return;
    }

    existing?.remove();

    try {
      if (typeof currentPage !== 'undefined' && currentPage === 'attendance') {
        setTimeout(() => {
          try {
            if (typeof go === 'function') go('records');
          } catch (_) {}
        }, 0);
      }
    } catch (_) {}
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
    const select = document.getElementById('regionSelect');
    if (!select) return;

    // Managers do not have Attendance at all.
    if (roleNow() === 'manager') return;

    // Apply the same blocked-region policy to EVERY Attendance user,
    // including owner and boss.
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
    const select = document.getElementById('regionSelect');
    if (!select) return false;

    let code = select.value;

    if (code && code !== 'all' && blockedAttendanceRegion(code)) {
      const parent = parentAttendanceRegion(code);

      if (parent && optionExists(parent) && !blockedAttendanceRegion(parent)) {
        select.value = parent;
        return true;
      }
    }

    if (!code || code === 'all') {
      const preferred = preferredAttendanceRegion();

      if (!preferred) return false;
      select.value = preferred;
      return true;
    }

    if (!blockedAttendanceRegion(code)) return true;

    const fallback = preferredAttendanceRegion();

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
    if (!select || select.dataset.prizAttendanceV15Bound === '1') return;

    select.dataset.prizAttendanceV15Bound = '1';

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

  /* =======================================================
     PROFILE CARD
     ======================================================= */

  function ensureProfileStructure() {
    const card = document.getElementById('userCard');
    if (!card) return;

    let avatar = card.querySelector(':scope > .priz-profile-avatar');

    if (!avatar) {
      avatar = document.createElement('span');
      avatar.className = 'priz-profile-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      card.prepend(avatar);
    }

    // Exact UI may have created <b>P</b><i></i> earlier.
    // Keep ONE visual P only: the CSS ::before glyph + online dot.
    if (
      avatar.querySelector('b') ||
      avatar.childNodes.length !== 1 ||
      avatar.firstElementChild?.tagName !== 'I'
    ) {
      avatar.innerHTML = '<i></i>';
    }

    let copy = card.querySelector(':scope > .priz-profile-copy');

    if (!copy) {
      copy = document.createElement('div');
      copy.className = 'priz-profile-copy';

      [...card.children].forEach(child => {
        if (child === avatar || child === copy) return;
        copy.appendChild(child);
      });

      card.appendChild(copy);
    } else {
      // shared-operator-account may repaint userCard.innerHTML.
      // Move any newly created profile text back into the dedicated copy column.
      [...card.children].forEach(child => {
        if (child === avatar || child === copy) return;
        copy.appendChild(child);
      });
    }
  }

  /* =======================================================
     ROLE MARKER / CSS
     ======================================================= */

  function syncRoleMarker() {
    const role = roleNow();

    if (role) {
      document.documentElement.dataset.prizRole = role;
    } else {
      delete document.documentElement.dataset.prizRole;
    }
  }

  function injectV14Styles() {
    if (document.getElementById('prizRoleUiV15Styles')) return;

    const style = document.createElement('style');
    style.id = 'prizRoleUiV15Styles';

    style.textContent = `
      /* Manager: technical record ID must never paint. */
      html[data-priz-role="manager"] #viewDialogBody .dialog-head > div > h3{
        display:none!important;
      }

      /* Manager: remove redundant Manager / name / region banner. */
      html[data-priz-role="manager"] .manager-records-head{
        display:none!important;
      }

      /* Hide dialogs while their role-specific action set is being completed. */
      html[data-priz-manager-dialog-preload="1"] #viewDialog[open],
      html[data-priz-senior-dialog-preload="1"] #viewDialog[open]{
        visibility:hidden!important;
        opacity:0!important;
        pointer-events:none!important;
      }

      /* Operator profile: real 2-column layout. */
      #userCard.user-card{
        position:relative!important;
        display:grid!important;
        grid-template-columns:48px minmax(0,1fr)!important;
        grid-template-rows:auto!important;
        align-items:start!important;
        column-gap:14px!important;
        row-gap:0!important;
        padding:15px 13px!important;
      }

      /* Shared operator account can replace userCard.innerHTML in one operation.
         These direct-child rules make that intermediate DOM safe immediately. */
      #userCard.user-card > b,
      #userCard.user-card > span:not(.priz-profile-avatar),
      #userCard.user-card > .role-pill,
      #userCard.user-card > .sync-pill{
        grid-column:2!important;
        position:static!important;
        inset:auto!important;
        width:auto!important;
        height:auto!important;
        min-width:0!important;
        min-height:0!important;
        transform:none!important;
      }

      #userCard.user-card > b{
        grid-row:1!important;
        margin:0 0 4px!important;
        align-self:start!important;
      }

      #userCard.user-card > span:not(.priz-profile-avatar){
        margin:23px 0 0!important;
        align-self:start!important;
        color:#8f9ab1!important;
        background:none!important;
        border:0!important;
        box-shadow:none!important;
      }

      #userCard.user-card > .role-pill{
        margin-top:43px!important;
        align-self:start!important;
        justify-self:start!important;
      }

      #userCard.user-card > .sync-pill{
        margin-top:67px!important;
        align-self:start!important;
        justify-self:start!important;
      }

      #userCard > .priz-profile-avatar{
        position:relative!important;
        inset:auto!important;
        grid-column:1!important;
        grid-row:1!important;
        width:44px!important;
        height:44px!important;
        min-width:44px!important;
        min-height:44px!important;
        display:grid!important;
        place-items:center!important;
        margin:0!important;
        padding:0!important;
        border-radius:50%!important;
        overflow:visible!important;
        color:#fff!important;
        background:linear-gradient(145deg,#6333d7,#8a55f4)!important;
        border:1px solid rgba(197,161,255,.51)!important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.13),
          0 0 24px rgba(124,58,237,.25)!important;
      }

      #userCard > .priz-profile-avatar::before{
        content:"P";
        color:#fff;
        font-size:17px;
        line-height:1;
        font-weight:900;
      }

      #userCard > .priz-profile-avatar{
        font-size:0!important;
        text-indent:0!important;
      }

      #userCard > .priz-profile-avatar > b,
      #userCard > .priz-profile-avatar > span{
        display:none!important;
      }

      #userCard > .priz-profile-avatar > i{
        position:absolute!important;
        right:-1px!important;
        bottom:-1px!important;
        width:10px!important;
        height:10px!important;
        border-radius:50%!important;
        background:#28df70!important;
        border:2px solid #141a29!important;
        box-shadow:0 0 9px rgba(40,223,112,.6)!important;
      }

      #userCard > .priz-profile-copy{
        grid-column:2!important;
        grid-row:1!important;
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        margin:0!important;
        padding:0!important;
      }

      #userCard > .priz-profile-copy > b{
        display:block!important;
        width:100%!important;
        margin:0 0 4px!important;
        padding:0!important;
        color:#fff!important;
        font-size:12px!important;
        line-height:1.28!important;
        font-weight:900!important;
        overflow-wrap:anywhere!important;
      }

      #userCard > .priz-profile-copy > span{
        position:static!important;
        display:block!important;
        width:auto!important;
        height:auto!important;
        min-width:0!important;
        min-height:0!important;
        margin:0!important;
        padding:0!important;
        color:#8f9ab1!important;
        background:none!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
        transform:none!important;
        font-size:9.5px!important;
        line-height:1.35!important;
      }

      #userCard > .priz-profile-copy > .role-pill{
        margin-top:7px!important;
      }

      #userCard > .priz-profile-copy > .sync-pill{
        margin-top:7px!important;
      }

      @media(min-width:1400px){
        #userCard.user-card{
          grid-template-columns:58px minmax(0,1fr)!important;
          column-gap:17px!important;
          padding:19px 16px!important;
        }

        #userCard > .priz-profile-avatar{
          width:54px!important;
          height:54px!important;
          min-width:54px!important;
          min-height:54px!important;
        }

        #userCard > .priz-profile-avatar::before{
          font-size:20px!important;
        }

        #userCard > .priz-profile-copy > b{
          font-size:15px!important;
        }

        #userCard > .priz-profile-copy > span{
          font-size:12px!important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     DELETE REQUEST
     ======================================================= */

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

        <p class="muted small">
          Коротко объясните руководителю, почему запись нужно удалить. Минимум 5 символов.
        </p>

        <label>
          Причина
          <textarea id="deletionRequestReason"
                    maxlength="1000"
                    placeholder="Например: запись внесена дважды"
                    required></textarea>
        </label>

        <div class="dialog-actions">
          <button value="cancel" class="btn ghost">Отмена</button>
          <button type="button" id="deletionRequestSend" class="btn danger">
            Отправить руководителю
          </button>
        </div>
      </form>
    `;

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

  function installSeniorDeleteButton(recordId) {
    if (roleNow() !== 'senior') return true;

    const root = document.getElementById('viewDialogBody');
    const actions = root?.querySelector('.dialog-actions');

    if (!actions) return false;

    let cached = null;

    try {
      cached = (recordCache || []).find(x => x.id === recordId) || null;
    } catch (_) {}

    const isEvaluation =
      cached?.kind === 'eval' ||
      cached?.kind === 'evaluation' ||
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

  function waitForSeniorFinalDialog(recordId, timeoutMs=1800) {
    if (roleNow() !== 'senior') return Promise.resolve();

    return new Promise(resolve => {
      if (installSeniorDeleteButton(recordId)) {
        resolve();
        return;
      }

      const root = document.getElementById('viewDialogBody');

      if (!root) {
        resolve();
        return;
      }

      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      };

      const observer = new MutationObserver(() => {
        if (installSeniorDeleteButton(recordId)) finish();
      });

      observer.observe(root, { childList:true, subtree:true });

      const timer = setTimeout(finish, timeoutMs);
    });
  }

  /* =======================================================
     MANAGER
     ======================================================= */

  async function managerRecordPreflight(id) {
    let cached = null;

    try {
      cached = (recordCache || []).find(x => x.id === id) || null;
    } catch (_) {}

    if (cached) {
      return {
        exists:true,
        regionId:cached.regionId || null
      };
    }

    try {
      const { data, error } = await sb
        .from('records')
        .select('id,region_id')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      return {
        exists:!!data,
        regionId:data?.region_id || null
      };
    } catch (err) {
      console.warn('Manager record preflight failed:', err);

      return {
        exists:true,
        regionId:null
      };
    }
  }

  function stripManagerTechnicalHeading() {
    if (roleNow() !== 'manager') return;

    const head = document.querySelector('#viewDialogBody .dialog-head');
    const h3 = head?.querySelector(':scope > div > h3');

    if (h3) {
      h3.remove();
    }
  }

  /* =======================================================
     APP / SHELL
     ======================================================= */

  const baseShowApp =
    typeof showApp === 'function'
      ? showApp
      : window.showApp;

  if (typeof baseShowApp === 'function') {
    const fixedShowApp = function (...args) {
      syncRoleMarker();

      try {
        window.prizInvalidateNavigationCache?.('all');
      } catch (_) {}

      try {
        window.prizInvalidateReadCache?.('all');
      } catch (_) {}

      if (roleNow() === 'manager') {
        managerLoginGuardUntil = Date.now() + 8000;
      }

      const result = baseShowApp.apply(this, args);

      setTimeout(() => {
        syncRoleMarker();
        ensureProfileStructure();
        bindRegionSelect();
        syncAttendanceNav();
        syncAttendancePageOptions();
      }, 0);

      return result;
    };

    try { showApp = fixedShowApp; } catch (_) {}
    window.showApp = fixedShowApp;
  }

  const baseBuildShell =
    typeof buildShell === 'function'
      ? buildShell
      : window.buildShell;

  if (typeof baseBuildShell === 'function') {
    const fixedBuildShell = function (...args) {
      syncRoleMarker();

      const result = baseBuildShell.apply(this, args);

      ensureProfileStructure();
      bindRegionSelect();
      syncAttendanceNav();
      syncAttendancePageOptions();

      return result;
    };

    try { buildShell = fixedBuildShell; } catch (_) {}
    window.buildShell = fixedBuildShell;
  }

  const baseGo =
    typeof go === 'function'
      ? go
      : window.go;

  if (typeof baseGo === 'function') {
    const fixedGo = function (page, ...rest) {
      if (page === 'attendance') {
        if (!shouldShowAttendanceNav()) {
          page = 'records';
        } else if (!normalizeAttendanceSelection()) {
          page = 'records';
        }
      }

      if (page !== 'attendance') {
        restoreAttendanceOptions();
      }

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

  /* =======================================================
     VIEW RECORD — NO FLASH
     ======================================================= */

  const baseViewRecord =
    typeof viewRecord === 'function'
      ? viewRecord
      : window.viewRecord;

  if (typeof baseViewRecord === 'function') {
    const fixedViewRecord = async function (id) {
      const role = roleNow();

      if (role === 'senior') {
        document.documentElement.dataset.prizSeniorDialogPreload = '1';
      }

      if (role === 'manager') {
        document.documentElement.dataset.prizManagerDialogPreload = '1';
      }

      try {
        if (role === 'manager') {
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

              if (
                code &&
                select &&
                [...select.options].some(o => o.value === code)
              ) {
                select.value = code;
              }
            } catch (_) {}
          }
        }

        const result = await baseViewRecord.apply(this, arguments);

        if (role === 'manager') {
          stripManagerTechnicalHeading();
        }

        if (role === 'senior') {
          await waitForSeniorFinalDialog(id);
        }

        return result;
      } finally {
        if (role === 'manager') {
          stripManagerTechnicalHeading();
          delete document.documentElement.dataset.prizManagerDialogPreload;
        }

        if (role === 'senior') {
          installSeniorDeleteButton(id);
          delete document.documentElement.dataset.prizSeniorDialogPreload;
        }
      }
    };

    try { viewRecord = fixedViewRecord; } catch (_) {}
    window.viewRecord = fixedViewRecord;
  }

  /* =======================================================
     OBSERVERS
     ======================================================= */

  const userCard = document.getElementById('userCard');

  if (userCard) {
    let profileSyncing = false;

    const profileObserver = new MutationObserver(() => {
      if (profileSyncing) return;

      // MutationObserver runs before the next paint.
      // Repair shared-account innerHTML immediately so there is no visible
      // frame with region/name on top of the avatar.
      profileSyncing = true;
      ensureProfileStructure();

      queueMicrotask(() => {
        profileSyncing = false;
      });
    });

    profileObserver.observe(userCard, {
      childList:true,
      subtree:false
    });
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

    navObserver.observe(nav, {
      childList:true,
      subtree:false
    });
  }

  injectV14Styles();
  syncRoleMarker();
  ensureProfileStructure();
  bindRegionSelect();
  syncAttendanceNav();
  syncAttendancePageOptions();
})();
