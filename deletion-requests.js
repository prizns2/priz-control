(() => {
  const PAGE = 'deletionRequests';
  const ACTIVE_ROLES = new Set(['owner','boss','senior']);
  const STATUS_META = {
    pending_boss: { label: 'Ожидает руководителя', cls: 'pending' },
    approved_owner: { label: 'Согласовано · ожидает удаления', cls: 'approved' },
    rejected: { label: 'Отклонено', cls: 'rejected' },
    cancelled: { label: 'Отозвано', cls: 'muted' },
    deleted: { label: 'Удалено', cls: 'deleted' },
    stale: { label: 'Запись изменилась · нужна новая заявка', cls: 'stale' }
  };

  const style = document.createElement('style');
  style.textContent = `
    .delreq-nav{position:relative}
    .delreq-badge{display:none;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d63c45;color:white;font-size:10px;font-weight:900;align-items:center;justify-content:center;margin-left:auto}
    .delreq-badge.show{display:inline-flex}
    .delreq-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    .delreq-list{display:grid;gap:12px}
    .delreq-card{border:1px solid #2a2d38;border-radius:14px;background:#11131a;padding:14px}
    .delreq-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    .delreq-title{font-weight:900;font-size:14px;color:#f1f3f8}
    .delreq-sub{margin-top:4px;color:#8e95a3;font-size:11px;line-height:1.45}
    .delreq-status{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;border:1px solid #343846;white-space:nowrap}
    .delreq-status.pending{color:#ffd166;border-color:rgba(255,209,102,.35);background:rgba(255,209,102,.07)}
    .delreq-status.approved{color:#75e0a7;border-color:rgba(117,224,167,.35);background:rgba(117,224,167,.07)}
    .delreq-status.rejected,.delreq-status.stale{color:#ff7b82;border-color:rgba(255,82,82,.35);background:rgba(255,82,82,.07)}
    .delreq-status.deleted{color:#a8b0bd;border-color:rgba(168,176,189,.25);background:rgba(168,176,189,.05)}
    .delreq-status.muted{color:#8e95a3}
    .delreq-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
    .delreq-field{border:1px solid #252936;border-radius:10px;padding:9px 10px;min-width:0}
    .delreq-k{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#6f7684}
    .delreq-v{margin-top:4px;font-size:11px;font-weight:700;color:#e6e9ef;overflow-wrap:anywhere}
    .delreq-story{margin-top:10px;border:1px solid #252936;border-radius:10px;padding:10px;color:#d6dae3;font-size:11px;line-height:1.5;white-space:pre-wrap}
    .delreq-reason{margin-top:10px;border-left:3px solid #f0a84b;background:rgba(240,168,75,.06);border-radius:8px;padding:9px 10px;font-size:11px;line-height:1.45}
    .delreq-chain{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;color:#7f8795;font-size:10px}
    .delreq-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #252936}
    .delreq-warning{margin-top:10px;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,82,82,.28);background:rgba(255,82,82,.06);color:#ff8585;font-size:11px;font-weight:700}
    .delreq-dialog-card{width:min(560px,92vw)}
    .delreq-dialog-card textarea{min-height:120px;resize:vertical}
    @media(max-width:850px){.delreq-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function escText(v){ return typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function statusMeta(s){ return STATUS_META[s] || {label:s||'—',cls:'muted'}; }
  function regionName(id){ return REGION_BY_UUID?.[id]?.name || 'Регион'; }
  function recordKindLabel(k){ return k === 'cat1' ? 'Категория 1' : k === 'cat2' ? 'Категория 2' : k === 'evaluation' ? 'Оценка' : (k || '—'); }
  function formatWhen(v){ try { return fmtDateTime(v); } catch (_) { return v || '—'; } }

  function ensureDialogs(){
    if (!document.getElementById('deletionRequestDialog')) {
      const d = document.createElement('dialog');
      d.id = 'deletionRequestDialog';
      d.className = 'dialog';
      d.innerHTML = `<form method="dialog" class="dialog-card delreq-dialog-card" id="deletionRequestForm">
        <div class="dialog-head"><div><div class="eyebrow">ЗАЯВКА НА УДАЛЕНИЕ</div><h3 style="margin-top:6px">Причина удаления</h3></div><button class="close-x" value="cancel">×</button></div>
        <p class="muted small">Коротко объясните руководителю, почему запись нужно удалить. Минимум 5 символов.</p>
        <label>Причина<textarea id="deletionRequestReason" maxlength="1000" placeholder="Например: запись внесена дважды" required></textarea></label>
        <div class="dialog-actions"><button value="cancel" class="btn ghost">Отмена</button><button type="button" id="deletionRequestSend" class="btn danger">Отправить руководителю</button></div>
      </form>`;
      document.body.appendChild(d);
    }
    if (!document.getElementById('deletionDecisionDialog')) {
      const d = document.createElement('dialog');
      d.id = 'deletionDecisionDialog';
      d.className = 'dialog';
      d.innerHTML = `<div class="dialog-card delreq-dialog-card">
        <div class="dialog-head"><div><div class="eyebrow">ЗАЯВКА НА УДАЛЕНИЕ</div><h3 id="deletionDecisionTitle" style="margin-top:6px">Решение руководителя</h3></div><button class="close-x" id="deletionDecisionClose">×</button></div>
        <p class="muted small" id="deletionDecisionHint"></p>
        <label>Комментарий<textarea id="deletionDecisionComment" maxlength="1000" placeholder="Комментарий"></textarea></label>
        <div class="dialog-actions"><button class="btn ghost" id="deletionDecisionCancel">Отмена</button><button class="btn primary" id="deletionDecisionSubmit">Подтвердить</button></div>
      </div>`;
      document.body.appendChild(d);
    }
  }

  function ensureNav(){
    if (!ACTIVE_ROLES.has(currentUser?.role)) return;
    const nav = document.getElementById('nav');
    if (!nav || nav.querySelector('[data-page="deletionRequests"]')) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn delreq-nav';
    btn.dataset.page = PAGE;
    btn.innerHTML = `<span class="nav-ico">⌫</span><span>Заявки на удаление</span><span class="delreq-badge" id="delreqBadge"></span>`;
    const settings = nav.querySelector('[data-page="settings"]');
    if (settings) nav.insertBefore(btn, settings); else nav.appendChild(btn);
    btn.onclick = () => go(PAGE);
    refreshBadge();
  }

  async function refreshBadge(){
    if (!ACTIVE_ROLES.has(currentUser?.role)) return;
    try {
      const {data,error} = await sb.rpc('deletion_requests_badge');
      if (error) throw error;
      const badge = document.getElementById('delreqBadge');
      if (!badge) return;
      const n = Number(data || 0);
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.classList.toggle('show', n > 0);
    } catch (e) { console.warn('Deletion badge failed', e); }
  }

  const baseBuildShell = window.buildShell;
  if (typeof baseBuildShell === 'function') {
    window.buildShell = function(){
      const out = baseBuildShell.apply(this, arguments);
      ensureNav();
      return out;
    };
  }

  const baseRenderPage = window.renderPage;
  if (typeof baseRenderPage === 'function') {
    window.renderPage = async function(){
      if (currentPage === PAGE) {
        const sel = document.getElementById('regionSelect')?.value || 'all';
        document.getElementById('pageTitle').textContent = 'Заявки на удаление';
        document.getElementById('pageEyebrow').textContent = sel === 'all' ? 'ВСЕ РЕГИОНЫ' : (REGIONS[sel]?.eyebrow || sel.toUpperCase());
        document.getElementById('content').innerHTML = '<div class="loading-line">Загрузка…</div>';
        try { await renderDeletionRequests(); }
        catch (e) { console.error(e); document.getElementById('content').innerHTML = `<div class="empty"><b>Ошибка загрузки</b>${escText(e.message || e)}</div>`; }
        return;
      }
      return baseRenderPage.apply(this, arguments);
    };
  }

  function actionButtons(req){
    const actions = [];
    if (req.recordId) actions.push(`<button class="btn ghost small-btn delreq-open-record" data-id="${escText(req.recordId)}">Открыть запись</button>`);
    if (currentUser?.role === 'senior' && req.status === 'pending_boss') actions.push(`<button class="btn ghost small-btn delreq-cancel" data-request-id="${escText(req.id)}">Отозвать заявку</button>`);
    if (currentUser?.role === 'boss' && req.status === 'pending_boss') {
      actions.push(`<button class="btn ghost small-btn delreq-reject" data-request-id="${escText(req.id)}">Отклонить</button>`);
      actions.push(`<button class="btn primary small-btn delreq-approve" data-request-id="${escText(req.id)}">Согласовать</button>`);
    }
    if (currentUser?.role === 'owner' && req.status === 'approved_owner') actions.push(`<button class="btn danger small-btn delreq-owner-delete" data-request-id="${escText(req.id)}">Удалить запись</button>`);
    return actions.join('');
  }

  function renderRequestCard(req){
    const r = req.record || {};
    const sm = statusMeta(req.status);
    const chain = [
      `Запросил: ${req.requestedBy || '—'} · ${formatWhen(req.createdAt)}`,
      req.bossBy ? `Руководитель: ${req.bossBy} · ${formatWhen(req.bossAt)}` : null,
      req.ownerBy ? `Удалил: ${req.ownerBy} · ${formatWhen(req.ownerAt)}` : null
    ].filter(Boolean);
    return `<div class="delreq-card" data-request="${escText(req.id)}">
      <div class="delreq-head">
        <div><div class="delreq-title">${escText(recordKindLabel(r.kind))} · ${escText(r.store || 'Магазин не указан')}</div><div class="delreq-sub">${escText(regionName(req.regionId))} · ${escText(r.record_date ? fmtDate(String(r.record_date)) : '—')} · Автор: ${escText(r.created_by_name || '—')}</div></div>
        <span class="delreq-status ${escText(sm.cls)}">${escText(sm.label)}</span>
      </div>
      <div class="delreq-grid">
        <div class="delreq-field"><div class="delreq-k">Продавец</div><div class="delreq-v">${escText(r.employee || '—')}</div></div>
        <div class="delreq-field"><div class="delreq-k">Менеджер</div><div class="delreq-v">${escText(r.manager || '—')}</div></div>
        <div class="delreq-field"><div class="delreq-k">Тип нарушения</div><div class="delreq-v">${escText(r.violation_type || '—')}</div></div>
      </div>
      ${r.story ? `<div class="delreq-story">${escText(r.story)}</div>` : ''}
      <div class="delreq-reason"><b>Причина удаления:</b> ${escText(req.reason || '—')}</div>
      ${req.bossComment ? `<div class="delreq-sub" style="margin-top:8px"><b>Комментарий руководителя:</b> ${escText(req.bossComment)}</div>` : ''}
      ${req.status === 'stale' ? `<div class="delreq-warning">${escText(req.staleReason || 'Запись изменилась. Создайте новую заявку.')}</div>` : ''}
      <div class="delreq-chain">${chain.map(x => `<span>${escText(x)}</span>`).join('<span>•</span>')}</div>
      ${actionButtons(req) ? `<div class="delreq-actions">${actionButtons(req)}</div>` : ''}
    </div>`;
  }

  async function loadDeletionRequests(){
    const sel = document.getElementById('regionSelect')?.value || 'all';
    const regionId = sel === 'all' ? null : REGIONS[sel]?.id || null;
    const {data,error} = await sb.rpc('deletion_requests_payload',{p_region_id:regionId});
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function renderDeletionRequests(){
    ensureDialogs();
    const rows = await loadDeletionRequests();
    let intro = 'Цепочка: старший оператор → руководитель → Owner.';
    if (currentUser?.role === 'senior') intro = 'Здесь видны ваши заявки и их текущий статус.';
    if (currentUser?.role === 'boss') intro = 'Согласуйте или отклоните заявки старших операторов.';
    if (currentUser?.role === 'owner') intro = 'Удаление доступно только после согласования руководителем.';
    document.getElementById('content').innerHTML = `<div class="panel" style="margin-top:0">
      <div class="delreq-toolbar"><div><h3>Заявки на удаление</h3><div class="muted small">${escText(intro)}</div></div><span class="muted small">${rows.length} заявок</span></div>
      ${rows.length ? `<div class="delreq-list">${rows.map(renderRequestCard).join('')}</div>` : '<div class="empty"><b>Заявок пока нет</b>Новые заявки появятся здесь автоматически.</div>'}
    </div>`;
    bindRequestActions();
    refreshBadge();
  }

  function openRequestDialog(recordId){
    ensureDialogs();
    const d = document.getElementById('deletionRequestDialog');
    const reason = document.getElementById('deletionRequestReason');
    const send = document.getElementById('deletionRequestSend');
    reason.value = '';
    d.showModal();
    setTimeout(() => reason.focus(), 0);
    send.onclick = async () => {
      const text = reason.value.trim();
      if (text.length < 5) { toast('Укажите причину удаления', true); return; }
      setBusy(send,true,'Отправляем…');
      try {
        const {error} = await sb.rpc('deletion_request_create',{p_record_id:recordId,p_reason:text});
        if (error) throw error;
        d.close();
        toast('Заявка отправлена руководителю');
        refreshBadge();
      } catch (e) {
        const msg = String(e.message || e);
        toast(msg.includes('active request') ? 'На эту запись уже есть активная заявка' : 'Не удалось отправить заявку: '+msg, true);
      } finally { setBusy(send,false); }
    };
  }

  async function cancelRequest(id){
    if (!confirm('Отозвать эту заявку на удаление?')) return;
    try {
      const {error} = await sb.rpc('deletion_request_cancel',{p_request_id:id});
      if (error) throw error;
      toast('Заявка отозвана');
      await renderDeletionRequests();
    } catch (e) { toast('Не удалось отозвать заявку: '+(e.message || e), true); }
  }

  function openBossDecision(id, approve){
    ensureDialogs();
    const d = document.getElementById('deletionDecisionDialog');
    const title = document.getElementById('deletionDecisionTitle');
    const hint = document.getElementById('deletionDecisionHint');
    const comment = document.getElementById('deletionDecisionComment');
    const submit = document.getElementById('deletionDecisionSubmit');
    title.textContent = approve ? 'Согласовать удаление?' : 'Отклонить заявку?';
    hint.textContent = approve ? 'После согласования заявка автоматически перейдёт Owner для окончательного удаления.' : 'При отклонении комментарий обязателен.';
    comment.value = '';
    comment.placeholder = approve ? 'Комментарий необязателен' : 'Укажите причину отклонения';
    submit.textContent = approve ? 'Согласовать' : 'Отклонить';
    submit.className = approve ? 'btn primary' : 'btn danger';
    document.getElementById('deletionDecisionClose').onclick = () => d.close();
    document.getElementById('deletionDecisionCancel').onclick = () => d.close();
    submit.onclick = async () => {
      const text = comment.value.trim();
      if (!approve && text.length < 3) { toast('Укажите причину отклонения', true); return; }
      setBusy(submit,true,'Сохраняем…');
      try {
        const {data,error} = await sb.rpc('deletion_request_boss_decide',{p_request_id:id,p_approve:approve,p_comment:text || null});
        if (error) throw error;
        d.close();
        if (data?.status === 'stale') toast('Запись уже изменилась. Требуется новая заявка.', true);
        else toast(approve ? 'Согласовано и отправлено Owner' : 'Заявка отклонена');
        await renderDeletionRequests();
      } catch (e) { toast('Не удалось сохранить решение: '+(e.message || e), true); }
      finally { setBusy(submit,false); }
    };
    d.showModal();
  }

  async function ownerDeleteRequest(id){
    const ok = confirm('Запись согласована руководителем. Удалить её окончательно вместе с фото и видео?');
    if (!ok) return;
    try {
      const {data:prep,error:pErr} = await sb.rpc('deletion_request_owner_prepare',{p_request_id:id});
      if (pErr) throw pErr;
      if (!prep?.ok) {
        toast('Запись изменилась или больше не существует. Заявка остановлена.', true);
        await renderDeletionRequests();
        return;
      }
      const recordId = prep.recordId;
      const r = await fetchRecordById(recordId);
      if (!r) throw new Error('Запись не найдена');
      for (const a of r.attachments || []) {
        await mediaAccess({action:'delete',mediaId:a.id});
      }
      await deleteRecordServer(recordId);
      const {error:mErr} = await sb.rpc('deletion_request_mark_deleted',{p_request_id:id});
      if (mErr) throw mErr;
      toast('Запись удалена');
      recordCache = (recordCache || []).filter(x => x.id !== recordId);
      await renderDeletionRequests();
    } catch (e) {
      console.error(e);
      toast('Не удалось удалить запись: '+(e.message || e), true);
    }
  }

  function bindRequestActions(){
    document.querySelectorAll('.delreq-open-record').forEach(b => b.onclick = () => viewRecord(b.dataset.id));
    document.querySelectorAll('.delreq-cancel').forEach(b => b.onclick = () => cancelRequest(b.dataset.requestId));
    document.querySelectorAll('.delreq-approve').forEach(b => b.onclick = () => openBossDecision(b.dataset.requestId,true));
    document.querySelectorAll('.delreq-reject').forEach(b => b.onclick = () => openBossDecision(b.dataset.requestId,false));
    document.querySelectorAll('.delreq-owner-delete').forEach(b => b.onclick = () => ownerDeleteRequest(b.dataset.requestId));
  }

  const baseViewRecord = window.viewRecord;
  if (typeof baseViewRecord === 'function') {
    window.viewRecord = async function(id){
      await baseViewRecord(id);
      if (currentUser?.role !== 'senior') return;
      try {
        const r = await fetchRecordById(id);
        if (!r || r.kind === 'eval') return;
        const root = document.getElementById('viewDialogBody');
        const actions = root?.querySelector('.dialog-actions');
        if (!actions || actions.querySelector('.delreq-request-button')) return;
        const btn = document.createElement('button');
        btn.className = 'btn danger delreq-request-button';
        btn.textContent = 'Запросить удаление';
        btn.onclick = () => openRequestDialog(id);
        actions.insertBefore(btn, actions.firstChild);
      } catch (e) { console.warn('Deletion request button failed', e); }
    };
  }

  ensureDialogs();
  setTimeout(ensureNav, 500);
  setTimeout(ensureNav, 1800);
  setInterval(() => { if (ACTIVE_ROLES.has(currentUser?.role)) { ensureNav(); refreshBadge(); } }, 30000);
})();
