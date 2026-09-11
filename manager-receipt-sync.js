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
    `;
    document.head.appendChild(style);
  }

  let activeRecordId = null;
  const syncLocks = new Map();

  function isManager() {
    return currentUser?.role === 'manager' && !!currentUser?.id;
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
        let status = item.querySelector('.manager-notif-photo');

        if (!status) {
          status = document.createElement('div');
          item.appendChild(status);
        }

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

  async function syncVisibleNotifications() {
    if (!isManager()) return;

    const panel = document.getElementById('managerNotifPanel');
    if (!panel || panel.classList.contains('hidden')) return;

    const ids = [...new Set(
      [...panel.querySelectorAll('.manager-notif-item[data-record-id]')]
        .map(x => x.dataset.recordId)
        .filter(Boolean)
    )];

    await Promise.all(ids.map(syncRecord));
  }

  // Исправляем статус внутри открытой записи:
  // чек считается добавленным ТОЛЬКО если фото загрузил текущий менеджер.
  if (typeof viewRecord === 'function') {
    const baseViewRecord = viewRecord;

    viewRecord = async function(recordId) {
      activeRecordId = recordId;
      const result = await baseViewRecord.apply(this, arguments);

      if (isManager()) {
        await syncRecord(recordId);
      }

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

  // После успешной загрузки фото сразу обновляем:
  // открытую запись, таблицу и уведомления — без F5.
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

  // Если панель уведомлений открыли, перепроверяем статусы с сервера.
  document.addEventListener('click', event => {
    if (!event.target.closest('#managerNotifBtn')) return;

    setTimeout(syncVisibleNotifications, 150);
    setTimeout(syncVisibleNotifications, 600);
    setTimeout(syncVisibleNotifications, 1400);
  }, true);

  // Пока панель уведомлений открыта — лёгкая страховочная синхронизация.
  setInterval(() => {
    if (isManager()) syncVisibleNotifications();
  }, 2500);
})();
