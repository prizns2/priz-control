(() => {
  if (window.__prizDashboardHomePremiumInstalled) return;
  window.__prizDashboardHomePremiumInstalled = true;

  const svg = body => `
    <svg viewBox="0 0 24 24"
         width="30" height="30"
         fill="none"
         stroke="currentColor"
         stroke-width="1.75"
         stroke-linecap="round"
         stroke-linejoin="round"
         aria-hidden="true"
         focusable="false">
      ${body}
    </svg>
  `;

  const ICONS = {
    cat1: svg(`
      <path d="M12 3.4 20.2 6.5v5.6c0 4.8-3.1 7.3-8.2 8.9-5.1-1.6-8.2-4.1-8.2-8.9V6.5z"/>
      <path d="M12 8v5.2"/>
      <path d="M12 16.5h.01"/>
    `),

    cat2: svg(`
      <path d="m12 4 7.5 4-7.5 4-7.5-4z"/>
      <path d="m4.5 12 7.5 4 7.5-4"/>
      <path d="m4.5 16 7.5 4 7.5-4"/>
    `),

    eval: svg(`
      <path d="m12 3.4 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.42 6.9 19.1l.97-5.68L3.75 9.4l5.7-.83z"/>
    `)
  };

  const ARROW = `
    <svg viewBox="0 0 24 24"
         width="22" height="22"
         fill="none"
         stroke="currentColor"
         stroke-width="2"
         stroke-linecap="round"
         stroke-linejoin="round"
         aria-hidden="true"
         focusable="false">
      <path d="m9 5 7 7-7 7"/>
    </svg>
  `;

  function decorateCard(card) {
    if (!(card instanceof HTMLElement)) return;
    if (card.dataset.prizPremiumHome === '1') return;

    const kind = String(card.dataset.kind || '');
    if (!ICONS[kind]) return;

    // Flag first: this module never reprocesses its own DOM changes.
    card.dataset.prizPremiumHome = '1';
    card.classList.add('priz-premium-quick-card', `priz-premium-${kind}`);

    const icon = card.querySelector(':scope > .quick-icon') || card.querySelector('.quick-icon');
    const title = card.querySelector(':scope > .quick-title') || card.querySelector('.quick-title');
    const desc = card.querySelector(':scope > .quick-desc') || card.querySelector('.quick-desc');

    if (icon) {
      icon.innerHTML = ICONS[kind];
      icon.setAttribute('aria-hidden', 'true');
    }

    if (title && desc && !card.querySelector(':scope > .priz-quick-copy')) {
      const copy = document.createElement('div');
      copy.className = 'priz-quick-copy';

      title.before(copy);
      copy.appendChild(title);
      copy.appendChild(desc);
    }

    if (!card.querySelector(':scope > .priz-quick-arrow')) {
      const arrow = document.createElement('span');
      arrow.className = 'priz-quick-arrow';
      arrow.innerHTML = ARROW;
      arrow.setAttribute('aria-hidden', 'true');
      card.appendChild(arrow);
    }
  }

  function decorateGrid(grid) {
    if (!(grid instanceof HTMLElement)) return;
    if (!grid.classList.contains('quick-grid')) return;

    grid.querySelectorAll('.quick-card[data-kind]').forEach(decorateCard);

    const panel = grid.closest('.panel');
    if (!panel) return;

    panel.classList.add('priz-premium-quick-panel');

    const head = panel.querySelector(':scope > .panel-head') || panel.querySelector('.panel-head');
    if (head) head.classList.add('priz-premium-quick-head');
  }

  function scan(root = document) {
    if (!root) return;

    if (root.matches?.('.quick-grid')) decorateGrid(root);
    if (root.matches?.('.quick-card[data-kind]')) {
      decorateCard(root);
      const grid = root.closest('.quick-grid');
      if (grid) decorateGrid(grid);
    }

    root.querySelectorAll?.('.quick-grid').forEach(decorateGrid);
    root.querySelectorAll?.('.quick-card[data-kind]').forEach(card => {
      decorateCard(card);
      const grid = card.closest('.quick-grid');
      if (grid) decorateGrid(grid);
    });
  }

  function injectStyles() {
    if (document.getElementById('prizDashboardHomePremiumStyles')) return;

    const style = document.createElement('style');
    style.id = 'prizDashboardHomePremiumStyles';

    style.textContent = `
      .priz-premium-quick-panel {
        padding: 0 !important;
        margin-top: 22px !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
        overflow: visible !important;
      }

      .priz-premium-quick-panel .priz-premium-quick-head {
        margin-bottom: 13px !important;
        padding: 0 2px !important;
      }

      .priz-premium-quick-panel .priz-premium-quick-head h3 {
        font-size: 15px !important;
        color: #d9dce4;
        letter-spacing: -.01em;
      }

      .priz-premium-quick-panel .quick-grid {
        grid-template-columns: repeat(3,minmax(0,1fr)) !important;
        gap: 14px !important;
      }

      .priz-premium-quick-panel .quick-card {
        position: relative;
        min-height: 142px;
        display: grid !important;
        grid-template-columns: 66px minmax(0,1fr) 44px;
        align-items: center;
        gap: 18px;
        padding: 20px 20px 20px 21px !important;
        border-radius: 17px !important;
        border: 1px solid rgba(105,112,132,.20) !important;
        background:
          radial-gradient(circle at 12% 50%,rgba(99,58,177,.085),transparent 31%),
          linear-gradient(180deg,rgba(23,26,34,.99),rgba(18,21,28,.99)) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.018),
          0 14px 38px rgba(0,0,0,.13);
        overflow: hidden;
        isolation: isolate;
        transition:
          transform .17s ease,
          border-color .17s ease,
          box-shadow .17s ease,
          background .17s ease !important;
      }

      .priz-premium-quick-panel .quick-card::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background:
          linear-gradient(
            110deg,
            rgba(139,92,246,.055),
            transparent 28%,
            transparent 72%,
            rgba(139,92,246,.025)
          );
        opacity: .65;
        transition: opacity .17s ease;
      }

      .priz-premium-quick-panel .quick-card:hover {
        transform: translateY(-2px) !important;
        border-color: rgba(139,92,246,.50) !important;
        background:
          radial-gradient(circle at 13% 50%,rgba(111,66,198,.15),transparent 34%),
          linear-gradient(180deg,rgba(25,28,38,.995),rgba(19,22,30,.995)) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.025),
          0 16px 42px rgba(0,0,0,.18),
          0 0 0 1px rgba(139,92,246,.035),
          0 0 32px rgba(124,58,237,.055) !important;
      }

      .priz-premium-quick-panel .quick-card:hover::before {
        opacity: 1;
      }

      .priz-premium-quick-panel .quick-card:active {
        transform: translateY(0) scale(.997) !important;
      }

      .priz-premium-quick-panel .quick-icon {
        width: 66px !important;
        height: 66px;
        display: grid !important;
        place-items: center;
        margin: 0 !important;
        border-radius: 18px;
        color: #c9b9ff;
        background:
          radial-gradient(circle at 35% 25%,rgba(176,145,255,.18),transparent 38%),
          linear-gradient(145deg,rgba(83,50,151,.58),rgba(41,30,70,.55));
        border: 1px solid rgba(161,122,255,.33);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.07),
          0 10px 25px rgba(0,0,0,.12),
          0 0 22px rgba(124,58,237,.11);
        font-size: 0 !important;
        transition:
          color .17s ease,
          border-color .17s ease,
          box-shadow .17s ease,
          transform .17s ease;
      }

      .priz-premium-quick-panel .quick-icon svg {
        width: 31px;
        height: 31px;
        display: block;
        filter: drop-shadow(0 0 5px rgba(167,139,250,.18));
      }

      .priz-premium-quick-panel .quick-card:hover .quick-icon {
        color: #efeaff;
        border-color: rgba(185,154,255,.50);
        transform: translateY(-1px);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.08),
          0 10px 28px rgba(0,0,0,.14),
          0 0 26px rgba(124,58,237,.17);
      }

      .priz-premium-quick-panel .priz-quick-copy {
        min-width: 0;
        align-self: center;
      }

      .priz-premium-quick-panel .quick-title {
        margin: 0 !important;
        color: #f2f3f7;
        font-size: 17px !important;
        font-weight: 800 !important;
        letter-spacing: -.025em;
        line-height: 1.15;
      }

      .priz-premium-quick-panel .quick-desc {
        max-width: 330px;
        margin: 8px 0 0 !important;
        color: #8d94a2 !important;
        font-size: 12.5px !important;
        line-height: 1.5 !important;
      }

      .priz-premium-quick-panel .priz-quick-arrow {
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        justify-self: end;
        border-radius: 50%;
        color: #d5cdf9;
        background:
          linear-gradient(145deg,rgba(35,33,57,.92),rgba(24,25,37,.94));
        border: 1px solid rgba(135,105,215,.30);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.035);
        transition:
          color .17s ease,
          border-color .17s ease,
          background .17s ease,
          transform .17s ease,
          box-shadow .17s ease;
      }

      .priz-premium-quick-panel .priz-quick-arrow svg {
        width: 19px;
        height: 19px;
      }

      .priz-premium-quick-panel .quick-card:hover .priz-quick-arrow {
        color: #fff;
        border-color: rgba(161,123,255,.52);
        background:
          linear-gradient(145deg,rgba(77,48,132,.72),rgba(38,31,62,.85));
        transform: translateX(2px);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.05),
          0 0 20px rgba(124,58,237,.10);
      }

      .priz-premium-quick-panel .priz-premium-cat1:hover {
        border-color: rgba(145,96,255,.62) !important;
      }

      .priz-premium-quick-panel .priz-premium-cat2 .quick-icon {
        color: #bca9ff;
      }

      .priz-premium-quick-panel .priz-premium-eval .quick-icon {
        color: #e6ddff;
      }

      .priz-premium-quick-panel .quick-grid.readonly .quick-card {
        cursor: default;
      }

      @media (max-width:1180px) {
        .priz-premium-quick-panel .quick-card {
          grid-template-columns: 58px minmax(0,1fr) 38px;
          gap: 14px;
          min-height: 130px;
          padding: 17px !important;
        }

        .priz-premium-quick-panel .quick-icon {
          width: 58px !important;
          height: 58px;
          border-radius: 16px;
        }

        .priz-premium-quick-panel .quick-icon svg {
          width: 27px;
          height: 27px;
        }

        .priz-premium-quick-panel .priz-quick-arrow {
          width: 38px;
          height: 38px;
        }
      }

      @media (max-width:900px) {
        .priz-premium-quick-panel .quick-grid {
          grid-template-columns: 1fr !important;
        }
      }

      @media (max-width:520px) {
        .priz-premium-quick-panel .quick-card {
          grid-template-columns: 52px minmax(0,1fr) 36px;
          gap: 12px;
          min-height: 116px;
          padding: 15px !important;
        }

        .priz-premium-quick-panel .quick-icon {
          width: 52px !important;
          height: 52px;
          border-radius: 14px;
        }

        .priz-premium-quick-panel .quick-title {
          font-size: 15px !important;
        }

        .priz-premium-quick-panel .quick-desc {
          font-size: 11.5px !important;
        }

        .priz-premium-quick-panel .priz-quick-arrow {
          width: 36px;
          height: 36px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectStyles();

  // Initial screen / cached screens already present at module load.
  scan(document);

  /*
   * IMPORTANT FIX:
   * navigation-stability v6 replaces the temporary #content slot.
   * #prizPageHost is permanent, so we observe it instead.
   */
  const host =
    document.getElementById('prizPageHost') ||
    document.querySelector('[data-priz-page-host="1"]') ||
    document.querySelector('.main');

  if (!host) return;

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        scan(node);
      }
    }
  });

  observer.observe(host, {
    childList: true,
    subtree: true
  });
})();
