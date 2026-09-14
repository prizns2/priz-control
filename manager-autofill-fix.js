(() => {
  // PRIZ Control — manager autofill stability v22
  if (window.__prizManagerAutofillV22Installed) return;
  window.__prizManagerAutofillV22Installed = true;

  const BOUND = 'data-priz-manager-autofill-v22-bound';

  function norm(v) {
    return String(v || '').trim().toLowerCase();
  }

  function getRegionCodeFromForm(form) {
    if (!form) return null;

    const subtitle =
      form.querySelector('.dialog-head .muted')?.textContent?.trim() || '';

    // New record: "Новая запись · Харьков"
    const newMatch = subtitle.match(/Новая запись\s*·\s*(.+)$/i);

    if (newMatch) {
      const wanted = norm(newMatch[1]);

      for (const [key, region] of Object.entries(REGIONS || {})) {
        if (
          norm(region?.name) === wanted ||
          norm(region?.eyebrow) === wanted ||
          norm(region?.code) === wanted ||
          norm(key) === wanted
        ) {
          return region?.code || key;
        }
      }
    }

    // Edit record: "KHARKIV-20260914-CAT1-..."
    if (subtitle) {
      const upper = subtitle.toUpperCase();

      const entries = Object.entries(REGIONS || {})
        .sort((a, b) => {
          const ac = String(a[1]?.code || a[0]).length;
          const bc = String(b[1]?.code || b[0]).length;
          return bc - ac;
        });

      for (const [key, region] of entries) {
        const code = String(region?.code || key).trim();

        if (code && upper.startsWith(code.toUpperCase() + '-')) {
          return region?.code || key;
        }
      }
    }

    // Selected region is only a fallback.
    try {
      const selected = document.getElementById('regionSelect')?.value;
      if (selected && selected !== 'all' && REGIONS?.[selected]) {
        return selected;
      }
    } catch (_) {}

    try {
      if (typeof creationRegionCode === 'function') {
        const code = creationRegionCode();
        if (code && REGIONS?.[code]) return code;
      }
    } catch (_) {}

    try {
      if (typeof selectedRegionCode === 'function') {
        const code = selectedRegionCode();
        if (code && REGIONS?.[code]) return code;
      }
    } catch (_) {}

    return null;
  }

  async function managerForStore(form, storeName) {
    const regionCode = getRegionCodeFromForm(form);
    const regionId = regionCode ? REGIONS?.[regionCode]?.id : null;

    if (!regionId || !storeName) return { found: false, name: '' };

    const { data, error } = await sb
      .from('stores')
      .select('id,manager_id,display_name,managers(full_name)')
      .eq('region_id', regionId)
      .eq('display_name', storeName)
      .maybeSingle();

    if (error) {
      console.warn('manager autofill v22:', error);
      return { found: false, name: '' };
    }

    if (!data) return { found: false, name: '' };

    return {
      found: true,
      name: data?.managers?.full_name || ''
    };
  }

  async function fillAfterStoreChange(form) {
    if (!form || !document.body.contains(form)) return;

    const storeSelect = form.elements?.storeSelect;
    const managerInput = form.elements?.manager;

    if (!storeSelect || !managerInput) return;

    const seq = Number(form.dataset.managerFillSeq || 0) + 1;
    form.dataset.managerFillSeq = String(seq);

    const storeName = String(storeSelect.value || '').trim();

    if (!storeName) return;

    if (storeName === '__custom') {
      managerInput.value = '';
      delete managerInput.dataset.userTouched;
      return;
    }

    const result = await managerForStore(form, storeName);

    if (
      Number(form.dataset.managerFillSeq || 0) !== seq ||
      !document.body.contains(form)
    ) {
      return;
    }

    // A real selected store should always control its manager.
    if (result.found) {
      managerInput.value = result.name;
      delete managerInput.dataset.userTouched;
    }
  }

  function isEditForm(form) {
    const title =
      form?.querySelector('.dialog-head h3')?.textContent?.trim() || '';

    return /редакт/i.test(title);
  }

  function bindForm(form) {
    if (!form || form.getAttribute(BOUND) === '1') return;

    const storeSelect = form.elements?.storeSelect;
    const managerInput = form.elements?.manager;

    if (!storeSelect || !managerInput) return;

    form.setAttribute(BOUND, '1');

    /*
      IMPORTANT:
      On edit we DO NOT touch manager on initial opening.
      app.js already fills r.manager and intentionally preserves it.
      This avoids erasing the manager saved in the record.
    */

    storeSelect.addEventListener('change', () => {
      // Let app.js updStore() start first, then independently guarantee
      // the manager for the newly selected store.
      setTimeout(() => {
        fillAfterStoreChange(form);
      }, 20);
    });

    // Only new forms may be initialized automatically.
    if (!isEditForm(form) && storeSelect.value) {
      setTimeout(() => fillAfterStoreChange(form), 20);
    }
  }

  function scan(root = document) {
    const form =
      root?.id === 'recordForm'
        ? root
        : root?.querySelector?.('#recordForm');

    if (form) bindForm(form);
  }

  function start() {
    scan(document);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scan(node);
          }
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
