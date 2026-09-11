(() => {
  if (window.__prizManagerReceiptSyncInstalled) return;
  window.__prizManagerReceiptSyncInstalled = true;

  const STYLE_ID = 'priz-manager-receipt-sync-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .manager-add-photo.has-photo{
        border-color:#24583b!important;
        background:#11251a!important;
        color:#8ee6ad!important;
      }
      .manager-notif-clear{
        padding:6px 9px!important;
        font-size:10px!important;
        border-color:#473037!important;
        color:#ffadb4!important;
      }
      .manager-notif-clear:hover{
        background:#2a1519!important;
        border-color:#6e3b44!important;
      }
      .manager-notif-head-actions{
        display:flex;
        align-items:center;
        gap:7px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }
      .manager-notif-list{
        overflow-anchor:none;
      }
    `;
    document.head.appendChild(style);
  }

  let activeRecordId = null;
  const syncLocks = new Map();
  let cleanupScheduled = false;

  function isManager() {
    return currentUser?.role === 'manager' && !!currentUser?.id;
  }

  function clearedStorageKey() {
    return isManager() ? `priz_manager_notifications_cleared_${currentUser.id}` : null;
  }

  function getClearedIds() {
    const key = clearedStorageKey();
    if (!key) return new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveClearedIds(ids) {
    const key = clearedStorageKey();
    if (!key) return;
    const compact = [...new Set([...ids].map(String))].slice(-500);
    localStorage.setItem(key, JSON.stringify(compact));
  }

  async function hasOwnReceipt(recordId) {
    if (!isManager() || !recordId) return false;

    const { data, error } = await sb
      .from('media')
      .select('id,mime_type,uploaded_by')
      .eq('record_id', recordId)
      .eq('uploaded_by', currentUser.id);

    if (error) throw error;

    return (data || []).some(x =>
      String(x.mime_type || '').toLowerCase().startsWith('image/')
    );
  }

  function paintRowButtons(recordId, hasReceipt) {
    document
      .querySelectorAll(`.manager-photo-row[data-id="${CSS.escape(String(recordId))}"]`)
      .forEach(button => {
        button.textContent = hasReceipt
          ? '✓ Чек об оплате добавлен'
          : '📎 Добавить чек';
        button.classList.toggle('has-photo', hasReceipt);
      });
  }

  function paintOpenRecord(recordId, hasReceipt) {
    if (activeRecordId !== recordId) return;

    const button = document.querySelector('#viewDialogBody .manager-add-photo');
    if (!button) return;

    button.textContent = hasReceipt
      ? '✓ Чек об оплате добавлен'
      : '📎 Добавить чек';

    button.classList.toggle('has-photo', hasReceipt);
    button.dataset.managerReceipt = hasReceipt ? '1' : '0';
  }

  function paintNotification(recordId, hasReceipt) {
    document
      .querySelectorAll(`.manager-notif-item[data-record-id="${CSS.escape(String(recordId))}"]`)
      .forEach(item => {
        // Строка статуса уже создаётся manager-notifications.js
        // только для КАТ.1 с ущербом магазину > 0.
        const status = item.querySelector('.manager-notif-photo');
        if (!status) return;

        status.className = `manager-notif-photo ${hasReceipt ? 'ok' : 'need'}`;
        status.textContent = hasReceipt
          ? '✓ Чек об оплате добавлен'
          : '📷 Нужно прикрепить чек об оплате';
      });
  }

  async function syncRecord(recordId) {
    if (!isManager() || !recordId) return false;

    if (syncLocks.has(recordId)) return syncLocks.get(recordId);

    const job = (async () => {
      try {
        const hasReceipt = await hasOwnReceipt(recordId);
        paintRowButtons(recordId, hasReceipt);
        paintOpenRecord(recordId, hasReceipt);
        paintNotification(recordId, hasReceipt);
        return hasReceipt;
      } catch (err) {
        console.warn('Не удалось обновить статус чека менеджера', err);
        return false;
      } finally {
        syncLocks.delete(recordId);
      }
    })();

    syncLocks.set(recordId, job);
    return job;
  }

  function renderEmptyIfNeeded() {
    const list = document.getElementById('managerNotifList');
    if (!list) return;

    if (!list.querySelector('.manager-notif-item')) {
      list.innerHTML = '<div class="manager-notif-empty">Новых уведомлений пока нет.</div>';
    }
  }

  function applyClearedNotifications() {
    if (!isManager()) return;

    const list = document.getElementById('managerNotifList');
    if (!list) return;

    const cleared = getClearedIds();
    if (!cleared.size) return;

    list.querySelectorAll('.manager-notif-item[data-notification-id]').forEach(item => {
      if (cleared.has(String(item.dataset.notificationId || ''))) item.remove();
    });

    renderEmptyIfNeeded();
  }

  async function clearVisibleNotifications(button) {
    if (!isManager()) return;

    const list = document.getElementById('managerNotifList');
    if (!list) return;

    const ids = [...list.querySelectorAll('.manager-notif-item[data-notification-id]')]
      .map(item => item.dataset.notificationId)
      .filter(Boolean);

    if (!ids.length) {
      toast('Уведомлений уже нет');
      return;
    }

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Очищаем…';

    try {
      const cleared = getClearedIds();
      ids.forEach(id => cleared.add(String(id)));
      saveClearedIds(cleared);

      const { error } = await sb.rpc('manager_notifications_mark_all_read');
      if (error) throw error;

      list.querySelectorAll('.manager-notif-item').forEach(item => item.remove());
      renderEmptyIfNeeded();

      const badge = document.getElementById('managerNotifBadge');
      if (badge) {
        badge.textContent = '0';
        badge.classList.add('hidden');
      }

      const headText = document.getElementById('managerNotifHeadText');
      if (headText) headText.textContent = 'Новых уведомлений нет';

      toast('Уведомления очищены');
    } catch (err) {
      console.error(err);
      toast(err.message || 'Не удалось очистить уведомления', true);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function ensureClearButton() {
    if (!isManager()) return;

    const head = document.querySelector('#managerNotifPanel .manager-notif-head');
    const readAll = document.getElementById('managerNotifReadAll');
    if (!head || !readAll || document.getElementById('managerNotifClear')) return;

    let actions = head.querySelector('.manager-notif-head-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'manager-notif-head-actions';
      readAll.parentNode.insertBefore(actions, readAll);
      actions.appendChild(readAll);
    }

    const clear = document.createElement('button');
    clear.id = 'managerNotifClear';
    clear.type = 'button';
    clear.className = 'btn ghost manager-notif-clear';
    clear.textContent = 'Очистить';
    clear.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      clearVisibleNotifications(clear);
    };

    actions.appendChild(clear);
  }

  function scheduleUiCleanup() {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    requestAnimationFrame(() => {
      cleanupScheduled = false;
      ensureClearButton();
      applyClearedNotifications();
    });
  }

  if (typeof viewRecord === 'function') {
    const baseViewRecord = viewRecord;

    viewRecord = async function(recordId) {
      activeRecordId = recordId;
      const result = await baseViewRecord.apply(this, arguments);

      if (isManager()) await syncRecord(recordId);

      const dialog = document.getElementById('viewDialog');
      if (dialog && !dialog.dataset.managerReceiptCloseBound) {
        dialog.dataset.managerReceiptCloseBound = '1';
        dialog.addEventListener('close', () => {
          activeRecordId = null;
        });
      }

      return result;
    };

    try { window.viewRecord = viewRecord; } catch (_) {}
  }

  if (typeof uploadOneMedia === 'function') {
    const baseUploadOneMedia = uploadOneMedia;

    uploadOneMedia = async function(recordId, file, progressCb) {
      const result = await baseUploadOneMedia.apply(this, arguments);

      if (
        isManager() &&
        recordId &&
        String(file?.type || '').toLowerCase().startsWith('image/')
      ) {
        await syncRecord(recordId);
      }

      return result;
    };

    try { window.uploadOneMedia = uploadOneMedia; } catch (_) {}
  }

  // Только отслеживаем перерисовку панели.
  // Постоянные запросы и многократные setTimeout убраны — они давали «подпрыгивание».
  const observer = new MutationObserver(scheduleUiCleanup);
  observer.observe(document.body, { childList:true, subtree:true });

  document.addEventListener('click', event => {
    if (event.target.closest('#managerNotifBtn')) {
      scheduleUiCleanup();
    }
  }, true);

  scheduleUiCleanup();
})();
