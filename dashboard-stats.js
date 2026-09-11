(() => {
  if (window.__prizDashboardStatsInstalled) return;
  window.__prizDashboardStatsInstalled = true;

  const style = document.createElement('style');
  style.id = 'priz-dashboard-stats-style';
  style.textContent = `
    #content .dashboard-today.priz-dashboard-stats {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 14px !important;
      align-items: stretch !important;
      width: 100% !important;
    }

    #content .dashboard-today.priz-dashboard-stats .stat-card {
      min-width: 0 !important;
      min-height: 118px !important;
      height: 100% !important;
      padding: 18px 20px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      box-sizing: border-box !important;
    }

    #content .dashboard-today.priz-dashboard-stats .stat-label {
      font-size: 12px !important;
      line-height: 1.3 !important;
      color: #8f98a8 !important;
      font-weight: 700 !important;
    }

    #content .dashboard-today.priz-dashboard-stats .stat-value {
      margin: 8px 0 6px !important;
      font-size: 34px !important;
      line-height: 1 !important;
      font-weight: 900 !important;
      color: #f5f7fb !important;
      letter-spacing: -0.02em !important;
    }

    #content .dashboard-today.priz-dashboard-stats .stat-sub {
      margin-top: auto !important;
      font-size: 10px !important;
      line-height: 1.3 !important;
      color: #687283 !important;
    }

    @media (max-width: 1100px) {
      #content .dashboard-today.priz-dashboard-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }

    @media (max-width: 650px) {
      #content .dashboard-today.priz-dashboard-stats {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(style);

  function identify(card) {
    const text = card?.querySelector('.stat-label')?.textContent || '';
    if (/всего нарушений/i.test(text)) return 'total';
    if (/категория\s*1/i.test(text)) return 'cat1';
    if (/категория\s*2/i.test(text)) return 'cat2';
    if (/оцен/i.test(text)) return 'eval';
    return null;
  }

  function makeCard(title, value) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-label">${title}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">за сегодня</div>
    `;
    return card;
  }

  function beautifyDashboardStats() {
    if (typeof currentPage !== 'undefined' && currentPage !== 'dashboard') return;

    const row = document.querySelector('#content .dashboard-today');
    if (!row || row.dataset.prizStatsReady === '1') return;

    const values = { total: '0', cat1: '0', cat2: '0', eval: '0' };

    [...row.querySelectorAll('.stat-card')].forEach(card => {
      const key = identify(card);
      if (!key) return;
      values[key] = card.querySelector('.stat-value')?.textContent?.trim() || '0';
    });

    row.innerHTML = '';
    row.classList.add('priz-dashboard-stats');

    row.append(
      makeCard('Всего нарушений', values.total),
      makeCard('Категория 1', values.cat1),
      makeCard('Категория 2', values.cat2),
      makeCard('Оценки', values.eval)
    );

    row.dataset.prizStatsReady = '1';
  }

  // renderDashboard каждый раз создаёт блок заново, поэтому оформляем после каждого рендера.
  if (typeof renderDashboard === 'function') {
    const originalRenderDashboard = renderDashboard;

    renderDashboard = async function (...args) {
      const result = await originalRenderDashboard.apply(this, args);
      beautifyDashboardStats();
      return result;
    };

    try { window.renderDashboard = renderDashboard; } catch (_) {}
  }

  // Если скрипт подключился, когда Главная уже отрисована.
  beautifyDashboardStats();
})();
