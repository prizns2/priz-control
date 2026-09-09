(() => {
  const originalRenderRecordsOperatorFilter = renderRecords;
  const originalRecordsTableOperatorFilter = recordsTable;

  // Без MutationObserver: он и был причиной зависания страницы.
  recordsTable = function(list, actions = true) {
    if (currentUser?.role === 'manager') {
      return originalRecordsTableOperatorFilter(list, actions);
    }

    if (!list.length) {
      return '<div class="empty"><b>Записей пока нет</b>Добавь первую запись, и она появится здесь.</div>';
    }

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Тип</th>
              <th>Дата</th>
              <th>Магазин</th>
              <th>Сотрудник</th>
              <th>Содержание</th>
              <th>Менеджер</th>
              <th>Оператор</th>
              ${actions ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${list.map(r => `
              <tr class="clickable" data-id="${esc(r.id)}">
                <td>${typeBadge(r.kind)}</td>
                <td>${fmtDate(r.date)}</td>
                <td>${esc(r.store || '—')}</td>
                <td>${esc(recordSubject(r))}</td>
                <td>
                  <b>${esc(recordTitle(r))}</b>
                  <div class="muted small">
                    ${esc((r.story || r.comment || '').slice(0, 90))}
                    ${(r.story || r.comment || '').length > 90 ? '…' : ''}
                  </div>
                </td>
                <td>${esc(r.manager || '—')}</td>
                <td>${esc(r.createdByName || '—')}</td>
                ${actions ? `<td>${canEdit() ? `<button class="btn ghost small-btn edit-row" data-id="${esc(r.id)}">Редактировать</button>` : ''}</td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

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

    if (!search || !personInput) return;

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
  }

  renderRecords = async function (...args) {
    const result = await originalRenderRecordsOperatorFilter.apply(this, args);
    await enhanceRecordsFilters();
    return result;
  };
})();
