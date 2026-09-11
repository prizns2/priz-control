(() => {
  const STYLE_ID = 'priz-audit-history-enhancements-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .priz-audit-head-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
      .priz-changed-field{border:1px solid rgba(255,82,82,.55)!important;background:rgba(255,82,82,.08)!important;box-shadow:0 0 0 1px rgba(255,82,82,.08) inset}
      .priz-changed-field .k,.priz-changed-field .v,.priz-changed-field span,.priz-changed-field b{color:#ff7777!important}
      .priz-changed-story{border:1px solid rgba(255,82,82,.55)!important;background:rgba(255,82,82,.08)!important;color:#ff8b8b!important}
      .priz-change-summary{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .priz-change-tag{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,82,82,.48);background:rgba(255,82,82,.10);color:#ff7777;font-size:11px;font-weight:800}
      .priz-change-panel{margin:14px 0 4px;border:1px solid rgba(255,82,82,.38);border-radius:12px;background:rgba(255,82,82,.045);overflow:hidden}
      .priz-change-panel-title{padding:10px 12px;border-bottom:1px solid rgba(255,82,82,.20);color:#ff8585;font-size:12px;font-weight:800}
      .priz-change-row{padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
      .priz-change-row:last-child{border-bottom:0}
      .priz-change-label{font-size:12px;font-weight:800;color:#e9ebf2;margin-bottom:7px}
      .priz-change-values{display:flex;align-items:center;gap:9px;flex-wrap:wrap;line-height:1.4}
      .priz-change-before{color:#8d93a1;text-decoration:line-through;text-decoration-thickness:1px}
      .priz-change-arrow{color:#686e7b;font-weight:800}
      .priz-change-after{color:#ff6f6f;font-weight:800}
      .priz-change-meta{margin-top:6px;color:#777e8c;font-size:10px}
      .priz-audit-clear{white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  const SERVICE_KEYS = new Set(['updated_at', 'updated_by']);

  function meaningfulChanges(changes) {
    const out = {};
    for (const [key, value] of Object.entries(changes || {})) {
      if (!SERVICE_KEYS.has(key)) out[key] = value;
    }
    return out;
  }

  function auditActionTitle(action) {
    return action === 'update' ? 'Изменение' : action === 'delete' ? 'Удаление' : action;
  }

  function valueText(key, value) {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'record_date') return fmtDate(String(value));
    if (['damage_customer', 'damage_store', 'reimbursed_customer', 'reimbursed_store'].includes(key)) return money(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function friendlyEventChanges(event) {
    const ch = meaningfulChanges(event?.changes || {});
    const result = [];
    const push = (id, label, key, before, after) => result.push({
      id, label, key, before, after,
      actor: event?.actor_name || 'Система',
      createdAt: event?.created_at || null
    });

    if (ch.record_date) push('record_date', 'Дата', 'record_date', ch.record_date.before, ch.record_date.after);

    if (ch.store_name_snapshot) {
      push('store', 'Магазин', 'store_name_snapshot', ch.store_name_snapshot.before, ch.store_name_snapshot.after);
    } else if (ch.store_number_snapshot) {
      push('store', 'Магазин', 'store_number_snapshot', ch.store_number_snapshot.before, ch.store_number_snapshot.after);
    }

    if (ch.manager_name_snapshot) {
      push('manager', 'Менеджер', 'manager_name_snapshot', ch.manager_name_snapshot.before, ch.manager_name_snapshot.after);
    }

    if (ch.violation_type_snapshot) {
      push('violation', 'Тип нарушения', 'violation_type_snapshot', ch.violation_type_snapshot.before, ch.violation_type_snapshot.after);
    }

    if (ch.employee_name) push('employee', 'Сотрудник / продавец', 'employee_name', ch.employee_name.before, ch.employee_name.after);
    if (ch.story) push('story', 'Фабула', 'story', ch.story.before, ch.story.after);
    if (ch.damage_customer) push('damage_customer', 'Ущерб покупателю', 'damage_customer', ch.damage_customer.before, ch.damage_customer.after);
    if (ch.damage_store) push('damage_store', 'Ущерб магазину', 'damage_store', ch.damage_store.before, ch.damage_store.after);
    if (ch.reimbursed_customer) push('reimbursed_customer', 'Возмещено покупателю', 'reimbursed_customer', ch.reimbursed_customer.before, ch.reimbursed_customer.after);
    if (ch.reimbursed_store) push('reimbursed_store', 'Возмещено магазину', 'reimbursed_store', ch.reimbursed_store.before, ch.reimbursed_store.after);
    if (ch.kind) push('kind', 'Тип записи', 'kind', ch.kind.before, ch.kind.after);

    if (ch.evaluation_data?.before && ch.evaluation_data?.after) {
      const before = ch.evaluation_data.before || {};
      const after = ch.evaluation_data.after || {};
      if ((before.start_time || '') !== (after.start_time || '')) push('eval:start_time', 'Время', 'eval:start_time', before.start_time, after.start_time);
      if ((before.buyer_gender || '') !== (after.buyer_gender || '')) push('eval:buyer_gender', 'Пол покупателя', 'eval:buyer_gender', before.buyer_gender, after.buyer_gender);
      const bs = Array.isArray(before.scores) ? before.scores : [];
      const as = Array.isArray(after.scores) ? after.scores : [];
      CRITERIA.forEach((criterion, i) => {
        if (Number(bs[i] || 0) !== Number(as[i] || 0)) push(`eval:score:${i}`, criterion, `eval:score:${i}`, Number(bs[i] || 0), Number(as[i] || 0));
      });
      if ((before.comment || '') !== (after.comment || '')) push('eval:comment', 'Комментарий', 'eval:comment', before.comment, after.comment);
    }

    return result;
  }

  function latestFriendlyChanges(events) {
    const seen = new Set();
    const out = [];
    for (const event of events || []) {
      for (const item of friendlyEventChanges(event)) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }

  function collectChangedFields(events) {
    const changed = new Set();
    for (const event of events || []) {
      for (const item of friendlyEventChanges(event)) changed.add(item.id);
      const raw = meaningfulChanges(event?.changes || {});
      if (raw.store_id || raw.store_number_snapshot || raw.store_name_snapshot) changed.add('store');
      if (raw.manager_id || raw.manager_name_snapshot) changed.add('manager');
      if (raw.violation_type_id || raw.violation_type_snapshot) changed.add('violation');
    }
    return changed;
  }

  function markDetailByLabel(root, label, shouldMark) {
    if (!shouldMark) return;
    for (const el of root.querySelectorAll('.detail')) {
      const k = el.querySelector('.k');
      if (k?.textContent.trim() === label) el.classList.add('priz-changed-field');
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

  function renderExactChangesPanel(root, events) {
    const items = latestFriendlyChanges(events);
    if (!items.length) return;
    const head = root.querySelector('.dialog-head');
    if (!head || root.querySelector('.priz-change-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'priz-change-panel';
    panel.innerHTML = `
      <div class="priz-change-panel-title">Что именно изменялось</div>
      ${items.map(item => `
        <div class="priz-change-row">
          <div class="priz-change-label">${esc(item.label)}</div>
          <div class="priz-change-values">
            <span class="priz-change-before">Было: ${esc(valueText(item.key, item.before))}</span>
            <span class="priz-change-arrow">→</span>
            <span class="priz-change-after">Стало: ${esc(valueText(item.key, item.after))}</span>
          </div>
          <div class="priz-change-meta">${esc(item.actor)}${item.createdAt ? ` · ${esc(fmtDateTime(item.createdAt))}` : ''}</div>
        </div>`).join('')}
    `;
    head.insertAdjacentElement('afterend', panel);
  }

  async function highlightRecordChanges(recordId) {
    if (!['owner', 'boss'].includes(currentUser?.role)) return;
    const root = document.getElementById('viewDialogBody');
    if (!root) return;

    const { data, error } = await sb
      .from('audit_log')
      .select('changes,actor_name,created_at')
      .eq('record_id', recordId)
      .eq('action', 'update')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data?.length) return;
    const events = data.filter(x => Object.keys(meaningfulChanges(x.changes)).length > 0);
    if (!events.length) return;

    const changed = collectChangedFields(events);
    renderExactChangesPanel(root, events);

    markDetailByLabel(root, 'Сотрудник', changed.has('employee'));
    markDetailByLabel(root, 'Продавец', changed.has('employee'));
    markDetailByLabel(root, 'Тип нарушения', changed.has('violation'));
    markDetailByLabel(root, 'Ущерб покупателю', changed.has('damage_customer'));
    markDetailByLabel(root, 'Ущерб магазину', changed.has('damage_store'));
    markDetailByLabel(root, 'Возмещено покупателю', changed.has('reimbursed_customer'));
    markDetailByLabel(root, 'Возмещено магазину', changed.has('reimbursed_store'));
    markDetailByLabel(root, 'Время', changed.has('eval:start_time'));
    markDetailByLabel(root, 'Пол покупателя', changed.has('eval:buyer_gender'));

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
    if (changed.has('store')) headerChanges.push('Магазин');
    if (changed.has('manager')) headerChanges.push('Менеджер');

    const dialogHead = root.querySelector('.dialog-head');
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

    const events = (data || []).filter(x =>
      x.action === 'delete' ||
      (x.action === 'update' && Object.keys(meaningfulChanges(x.changes)).length > 0)
    );

    const clearButton = currentUser?.role === 'owner'
      ? '<button class="btn danger small-btn priz-audit-clear" type="button">Очистить историю</button>'
      : '';

    document.getElementById('content').innerHTML = `
      <div class="panel" style="margin-top:0">
        <div class="panel-head">
          <div>
            <h3>Журнал изменений</h3>
            <div class="muted small">Показываются только реальные изменения и удаления записей.</div>
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
          </div>`).join('') : '<div class="empty"><b>История пока пустая</b>Здесь появятся реальные изменения и удаления записей.</div>'}
      </div>`;

    document.querySelectorAll('.audit-clickable').forEach(x => {
      x.onclick = () => window.viewRecord(x.dataset.recordId);
    });
    document.querySelector('.priz-audit-clear')?.addEventListener('click', clearAuditHistory);
  };
})();
