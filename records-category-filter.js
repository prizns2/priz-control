(() => {
  const RPC_NAME = 'search_records_secure_v2';
  let installObserver = null;

  function currentViolationType() {
    return document.getElementById('fViolationType')?.value?.trim() || null;
  }

  const baseSecureSearchArgs = window.secureSearchArgs;
  window.secureSearchArgs = function(filters = {}, offset = 0, limit = 100) {
    const args = typeof baseSecureSearchArgs === 'function'
      ? baseSecureSearchArgs(filters, offset, limit)
      : {
          p_region_id: null,
          p_kind: null,
          p_person: null,
          p_manager: null,
          p_from: null,
          p_to: null,
          p_query: null,
          p_offset: Math.max(0, Number(offset) || 0),
          p_limit: Math.min(1000, Math.max(1, Number(limit) || 100))
        };

    args.p_violation_type = currentViolationType();
    return args;
  };

  window.fetchRecordPage = async function(filters, page = 0, pageSize = 100) {
    const offset = Math.max(0, Number(page) || 0) * Math.max(1, Number(pageSize) || 100);
    const { data, error } = await sb.rpc(RPC_NAME, window.secureSearchArgs(filters, offset, pageSize));
    if (error) throw error;

    const rawRows = Array.isArray(data?.rows) ? data.rows : [];
    const rows = rawRows.map(r => fromDbRecord(r, []));
    recordCache = rows;
    return { rows, count: Number(data?.count || 0) };
  };

  window.fetchFilteredRecords = async function(filters) {
    const pageSize = 1000;
    const maxRows = 50000;
    const out = [];

    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const { data, error } = await sb.rpc(RPC_NAME, window.secureSearchArgs(filters, offset, pageSize));
      if (error) throw error;

      const rawRows = Array.isArray(data?.rows) ? data.rows : [];
      out.push(...rawRows);

      if (rawRows.length < pageSize || out.length >= Number(data?.count || 0)) break;
    }

    return out.slice(0, maxRows).map(r => fromDbRecord(r, []));
  };

  function regionCode() {
    return document.getElementById('regionSelect')?.value || 'all';
  }

  function uniqueTypeNames(kind) {
    if (!['cat1', 'cat2'].includes(kind)) return [];
    const code = regionCode();
    let list = [];

    if (code !== 'all' && typeof typesFor === 'function') {
      list = typesFor(kind, code) || [];
    } else {
      list = kind === 'cat1'
        ? (VIOLATION_TYPES?.cat1 || FALLBACK_CAT1 || [])
        : (VIOLATION_TYPES?.cat2 || FALLBACK_CAT2 || []);
    }

    const names = list
      .map(x => typeof x === 'string' ? x : x?.name)
      .filter(Boolean);

    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function rebuildViolationSelect(select, kind, preserve = false) {
    const old = preserve ? select.value : '';

    if (!['cat1', 'cat2'].includes(kind)) {
      select.value = '';
      select.innerHTML = '<option value="">Все нарушения</option>';
      select.style.display = 'none';
      select.disabled = true;
      return;
    }

    const names = uniqueTypeNames(kind);
    const allLabel = kind === 'cat1'
      ? 'Все нарушения 1 категории'
      : 'Все нарушения 2 категории';

    select.innerHTML = `
      <option value="">${allLabel}</option>
      ${names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
    `;

    if (old && names.includes(old)) select.value = old;
    select.disabled = false;
    select.style.display = '';
  }

  function installFilters() {
    if (currentPage !== 'records') return false;
    if (currentUser?.role === 'manager') return true;

    const q = document.getElementById('q');
    const kind = document.getElementById('fKind');
    const manager = document.getElementById('fManager');
    const clear = document.getElementById('clearFilters');
    if (!q || !kind || !manager) return false;

    q.placeholder = 'Поиск: магазин, продавец...';
    q.title = 'Поиск по магазину, продавцу, менеджеру и оператору';

    let violation = document.getElementById('fViolationType');
    if (!violation) {
      violation = document.createElement('select');
      violation.id = 'fViolationType';
      violation.className = kind.className;
      kind.insertAdjacentElement('afterend', violation);

      kind.addEventListener('change', () => {
        rebuildViolationSelect(violation, kind.value, false);
      }, true);

      violation.addEventListener('change', () => {
        // В renderRecords загрузка уже привязана к change менеджера.
        // Посылаем безопасный change только чтобы переиспользовать текущую загрузку/пагинацию.
        manager.dispatchEvent(new Event('change', { bubbles: true }));
      });

      clear?.addEventListener('click', () => {
        violation.value = '';
        rebuildViolationSelect(violation, '', false);
      }, true);
    }

    rebuildViolationSelect(violation, kind.value, true);
    return true;
  }

  function watchUntilInstalled() {
    installObserver?.disconnect();
    installObserver = null;

    if (installFilters()) return;

    const content = document.getElementById('content');
    if (!content) return;

    installObserver = new MutationObserver(() => {
      if (installFilters()) {
        installObserver?.disconnect();
        installObserver = null;
      }
    });

    installObserver.observe(content, { childList: true, subtree: true });
  }

  const baseRenderRecords = window.renderRecords;
  if (typeof baseRenderRecords === 'function') {
    window.renderRecords = async function(...args) {
      watchUntilInstalled();
      const result = await baseRenderRecords.apply(this, args);
      installFilters();
      return result;
    };
  }
})();
