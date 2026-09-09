(() => {
  const originalRenderRecordsOperatorFilter = renderRecords;
  let recordsOperatorObserver = null;

  function renameAuthorHeader() {
    const area = document.getElementById('recordsArea');
    if (!area) return;

    area.querySelectorAll('thead th').forEach(th => {
      if (th.textContent.trim() === 'Автор') {
        th.textContent = 'Оператор';
      }
    });
  }

  function observeRecordsArea() {
    recordsOperatorObserver?.disconnect();
    recordsOperatorObserver = null;

    const area = document.getElementById('recordsArea');
    if (!area) return;

    recordsOperatorObserver = new MutationObserver(() => renameAuthorHeader());
    recordsOperatorObserver.observe(area, { childList: true, subtree: true });
    renameAuthorHeader();
  }

  async function getOperatorOptionsForSelectedRegion() {
    const regionCode = document.getElementById('regionSelect')?.value || 'all';
    const regionId = regionCode === 'all' ? null : REGIONS?.[regionCode]?.id;

    const [{ data: profiles, error: pErr }, { data: links, error: lErr }] = await Promise.all([
      sb
        .from('profiles')
        .select('id,full_name,role,region_id,is_active')
        .eq('is_active', true)
        .in('role', ['operator', 'senior'])
        .order('full_name'),
      sb
        .from('user_regions')
        .select('user_id,region_id')
    ]);

    if (pErr) throw pErr;
    if (lErr) throw lErr;

    const linked = new Map();
    for (const row of links || []) {
      if (!linked.has(row.user_id)) linked.set(row.user_id, new Set());
      linked.get(row.user_id).add(row.region_id);
    }

    const names = (profiles || [])
      .filter(p => {
        if (!regionId) return true;
        return p.region_id === regionId || linked.get(p.id)?.has(regionId);
      })
      .map(p => String(p.full_name || '').trim())
      .filter(Boolean);

    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  async function enhanceRecordsFilters() {
    if (currentPage !== 'records') return;

    const search = document.getElementById('q');
    const personInput = document.getElementById('fPerson');
    const clearBtn = document.getElementById('clearFilters');

    if (!search || !personInput) {
      observeRecordsArea();
      return;
    }

    search.placeholder = 'Поиск: магазин, фабула, сотрудник / продавец...';
    search.title = 'Поиск по магазину, фабуле, сотруднику / продавцу, менеджеру и оператору';

    if (!document.getElementById('fOperator')) {
      let operators = [];
      try {
        operators = await getOperatorOptionsForSelectedRegion();
      } catch (err) {
        console.error('Не удалось загрузить список операторов', err);
      }

      const select = document.createElement('select');
      select.id = 'fOperator';
      select.innerHTML = `
        <option value="">Все операторы</option>
        ${operators.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
      `;

      // Оставляем старый fPerson в DOM, потому что штатный renderRecords
      // уже привязал к нему фильтрацию. Теперь это скрытое поле оператора.
      personInput.style.display = 'none';
      personInput.setAttribute('aria-hidden', 'true');
      personInput.insertAdjacentElement('afterend', select);

      select.onchange = () => {
        personInput.value = select.value;
        personInput.dispatchEvent(new Event('input', { bubbles: true }));
        personInput.dispatchEvent(new Event('change', { bubbles: true }));
      };

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          select.value = '';
          personInput.value = '';
        });
      }
    }

    observeRecordsArea();
  }

  renderRecords = async function (...args) {
    const result = await originalRenderRecordsOperatorFilter.apply(this, args);
    await enhanceRecordsFilters();
    return result;
  };
})();
