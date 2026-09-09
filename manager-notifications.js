(() => {
  let managerNotifTimer = null;
  let managerNotifLoading = false;
  let managerNotifData = { unreadCount: 0, items: [] };

  const originalBuildShellManagerNotifications = buildShell;
  const originalRenderPageManagerNotifications = renderPage;

  function ensureManagerNotificationStyles() {
    if (document.getElementById('managerNotificationStyles')) return;

    const style = document.createElement('style');
    style.id = 'managerNotificationStyles';
    style.textContent = `
      .manager-notif-wrap{position:relative;display:inline-flex;align-items:center}
      .manager-notif-btn{position:relative;width:40px;height:40px;display:grid;place-items:center;padding:0;border:1px solid #303646;border-radius:9px;background:#11141b;color:#dfe3eb;font-size:17px;cursor:pointer}
      .manager-notif-btn:hover{border-color:#6f4fd6;background:#171426}
      .manager-notif-badge{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;padding:0 5px;display:grid;place-items:center;box-sizing:border-box;border-radius:999px;background:#7c4dff;color:#fff;font-size:9px;font-weight:900;border:2px solid #090a0f}
      .manager-notif-badge.hidden{display:none}
      .manager-notif-panel{position:fixed;z-index:5000;right:22px;top:74px;width:min(430px,calc(100vw - 28px));max-height:min(650px,calc(100vh - 95px));display:flex;flex-direction:column;border:1px solid #303646;border-radius:15px;background:#0f1218;box-shadow:0 24px 80px rgba(0,0,0,.48);overflow:hidden}
      .manager-notif-panel.hidden{display:none}
      .manager-notif-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px;border-bottom:1px solid #262c38}
      .manager-notif-head h4{margin:0;font-size:14px}
      .manager-notif-head .sub{margin-top:3px;color:#7f8795;font-size:10px}
      .manager-notif-list{overflow:auto;padding:7px}
      .manager-notif-empty{padding:30px 18px;text-align:center;color:#7d8592;font-size:11px}
      .manager-notif-item{width:100%;display:block;text-align:left;padding:11px 12px;border:1px solid transparent;border-radius:10px;background:transparent;color:#e5e8ef;cursor:pointer}
      .manager-notif-item:hover{background:#151923;border-color:#2b3240}
      .manager-notif-item.unread{background:#171426;border-color:#4a347f}
      .manager-notif-line{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .manager-notif-type{font-size:10px;font-weight:900}
      .manager-notif-time{color:#727b88;font-size:9px;white-space:nowrap}
      .manager-notif-title{margin-top:6px;font-size:12px;font-weight:900;line-height:1.35}
      .manager-notif-meta{margin-top:4px;color:#9aa2af;font-size:10px;line-height:1.35}
      .manager-notif-photo{margin-top:7px;font-size:10px;font-weight:900}
      .manager-notif-photo.need{color:#f6c453}
      .manager-notif-photo.ok{color:#78d69a}
      .manager-notif-dot{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#8b5cf6;vertical-align:1px}
      .manager-notif-read-all{padding:6px 9px!important;font-size:10px!important}
    `;
    document.head.appendChild(style);
  }

  function notificationTypeLabel(kind) {
    if (kind === 'cat1') return 'КАТ. 1';
    if (kind === 'cat2') return 'КАТ. 2';
    return 'ОЦЕНКА';
  }

  function notificationTitle(item) {
    if (item.kind === 'evaluation') {
      const scores = Array.isArray(item.evaluationData?.scores) ? item.evaluationData.scores : [];
      const total = scores.reduce((sum, value) => sum + Number(value || 0), 0);
      return `Оценка${scores.length ? ` · ${total} / 10` : ''}`;
    }
    return item.violationType || 'Нарушение';
  }

  function notificationStore(item) {
    return item.storeName || item.storeNumber || 'Магазин не указан';
  }

  function notificationPhotoStatus(item) {
    if (item.kind !== 'cat1' || Number(item.damageStore || 0) <= 0) return '';
    return item.hasManagerReceipt
      ? '<div class="manager-notif-photo ok">✓ Чек об оплате добавлен</div>'
      : '<div class="manager-notif-photo need">📷 Нужно прикрепить чек об оплате</div>';
  }

  async function enrichManagerReceiptStatus(items) {
    const ids = [...new Set(
      (items || [])
        .filter(item => item.kind === 'cat1' && Number(item.damageStore || 0) > 0)
        .map(item => item.recordId)
        .filter(Boolean)
    )];

    if (!ids.length) return;

    try {
      const { data, error } = await sb
        .from('media')
        .select('record_id,mime_type,uploaded_by')
        .in('record_id', ids)
        .eq('uploaded_by', currentUser.id);

      if (error) throw error;

      const receiptRecords = new Set(
        (data || [])
          .filter(x => String(x.mime_type || '').toLowerCase().startsWith('image/'))
          .map(x => x.record_id)
      );

      (items || []).forEach(item => {
        item.hasManagerReceipt = receiptRecords.has(item.recordId);
      });
    } catch (err) {
      console.warn('Не удалось проверить чеки менеджера', err);
      (items || []).forEach(item => {
        item.hasManagerReceipt = false;
      });
    }
  }

  function ensureManagerNotificationUi() {
    if (currentUser?.role !== 'manager') return;
    ensureManagerNotificationStyles();

    const topActions = document.querySelector('.top-actions');
    if (!topActions) return;

    if (!document.getElementById('managerNotifWrap')) {
      const wrap = document.createElement('div');
      wrap.id = 'managerNotifWrap';
      wrap.className = 'manager-notif-wrap';
      wrap.innerHTML = `
        <button id="managerNotifBtn" class="manager-notif-btn" type="button" title="Уведомления">
          🔔
          <span id="managerNotifBadge" class="manager-notif-badge hidden">0</span>
        </button>
      `;
      topActions.insertBefore(wrap, topActions.firstChild);

      const panel = document.createElement('div');
      panel.id = 'managerNotifPanel';
      panel.className = 'manager-notif-panel hidden';
      panel.innerHTML = `
        <div class="manager-notif-head">
          <div><h4>Уведомления</h4><div class="sub" id="managerNotifHeadText">Новые нарушения и оценки</div></div>
          <button id="managerNotifReadAll" class="btn ghost manager-notif-read-all" type="button">Прочитать все</button>
        </div>
        <div id="managerNotifList" class="manager-notif-list"></div>
      `;
      document.body.appendChild(panel);

      document.getElementById('managerNotifBtn').onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) loadManagerNotifications(true);
      };

      panel.onclick = event => event.stopPropagation();

      document.getElementById('managerNotifReadAll').onclick = async () => {
        try {
          const { error } = await sb.rpc('manager_notifications_mark_all_read');
          if (error) throw error;
          await loadManagerNotifications(true);
        } catch (err) {
          toast(err.message || 'Не удалось отметить уведомления', true);
        }
      };
    }
  }

  function renderManagerNotifications() {
    if (currentUser?.role !== 'manager') return;

    ensureManagerNotificationUi();

    const badge = document.getElementById('managerNotifBadge');
    const list = document.getElementById('managerNotifList');
    const headText = document.getElementById('managerNotifHeadText');
    if (!badge || !list || !headText) return;

    const unread = Number(managerNotifData.unreadCount || 0);
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread <= 0);
    headText.textContent = unread ? `Непрочитанных: ${unread}` : 'Новых уведомлений нет';

    const items = Array.isArray(managerNotifData.items) ? managerNotifData.items : [];
    if (!items.length) {
      list.innerHTML = '<div class="manager-notif-empty">Новых уведомлений пока нет.<br>Они появятся, когда оператор или старший добавит новую запись.</div>';
      return;
    }

    list.innerHTML = items.map(item => `
      <button class="manager-notif-item ${item.readAt ? '' : 'unread'}" type="button" data-notification-id="${esc(item.id)}" data-record-id="${esc(item.recordId)}">
        <div class="manager-notif-line">
          <div class="manager-notif-type">${item.readAt ? '' : '<span class="manager-notif-dot"></span>'}${esc(notificationTypeLabel(item.kind))}</div>
          <div class="manager-notif-time">${esc(fmtDateTime(item.createdAt))}</div>
        </div>
        <div class="manager-notif-title">${esc(notificationTitle(item))}</div>
        <div class="manager-notif-meta">${esc(notificationStore(item))}${item.employee ? ` · ${esc(item.employee)}` : ''}</div>
        <div class="manager-notif-meta">Добавил: ${esc(item.createdByName || '—')}</div>
        ${notificationPhotoStatus(item)}
      </button>
    `).join('');

    list.querySelectorAll('.manager-notif-item').forEach(button => {
      button.onclick = async () => {
        const notificationId = button.dataset.notificationId;
        const recordId = button.dataset.recordId;

        try {
          if (notificationId) {
            const { error } = await sb.rpc('manager_notification_mark_read', { p_notification_id: notificationId });
            if (error) throw error;
          }
        } catch (err) {
          console.warn(err);
        }

        document.getElementById('managerNotifPanel')?.classList.add('hidden');
        await loadManagerNotifications(false);
        if (recordId) await viewRecord(recordId);
      };
    });
  }

  async function loadManagerNotifications(showErrors = false) {
    if (currentUser?.role !== 'manager') {
      stopManagerNotificationPolling();
      return;
    }
    if (managerNotifLoading) return;

    managerNotifLoading = true;
    try {
      const { data, error } = await sb.rpc('manager_notifications_payload', { p_limit: 50 });
      if (error) throw error;
      managerNotifData = data || { unreadCount: 0, items: [] };
      await enrichManagerReceiptStatus(managerNotifData.items || []);
      renderManagerNotifications();
    } catch (err) {
      console.error('Manager notifications:', err);
      if (showErrors) toast(err.message || 'Не удалось загрузить уведомления', true);
    } finally {
      managerNotifLoading = false;
    }
  }

  function startManagerNotificationPolling() {
    stopManagerNotificationPolling();
    if (currentUser?.role !== 'manager') return;
    ensureManagerNotificationUi();
    loadManagerNotifications(false);
    managerNotifTimer = setInterval(() => loadManagerNotifications(false), 30000);
  }

  function stopManagerNotificationPolling() {
    if (managerNotifTimer) clearInterval(managerNotifTimer);
    managerNotifTimer = null;
  }

  buildShell = function(...args) {
    const result = originalBuildShellManagerNotifications.apply(this, args);
    if (currentUser?.role === 'manager') startManagerNotificationPolling();
    else stopManagerNotificationPolling();
    return result;
  };

  renderPage = async function(...args) {
    const result = await originalRenderPageManagerNotifications.apply(this, args);
    if (currentUser?.role === 'manager') {
      ensureManagerNotificationUi();
      renderManagerNotifications();
    }
    return result;
  };

  document.addEventListener('click', () => {
    document.getElementById('managerNotifPanel')?.classList.add('hidden');
  });

  ensureManagerNotificationStyles();
})();
