(() => {
  if (window.__prizExactUIInstalled) return;
  window.__prizExactUIInstalled = true;

  const ICONS = {
    total: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6 19.3 6.4v5.2c0 4.3-2.7 6.8-7.3 8.3-4.6-1.5-7.3-4-7.3-8.3V6.4z"/><path d="M12 8v5"/><path d="M12 16.2h.01"/></svg>`,
    cat1: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 4 7.4 3.9-7.4 3.9-7.4-3.9z"/><path d="m4.6 11.8 7.4 3.9 7.4-3.9"/><path d="m4.6 15.8 7.4 3.9 7.4-3.9"/></svg>`,
    cat2: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.8h7l3.6 3.6v12.8H7z"/><path d="M14 3.8v4h3.6"/><path d="M9.5 11.3h5M9.5 14.5h5"/></svg>`,
    eval: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3.6 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83z"/></svg>`,
    records: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.8h7l3.5 3.5v12.9H7z"/><path d="M14 3.8v4h3.5"/><path d="M9.5 11.2h5M9.5 14.5h5M9.5 17.8h3.6"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 5h5v5"/><path d="m19 5-8 8"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`
  };

  const SPARK = {
    total: 'M2 28 C12 27 17 16 29 18 S43 26 54 14 S69 10 79 7 S91 10 99 4',
    cat1: 'M2 28 C11 24 18 15 28 16 S41 24 52 14 S67 7 78 10 S90 9 99 4',
    cat2: 'M2 27 C10 20 17 17 25 21 S39 23 47 15 S61 18 70 12 S84 10 99 4',
    eval: 'M2 27 C14 26 18 14 30 15 S44 21 55 14 S68 8 78 11 S91 9 99 5'
  };

  function spark(kind) {
    return `<svg class="priz-spark-svg" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="priz-spark-${kind}" x1="0" x2="1">
          <stop offset="0%" stop-color="#743cff" stop-opacity=".3"/>
          <stop offset="55%" stop-color="#8b45ff"/>
          <stop offset="100%" stop-color="#d0b8ff"/>
        </linearGradient>
        <filter id="priz-spark-glow-${kind}" x="-30%" y="-80%" width="160%" height="260%">
          <feGaussianBlur stdDeviation="1.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="${SPARK[kind]}" fill="none" stroke="url(#priz-spark-${kind})" stroke-width="2.1" vector-effect="non-scaling-stroke" filter="url(#priz-spark-glow-${kind})"/>
      <circle cx="99" cy="${kind === 'eval' ? 5 : 4}" r="2.1" fill="#e5dcff"/>
    </svg>`;
  }

  function statCard(kind, title, value, sub, live=false) {
    return `<article class="priz-stat priz-stat-${kind}">
      <div class="priz-stat-icon">${ICONS[kind]}</div>
      <div class="priz-stat-copy">
        <div class="priz-stat-title">${title}</div>
        <div class="priz-stat-value">${value}</div>
        <div class="priz-stat-sub">${sub}</div>
      </div>
      <div class="priz-stat-badge"><i></i>${live ? 'LIVE' : 'LIVE'}</div>
      <div class="priz-stat-spark">${spark(kind)}</div>
    </article>`;
  }

  function quickCard(kind, title, desc) {
    return `<button type="button" class="priz-quick-card" data-kind="${kind}">
      <span class="priz-quick-icon">${ICONS[kind]}</span>
      <span class="priz-quick-copy">
        <b>${title}</b>
        <span>${desc}</span>
      </span>
      <span class="priz-quick-arrow">${ICONS.arrow}</span>
    </button>`;
  }

  function exactDashboardTable(list) {
    if (!list.length) {
      return '<div class="empty"><b>Записей пока нет</b>В этом разделе пока ничего не добавлено.</div>';
    }

    return `<div class="priz-home-table-wrap">
      <table class="priz-home-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Магазин</th>
            <th>Продавец</th>
            <th>Менеджер</th>
            <th>Фабула</th>
            <th>Оператор</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map(r => `
            <tr class="clickable" data-id="${esc(r.id)}">
              <td>${fmtDate(r.date)}</td>
              <td>${esc(r.store || '—')}</td>
              <td>${esc(recordSubject(r))}</td>
              <td>${esc(r.manager || '—')}</td>
              <td>
                <b>${esc(recordTitle(r))}</b>
                <div class="muted small">${esc((r.story || r.comment || '').slice(0, 90))}${(r.story || r.comment || '').length > 90 ? '…' : ''}</div>
              </td>
              <td>${esc(r.createdByName)}</td>
              <td class="priz-row-actions">
                ${canEdit() ? `<button class="btn ghost small-btn edit-row" data-id="${esc(r.id)}">Редактировать</button>` : ''}
                <span class="priz-row-more" aria-hidden="true">⋮</span>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  }

  async function exactRenderDashboard() {
    const today = todayKyiv();
    const regionSel = $('#regionSelect')?.value || 'all';
    const pRegionId = regionSel === 'all' ? null : (REGIONS[regionSel]?.id || null);

    const { data: payload, error } = await sb.rpc('dashboard_payload', {
      p_region_id: pRegionId,
      p_date: today
    });
    if (error) throw error;

    const counts = payload?.counts || {};
    const cat1Count = Number(counts.cat1 || 0);
    const cat2Count = Number(counts.cat2 || 0);
    const evalCount = Number(counts.evaluation || 0);

    const latest = payload?.latest || {};
    const cat1Rows = (latest.cat1 || []).map(r => fromDbRecord(r, []));
    const cat2Rows = (latest.cat2 || []).map(r => fromDbRecord(r, []));
    const evalRows = (latest.evaluation || []).map(r => fromDbRecord(r, []));
    const lists = { cat1: cat1Rows, cat2: cat2Rows, eval: evalRows };

    recordCache = [...cat1Rows, ...cat2Rows, ...evalRows];

    $('#content').innerHTML = `
      <div class="priz-home">
        ${currentUser.role === 'boss'
          ? '<div class="notice">Режим руководителя: просмотр записей, медиа и истории без возможности редактирования.</div>'
          : ''}

        <section class="priz-stat-grid">
          ${statCard('total', 'Всего нарушений', cat1Count + cat2Count, 'за сегодня', true)}
          ${statCard('cat1', 'Категория 1', cat1Count, 'за сегодня')}
          ${statCard('cat2', 'Категория 2', cat2Count, 'за сегодня')}
          ${statCard('eval', 'Оценки', evalCount, 'за сегодня')}
        </section>

        <section class="priz-quick-section">
          <h3>Быстрое добавление</h3>
          <div class="priz-quick-grid ${canCreate() ? '' : 'readonly'}">
            ${quickCard('cat1', 'Категория 1', 'Добавить нарушение в категорию 1')}
            ${quickCard('cat2', 'Категория 2', 'Добавить нарушение в категорию 2')}
            ${quickCard('eval', 'Оценка', 'Добавить оценку или комментарий')}
          </div>
        </section>

        <section class="priz-records-card">
          <header class="priz-records-head">
            <div class="priz-records-heading">
              <span class="priz-records-icon">${ICONS.records}</span>
              <span>
                <b>Записи</b>
                <small>Последние записи выбранного раздела</small>
              </span>
            </div>

            <button type="button" class="btn ghost small-btn priz-open-all" id="allRecords">
              ${ICONS.external}
              <span>Открыть все</span>
            </button>
          </header>

          <div class="priz-dashboard-tabs">
            <button class="priz-dashboard-tab active" data-dashboard-kind="cat1">Категория 1</button>
            <button class="priz-dashboard-tab" data-dashboard-kind="cat2">Категория 2</button>
            <button class="priz-dashboard-tab" data-dashboard-kind="eval">Оценка</button>
          </div>

          <div id="dashboardRecordsArea">
            ${exactDashboardTable(lists.cat1)}
          </div>
        </section>
      </div>`;

    $$('.priz-quick-card').forEach(c => {
      c.onclick = () => {
        if (!canCreate()) {
          toast('У этой роли только просмотр', true);
          return;
        }
        const region = creationRegionCode();
        if (region) openRecordForm(c.dataset.kind, null, region);
        else openRegionPicker(c.dataset.kind);
      };
    });

    $('#allRecords').onclick = () => go('records');

    $$('.priz-dashboard-tab').forEach(btn => {
      btn.onclick = () => {
        $$('.priz-dashboard-tab').forEach(x => x.classList.toggle('active', x === btn));
        $('#dashboardRecordsArea').innerHTML = exactDashboardTable(lists[btn.dataset.dashboardKind] || []);
        bindRows();
      };
    });

    bindRows();
  }

  function ensureShell() {
    const topbar = document.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.priz-topbar-inner')) {
      const inner = document.createElement('div');
      inner.className = 'priz-topbar-inner';

      while (topbar.firstChild) inner.appendChild(topbar.firstChild);
      topbar.appendChild(inner);
    }

    const title = document.getElementById('pageTitle');
    const titleBlock = title?.parentElement;
    if (titleBlock && !titleBlock.querySelector('.priz-page-subtitle')) {
      const sub = document.createElement('div');
      sub.className = 'priz-page-subtitle';
      sub.textContent = 'Добро пожаловать в PRIZ Control';
      title.insertAdjacentElement('afterend', sub);
    }

    const actions = document.querySelector('.top-actions');
    if (actions && !actions.querySelector('.priz-top-motto')) {
      const motto = document.createElement('div');
      motto.className = 'priz-top-motto';
      motto.innerHTML = 'БЕЗОПАСНОСТЬ<br>СОЗДАЁТ ПОРЯДОК';
      actions.appendChild(motto);
    }

    const userCard = document.getElementById('userCard');
    if (userCard && !userCard.querySelector('.priz-profile-avatar')) {
      const avatar = document.createElement('span');
      avatar.className = 'priz-profile-avatar';
      avatar.innerHTML = '<b>P</b><i></i>';
      userCard.prepend(avatar);
    }

    const bottom = document.querySelector('.sidebar-bottom');
    if (bottom && !bottom.querySelector('.priz-sidebar-motto')) {
      const motto = document.createElement('div');
      motto.className = 'priz-sidebar-motto';
      motto.innerHTML = '<span>БЕЗОПАСНОСТЬ<br>СОЗДАЁТ ПОРЯДОК</span><i></i>';
      bottom.appendChild(motto);
    }

    syncPageClass();
  }

  function syncPageClass() {
    const title = document.getElementById('pageTitle')?.textContent?.trim() || '';
    document.body.classList.toggle('priz-home-page', title === 'Главная');
  }

  // Replace the old dashboard renderer with the exact layout.
  renderDashboard = exactRenderDashboard;
  try { window.renderDashboard = exactRenderDashboard; } catch (_) {}

  // Re-decorate shell after buildShell rewrites user/nav content.
  if (typeof buildShell === 'function') {
    const originalBuildShell = buildShell;
    buildShell = function (...args) {
      const result = originalBuildShell.apply(this, args);
      ensureShell();
      return result;
    };
    try { window.buildShell = buildShell; } catch (_) {}
  }

  ensureShell();

  // Safe observer: it watches only the title text and toggles a class on BODY.
  // It never mutates the observed node, so it cannot loop.
  const titleNode = document.getElementById('pageTitle');
  if (titleNode) {
    const titleObserver = new MutationObserver(syncPageClass);
    titleObserver.observe(titleNode, { childList: true, characterData: true, subtree: true });
  }
})();