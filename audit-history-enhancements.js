(() => {
  const STYLE_ID = 'priz-audit-history-enhancements-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .priz-audit-head-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}
      .priz-changed-field{border:1px solid rgba(255,82,82,.55)!important;background:rgba(255,82,82,.08)!important;box-shadow:0 0 0 1px rgba(255,82,82,.08) inset}
      .priz-changed-field .k,.priz-changed-field .v,.priz-changed-field span,.priz-changed-field b{color:#ff7777!important}
      .priz-changed-story{border:1px solid rgba(255,82,82,.32)!important;background:rgba(255,82,82,.035)!important}
      .priz-diff-context{color:#cfd3dc;font-weight:400;text-decoration:none}
      .priz-diff-removed{color:#8d93a1;text-decoration:line-through;text-decoration-thickness:1px;background:rgba(141,147,161,.08);border-radius:3px;padding:0 1px}
      .priz-diff-added{color:#ff6f6f;font-weight:800;background:rgba(255,82,82,.10);border-radius:3px;padding:0 1px}
      .priz-text-diff{display:grid;gap:7px;width:100%}
      .priz-text-diff-line{line-height:1.55;white-space:normal;word-break:break-word}
      .priz-text-diff-label{display:inline-block;min-width:45px;color:#777e8c;font-size:10px;font-weight:800;margin-right:6px}
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
      .priz-audit-change{margin-top:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.025)}
      .priz-audit-change-label{font-weight:800;font-size:11px;margin-bottom:5px;color:#e9ebf2}
      .priz-audit-change-values{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11px;line-height:1.35}
      .priz-audit-before{color:#8d93a1;text-decoration:line-through}
      .priz-audit-arrow{color:#666d7a}
      .priz-audit-after{color:#ff7272;font-weight:800}
      .priz-audit-clear{white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function actionTitle(action) {
    return action === 'update' ? 'Изменение' : action === 'delete' ? 'Удаление' : action;
  }

  function kindText(v) {
    const s = String(v ?? '');
    return s === 'cat1' ? 'Категория 1' : s === 'cat2' ? 'Категория 2' : (s === 'evaluation' || s === 'eval') ? 'Оценка' : s;
  }

  function valueText(key, value) {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'record_date') return fmtDate(String(value));
    if (key === 'kind') return kindText(value);
    if (['damage_customer','damage_store','reimbursed_customer','reimbursed_store'].includes(key)) return money(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }


  function diffTokens(value) {
    const text = String(value ?? '');
    return text.match(/\s+|[A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9_]+|[^\sA-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9_]/g) || [];
  }

  function textDiff(beforeValue, afterValue) {
    const before = diffTokens(beforeValue);
    const after = diffTokens(afterValue);
    const n = before.length, m = after.length;
    const dp = Array.from({length:n+1}, () => new Uint16Array(m+1));
    for (let i=n-1;i>=0;i--) {
      for (let j=m-1;j>=0;j--) {
        dp[i][j] = before[i] === after[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
      }
    }
    const oldParts = [], newParts = [];
    let i=0, j=0;
    while (i<n || j<m) {
      if (i<n && j<m && before[i] === after[j]) {
        const t = esc(before[i]);
        oldParts.push(`<span class="priz-diff-context">${t}</span>`);
        newParts.push(`<span class="priz-diff-context">${t}</span>`);
        i++; j++;
      } else if (j<m && (i===n || dp[i][j+1] >= dp[i+1][j])) {
        newParts.push(`<span class="priz-diff-added">${esc(after[j])}</span>`);
        j++;
      } else if (i<n) {
        oldParts.push(`<span class="priz-diff-removed">${esc(before[i])}</span>`);
        i++;
      }
    }
    return { beforeHtml: oldParts.join(''), afterHtml: newParts.join('') };
  }

  function isLongTextItem(item) {
    return item?.id === 'story' || item?.id === 'eval:comment';
  }

  function renderItemValues(item, compact=false) {
    if (isLongTextItem(item)) {
      const d = textDiff(valueText(item.key, item.before), valueText(item.key, item.after));
      return `<div class="priz-text-diff">
        <div class="priz-text-diff-line"><span class="priz-text-diff-label">Было:</span>${d.beforeHtml}</div>
        <div class="priz-text-diff-line"><span class="priz-text-diff-label">Стало:</span>${d.afterHtml}</div>
      </div>`;
    }
    const clsPrefix = compact ? 'priz-audit' : 'priz-change';
    return `<span class="${clsPrefix}-before">Было: ${esc(valueText(item.key, item.before))}</span>
      <span class="${clsPrefix}-arrow">→</span>
      <span class="${clsPrefix}-after">Стало: ${esc(valueText(item.key, item.after))}</span>`;
  }

  function pushItem(out, id, label, key, before, after, event) {
    if (String(before ?? '') === String(after ?? '')) return;
    out.push({
      id, label, key, before, after,
      actor: event?.actor_name || 'Система',
      createdAt: event?.created_at || null
    });
  }

  // Возвращает ТОЛЬКО понятные пользователю изменения.
  // UUID и служебные поля сюда намеренно не попадают.
  function friendlyEventChanges(event) {
    const ch = event?.changes || {};
    const out = [];

    if (ch.record_date) pushItem(out, 'record_date', 'Дата', 'record_date', ch.record_date.before, ch.record_date.after, event);

    // Магазин показываем одной строкой, без store_id и отдельного "Номер ТТ".
    if (ch.store_name_snapshot || ch.store_number_snapshot) {
      const n = ch.store_name_snapshot;
      const num = ch.store_number_snapshot;
      const before = n?.before ?? num?.before;
      const after = n?.after ?? num?.after;
      pushItem(out, 'store', 'Магазин', 'store_name_snapshot', before, after, event);
    }

    if (ch.manager_name_snapshot) pushItem(out, 'manager', 'Менеджер', 'manager_name_snapshot', ch.manager_name_snapshot.before, ch.manager_name_snapshot.after, event);
    if (ch.employee_name) pushItem(out, 'employee', 'Продавец', 'employee_name', ch.employee_name.before, ch.employee_name.after, event);
    if (ch.violation_type_snapshot) pushItem(out, 'violation', 'Тип нарушения', 'violation_type_snapshot', ch.violation_type_snapshot.before, ch.violation_type_snapshot.after, event);
    if (ch.story) pushItem(out, 'story', 'Фабула', 'story', ch.story.before, ch.story.after, event);
    if (ch.damage_customer) pushItem(out, 'damage_customer', 'Ущерб покупателю', 'damage_customer', ch.damage_customer.before, ch.damage_customer.after, event);
    if (ch.damage_store) pushItem(out, 'damage_store', 'Ущерб магазину', 'damage_store', ch.damage_store.before, ch.damage_store.after, event);
    if (ch.reimbursed_customer) pushItem(out, 'reimbursed_customer', 'Возмещено покупателю', 'reimbursed_customer', ch.reimbursed_customer.before, ch.reimbursed_customer.after, event);
    if (ch.reimbursed_store) pushItem(out, 'reimbursed_store', 'Возмещено магазину', 'reimbursed_store', ch.reimbursed_store.before, ch.reimbursed_store.after, event);
    if (ch.kind) pushItem(out, 'kind', 'Тип записи', 'kind', ch.kind.before, ch.kind.after, event);

    if (ch.evaluation_data?.before && ch.evaluation_data?.after) {
      const before = ch.evaluation_data.before || {};
      const after = ch.evaluation_data.after || {};
      if ((before.start_time || '') !== (after.start_time || '')) pushItem(out, 'eval:start_time', 'Время', 'eval:start_time', before.start_time, after.start_time, event);
      if ((before.buyer_gender || '') !== (after.buyer_gender || '')) pushItem(out, 'eval:buyer_gender', 'Пол покупателя', 'eval:buyer_gender', before.buyer_gender, after.buyer_gender, event);
      const bs = Array.isArray(before.scores) ? before.scores : [];
      const as = Array.isArray(after.scores) ? after.scores : [];
      CRITERIA.forEach((criterion, i) => {
        if (Number(bs[i] || 0) !== Number(as[i] || 0)) pushItem(out, `eval:score:${i}`, criterion, `eval:score:${i}`, Number(bs[i] || 0), Number(as[i] || 0), event);
      });
      if ((before.comment || '') !== (after.comment || '')) pushItem(out, 'eval:comment', 'Комментарий', 'eval:comment', before.comment, after.comment, event);
    }

    return out;
  }

  function renderFriendlyAuditChanges(event) {
    if (event.action === 'delete') {
      const ch = event.changes || {};
      const bits = [];
      if (ch.record_date) bits.push(`Дата: ${fmtDate(String(ch.record_date))}`);
      if (ch.store) bits.push(`Магазин: ${ch.store}`);
      if (ch.employee) bits.push(`Продавец: ${ch.employee}`);
      if (ch.manager) bits.push(`Менеджер: ${ch.manager}`);
      return `<div class="audit-change"><b>Запись удалена</b>${bits.length ? `<div class="muted small">${esc(bits.join(' · '))}</div>` : ''}</div>`;
    }

    const items = friendlyEventChanges(event);
    return items.map(item => `
      <div class="priz-audit-change">
        <div class="priz-audit-change-label">${esc(item.label)}</div>
        <div class="priz-audit-change-values">
          ${renderItemValues(item, true)}
        </div>
      </div>`).join('');
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

  function markDetailByLabel(root, label, shouldMark) {
    if (!shouldMark) return;
    for (const el of root.querySelectorAll('.detail')) {
      if (el.querySelector('.k')?.textContent.trim() === label) el.classList.add('priz-changed-field');
    }
  }

  function markStorySection(root, headingText, item) {
    if (!item) return;
    for (const h of root.querySelectorAll('h3')) {
      if (h.textContent.trim() !== headingText) continue;
      const next = h.nextElementSibling;
      if (!next?.classList.contains('story')) continue;
      const d = textDiff(valueText(item.key, item.before), valueText(item.key, item.after));
      h.style.color = '#ff7777';
      next.classList.add('priz-changed-story');
      // В самой текущей записи оставляем обычный текст, а красным отмечаем только добавленные/заменённые фрагменты.
      next.innerHTML = d.afterHtml;
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
            ${renderItemValues(item, false)}
          </div>
          <div class="priz-change-meta">${esc(item.actor)}${item.createdAt ? ` · ${esc(fmtDateTime(item.createdAt))}` : ''}</div>
        </div>`).join('')}
    `;
    head.insertAdjacentElement('afterend', panel);
  }

  async function highlightRecordChanges(recordId) {
    if (!['owner','boss'].includes(currentUser?.role)) return;
    const root = document.getElementById('viewDialogBody');
    if (!root) return;

    const { data, error } = await sb.from('audit_log')
      .select('changes,actor_name,created_at')
      .eq('record_id', recordId)
      .eq('action', 'update')
      .order('created_at', { ascending:false })
      .limit(200);
    if (error || !data?.length) return;

    const events = data.filter(x => friendlyEventChanges(x).length > 0);
    if (!events.length) return;

    const items = latestFriendlyChanges(events);
    const changed = new Set(items.map(x => x.id));
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
    markStorySection(root, 'Фабула', items.find(x => x.id === 'story'));
    markStorySection(root, 'Комментарий', items.find(x => x.id === 'eval:comment'));

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
    const head = root.querySelector('.dialog-head');
    if (headerChanges.length && head) {
      const left = head.firstElementChild;
      if (left && !left.querySelector('.priz-change-summary')) {
        const summary = document.createElement('div');
        summary.className = 'priz-change-summary';
        summary.innerHTML = headerChanges.map(x => `<span class="priz-change-tag">Изменено: ${esc(x)}</span>`).join('');
        left.appendChild(summary);
      }
    }
  }

  const baseViewRecord = window.viewRecord;
  if (typeof baseViewRecord === 'function') {
    window.viewRecord = async function(id) {
      await baseViewRecord(id);
      const root = document.getElementById('viewDialogBody');
      if (root) {
        for (const el of root.querySelectorAll('.detail .k')) {
          if (el.textContent.trim() === 'Сотрудник') el.textContent = 'Продавец';
        }
      }
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
        const { data, error } = await sb.rpc('clear_audit_history', { p_region_id:regionId });
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
    if (!['owner','boss'].includes(currentUser?.role)) { go('dashboard'); return; }

    let q = sb.from('audit_log').select('*').in('action',['update','delete']).order('created_at',{ascending:false}).limit(2000);
    const reg = document.getElementById('regionSelect')?.value || 'all';
    if (reg !== 'all') q = q.eq('region_id', REGIONS[reg]?.id);
    const { data, error } = await q;
    if (error) throw error;

    const events = (data || []).filter(x => x.action === 'delete' || (x.action === 'update' && friendlyEventChanges(x).length > 0));
    const clearButton = currentUser?.role === 'owner' ? '<button class="btn danger small-btn priz-audit-clear" type="button">Очистить историю</button>' : '';

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
            <div class="audit-line"><b>${esc(actionTitle(x.action))}</b><span class="muted small">${fmtDateTime(x.created_at)}</span></div>
            <div class="muted small">${esc(x.actor_name || 'Система')}</div>
            ${renderFriendlyAuditChanges(x)}
            ${x.record_id ? '<div class="audit-open-hint">Открыть запись →</div>' : ''}
          </div>`).join('') : '<div class="empty"><b>История пока пустая</b>Здесь появятся реальные изменения и удаления записей.</div>'}
      </div>`;

    document.querySelectorAll('.audit-clickable').forEach(x => { x.onclick = () => window.viewRecord(x.dataset.recordId); });
    document.querySelector('.priz-audit-clear')?.addEventListener('click', clearAuditHistory);
  };
})();
