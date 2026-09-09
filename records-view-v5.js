(() => {
  const baseRenderRecords = renderRecords;
  const baseRecordsTable = recordsTable;

  const style = document.createElement('style');
  style.id = 'recordsViewV5Styles';
  style.textContent = `
    #fPerson {
      display: none !important;
    }

    #fOperator.records-operator-loading {
      opacity: .72;
    }

   /* Белая иконка календаря */
#content input[type="date"] {
  color-scheme: dark;
  padding-right: 42px !important;

  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M16 3v4M8 3v4M3 11h18'/%3E%3C/svg%3E") !important;

  background-repeat: no-repeat !important;
  background-position: right 14px center !important;
  background-size: 18px 18px !important;
}

#content input[type="date"]::-webkit-calendar-picker-indicator {
  opacity: 0 !important;
  cursor: pointer;
  width: 30px;
  height: 30px;
}
  `;
  document.head.appendChild(style);
// Открываем календарь по клику в любое место поля даты
document.addEventListener('click', (e) => {
  const input = e.target.closest('#content input[type="date"]');

  if (!input) return;

  try {
    input.showPicker();
  } catch (_) {
    input.focus();
  }
});
  let toolbarObserver = null;
  let operatorLoadSeq = 0;

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
              <th>Продавец</th>
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
                    ${esc(
                      (r.story || r.comment || '').slice(0, 90)
                    )}

                    ${
                      (r.story || r.comment || '').length > 90
                        ? '…'
                        : ''
                    }
                  </div>
                </td>

                <td>${esc(r.manager || '—')}</td>

                <td>${esc(r.createdByName || '—')}</td>

                ${
                  actions
                    ? `
                      <td>
                        ${
                          canEdit()
                            ? `
                              <button
                                class="btn ghost small-btn edit-row"
                                data-id="${esc(r.id)}"
                              >
                                Редактировать
                              </button>
                            `
                            : ''
                        }
                      </td>
                    `
                    : ''
                }

              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  function selectedRegionIdForOperatorFilter() {
    const code =
      document.getElementById('regionSelect')?.value || 'all';

    return code === 'all'
      ? null
      : (REGIONS?.[code]?.id || null);
  }

  async function fillOperators(select) {
    const seq = ++operatorLoadSeq;

    const regionId =
      selectedRegionIdForOperatorFilter();

    select.classList.add(
      'records-operator-loading'
    );

    try {
      const { data, error } = await sb.rpc(
        'record_filter_operators',
        {
          p_region_id: regionId
        }
      );

      if (error) {
        throw error;
      }

      if (
        seq !== operatorLoadSeq ||
        !document.body.contains(select)
      ) {
        return;
      }

      const current = select.value;

      const names =
        Array.isArray(data)
          ? data
          : [];

      select.innerHTML = `
        <option value="">
          Все операторы
        </option>

        ${names
          .map(
            name => `
              <option value="${esc(name)}">
                ${esc(name)}
              </option>
            `
          )
          .join('')}
      `;

      if (
        current &&
        names.includes(current)
      ) {
        select.value = current;
      }

    } catch (err) {
      console.error(
        'Не удалось загрузить операторов',
        err
      );

    } finally {
      if (
        seq === operatorLoadSeq &&
        document.body.contains(select)
      ) {
        select.classList.remove(
          'records-operator-loading'
        );
      }
    }
  }

  function installOperatorSelectImmediately() {
    if (
      currentPage !== 'records' ||
      currentUser?.role === 'manager'
    ) {
      return false;
    }

    const hiddenFilter =
      document.getElementById('fPerson');

    if (!hiddenFilter) {
      return false;
    }

    const search =
      document.getElementById('q');

    if (search) {
      search.placeholder =
        'Поиск: магазин, фабула, продавец...';

      search.title =
        'Поиск по магазину, фабуле, продавцу, менеджеру и оператору';
    }

    hiddenFilter.setAttribute(
      'aria-hidden',
      'true'
    );

    let select =
      document.getElementById('fOperator');

    if (!select) {

      select =
        document.createElement('select');

      select.id = 'fOperator';

      select.className =
        'records-operator-loading';

      select.innerHTML =
        '<option value="">Все операторы</option>';

      hiddenFilter.insertAdjacentElement(
        'afterend',
        select
      );

      select.onchange = () => {

        hiddenFilter.value =
          select.value;

        hiddenFilter.dispatchEvent(
          new Event(
            'input',
            { bubbles: true }
          )
        );

        hiddenFilter.dispatchEvent(
          new Event(
            'change',
            { bubbles: true }
          )
        );
      };

      const clearBtn =
        document.getElementById(
          'clearFilters'
        );

      clearBtn?.addEventListener(
        'click',
        () => {

          select.value = '';

          hiddenFilter.value = '';
        }
      );

      fillOperators(select);
    }

    return true;
  }

  function watchToolbarOnlyUntilReady() {

    toolbarObserver?.disconnect();

    toolbarObserver = null;

    if (
      installOperatorSelectImmediately()
    ) {
      return;
    }

    const content =
      document.getElementById(
        'content'
      );

    if (!content) {
      return;
    }

    toolbarObserver =
      new MutationObserver(() => {

        if (
          installOperatorSelectImmediately()
        ) {

          toolbarObserver?.disconnect();

          toolbarObserver = null;
        }
      });

    toolbarObserver.observe(
      content,
      {
        childList: true,
        subtree: true
      }
    );
  }

  renderRecords = async function(...args) {

    watchToolbarOnlyUntilReady();

    const result =
      await baseRenderRecords.apply(
        this,
        args
      );

    installOperatorSelectImmediately();

    return result;
  };

})();
