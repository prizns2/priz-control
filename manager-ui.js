(() => {
  const originalGoManagerUi = go;
  const originalBuildShellManagerUi = buildShell;
  const originalRenderRecordsManagerUi = renderRecords;
  const originalRecordsTableManagerUi = recordsTable;
  const originalBindRowsManagerUi = bindRows;

  function injectManagerUiStyles() {
    if (document.getElementById('managerUiStyles')) return;

    const style = document.createElement('style');
    style.id = 'managerUiStyles';
    style.textContent = `
      .manager-records-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
        margin-bottom:12px;
        padding:12px 14px;
        border:1px solid #2a3040;
        border-radius:12px;
        background:#10131a;
      }
      .manager-records-head .k{
        color:#767f8e;
        font-size:10px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.08em;
      }
      .manager-records-head .v{
        margin-top:4px;
        color:#f0f2f7;
        font-size:14px;
        font-weight:900;
      }
      .manager-records-head .region{
        color:#9ea6b3;
        font-size:11px;
        font-weight:700;
      }
      .manager-name-chip{
        min-width:220px;
        height:40px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 12px;
        border:1px solid #313747;
        border-radius:9px;
        background:#11141b;
        color:#d9dde5;
        box-sizing:border-box;
      }
      .manager-name-chip span{
        color:#757e8c;
        font-size:10px;
        font-weight:800;
        text-transform:uppercase;
      }
      .manager-name-chip b{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:11px;
      }
      .manager-photo-row{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        min-width:92px;
        white-space:nowrap;
      }
      .manager-photo-row.uploading{
        opacity:.65;
        pointer-events:none;
      }
      .manager-photo-action-cell{
        width:112px;
        text-align:right;
      }
      @media(max-width:900px){
        .manager-name-chip{min-width:180px}
      }
    `;
    document.head.appendChild(style);
  }

  go = function(page) {
    if (currentUser?.role === 'manager' && page === 'dashboard') {
      page = 'records';
    }
    return originalGoManagerUi(page);
  };

  buildShell = function(...args) {
    const result = originalBuildShellManagerUi.apply(this, args);

    if (currentUser?.role === 'manager') {
      document.querySelector('[data-page="dashboard"]')?.remove();

      const nav = document.getElementById('nav');
      const recordsBtn = nav?.querySelector('[data-page="records"]');
      if (recordsBtn) recordsBtn.classList.add('active');

      const quick = document.getElementById('quickAddBtn');
      if (quick) quick.classList.add('hidden');
    }

    return result;
  };

  recordsTable = function(list, actions = true) {
    if (currentUser?.role !== 'manager') {
      return originalRecordsTableManagerUi(list, actions);
    }

    if (!list.length) {
      return '<div class="empty"><b>Записей пока нет</b>Для этого менеджера записи не найдены.</div>';
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
              <th>Автор</th>
              <th class="manager-photo-action-cell">Фото</th>
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
                <td>${esc(r.createdByName)}</td>
                <td class="manager-photo-action-cell">
                  ${r.kind === 'eval'
                    ? '<span class="muted small">—</span>'
                    : `<button class="btn ghost small-btn manager-photo-row" type="button" data-id="${esc(r.id)}">📎 Добавить фото</button>`
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  async function uploadManagerPhotos(recordId, button) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      try { input.remove(); } catch (_) {}
    };

    input.onchange = async () => {
      const files = [...(input.files || [])];
      if (!files.length) {
        cleanup();
        return;
      }

      const oldText = button.textContent;
      button.classList.add('uploading');
      button.disabled = true;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          if (!String(file.type || '').startsWith('image/')) {
            throw new Error(`«${file.name}» — не фото`);
          }

          await uploadOneMedia(
            recordId,
            {
              name: file.name,
              type: file.type,
              size: file.size,
              blob: file
            },
            progress => {
              button.textContent = `Фото ${i + 1}/${files.length} · ${progress}%`;
            }
          );
        }

        button.textContent = '✓ Фото добавлено';
        toast(files.length === 1 ? 'Фото прикреплено' : `Прикреплено фото: ${files.length}`);

        setTimeout(() => {
          if (document.body.contains(button)) button.textContent = oldText;
        }, 1800);
      } catch (err) {
        console.error(err);
        toast(err.message || 'Не удалось прикрепить фото', true);
        button.textContent = oldText;
      } finally {
        button.classList.remove('uploading');
        button.disabled = false;
        cleanup();
      }
    };

    input.click();
  }

  bindRows = function(...args) {
    const result = originalBindRowsManagerUi.apply(this, args);

    if (currentUser?.role === 'manager') {
      document.querySelectorAll('.manager-photo-row').forEach(button => {
        if (button.dataset.bound === '1') return;
        button.dataset.bound = '1';

        button.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          uploadManagerPhotos(button.dataset.id, button);
        };
      });
    }

    return result;
  };

  function enhanceManagerRecordsPage() {
    if (currentUser?.role !== 'manager' || currentPage !== 'records') return;

    injectManagerUiStyles();

    const title = document.getElementById('pageTitle');
    if (title) title.textContent = 'Мои записи';

    const panel = document.querySelector('#content > .panel');
    if (!panel || panel.querySelector('.manager-records-head')) return;

    const regionName = currentUser.managerRegionId
      ? (REGION_BY_UUID[currentUser.managerRegionId]?.name || '')
      : (REGIONS[currentUser.region]?.name || '');

    const head = document.createElement('div');
    head.className = 'manager-records-head';
    head.innerHTML = `
      <div>
        <div class="k">Менеджер</div>
        <div class="v">${esc(currentUser.managerName || currentUser.name || '—')}</div>
      </div>
      <div class="region">${esc(regionName || '')}</div>
    `;
    panel.insertBefore(head, panel.firstChild);

    const managerSelect = document.getElementById('fManager');
    if (managerSelect) {
      managerSelect.style.display = 'none';

      const chip = document.createElement('div');
      chip.className = 'manager-name-chip';
      chip.innerHTML = `
        <span>Менеджер</span>
        <b>${esc(currentUser.managerName || currentUser.name || '—')}</b>
      `;
      managerSelect.insertAdjacentElement('afterend', chip);
    }
  }

  renderRecords = async function(...args) {
    const result = await originalRenderRecordsManagerUi.apply(this, args);
    enhanceManagerRecordsPage();
    return result;
  };

  injectManagerUiStyles();

  if (currentUser?.role === 'manager' && currentPage === 'records') {
    setTimeout(enhanceManagerRecordsPage, 0);
  }
})();
