(() => {
  if (window.__prizPremiumUIV1Installed) return;
  window.__prizPremiumUIV1Installed = true;

  const svg = body => `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

  const ICONS = {
    total: svg('<path d="M4.5 19.5V14"/><path d="M9.5 19.5V9"/><path d="M14.5 19.5V5.5"/><path d="M19.5 19.5V11.5"/>'),
    cat1: svg('<path d="M12 3.6 19.4 6.4v5.1c0 4.4-2.8 6.8-7.4 8.3-4.6-1.5-7.4-3.9-7.4-8.3V6.4z"/><path d="M12 8.1v4.9"/><path d="M12 16.2h.01"/>'),
    cat2: svg('<path d="m12 4.1 7.2 3.8-7.2 3.8-7.2-3.8z"/><path d="m4.8 11.8 7.2 3.8 7.2-3.8"/><path d="m4.8 15.7 7.2 3.8 7.2-3.8"/>'),
    eval: svg('<path d="m12 3.7 2.45 4.96 5.47.79-3.96 3.86.94 5.45L12 16.18l-4.9 2.58.94-5.45-3.96-3.86 5.47-.79z"/>')
  };

  const SPARK = {
    total: "M2 28 C14 27 17 16 29 18 S43 24 53 13 S69 11 78 7 S91 8 98 3",
    cat1: "M2 27 C12 24 16 15 27 16 S42 24 52 15 S66 7 77 10 S90 8 98 4",
    cat2: "M2 26 C10 19 16 16 25 20 S39 23 47 14 S61 18 69 12 S84 10 98 4",
    eval: "M2 26 C15 25 17 13 30 14 S44 20 54 13 S68 8 78 11 S91 9 98 5"
  };

  function kindOf(card) {
    const t = card?.querySelector('.stat-label')?.textContent || '';
    if (/всего нарушений/i.test(t)) return 'total';
    if (/категория\s*1/i.test(t)) return 'cat1';
    if (/категория\s*2/i.test(t)) return 'cat2';
    if (/оцен/i.test(t)) return 'eval';
    return null;
  }

  function decorateCard(card) {
    if (!(card instanceof HTMLElement) || card.dataset.prizPremiumStat === '1') return;
    const kind = kindOf(card);
    if (!kind) return;
    const label = card.querySelector('.stat-label');
    const value = card.querySelector('.stat-value');
    const sub = card.querySelector('.stat-sub');
    if (!label || !value || !sub) return;

    card.dataset.prizPremiumStat = '1';
    card.classList.add('priz-premium-stat', `priz-stat-${kind}`);

    const icon = document.createElement('div');
    icon.className = 'priz-stat-icon';
    icon.innerHTML = ICONS[kind];

    const copy = document.createElement('div');
    copy.className = 'priz-stat-copy';
    label.before(copy);
    copy.append(label, value, sub);

    const spark = document.createElement('div');
    spark.className = 'priz-stat-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.innerHTML = `<svg viewBox="0 0 100 32" preserveAspectRatio="none">
      <path d="${SPARK[kind]}" fill="none" stroke="#8b5cf6" stroke-width="2.1"
        vector-effect="non-scaling-stroke"/>
      <circle cx="98" cy="${kind==='total'?3:kind==='eval'?5:4}" r="2.1" fill="#ddd6fe"/>
    </svg>`;

    card.prepend(icon);
    card.append(spark);
  }

  function scan(root = document) {
    root.querySelectorAll?.('.dashboard-today .stat-card').forEach(decorateCard);
    if (root.matches?.('.stat-card')) decorateCard(root);
    root.querySelectorAll?.('.dashboard-today').forEach(row => {
      if (row.querySelector('.priz-premium-stat')) row.classList.add('priz-premium-stats');
    });
    const areas = [];
    if (root.id === 'dashboardRecordsArea') areas.push(root);
    root.querySelectorAll?.('#dashboardRecordsArea').forEach(x => areas.push(x));
    areas.forEach(area => area.closest('.panel')?.classList.add('priz-dashboard-records-panel'));
  }

  const style = document.createElement('style');
  style.id = 'prizPremiumUIV1Styles';
  style.textContent = `
    :root{
      --bg:#080a10!important;--panel:#11141d!important;--panel2:#151925!important;
      --line:#252b39!important;--text:#f5f6fb!important;--muted:#8e96a8!important;
      --accent:#8b5cf6!important;--accent2:#6d3ee7!important
    }
    html,body{background:#080a10!important}
    body{background:radial-gradient(circle at 72% -12%,rgba(93,45,190,.12),transparent 32%),
      radial-gradient(circle at 18% 105%,rgba(109,62,231,.075),transparent 27%),#080a10!important}
    .app{background:transparent!important}
    .main{position:relative;background:radial-gradient(circle at 62% -3%,rgba(90,47,173,.075),transparent 25%),
      linear-gradient(180deg,rgba(8,10,16,.96),#080a10)!important}

    .sidebar{background:radial-gradient(circle at 24% 10%,rgba(109,62,231,.10),transparent 24%),
      linear-gradient(180deg,#0d1018,#0a0d14 66%,#0c0f17)!important;
      border-right:1px solid rgba(139,92,246,.15)!important;box-shadow:16px 0 50px rgba(0,0,0,.16)}
    .sidebar-brand .brand-mark.mini{background:linear-gradient(145deg,#5a2fd0,#8b5cf6)!important;
      border:1px solid rgba(196,181,253,.26);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 0 24px rgba(124,58,237,.24)!important}

    .user-card{position:relative;min-height:94px;padding:14px 12px 13px 58px!important;border-radius:15px!important;
      overflow:hidden;background:radial-gradient(circle at 24% 30%,rgba(124,58,237,.13),transparent 40%),
      linear-gradient(180deg,rgba(20,24,34,.97),rgba(15,19,28,.97))!important;
      border:1px solid rgba(129,105,191,.22)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 28px rgba(0,0,0,.16)}
    .user-card::before{content:"P";position:absolute;left:13px;top:14px;width:34px;height:34px;display:grid;place-items:center;
      border-radius:50%;color:#f3efff;font-size:16px;font-weight:900;background:linear-gradient(145deg,rgba(99,58,179,.92),rgba(53,39,91,.96));
      border:1px solid rgba(180,145,255,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 0 18px rgba(124,58,237,.18)}
    .user-card::after{content:"";position:absolute;left:39px;top:40px;width:8px;height:8px;border-radius:50%;
      background:#21d965;border:2px solid #11151f;box-shadow:0 0 9px rgba(34,197,94,.55)}
    .user-card b{color:#f2f3f7;font-size:12.5px;line-height:1.25;margin-bottom:4px!important}
    .user-card>span{display:block;color:#8d95a6;font-size:10.5px;line-height:1.35}
    .user-card .role-pill{margin-top:7px!important;background:rgba(124,58,237,.14)!important;
      border:1px solid rgba(139,92,246,.18);color:#cfc4ff!important}
    .user-card .sync-pill{display:inline-flex!important;margin-top:7px!important;padding:4px 7px;border-radius:999px;
      background:rgba(34,197,94,.075);border:1px solid rgba(34,197,94,.13);color:#7ee6a3!important;font-size:9.5px;font-weight:800}
    .sidebar-bottom>.btn{min-height:42px;border-radius:12px!important;background:linear-gradient(180deg,#171c28,#111620)!important;
      border-color:rgba(108,117,139,.22)!important}

    .topbar{height:92px!important;padding:0 28px!important;background:linear-gradient(180deg,rgba(9,11,17,.94),rgba(9,11,17,.84))!important;
      border-bottom:1px solid rgba(99,106,124,.14)!important;backdrop-filter:blur(18px) saturate(120%)!important;box-shadow:0 10px 36px rgba(0,0,0,.08)}
    .topbar h2{color:#f5f6fa;font-size:23px!important;letter-spacing:-.03em}
    .eyebrow{color:#a78bfa!important;text-shadow:0 0 12px rgba(139,92,246,.12)}
    .select.compact{min-width:166px!important;min-height:42px;border-radius:12px!important}

    input,select,textarea{background:rgba(13,16,24,.96)!important;border-color:rgba(104,113,132,.27)!important;color:#f2f4f8!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.018)}
    input:hover,select:hover,textarea:hover{border-color:rgba(139,92,246,.24)!important}
    input:focus,select:focus,textarea:focus{border-color:rgba(139,92,246,.62)!important;
      box-shadow:0 0 0 3px rgba(139,92,246,.095),inset 0 1px 0 rgba(255,255,255,.02)!important}

    .btn{border-radius:11px!important;transition:transform .15s ease,filter .15s ease,border-color .15s ease,box-shadow .15s ease!important}
    .btn.primary{background:linear-gradient(135deg,#713df0,#8b5cf6 60%,#935dff)!important;border:1px solid rgba(196,181,253,.17)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 7px 20px rgba(109,62,231,.20)}
    .btn.primary:hover{filter:brightness(1.08) saturate(1.04)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 9px 24px rgba(109,62,231,.28)!important}
    .btn.ghost{background:linear-gradient(180deg,#181c27,#131722)!important;border:1px solid rgba(102,111,131,.24)!important}
    .btn.ghost:hover{border-color:rgba(139,92,246,.31)!important;background:linear-gradient(180deg,#1c2130,#151a26)!important}

    .panel{background:linear-gradient(180deg,rgba(17,20,29,.98),rgba(14,18,26,.98))!important;
      border-color:rgba(88,97,116,.20)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018),0 14px 36px rgba(0,0,0,.12)}
    .panel-head h3{color:#f0f2f6;letter-spacing:-.015em}

    .dashboard-today.priz-premium-stats{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;width:100%!important}
    .dashboard-today.priz-premium-stats .stat-card{position:relative;min-height:126px!important;display:grid!important;
      grid-template-columns:54px minmax(0,1fr) 86px!important;align-items:center!important;gap:14px!important;padding:17px 18px!important;
      overflow:hidden;border-radius:17px!important;background:radial-gradient(circle at 18% 40%,rgba(124,58,237,.09),transparent 39%),
      linear-gradient(180deg,rgba(19,23,33,.99),rgba(15,18,27,.99))!important;border:1px solid rgba(92,101,121,.22)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.022),0 14px 34px rgba(0,0,0,.12);transition:.16s ease!important}
    .dashboard-today.priz-premium-stats .stat-card:hover{transform:translateY(-2px);border-color:rgba(139,92,246,.42)!important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 16px 40px rgba(0,0,0,.16),0 0 28px rgba(124,58,237,.055)}
    .priz-stat-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:15px;color:#ddd4ff;
      background:radial-gradient(circle at 35% 24%,rgba(186,156,255,.16),transparent 40%),linear-gradient(145deg,rgba(87,51,157,.62),rgba(43,31,74,.60));
      border:1px solid rgba(162,124,255,.32);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 20px rgba(124,58,237,.10)}
    .priz-stat-icon svg{width:24px;height:24px;filter:drop-shadow(0 0 4px rgba(167,139,250,.14))}
    .priz-stat-copy{min-width:0}
    .dashboard-today.priz-premium-stats .stat-label{color:#aeb5c4!important;font-size:11.5px!important;line-height:1.2!important;font-weight:760!important;white-space:nowrap}
    .dashboard-today.priz-premium-stats .stat-value{margin:7px 0 5px!important;color:#fafbff!important;font-size:32px!important;line-height:.95!important;font-weight:900!important;letter-spacing:-.04em!important}
    .dashboard-today.priz-premium-stats .stat-sub{margin:0!important;color:#7f899b!important;font-size:10px!important;line-height:1.25!important}
    .priz-stat-spark{width:86px;height:34px;align-self:end;margin-bottom:9px;opacity:.95}
    .priz-stat-spark svg{width:100%;height:100%;overflow:visible;display:block;filter:drop-shadow(0 0 3px rgba(139,92,246,.24))}

    .priz-dashboard-records-panel{border-color:rgba(106,89,157,.24)!important;
      background:radial-gradient(circle at 15% 0%,rgba(124,58,237,.055),transparent 28%),linear-gradient(180deg,rgba(17,20,30,.99),rgba(13,17,25,.99))!important}
    .dashboard-kind-tabs{display:flex;gap:8px;margin:0 0 12px!important}
    .dashboard-kind-tab{min-height:35px;padding:7px 13px!important;border-radius:10px!important;background:#141923!important;
      border:1px solid rgba(94,103,123,.22)!important;color:#9da5b5!important;font-weight:780!important;cursor:pointer;transition:.15s ease!important}
    .dashboard-kind-tab:hover{color:#ece8ff!important;border-color:rgba(139,92,246,.28)!important}
    .dashboard-kind-tab.active{color:#fff!important;background:linear-gradient(135deg,#6e3ce8,#8b5cf6)!important;
      border-color:rgba(184,154,255,.35)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 7px 18px rgba(109,62,231,.16)!important}

    .table-wrap{border-radius:13px!important;border-color:rgba(73,82,101,.25)!important;background:rgba(10,13,20,.48);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.012)}
    th{height:39px;color:#778195!important;background:linear-gradient(180deg,rgba(17,21,31,.98),rgba(14,18,27,.98))!important;
      border-bottom-color:rgba(82,91,111,.23)!important;font-size:9.5px!important}
    td{padding-top:12px!important;padding-bottom:12px!important;border-bottom-color:rgba(63,72,90,.22)!important;color:#cfd3dc}
    tr.clickable{transition:background .13s ease,box-shadow .13s ease}
    tr.clickable:hover{background:linear-gradient(90deg,rgba(124,58,237,.055),rgba(124,58,237,.015))!important;box-shadow:inset 2px 0 0 rgba(139,92,246,.36)}
    td b{color:#eef0f5}

    .dialog::backdrop{background:rgba(3,5,10,.78)!important;backdrop-filter:blur(8px)!important}
    .dialog-card{border-radius:20px!important;border-color:rgba(111,97,154,.28)!important;
      background:radial-gradient(circle at 18% 0%,rgba(124,58,237,.08),transparent 30%),linear-gradient(180deg,#121620,#0f131c)!important;
      box-shadow:0 28px 90px rgba(0,0,0,.54),inset 0 1px 0 rgba(255,255,255,.025)!important}
    .close-x{background:#171c28!important;border-color:rgba(99,108,128,.28)!important}
    .upload-box{background:rgba(10,13,20,.62)!important;border-color:rgba(120,105,165,.34)!important}
    .notice{background:linear-gradient(180deg,rgba(31,25,55,.94),rgba(23,20,42,.94))!important;
      border-color:rgba(139,92,246,.26)!important;color:#d8d0ff!important}
    .toast{background:linear-gradient(180deg,rgba(31,26,52,.98),rgba(24,21,41,.98))!important;
      border-color:rgba(139,92,246,.34)!important;box-shadow:0 18px 50px rgba(0,0,0,.48),0 0 24px rgba(124,58,237,.08)!important}

    @media(max-width:1250px){
      .dashboard-today.priz-premium-stats .stat-card{grid-template-columns:48px minmax(0,1fr)!important}
      .priz-stat-icon{width:46px;height:46px}.priz-stat-spark{display:none}
    }
    @media(max-width:1100px){.dashboard-today.priz-premium-stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:760px){
      .topbar{min-height:84px!important}.content{padding:16px!important}
      .dashboard-today.priz-premium-stats{grid-template-columns:1fr!important}
      .dashboard-today.priz-premium-stats .stat-card{min-height:110px!important}
    }
  `;
  document.head.appendChild(style);

  scan(document);

  const host = document.getElementById('prizPageHost') ||
               document.querySelector('[data-priz-page-host="1"]') ||
               document.querySelector('.main');

  if (host) {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) scan(node);
        }
      }
    });
    observer.observe(host, {childList:true, subtree:true});
  }
})();