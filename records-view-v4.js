(() => {
  const baseRenderRecords = renderRecords;
  const baseRecordsTable = recordsTable;

  recordsTable = function(list, actions = true) {
    if (currentUser?.role === 'manager') {
      return baseRecordsTable(list, actions);
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

  function setupOperatorFilter() {
    if (currentPage !== 'records' || currentUser?.role === 'manager') return;

    const search = document.getElementById('q');
    const hiddenFilter = document.getElementById('fPerson');
    const clearBtn = document.getElementById('clearFilters');

    if (!search || !hiddenFilter) return;

    search.placeholder = 'Поиск: магазин, фабула, сотрудник / продавец...';
    search.title = 'Поиск по магазину, фабуле, сотруднику / продавцу, менеджеру и оператору';

    hiddenFilter.style.display = 'none';
    hiddenFilter.setAttribute('aria-hidden', 'true');

    if (document.getElementById('fOperator')) return;

    const select = document.createElement('select');
    select.id = 'fOperator';
    select.innerHTML = '<option value="">Все операторы</option>';
    hiddenFilter.insertAdjacentElement('afterend', select);

    select.onchange = () => {
      hiddenFilter.value = select.value;
      hiddenFilter.dispatchEvent(new Event('input', { bubbles: true }));
      hiddenFilter.dispatchEvent(new Event('change', { bubbles: true }));
    };

    clearBtn?.addEventListener('click', () => {
      select.value = '';
      hiddenFilter.value = '';
    });

    // Грузим список отдельно, не блокируя страницу.
    const regionCode = document.getElementById('regionSelect')?.value || 'all';
    const regionId = regionCode === 'all' ? null : (REGIONS?.[regionCode]?.id || null);

    sb.rpc('record_filter_operators', { p_region_id: regionId })
      .then(({ data, error }) => {
        if (error) throw error;
        if (!document.body.contains(select)) return;

        const names = Array.isArray(data) ? data : [];
        select.innerHTML = `
          <option value="">Все операторы</option>
          ${names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
        `;
      })
      .catch(err => {
        console.error('Не удалось загрузить операторов', err);
      });
  }

  renderRecords = async function(...args) {
    const result = await baseRenderRecords.apply(this, args);
    setupOperatorFilter();
    return result;
  };
})();
