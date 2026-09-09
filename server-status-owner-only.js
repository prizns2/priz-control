(() => {
  const originalBuildShellServerStatus = buildShell;
  const originalRenderPageServerStatus = renderPage;

  function applyServerStatusVisibility() {
    const card = document.getElementById('userCard');
    if (!card) return;

    const sync = card.querySelector('.sync-pill');

    if (currentUser?.role === 'owner') {
      if (!sync) {
        const pill = document.createElement('div');
        pill.className = 'sync-pill';
        pill.textContent = 'Сервер подключён';
        card.appendChild(pill);
      }
    } else {
      sync?.remove();
    }
  }

  buildShell = function (...args) {
    const result = originalBuildShellServerStatus.apply(this, args);
    applyServerStatusVisibility();
    return result;
  };

  renderPage = async function (...args) {
    const result = await originalRenderPageServerStatus.apply(this, args);
    applyServerStatusVisibility();
    return result;
  };

  const observer = new MutationObserver(() => applyServerStatusVisibility());
  const target = document.getElementById('userCard');
  if (target) observer.observe(target, { childList: true, subtree: true });

  setTimeout(applyServerStatusVisibility, 0);
})();
