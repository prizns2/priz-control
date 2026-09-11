(() => {
  const STYLE_ID = 'priz-audit-history-enhancements-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .priz-audit-head-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
      .priz-change-note{margin:12px 0 4px;padding:10px 12px;border:1px solid rgba(255,82,82,.38);border-radius:10px;background:rgba(255,82,82,.08);color:#ff8585;font-size:12px;font-weight:700}
      .priz-changed-field{border:1px solid rgba(255,82,82,.55)!important;background:rgba(255,82,82,.08)!important;box-shadow:0 0 0 1px rgba(255,82,82,.08) inset}
      .priz-changed-field .k,.priz-changed-field .v,.priz-changed-field span,.priz-changed-field b{color:#ff7777!important}
      .priz-changed-story{border:1px solid rgba(255,82,82,.55)!important;background:rgba(255,82,82,.08)!important;color:#ff8b8b!important}
      .priz-change-summary{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .priz-change-tag{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,82,82,.48);background:rgba(255,82,82,.10);color:#ff7777;font-size:11px;font-weight:800}
      .priz-audit-clear{white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function auditActionTitle(action) {
    return action === 'update' ? 'Изменение' : action === 'delete' ? 'Удаление' : action;
  }

  function collectChangedFields(events) {
    const changed = new Set();
    const add = key => { if (key) changed.add(key); };

    for (const event of events || []) {
      const changes = event?.changes || {};
      for (const [key, value] of Object.entries(changes)) {
        if (['updated_at', 'updated_by'].includes(key)) continue;
        if (key === 'evaluation_data' && value?.before && value?.after) {
          const before = value.before || {};
          const after = value.after || {};
          if ((before.start_time || '') !== (after.start_time || '')) add('eval:start_time');
          if ((before.buyer_gender || '') !== (after.buyer_gender || '')) add('eval:buyer_gender');
          const bs = Array.isArray(before.scores) ? before.scores : [];
          const as = Array.isArray(after.scores) ? after.scores : [];
          CRITERIA.forEach((_, i) => {
            if (Number(bs[i] || 0) !== Number(as[i] || 0)) add(`eval:score:${i}`);
          });
          if ((before.comment || '') !== (after.comment || '')) add('eval:comment');
          continue;
        }
        add(key);
      }
    }
    return changed;
  }

  function hasAny(changed, keys) {
    return keys.some(k => changed.has(k));
  }

  function markDetailByLabel(root, label, keys) {
    for (const el of root.querySelectorAll('.detail')) {
      const k = el.querySelector('.k');
      if (k?.textContent.trim() === label && hasAny(keys.changed, keys.fields)) {
        el.classList.add('priz-changed-field');
      }
    }
  }

  function markStorySection(root, headingText, shouldMark) {
    if (!shouldMark) return;
    for (const h of root.querySelectorAll('h3')) {
      if (h.textContent.trim() !== headingText) continue;
      const next = h.nextElementSibling;
      if (next?.classList.contains('story')) {
        h.style.color = '#ff7777';
        next.classList.add('priz-changed-story');
      }
    }
  }

  async function highlightRecordChanges(recordId) {
    if (!['owner', 'boss'].includes(currentUser?.role)) return;
    const root = document.getElementById('viewDialogBody');
    if (!root) return;

    const { data, error } = await sb
      .from('audit_log')
      .select('changes,created_at')
      .eq('record_id', recordId)
      .eq('action', 'update')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data?.length) return;
    const changed = collectChangedFields(data);
    if (!changed.size) return;

    const dialogCard = root.querySelector('.dialog-card');
    const dialogHead = root.querySelector('.dialog-head');
    if (dialogCard && dialogHead && !root.querySelector('.priz-change-note')) {
      const note = document.createElement('div');
      note.className = 'priz-change-note';
      note.textContent = 'Красным отмечены поля, которые изменялись после создания записи.';
      dialogHead.insertAdjacentElement('afterend', note);
    }

    const detailMap = [
      ['Сотрудник', ['employee_name']],
      ['Продавец', ['employee_name']],
      ['Тип нарушения', ['violation_type_snapshot', 'violation_type_id']],
      ['Ущерб покупателю', ['damage_customer']],
      ['Ущерб магазину', ['damage_store']],
      ['Возмещено покупателю', ['reimbursed_customer']],
      ['Возмещено магазину', ['reimbursed_store']],
      ['Время', ['eval:start_time']],
      ['Пол покупателя', ['eval:buyer_gender']]
    ];
    for (const [label, fields] of detailMap) markDetailByLabel(root, label, { changed, fields });

    markStorySection(root, 'Фабула', changed.has('story'));
    markStorySection(root, 'Комментарий', changed.has('eval:comment'));

    CRITERIA.forEach((criterion, i) => {
      if (!changed.has(`eval:score:${i}`)) return;
      for (const line of root.querySelectorAll('.audit-line')) {
        if (line.querySelector('span')?.textContent.trim() === criterion) line.classList.add('priz-changed-field');
      }
    });

    const headerChanges = [];
    if (changed.has('record_date')) headerChanges.push('Дата');
    if (hasAny(changed, ['store_name_snapshot', 'store_number_snapshot', 'store_id'])) headerChanges.push('Магазин');
    if (hasAny(changed, ['manager_name_snapshot', 'manager_id'])) headerChanges.push('Менеджер');
    if (headerChanges.length && dialogHead) {
      const left = dialogHead.firstElementChild;
      if (left && !left.querySelector('.priz-change-summary')) {
        const summary = document.createElement('div');
        summary.className = 'priz-change-summary';
        summary.innerHTML = headerChanges.map(x => `<span class="priz-change-tag">Изменено: ${esc(x)}</span>`).join('');
        left.appendChild(summary);
      }
    }
  }

  const originalViewRecord = window.viewRecord;
  if (typeof originalViewRecord === 'function') {
    window.viewRecord = async function(id) {
      await originalViewRecord(id);
      try { await highlightRecordChanges(id); } catch (e) { console.warn('Change highlight failed', e); }
    };
  }

  async function clearAuditHistory() {
    if (currentUser?.role !== 'owner') return;
    const regCode = document.getElementById('regionSelect')?.value || 'all';
    const regionId = regCode === 'all' ? null : REGIONS[regCode]?.id || null;
    const regionName = regCode === 'all' ? 'по всем регионам' : `по региону «${REGIONS[regCode]?.name || regCode}»`;

    const c = document.getElementById('confirmDialog');
    const title = document.getElementById('confirmTitle');
    const text = document.getElementById('confirmText');
    const ok = document.getElementById('confirmOk');
    if (!c || !title || !text || !ok) return;

    title.textContent = 'Очистить историю?';
    text.textContent = `Будут удалены все события журнала ${regionName}. Восстановить их можно будет только из резервной копии.`;
    ok.textContent = 'Очистить';
    c.showModal();

    c.onclose = async () => {
      const confirmed = c.returnValue === 'ok';
      title.textContent = 'Подтверждение';
      ok.textContent = 'Удалить';
      if (!confirmed) return;
      try {
        const { data, error } = await sb.rpc('clear_audit_history', { p_region_id: regionId });
        if (error) throw error;
        toast(`История очищена · удалено ${Number(data?.deleted || 0)} событий`);
        await window.renderAudit();
      } catch (e) {
        console.error(e);
        toast('Не удалось очистить историю: ' + (e.message || e), true);
      }
    };
  }

  window.renderAudit = async function() {
    if (!['owner', 'boss'].includes(currentUser?.role)) {
      go('dashboard');
      return;
    }

    let q = sb
      .from('audit_log')
      .select('*')
      .in('action', ['update', 'delete'])
      .order('created_at', { ascending: false })
      .limit(2000);

    const reg = document.getElementById('regionSelect')?.value || 'all';
    if (reg !== 'all') q = q.eq('region_id', REGIONS[reg]?.id);

    const { data, error } = await q;
    if (error) throw error;
    const events = data || [];
    const clearButton = currentUser?.role === 'owner'
      ? '<button class="btn danger small-btn priz-audit-clear" type="button">Очистить историю</button>'
      : '';

    document.getElementById('content').innerHTML = `
      <div class="panel" style="margin-top:0">
        <div class="panel-head">
          <div>
            <h3>Журнал изменений</h3>
            <div class="muted small">Показываются только изменённые и удалённые записи.</div>
          </div>
          <div class="priz-audit-head-actions">
            <span class="muted small">${events.length} событий</span>
            ${clearButton}
          </div>
        </div>
        ${events.length ? events.map(x => `
          <div class="audit-item ${x.record_id ? 'audit-clickable' : ''}" ${x.record_id ? `data-record-id="${esc(x.record_id)}"` : ''}>
            <div class="audit-line"><b>${esc(auditActionTitle(x.action))}</b><span class="muted small">${fmtDateTime(x.created_at)}</span></div>
            <div class="muted small">${esc(x.actor_name || 'Система')}</div>
            ${renderAuditChanges(x)}
            ${x.record_id ? '<div class="audit-open-hint">Открыть запись →</div>' : ''}
          </div>`).join('') : '<div class="empty"><b>История пока пустая</b>Здесь появятся изменения и удаления записей.</div>'}
      </div>`;

    document.querySelectorAll('.audit-clickable').forEach(x => {
      x.onclick = () => window.viewRecord(x.dataset.recordId);
    });
    document.querySelector('.priz-audit-clear')?.addEventListener('click', clearAuditHistory);
  };
})();
