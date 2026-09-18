(() => {
  ROLE_LABEL.ops_manager = 'Операционный руководитель';

  const originalGoOpsManager = go;
  const originalBuildShellOpsManager = buildShell;

  go = function (page) {
    if (currentUser?.role === 'ops_manager' && page === 'dashboard') page = 'records';
    return originalGoOpsManager(page);
  };

  buildShell = function (...args) {
    const result = originalBuildShellOpsManager.apply(this, args);

    if (currentUser?.role === 'ops_manager') {
      document.querySelector('[data-page="dashboard"]')?.remove();
      const recordsBtn = document.getElementById('nav')?.querySelector('[data-page="records"]');
      if (recordsBtn) recordsBtn.classList.add('active');
      document.getElementById('quickAddBtn')?.classList.add('hidden');
    }

    return result;
  };
})();
