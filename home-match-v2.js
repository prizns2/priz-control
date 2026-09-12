(() => {
  if (window.__prizHomeMatchV2Installed) return;
  window.__prizHomeMatchV2Installed = true;

  // If old visual layers were accidentally left in index.html, remove their CSS.
  // Their JS logic is not touched; HOME MATCH V2 simply takes visual priority.
  document.getElementById('prizDashboardHomePremiumStyles')?.remove();
  document.getElementById('prizPremiumUIV1Styles')?.remove();

  const SVG = {
    total: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4.5 19V14.3"/>
        <path d="M9.5 19V9.5"/>
        <path d="M14.5 19V5.3"/>
        <path d="M19.5 19V11.3"/>
      </svg>`,
    cat1: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3.6 19.4 6.4v5.1c0 4.4-2.8 6.8-7.4 8.3-4.6-1.5-7.4-3.9-7.4-8.3V6.4z"/>
        <path d="M12 8.2v4.8"/>
        <path d="M12 16.2h.01"/>
      </svg>`,
    cat2: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m12 4.2 7.2 3.8-7.2 3.8L4.8 8z"/>
        <path d="m4.8 11.9 7.2 3.8 7.2-3.8"/>
        <path d="m4.8 15.8 7.2 3.8 7.2-3.8"/>
      </svg>`,
    eval: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m12 3.7 2.45 4.96 5.47.79-3.96 3.86.94 5.45L12 16.18l-4.9 2.58.94-5.45-3.96-3.86 5.47-.79z"/>
      </svg>`,
    arrow: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 5 7 7-7 7"/>
      </svg>`,
    records: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7 3.8h7l3.5 3.5v12.9H7z"/>
        <path d="M14 3.8v4h3.5"/>
        <path d="M9.5 11.3h5.1M9.5 14.6h5.1M9.5 17.9h3.5"/>
      </svg>`
  };

  const SPARK = {
    total: 'M2 29 C13 29 17 18 29 18 S44 25 54 14 S69 11 78 7 S91 9 99 4',
    cat1:  'M2 28 C12 25 16 15 27 16 S42 24 52 15 S66 7 77 10 S90 9 99 4',
    cat2:  'M2 27 C10 20 17 17 25 21 S39 24 47 15 S61 18 69 12 S84 10 99 4',
    eval:  'M2 27 C14 26 18 14 30 15 S44 21 54 14 S68 8 78 11 S91 9 99 5'
  };

  function statKind(card) {
    const t = card.querySelector('.stat-label')?.textContent || '';
    if (/всего нарушений/i.test(t)) return 'total';
    if (/категория\s*1/i.test(t)) return 'cat1';
    if (/категория\s*2/i.test(t)) return 'cat2';
    if (/оцен/i.test(t)) return 'eval';
    return null;
  }

  function buildSpark(kind) {
    const wrap = document.createElement('span');
    wrap.className = 'hm-stat-spark';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <svg viewBox="0 0 100 34" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hm-grad-${kind}" x1="0" x2="1">
            <stop offset="0%" stop-color="#6d3ee7" stop-opacity=".2"/>
            <stop offset="55%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#c4b5fd"/>
          </linearGradient>
          <filter id="hm-glow-${kind}" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="1.35" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d="${SPARK[kind]}" fill="none"
              stroke="url(#hm-grad-${kind})"
              stroke-width="2.05"
              vector-effect="non-scaling-stroke"
              filter="url(#hm-glow-${kind})"/>
        <circle cx="99" cy="${kind === 'total' ? 4 : kind === 'eval' ? 5 : 4}"
                r="2.15" fill="#ddd6fe"/>
      </svg>`;
    return wrap;
  }

  function decorateStat(card) {
    if (!(card instanceof HTMLElement)) return;
    const kind = statKind(card);
    if (!kind) return;

    // dashboard-stats.js can recreate cards; only decorate a card once.
    if (card.dataset.homeMatchV2 === 'stat') return;
    card.dataset.homeMatchV2 = 'stat';
    card.classList.add('hm-stat-card', `hm-stat-${kind}`);

    const label = card.querySelector('.stat-label');
    const value = card.querySelector('.stat-value');
    const sub = card.querySelector('.stat-sub');
    if (!label || !value || !sub) return;

    const icon = document.createElement('span');
    icon.className = 'hm-stat-icon';
    icon.innerHTML = SVG[kind];

    const copy = document.createElement('span');
    copy.className = 'hm-stat-copy';

    // Do not invent comparative statistics. The reference has a % badge;
    // here it is a neutral "LIVE" status until real comparison is connected.
    const badge = document.createElement('span');
    badge.className = 'hm-stat-badge';
    badge.innerHTML = '<i></i> LIVE';
    badge.title = 'Текущие данные';

    label.before(copy);
    copy.append(label, value, sub);
    card.prepend(icon);
    card.append(badge, buildSpark(kind));
  }

  function decorateStats(root) {
    const rows = [];
    if (root.matches?.('.dashboard-today')) rows.push(root);
    root.querySelectorAll?.('.dashboard-today').forEach(x => rows.push(x));

    for (const row of rows) {
      row.classList.add('hm-stats-row');
      row.querySelectorAll('.stat-card').forEach(decorateStat);
    }
  }

  function quickKind(card) {
    const k = String(card.dataset.kind || card.dataset.k || '').toLowerCase();
    return ['cat1','cat2','eval'].includes(k) ? k : null;
  }

  function decorateQuick(card) {
    if (!(card instanceof HTMLElement)) return;
    const kind = quickKind(card);
    if (!kind || card.dataset.homeMatchV2 === 'quick') return;

    card.dataset.homeMatchV2 = 'quick';
    card.classList.add('hm-quick-card', `hm-quick-${kind}`);

    let icon = card.querySelector(':scope > .quick-icon') || card.querySelector('.quick-icon');
    if (icon) {
      icon.classList.add('hm-quick-icon');
      icon.innerHTML = SVG[kind];
    }

    const title = card.querySelector(':scope > .quick-title') || card.querySelector('.quick-title');
    const desc  = card.querySelector(':scope > .quick-desc') || card.querySelector('.quick-desc');

    if (title && !card.querySelector(':scope > .hm-quick-copy')) {
      const copy = document.createElement('span');
      copy.className = 'hm-quick-copy';
      title.before(copy);
      copy.appendChild(title);
      if (desc) copy.appendChild(desc);
    }

    if (!card.querySelector(':scope > .hm-quick-arrow')) {
      const arrow = document.createElement('span');
      arrow.className = 'hm-quick-arrow';
      arrow.innerHTML = SVG.arrow;
      arrow.setAttribute('aria-hidden', 'true');
      card.appendChild(arrow);
    }
  }

  function decorateQuickPanel(root) {
    const grids = [];
    if (root.matches?.('.quick-grid')) grids.push(root);
    root.querySelectorAll?.('.quick-grid').forEach(x => grids.push(x));

    for (const grid of grids) {
      // Only dashboard/type-picker cards with cat1/cat2/eval are decorated.
      const cards = [...grid.querySelectorAll(':scope > .quick-card')].filter(c => quickKind(c));
      if (!cards.length) continue;
      grid.classList.add('hm-quick-grid');
      const panel = grid.closest('.panel');
      if (panel) panel.classList.add('hm-quick-panel');
      cards.forEach(decorateQuick);
    }
  }

  function decorateRecords(root) {
    const areas = [];
    if (root.id === 'dashboardRecordsArea') areas.push(root);
    root.querySelectorAll?.('#dashboardRecordsArea').forEach(x => areas.push(x));

    for (const area of areas) {
      const panel = area.closest('.panel');
      if (!panel) continue;

      panel.classList.add('hm-records-panel');

      const head = panel.querySelector('.dashboard-records-head');
      if (head && !head.querySelector('.hm-records-title-icon')) {
        const titleWrap = head.querySelector(':scope > div');
        if (titleWrap) {
          titleWrap.classList.add('hm-records-title-wrap');
          const icon = document.createElement('span');
          icon.className = 'hm-records-title-icon';
          icon.innerHTML = SVG.records;
          titleWrap.prepend(icon);
        }
      }

      panel.querySelectorAll('.dashboard-kind-tab').forEach(x => x.classList.add('hm-kind-tab'));
      panel.querySelectorAll('.table-wrap').forEach(x => x.classList.add('hm-home-table'));
    }
  }

  function syncTopbar() {
    const top = document.querySelector('.topbar');
    const title = document.getElementById('pageTitle');
    if (!top || !title) return;

    let sub = top.querySelector('.hm-page-subtitle');
    if (!sub) {
      sub = document.createElement('div');
      sub.className = 'hm-page-subtitle';
      title.insertAdjacentElement('afterend', sub);
    }

    const isDashboard =
      (typeof currentPage !== 'undefined' && currentPage === 'dashboard') ||
      /главная/i.test(title.textContent || '');

    // SAFE: do not rewrite identical text from an observer callback.
    const wantedSubtitle = 'Добро пожаловать в PRIZ Control';
    if (sub.textContent !== wantedSubtitle) sub.textContent = wantedSubtitle;
    sub.classList.toggle('hidden', !isDashboard);
    top.classList.toggle('hm-topbar-dashboard', isDashboard);
  }

  function decorateUserCard() {
    const card = document.getElementById('userCard');
    if (!card) return;
    card.dataset.homeMatchV2 = 'user';
    card.classList.add('hm-user-card');

    if (!card.querySelector('.hm-user-avatar')) {
      const avatar = document.createElement('span');
      avatar.className = 'hm-user-avatar';
      avatar.innerHTML = '<b>P</b><i></i>';
      avatar.title = 'Аватар';
      card.prepend(avatar);
    }
  }

  function scan(root = document) {
    if (!root || root.nodeType !== 1 && root !== document) return;
    decorateStats(root);
    decorateQuickPanel(root);
    decorateRecords(root);
    syncTopbar();
    decorateUserCard();
  }

  const style = document.createElement('style');
  style.id = 'prizHomeMatchV2Styles';
  style.textContent = `
    :root {
      --hm-bg: #080a12;
      --hm-card: #111522;
      --hm-card2: #151a29;
      --hm-line: rgba(115,125,153,.22);
      --hm-purple: #8b5cf6;
      --hm-purple2: #6d3ee7;
      --hm-text: #f6f7fb;
      --hm-muted: #9099ad;
    }

    body {
      background:
        radial-gradient(circle at 72% -12%, rgba(111,62,231,.12), transparent 33%),
        #080a12 !important;
    }

    .main {
      background:
        radial-gradient(circle at 61% -9%, rgba(113,61,231,.11), transparent 31%),
        linear-gradient(180deg,#090b13 0%,#080a11 55%,#070910 100%) !important;
    }

    /* Large violet hero arc from the reference, intentionally very subtle. */
    .main::before {
      content: "";
      position: fixed;
      top: -250px;
      left: 48%;
      width: 690px;
      height: 470px;
      pointer-events: none;
      border-radius: 50%;
      border: 1px solid rgba(126,73,255,.19);
      box-shadow:
        0 0 70px rgba(109,62,231,.12),
        inset 0 -40px 100px rgba(109,62,231,.06);
      transform: rotate(-8deg);
      z-index: 0;
    }

    .topbar,
    #prizPageHost {
      position: relative;
      z-index: 1;
    }

    /* SIDEBAR */
    .sidebar {
      background:
        radial-gradient(circle at 12% 6%, rgba(123,67,245,.13), transparent 26%),
        linear-gradient(180deg,#0d1019 0%,#090d15 68%,#0b0f18 100%) !important;
      border-right: 1px solid rgba(132,89,229,.17) !important;
      box-shadow: 14px 0 48px rgba(0,0,0,.19);
    }

    .sidebar-brand .brand-mark.mini {
      background: linear-gradient(145deg,#6333db,#8b5cf6) !important;
      border: 1px solid rgba(205,189,255,.27) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.11),
        0 0 26px rgba(124,58,237,.27) !important;
    }

    /* TOPBAR */
    .topbar {
      min-height: 104px !important;
      height: 104px !important;
      padding: 0 30px !important;
      background: rgba(8,10,17,.78) !important;
      border-bottom: 1px solid rgba(87,96,118,.12) !important;
      backdrop-filter: blur(18px) saturate(120%) !important;
    }

    .topbar .eyebrow {
      color: #a78bfa !important;
      font-size: 10px !important;
      letter-spacing: .19em !important;
      margin-bottom: 6px;
    }

    .topbar h2 {
      font-size: 28px !important;
      line-height: 1.05 !important;
      letter-spacing: -.035em !important;
      color: #f7f8fb !important;
    }

    .hm-page-subtitle {
      margin-top: 7px;
      color: #838ca0;
      font-size: 12px;
      font-weight: 540;
    }

    .top-actions {
      gap: 10px !important;
    }

    .select.compact {
      min-width: 176px !important;
      min-height: 44px !important;
      border-radius: 12px !important;
      background: rgba(13,17,27,.94) !important;
      border-color: rgba(107,117,143,.28) !important;
    }

    #quickAddBtn {
      min-height: 44px !important;
      padding: 10px 17px !important;
      border-radius: 11px !important;
      background: linear-gradient(135deg,#7040ef,#8b5cf6 62%,#945fff) !important;
      border: 1px solid rgba(207,190,255,.19) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.12),
        0 9px 23px rgba(109,62,231,.22) !important;
    }

    /* CONTENT SPACING - closer to the reference */
    #prizPageHost {
      padding-top: 0 !important;
    }

    #content.content,
    .priz-page-slot.content {
      padding: 22px 28px 46px !important;
    }

    /* ========== EXACT HOME STATS ==========
       Higher specificity than dashboard-stats.js, on purpose. */
    #content .dashboard-today.hm-stats-row {
      display: grid !important;
      grid-template-columns: repeat(4,minmax(0,1fr)) !important;
      gap: 14px !important;
      width: 100% !important;
      align-items: stretch !important;
    }

    #content .dashboard-today.hm-stats-row .stat-card.hm-stat-card {
      position: relative !important;
      min-width: 0 !important;
      min-height: 122px !important;
      height: 122px !important;
      padding: 16px 16px !important;
      display: grid !important;
      grid-template-columns: 54px minmax(0,1fr) 72px !important;
      grid-template-rows: 1fr !important;
      align-items: center !important;
      gap: 14px !important;
      overflow: hidden !important;
      border-radius: 16px !important;
      border: 1px solid rgba(105,116,143,.24) !important;
      background:
        radial-gradient(circle at 15% 48%,rgba(119,64,225,.10),transparent 40%),
        linear-gradient(180deg,#141827,#10141f) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.022),
        0 12px 34px rgba(0,0,0,.14) !important;
      transition:
        transform .16s ease,
        border-color .16s ease,
        box-shadow .16s ease !important;
    }

    #content .dashboard-today.hm-stats-row .stat-card.hm-stat-card:hover {
      transform: translateY(-2px) !important;
      border-color: rgba(139,92,246,.50) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.03),
        0 16px 40px rgba(0,0,0,.18),
        0 0 30px rgba(124,58,237,.06) !important;
    }

    #content .hm-stat-icon {
      width: 52px !important;
      height: 52px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 14px !important;
      color: #e3dcff !important;
      background:
        radial-gradient(circle at 35% 24%,rgba(193,167,255,.18),transparent 42%),
        linear-gradient(145deg,rgba(94,53,170,.74),rgba(48,34,84,.70)) !important;
      border: 1px solid rgba(171,132,255,.34) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.08),
        0 0 21px rgba(124,58,237,.13) !important;
    }

    #content .hm-stat-icon svg {
      width: 25px !important;
      height: 25px !important;
      display: block !important;
    }

    #content .hm-stat-copy {
      display: block !important;
      align-self: center !important;
      min-width: 0 !important;
    }

    #content .dashboard-today.hm-stats-row .hm-stat-copy .stat-label {
      margin: 0 !important;
      color: #b2b9c8 !important;
      font-size: 11.5px !important;
      line-height: 1.2 !important;
      font-weight: 760 !important;
      white-space: nowrap !important;
    }

    #content .dashboard-today.hm-stats-row .hm-stat-copy .stat-value {
      margin: 7px 0 5px !important;
      color: #fbfbff !important;
      font-size: 31px !important;
      line-height: .95 !important;
      font-weight: 900 !important;
      letter-spacing: -.045em !important;
    }

    #content .dashboard-today.hm-stats-row .hm-stat-copy .stat-sub {
      margin: 0 !important;
      color: #808a9d !important;
      font-size: 10px !important;
      line-height: 1.2 !important;
      white-space: nowrap !important;
    }

    #content .hm-stat-badge {
      position: absolute !important;
      top: 14px !important;
      right: 14px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      height: 24px !important;
      padding: 0 8px !important;
      border-radius: 8px !important;
      color: #aab2c3 !important;
      background: rgba(36,42,59,.72) !important;
      border: 1px solid rgba(95,106,132,.20) !important;
      font-size: 8px !important;
      font-weight: 850 !important;
      letter-spacing: .06em !important;
    }

    #content .hm-stat-badge i {
      width: 5px !important;
      height: 5px !important;
      border-radius: 50% !important;
      background: #4de48a !important;
      box-shadow: 0 0 8px rgba(77,228,138,.45) !important;
    }

    #content .hm-stat-spark {
      width: 72px !important;
      height: 30px !important;
      align-self: end !important;
      justify-self: end !important;
      margin-bottom: 5px !important;
      opacity: .95 !important;
    }

    #content .hm-stat-spark svg {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      overflow: visible !important;
    }

    /* ========== QUICK ADD ========== */
    #content .panel.hm-quick-panel {
      padding: 0 !important;
      margin-top: 20px !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    #content .panel.hm-quick-panel > .panel-head {
      margin-bottom: 12px !important;
      padding: 0 !important;
    }

    #content .panel.hm-quick-panel > .panel-head h3 {
      color: #f0f2f7 !important;
      font-size: 14px !important;
      font-weight: 820 !important;
    }

    #content .hm-quick-grid {
      display: grid !important;
      grid-template-columns: repeat(3,minmax(0,1fr)) !important;
      gap: 14px !important;
    }

    #content .hm-quick-grid > .quick-card.hm-quick-card {
      position: relative !important;
      min-width: 0 !important;
      min-height: 108px !important;
      display: grid !important;
      grid-template-columns: 58px minmax(0,1fr) 40px !important;
      align-items: center !important;
      gap: 16px !important;
      padding: 17px 17px !important;
      border-radius: 15px !important;
      border: 1px solid rgba(103,114,141,.22) !important;
      background:
        radial-gradient(circle at 13% 50%,rgba(122,65,230,.09),transparent 34%),
        linear-gradient(180deg,#151928,#111520) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.022),
        0 12px 30px rgba(0,0,0,.12) !important;
      overflow: hidden !important;
      transition:
        transform .16s ease,
        border-color .16s ease,
        box-shadow .16s ease !important;
    }

    #content .hm-quick-grid > .quick-card.hm-quick-card:hover {
      transform: translateY(-2px) !important;
      border-color: rgba(139,92,246,.52) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.03),
        0 15px 36px rgba(0,0,0,.17),
        0 0 27px rgba(124,58,237,.06) !important;
    }

    #content .hm-quick-card .hm-quick-icon {
      width: 56px !important;
      height: 56px !important;
      display: grid !important;
      place-items: center !important;
      margin: 0 !important;
      border-radius: 14px !important;
      color: #e5deff !important;
      background:
        radial-gradient(circle at 35% 22%,rgba(195,167,255,.17),transparent 42%),
        linear-gradient(145deg,rgba(96,54,174,.78),rgba(49,34,86,.72)) !important;
      border: 1px solid rgba(177,137,255,.35) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.08),
        0 0 21px rgba(124,58,237,.13) !important;
      font-size: 0 !important;
    }

    #content .hm-quick-icon svg {
      width: 26px !important;
      height: 26px !important;
      display: block !important;
    }

    #content .hm-quick-copy {
      min-width: 0 !important;
      display: block !important;
    }

    #content .hm-quick-copy .quick-title {
      margin: 0 !important;
      color: #f4f5f9 !important;
      font-size: 15px !important;
      line-height: 1.15 !important;
      font-weight: 840 !important;
      letter-spacing: -.02em !important;
    }

    #content .hm-quick-copy .quick-desc {
      display: block !important;
      margin: 7px 0 0 !important;
      color: #858ea2 !important;
      font-size: 10.5px !important;
      line-height: 1.4 !important;
      max-width: 310px !important;
    }

    #content .hm-quick-arrow {
      width: 38px !important;
      height: 38px !important;
      display: grid !important;
      place-items: center !important;
      justify-self: end !important;
      border-radius: 50% !important;
      color: #dcd5fb !important;
      background: linear-gradient(145deg,rgba(39,36,62,.96),rgba(24,26,39,.96)) !important;
      border: 1px solid rgba(144,109,226,.32) !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.035) !important;
      transition: transform .16s ease,border-color .16s ease,background .16s ease !important;
    }

    #content .hm-quick-arrow svg {
      width: 17px !important;
      height: 17px !important;
    }

    #content .hm-quick-card:hover .hm-quick-arrow {
      transform: translateX(2px) !important;
      color: #fff !important;
      border-color: rgba(174,134,255,.50) !important;
      background: linear-gradient(145deg,rgba(82,48,145,.82),rgba(39,31,65,.92)) !important;
    }

    /* ========== RECORDS PANEL ========== */
    #content .panel.hm-records-panel {
      margin-top: 18px !important;
      padding: 16px !important;
      border-radius: 16px !important;
      border: 1px solid rgba(111,90,166,.28) !important;
      background:
        radial-gradient(circle at 12% 0%,rgba(124,58,237,.06),transparent 29%),
        linear-gradient(180deg,#121623,#0f131d) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.02),
        0 16px 40px rgba(0,0,0,.13) !important;
    }

    #content .hm-records-panel .dashboard-records-head {
      min-height: 45px !important;
      margin-bottom: 10px !important;
      align-items: center !important;
    }

    #content .hm-records-title-wrap {
      position: relative !important;
      padding-left: 40px !important;
      min-height: 34px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
    }

    #content .hm-records-title-icon {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 31px !important;
      height: 31px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 9px !important;
      color: #e5ddff !important;
      background: rgba(93,50,170,.52) !important;
      border: 1px solid rgba(167,128,255,.29) !important;
      box-shadow: 0 0 18px rgba(124,58,237,.10) !important;
    }

    #content .hm-records-title-icon svg {
      width: 16px !important;
      height: 16px !important;
    }

    #content .hm-records-panel .panel-head h3 {
      color: #f4f5f9 !important;
      font-size: 14px !important;
      font-weight: 840 !important;
    }

    #content .hm-records-panel .panel-head .small {
      color: #7f889a !important;
      font-size: 9.5px !important;
      margin-top: 2px !important;
    }

    #content .hm-records-panel #allRecords {
      min-height: 34px !important;
      padding: 7px 11px !important;
      border-radius: 9px !important;
      color: #d9ddeb !important;
      background: linear-gradient(180deg,#171c29,#121721) !important;
      border-color: rgba(106,116,141,.27) !important;
    }

    #content .hm-records-panel .dashboard-kind-tabs {
      display: flex !important;
      gap: 8px !important;
      margin: 0 0 11px !important;
    }

    #content .hm-records-panel .hm-kind-tab {
      min-height: 35px !important;
      padding: 7px 13px !important;
      border-radius: 9px !important;
      color: #9da5b6 !important;
      background: #141925 !important;
      border: 1px solid rgba(94,104,127,.23) !important;
      font-size: 10.5px !important;
      font-weight: 790 !important;
      cursor: pointer !important;
    }

    #content .hm-records-panel .hm-kind-tab.active {
      color: #fff !important;
      background: linear-gradient(135deg,#713dee,#8b5cf6) !important;
      border-color: rgba(190,158,255,.34) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.09),
        0 7px 19px rgba(109,62,231,.18) !important;
    }

    #content .hm-records-panel .table-wrap {
      border-radius: 12px !important;
      border-color: rgba(75,85,106,.27) !important;
      background: rgba(8,11,18,.42) !important;
      overflow: auto !important;
    }

    #content .hm-records-panel table {
      min-width: 900px !important;
    }

    #content .hm-records-panel th {
      height: 37px !important;
      padding: 9px 10px !important;
      color: #788296 !important;
      background: linear-gradient(180deg,#121724,#0f141e) !important;
      border-bottom-color: rgba(77,87,108,.25) !important;
      font-size: 8.5px !important;
    }

    #content .hm-records-panel td {
      padding: 10px 10px !important;
      color: #cdd2dc !important;
      border-bottom-color: rgba(61,70,89,.22) !important;
      font-size: 10.5px !important;
      line-height: 1.3 !important;
    }

    #content .hm-records-panel tr.clickable:hover {
      background: linear-gradient(90deg,rgba(124,58,237,.055),rgba(124,58,237,.012)) !important;
      box-shadow: inset 2px 0 0 rgba(139,92,246,.37) !important;
    }

    #content .hm-records-panel td b {
      color: #eff1f6 !important;
      font-weight: 760 !important;
    }

    #content .hm-records-panel .edit-row {
      min-height: 30px !important;
      padding: 6px 10px !important;
      border-radius: 8px !important;
      font-size: 9.5px !important;
    }

    /* PROFILE */
    .sidebar-bottom {
      gap: 9px !important;
    }

    #userCard.hm-user-card {
      position: relative !important;
      min-height: 94px !important;
      padding: 13px 10px 12px 55px !important;
      border-radius: 14px !important;
      background:
        radial-gradient(circle at 22% 25%,rgba(124,58,237,.13),transparent 42%),
        linear-gradient(180deg,#151a27,#111620) !important;
      border: 1px solid rgba(126,101,188,.27) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.025),
        0 12px 30px rgba(0,0,0,.17) !important;
    }

    #userCard .hm-user-avatar {
      position: absolute !important;
      left: 12px !important;
      top: 13px !important;
      width: 34px !important;
      height: 34px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 50% !important;
      color: #f4f0ff !important;
      background: linear-gradient(145deg,#6132cf,#7f50e7) !important;
      border: 1px solid rgba(189,155,255,.42) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.10),
        0 0 20px rgba(124,58,237,.17) !important;
    }

    #userCard .hm-user-avatar b {
      margin: 0 !important;
      font-size: 14px !important;
      color: inherit !important;
    }

    #userCard .hm-user-avatar i {
      position: absolute !important;
      right: -1px !important;
      bottom: -1px !important;
      width: 9px !important;
      height: 9px !important;
      border-radius: 50% !important;
      background: #22d765 !important;
      border: 2px solid #141925 !important;
      box-shadow: 0 0 8px rgba(34,215,101,.5) !important;
    }

    #userCard.hm-user-card > b {
      color: #f3f4f8 !important;
      font-size: 11.5px !important;
      line-height: 1.25 !important;
      margin-bottom: 4px !important;
    }

    #userCard.hm-user-card > span {
      color: #8f98aa !important;
      font-size: 9.5px !important;
      line-height: 1.3 !important;
    }

    #userCard.hm-user-card .role-pill,
    #userCard.hm-user-card .sync-pill {
      font-size: 8.5px !important;
      margin-top: 6px !important;
    }

    .sidebar-bottom > .btn {
      min-height: 39px !important;
      border-radius: 10px !important;
      color: #e6e9f0 !important;
      background: linear-gradient(180deg,#171c29,#111620) !important;
      border-color: rgba(101,112,137,.26) !important;
    }

    /* Keep other pages usable but slightly more consistent. */
    .btn.primary {
      background: linear-gradient(135deg,#713fee,#8b5cf6) !important;
    }

    input,select,textarea {
      background: #0e121b !important;
      border-color: rgba(99,110,135,.27) !important;
    }

    input:focus,select:focus,textarea:focus {
      border-color: rgba(139,92,246,.56) !important;
      box-shadow: 0 0 0 3px rgba(139,92,246,.09) !important;
    }

    @media (max-width: 1280px) {
      #content .dashboard-today.hm-stats-row .stat-card.hm-stat-card {
        grid-template-columns: 48px minmax(0,1fr) !important;
      }

      #content .hm-stat-spark {
        display: none !important;
      }

      #content .hm-stat-icon {
        width: 46px !important;
        height: 46px !important;
      }

      #content .hm-stat-badge {
        top: 10px !important;
        right: 10px !important;
      }
    }

    @media (max-width: 1100px) {
      #content .dashboard-today.hm-stats-row {
        grid-template-columns: repeat(2,minmax(0,1fr)) !important;
      }

      #content .hm-quick-grid {
        grid-template-columns: 1fr !important;
      }
    }

    @media (max-width: 760px) {
      .topbar {
        min-height: 92px !important;
        height: auto !important;
      }

      #content.content,
      .priz-page-slot.content {
        padding: 16px !important;
      }

      #content .dashboard-today.hm-stats-row {
        grid-template-columns: 1fr !important;
      }

      #content .dashboard-today.hm-stats-row .stat-card.hm-stat-card {
        min-height: 108px !important;
        height: auto !important;
      }
    }
  `;
  document.head.appendChild(style);

  scan(document);

  const host =
    document.getElementById('prizPageHost') ||
    document.querySelector('[data-priz-page-host="1"]') ||
    document.querySelector('.main');

  if (host) {
    const observer = new MutationObserver(mutations => {
      let needsTopbar = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          scan(node);
          needsTopbar = true;
        }
      }
      if (needsTopbar) syncTopbar();
    });

    observer.observe(host, { childList: true, subtree: true });
  }

  // SAFE shell handling. Do NOT observe topbar: syncTopbar itself may
  // change that DOM. Page-slot changes already call syncTopbar after
  // navigation and region switches.
  //
  // userCard may be replaced after login/operator switching, so watch only
  // its direct children. Adding the avatar triggers one more callback, which
  // immediately stops because the avatar already exists.
  const userCard = document.getElementById('userCard');
  if (userCard) {
    const userObserver = new MutationObserver(() => {
      if (!userCard.querySelector('.hm-user-avatar')) decorateUserCard();
    });
    userObserver.observe(userCard, { childList: true, subtree: false });
  }
})();