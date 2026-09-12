(() => {
  if (window.__prizSidebarIconsInstalled) return;
  window.__prizSidebarIconsInstalled = true;

  const svg = (body) => `
    <svg viewBox="0 0 24 24"
         width="21" height="21"
         fill="none"
         stroke="currentColor"
         stroke-width="1.85"
         stroke-linecap="round"
         stroke-linejoin="round"
         aria-hidden="true"
         focusable="false">
      ${body}
    </svg>
  `;

  const ICONS = {
    home: svg(`
      <path d="M3.5 10.7 12 3.8l8.5 6.9"/>
      <path d="M5.7 9.2v10.2h12.6V9.2"/>
      <path d="M9.5 19.4v-5.3h5v5.3"/>
    `),

    records: svg(`
      <path d="M7 3.8h7l3.5 3.5v12.9H7z"/>
      <path d="M14 3.8v4h3.5"/>
      <path d="M9.6 11.1h5.2"/>
      <path d="M9.6 14.4h5.2"/>
      <path d="M9.6 17.7h3.6"/>
    `),

    table: svg(`
      <rect x="3.8" y="4.2" width="16.4" height="15.6" rx="2.1"/>
      <path d="M3.8 9.3h16.4M3.8 14.6h16.4"/>
      <path d="M9.3 4.2v15.6M14.8 4.2v15.6"/>
    `),

    history: svg(`
      <path d="M4.8 7.8A8 8 0 1 1 4.4 15"/>
      <path d="M4.8 3.9v3.9H8.7"/>
      <path d="M12 7.7v4.7l3.1 1.9"/>
    `),

    inbox: svg(`
      <path d="M4.2 7.3h15.6l1.2 5.2v6.1H3v-6.1z"/>
      <path d="m3.2 12.5 4.6.1 1.6 2.3h5.2l1.6-2.3 4.6-.1"/>
    `),

    settings: svg(`
      <path d="M9.3 3.5h5.4l.6 2.2c.5.2 1 .5 1.5.9l2.2-.7 2.7 4.7-1.7 1.5c.1.6.1 1.2 0 1.8l1.7 1.5-2.7 4.7-2.2-.7c-.5.4-1 .7-1.5.9l-.6 2.2H9.3l-.6-2.2c-.5-.2-1-.5-1.5-.9l-2.2.7-2.7-4.7L4 13.9a8 8 0 0 1 0-1.8l-1.7-1.5L5 5.9l2.2.7c.5-.4 1-.7 1.5-.9z"/>
      <circle cx="12" cy="13" r="3.1"/>
    `),

    analytics: svg(`
      <path d="M4 19.5h16"/>
      <path d="M6.2 16.8v-4.1M11.1 16.8V7.8M16 16.8V10M20 16.8V5.2"/>
    `),

    bell: svg(`
      <path d="M6.2 9.7a5.8 5.8 0 0 1 11.6 0c0 6 2.1 6.2 2.1 6.2H4.1s2.1-.2 2.1-6.2"/>
      <path d="M9.8 19.2a2.4 2.4 0 0 0 4.4 0"/>
    `),

    default: svg(`
      <rect x="4" y="4" width="16" height="16" rx="4"/>
      <path d="M8.5 9h7M8.5 12h7M8.5 15h4.4"/>
    `)
  };

  function classify(button) {
    const page = String(button.dataset.page || '').toLowerCase();
    const text = String(button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

    if (page === 'dashboard' || /главн|home/.test(text)) return 'home';
    if (page === 'records' || /запис|records/.test(text)) return 'records';
    if (/attendance|табел|таблиц|table/.test(page + ' ' + text)) return 'table';
    if (page === 'audit' || /истор|history/.test(text)) return 'history';
    if (/delet|request|archive|обращ|заяв|удален|архив|audit/.test(page + ' ' + text)) return 'inbox';
    if (page === 'settings' || /управ|настро|settings/.test(text)) return 'settings';
    if (/analytic|аналит/.test(page + ' ' + text)) return 'analytics';
    if (/notif|уведом/.test(page + ' ' + text)) return 'bell';

    return 'default';
  }

  function cleanLabel(button) {
    const clone = button.cloneNode(true);
    clone.querySelector('.nav-ico')?.remove();
    return String(clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function decorateButton(button) {
    if (!(button instanceof HTMLElement)) return;

    let icon = button.querySelector('.nav-ico');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'nav-ico';
      button.prepend(icon);
    }

    const type = classify(button);
    icon.innerHTML = ICONS[type] || ICONS.default;
    icon.dataset.prizIcon = type;
    icon.setAttribute('aria-hidden', 'true');

    const label = cleanLabel(button);
    if (label) {
      button.title = label;
      if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', label);
    }

    button.classList.add('priz-nav-polished');
  }

  function decorateNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.querySelectorAll('.nav-btn').forEach(decorateButton);
  }

  function injectStyles() {
    if (document.getElementById('prizSidebarIconStyles')) return;

    const style = document.createElement('style');
    style.id = 'prizSidebarIconStyles';
    style.textContent = `
      #nav {
        gap: 7px !important;
      }

      #nav .nav-btn {
        position: relative;
        display: flex;
        align-items: center;
        gap: 11px;
        min-height: 47px;
        padding: 6px 9px !important;
        border: 1px solid transparent;
        border-radius: 13px !important;
        color: #a7adba;
        background: transparent;
        overflow: hidden;
        transition:
          background .16s ease,
          border-color .16s ease,
          color .16s ease,
          box-shadow .16s ease,
          transform .16s ease !important;
      }

      #nav .nav-btn::before {
        content: "";
        position: absolute;
        left: 0;
        top: 10px;
        bottom: 10px;
        width: 2px;
        border-radius: 999px;
        background: linear-gradient(180deg, #c4b5fd, #7c3aed);
        opacity: 0;
        transform: scaleY(.45);
        box-shadow: 0 0 13px rgba(139,92,246,.85);
        transition: opacity .16s ease, transform .16s ease;
      }

      #nav .nav-btn:hover {
        color: #f0edff !important;
        background:
          linear-gradient(90deg, rgba(139,92,246,.095), rgba(139,92,246,.025)) !important;
        border-color: rgba(139,92,246,.10) !important;
        transform: translateX(1px);
      }

      #nav .nav-btn.active {
        color: #f1edff !important;
        background:
          radial-gradient(circle at 14% 50%, rgba(139,92,246,.19), transparent 47%),
          linear-gradient(90deg, rgba(88,52,154,.24), rgba(35,27,57,.34)) !important;
        border-color: rgba(151,112,255,.22) !important;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.025),
          0 7px 24px rgba(0,0,0,.14) !important;
      }

      #nav .nav-btn.active::before {
        opacity: 1;
        transform: scaleY(1);
      }

      #nav .nav-ico {
        width: 34px !important;
        height: 34px;
        flex: 0 0 34px;
        display: grid !important;
        place-items: center;
        border-radius: 10px;
        color: #aeb5c7;
        background: rgba(255,255,255,.018);
        border: 1px solid rgba(255,255,255,.025);
        transition:
          color .16s ease,
          background .16s ease,
          border-color .16s ease,
          box-shadow .16s ease,
          transform .16s ease;
      }

      #nav .nav-ico svg {
        width: 20px;
        height: 20px;
        display: block;
        overflow: visible;
      }

      #nav .nav-btn:hover .nav-ico {
        color: #dcd5ff;
        background: rgba(124,58,237,.09);
        border-color: rgba(139,92,246,.12);
      }

      #nav .nav-btn.active .nav-ico {
        color: #eee9ff;
        background:
          linear-gradient(145deg, rgba(94,55,166,.56), rgba(54,35,91,.52));
        border-color: rgba(171,135,255,.34);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.08),
          0 0 18px rgba(124,58,237,.18);
      }

      #nav .nav-btn.active .nav-ico svg {
        filter: drop-shadow(0 0 4px rgba(167,139,250,.25));
      }

      #nav .nav-btn:active .nav-ico {
        transform: scale(.94);
      }

      @media (max-width: 760px) {
        #nav .nav-btn {
          min-height: 45px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectStyles();
  decorateNav();

  const nav = document.getElementById('nav');
  if (nav) {
    const observer = new MutationObserver(() => {
      queueMicrotask(decorateNav);
    });

    observer.observe(nav, {
      childList: true,
      subtree: true
    });
  }

  // На случай повторного buildShell после входа/переключения аккаунта.
  const bodyObserver = new MutationObserver(() => {
    const currentNav = document.getElementById('nav');
    if (currentNav) decorateNav();
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: false
  });
})();
