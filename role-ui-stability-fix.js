(() => {
  // PRIZ Control — role / profile / manager / attendance stability fixes.
  // Load LAST, after priz-exact-ui.js.
  if (window.__prizRoleUiStabilityV12Installed) return;
  window.__prizRoleUiStabilityV12Installed = true;

  const BLOCKED_ATTENDANCE_CODES = new Set([
    'chernihiv', 'chernigov',
    'poltava',
    'sumy', 'sumi'
  ]);

  const BLOCKED_ATTENDANCE_NAMES = [
    'чернигов', 'чернігів',
    'полтава',
    'сумы', 'суми'
  ];

  let managerLoginGuardUntil = 0;

  function roleNow() {
    try { return currentUser?.role || ''; }
    catch (_) { return window.currentUser?.role || ''; }
  }

  function isManager() {
    return roleNow() === 'manager';
  }

  function isSenior() {
    return roleNow() === 'senior';
  }

  function normalizeText(v) {
    return String(v || '').trim().toLowerCase();
  }

  function isAttendanceBlockedRegion(code) {
    const c = normalizeText(code);
    if (BLOCKED_ATTENDANCE_CODES.has(c)) return true;

    try {
      const name = normalizeText(REGIONS?.[code]?.name);
      return BLOCKED_ATTENDANCE_NAMES.some(x => name.includes(x));
    } catch (_) {
      return false;
    }
  }

  function attendanceMustBeHidden() {
    const role = roleNow();

    // Managers never use the attendance page.
    if (role === 'manager') return true;

    // Owner / boss keep central access to Kharkiv/Kyiv attendance.
    if (role === 'owner' || role === 'boss') return false;

    let regions = [];
    try {
      if (typeof allowedRegionCodes === 'function') {
        regions = allowedRegionCodes().filter(Boolean);
      }
    } catch (_) {}

    if (!regions.length) {
      try {
        const one = currentUser?.region;
        if (one && one !== 'all') regions = [one];
      } catch (_) {}
    }

    // If all regions assigned to this operator/senior are ones whose attendance
    // is maintained centrally elsewhere, there should be no Attendance nav item.
    return regions.length > 0 && regions.every(isAttendanceBlockedRegion);
  }

  function enforceAttendanceNav() {
    if (!attendanceMustBeHidden()) return;

    document.querySelector('[data-page="attendance"]')?.remove();

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

  function ensureProfileAvatar() {
    const card = document.getElementById('userCard');
    if (!card) return;

    if (card.querySelector('.priz-profile-avatar')) return;

    const avatar = document.createElement('span');
    avatar.className = 'priz-profile-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = '<b>P</b><i></i>';
    card.prepend(avatar);
  }

  function hideManagerInternalRecordId() {
    if (!isManager()) return;
    const head = document.querySelector('#viewDialogBody .dialog-head');
    if (!head) return;

    // The h3 in the base viewRecord dialog is the technical ID:
    // KHARKIV-20260905-CAT2-83E76D etc.
    const technicalId = head.querySelector('h3');
    if (technicalId) {
      technicalId.style.display = 'none';
      technicalId.setAttribute('aria-hidden', 'true');
    }
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
    if (!isSenior()) return false;

    const root = document.getElementById('viewDialogBody');
    const actions = root?.querySelector('.dialog-actions');
    if (!actions) return false;

    // No deletion requests for evaluations.
    const cached = (() => {
      try { return (recordCache || []).find(x => x.id === recordId) || null; }
      catch (_) { return null; }
    })();

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
    if (!isSenior()) return () => {};

    const root = document.getElementById('viewDialogBody');
    if (!root) return () => {};

    let closed = false;
    let timer = null;

    const stop = () => {
      if (closed) return;
      closed = true;
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };

    const observer = new MutationObserver(() => {
      if (installImmediateSeniorDeleteButton(recordId)) stop();
    });

    observer.observe(root, { childList: true, subtree: true });

    // In case the dialog DOM already exists by the time the watcher starts.
    if (installImmediateSeniorDeleteButton(recordId)) stop();

    timer = setTimeout(stop, 5000);
    return stop;
  }

  async function managerRecordPreflight(id) {
    let cached = null;
    try {
      cached = (recordCache || []).find(x => x.id === id) || null;
    } catch (_) {}

    if (cached) return { exists: true, regionId: cached.regionId || null };

    try {
      const { data, error } = await sb
        .from('records')
        .select('id,region_id')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return {
        exists: !!data,
        regionId: data?.region_id || null
      };
    } catch (err) {
      console.warn('Manager record preflight failed:', err);
      // Do not block normal opening if the preflight itself failed.
      return { exists: true, regionId: null };
    }
  }

  /* -------------------------------------------------------
     Clear DOM/read caches on every account entry.
     This prevents manager login from receiving a detached page slot
     belonging to the previous logged-in user.
     ------------------------------------------------------- */
  const baseShowApp =
    typeof showApp === 'function'
      ? showApp
      : window.showApp;

  if (typeof baseShowApp === 'function') {
    const fixedShowApp = function (...args) {
      try { window.prizInvalidateNavigationCache?.('all'); } catch (_) {}
      try { window.prizInvalidateReadCache?.('all'); } catch (_) {}

      try {
        if (currentUser?.role === 'manager') {
          managerLoginGuardUntil = Date.now() + 8000;
        }
      } catch (_) {}

      const result = baseShowApp.apply(this, args);

      setTimeout(() => {
        ensureProfileAvatar();
        enforceAttendanceNav();
      }, 0);

      return result;
    };

    try { showApp = fixedShowApp; } catch (_) {}
    window.showApp = fixedShowApp;
  }

  /* -------------------------------------------------------
     Keep avatar + region-specific Attendance policy after shell rebuilds.
     ------------------------------------------------------- */
  const baseBuildShell =
    typeof buildShell === 'function'
      ? buildShell
      : window.buildShell;

  if (typeof baseBuildShell === 'function') {
    const fixedBuildShell = function (...args) {
      const result = baseBuildShell.apply(this, args);
      ensureProfileAvatar();
      enforceAttendanceNav();
      return result;
    };

    try { buildShell = fixedBuildShell; } catch (_) {}
    window.buildShell = fixedBuildShell;
  }

  /* -------------------------------------------------------
     Prevent direct navigation to Attendance for regions that do not use it.
     ------------------------------------------------------- */
  const baseGo =
    typeof go === 'function'
      ? go
      : window.go;

  if (typeof baseGo === 'function') {
    const fixedGo = function (page, ...rest) {
      if (page === 'attendance' && attendanceMustBeHidden()) {
        page = 'records';
      }
      return baseGo.call(this, page, ...rest);
    };

    try { go = fixedGo; } catch (_) {}
    window.go = fixedGo;
  }

  /* -------------------------------------------------------
     Record dialog fixes:
     - manager startup stale-record noise;
     - manager technical ID hidden;
     - senior deletion request button appears immediately.
     ------------------------------------------------------- */
  const baseViewRecord =
    typeof viewRecord === 'function'
      ? viewRecord
      : window.viewRecord;

  if (typeof baseViewRecord === 'function') {
    const fixedViewRecord = async function (id) {
      const stopSeniorWatch = watchSeniorRecordDialog(id);

      try {
        if (isManager()) {
          const check = await managerRecordPreflight(id);

          if (!check.exists) {
            // A stale cached/notification record during first manager login
            // should not flash an error. Later explicit stale opens retain feedback.
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

        const result = await baseViewRecord.apply(this, arguments);

        if (isManager()) {
          hideManagerInternalRecordId();
        }

        return result;
      } finally {
        // The watcher normally disconnects immediately when the dialog renders.
        // Keep it alive briefly only if the base dialog is still opening.
        setTimeout(stopSeniorWatch, 1200);
      }
    };

    try { viewRecord = fixedViewRecord; } catch (_) {}
    window.viewRecord = fixedViewRecord;
  }

  /* -------------------------------------------------------
     Shared operator accounts repaint #userCard after buildShell.
     This observer only inserts the fallback avatar when absent.
     It cannot loop: the next callback sees the avatar and does nothing.
     ------------------------------------------------------- */
  const userCard = document.getElementById('userCard');
  if (userCard) {
    const profileObserver = new MutationObserver(() => {
      ensureProfileAvatar();
    });
    profileObserver.observe(userCard, { childList: true, subtree: false });
  }

  const nav = document.getElementById('nav');
  if (nav) {
    const navObserver = new MutationObserver(() => {
      enforceAttendanceNav();
    });
    navObserver.observe(nav, { childList: true, subtree: false });
  }

  ensureProfileAvatar();
  enforceAttendanceNav();
})();
