(() => {
  function applyLoginCleanup() {
    const loginCard = document.querySelector('#loginView .login-card');
    if (!loginCard) return;

    // Убираем технические подписи с экрана входа.
    loginCard.querySelectorAll('p.muted').forEach(el => {
      if ((el.textContent || '').includes('Серверная версия')) el.remove();
    });
    loginCard.querySelector('.demo-box.online-box')?.remove();

    // Плейсхолдер логина.
    const loginInput = document.getElementById('loginUser');
    if (loginInput) loginInput.placeholder = 'Ваш логин';

    // Показать / скрыть пароль.
    const passInput = document.getElementById('loginPass');
    if (!passInput || document.getElementById('loginPasswordToggle')) return;

    const style = document.createElement('style');
    style.id = 'loginCleanupStyles';
    style.textContent = `
      .login-password-wrap{
        position:relative;
        width:100%;
      }
      .login-password-wrap #loginPass{
        width:100%;
        padding-right:48px;
        box-sizing:border-box;
      }
      .login-password-toggle{
        position:absolute;
        top:50%;
        right:8px;
        transform:translateY(-50%);
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        border:0;
        border-radius:8px;
        background:transparent;
        color:#9299a8;
        cursor:pointer;
      }
      .login-password-toggle:hover{
        background:#1a1d25;
        color:#fff;
      }
      .login-password-toggle svg{
        width:18px;
        height:18px;
        fill:none;
        stroke:currentColor;
        stroke-width:1.8;
        stroke-linecap:round;
        stroke-linejoin:round;
      }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'login-password-wrap';

    passInput.parentNode.insertBefore(wrap, passInput);
    wrap.appendChild(passInput);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'loginPasswordToggle';
    btn.className = 'login-password-toggle';
    btn.setAttribute('aria-label', 'Показать пароль');
    btn.title = 'Показать пароль';

    const eyeOpen = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
        <circle cx="12" cy="12" r="2.5"/>
      </svg>`;
    const eyeClosed = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 3 18 18"/>
        <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8"/>
        <path d="M6.4 6.5C3.8 8.3 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.2-.5"/>
      </svg>`;

    btn.innerHTML = eyeOpen;

    btn.onclick = () => {
      const showing = passInput.type === 'text';
      passInput.type = showing ? 'password' : 'text';
      btn.innerHTML = showing ? eyeOpen : eyeClosed;
      btn.setAttribute('aria-label', showing ? 'Показать пароль' : 'Скрыть пароль');
      btn.title = showing ? 'Показать пароль' : 'Скрыть пароль';
      passInput.focus();
    };

    wrap.appendChild(btn);
  }

  applyLoginCleanup();
})();
