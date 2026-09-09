(() => {
  const originalRenderRecordsOperatorFilter = renderRecords;
  let recordsOperatorObserver = null;

  function enhanceRecordsTableHeaders() {
    const area = document.getElementById('recordsArea');
    if (!area) return;

    area.querySelectorAll('table').forEach(table => {
      // Для кабинета менеджера оставляем его отдельную таблицу как есть.
      if (currentUser?.role === 'manager') return;

      const headRow = table.querySelector('thead tr');
      if (!headRow) return;

      let operatorTh = [...headRow.querySelectorAll('th')]
        .find(th => ['Автор', 'Оператор'].includes(th.textContent.trim()));

      if (!operatorTh) return;
      operatorTh.textContent = 'Оператор';

      let managerTh = headRow.querySelector('.records-manager-col');
      if (!managerTh) {
        managerTh = document.createElement('th');
        managerTh.className = 'records-manager-col';
        managerTh.textContent = 'Менеджер';
        headRow.insertBefore(managerTh, operatorTh);
      }

      const operatorIndex = [...headRow.children].indexOf(operatorTh);
      const managerIndex = [...headRow.children].indexOf(managerTh);

      table.querySelectorAll('tbody tr[data-id]').forEach(row => {
        if (row.querySelector('.records-manager-col')) return;

        const recordId = row.dataset.id;
        const record = recordCache.find(r => String(r.id) === String(recordId));
        const td = document.createElement('td');
        td.className = 'records-manager-col';
        td.textContent = record?.manager || '—';

        const cells = [...row.children];

        // После вставки заголовка индекс "Оператор" сдвинут вправо.
        // Ставим менеджера прямо перед оператором.
        const beforeCell = cells[managerIndex] || cells[operatorIndex] || null;
        if (beforeCell) row.insertBefore(td, beforeCell);
        else row.appendChild(td);
      });
    });
  }

  function observeRecordsArea() {
    recordsOperatorObserver?.disconnect();
    recordsOperatorObserver = null;

    const area = document.getElementById('recordsArea');
    if (!area) return;

    recordsOperatorObserver = new MutationObserver(() => {
      enhanceRecordsTableHeaders();
    });

    recordsOperatorObserver.observe(area, { childList: true, subtree: true });
    enhanceRecordsTableHeaders();
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

      // Старое поле fPerson оставляем скрытым:
      // сервер теперь использует его как фильтр по оператору.
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
