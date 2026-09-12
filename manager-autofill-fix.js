(() => {
  const BOUND = 'data-priz-manager-autofill-bound';

  function getRegionCodeFromForm() {
    const subtitle = document.querySelector('#recordForm .dialog-head .muted')?.textContent || '';
    const match = subtitle.match(/Новая запись\s*·\s*(.+)$/i);
    if (match) {
      const name = match[1].trim().toLowerCase();
      const found = Object.values(REGIONS || {}).find(r => String(r.name || '').trim().toLowerCase() === name);
      if (found?.code) return found.code;
    }

    if (typeof creationRegionCode === 'function') {
      const code = creationRegionCode();
      if (code) return code;
    }

    if (typeof selectedRegionCode === 'function') {
      const code = selectedRegionCode();
      if (code) return code;
    }

    return null;
  }

  async function fillManager(form) {
    if (!form) return;

    const storeSelect = form.elements?.storeSelect;
    const managerInput = form.elements?.manager;
    if (!storeSelect || !managerInput) return;

    const storeName = String(storeSelect.value || '').trim();
    if (!storeName || storeName === '__custom') {
      if (storeName === '__custom') managerInput.value = '';
      return;
    }

    const regionCode = getRegionCodeFromForm();
    const regionId = regionCode ? REGIONS?.[regionCode]?.id : null;
    if (!regionId) return;

    const { data, error } = await sb
      .from('stores')
      .select('id,manager_id,managers(full_name)')
      .eq('region_id', regionId)
      .eq('display_name', storeName)
      .maybeSingle();

    if (error) {
      console.warn('manager autofill:', error);
      return;
    }

    const managerName = data?.managers?.full_name || '';
    managerInput.value = managerName;

    // Не даём браузеру считать программную подстановку ручным вводом.
    delete managerInput.dataset.userTouched;
  }

  function bindForm(form) {
    if (!form || form.getAttribute(BOUND) === '1') return;

    const storeSelect = form.elements?.storeSelect;
    const managerInput = form.elements?.manager;
    if (!storeSelect || !managerInput) return;

    form.setAttribute(BOUND, '1');

    storeSelect.addEventListener('change', () => {
      // Даём штатному обработчику PRIZ Control отработать первым,
      // затем гарантированно подставляем менеджера.
      setTimeout(() => fillManager(form), 0);
    });

    // Если форма открылась уже с выбранным магазином.
    setTimeout(() => fillManager(form), 0);
  }

  function scan(root = document) {
    const form = root?.id === 'recordForm'
      ? root
      : root?.querySelector?.('#recordForm');

    if (form) bindForm(form);
  }

  function start() {
    scan(document);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
