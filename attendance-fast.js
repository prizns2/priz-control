(() => {
  const FAST_VALID = new Set(['1', '1В', '1Л', 'В', 'Л']);
  const FAST_SHIFT = new Set(['1', '1В', '1Л']);
  let xlsxPromise = null;
  let fastEnhanceTimer = null;

  const previousRenderPageFast = renderPage;

  function addFastStyles() {
    if (document.getElementById('attendanceFastStyles')) return;

    const style = document.createElement('style');
    style.id = 'attendanceFastStyles';
    style.textContent = `
      .att-summary-head,.att-summary{
        min-width:76px!important;
        max-width:76px!important;
        width:76px!important;
        text-align:center!important;
      }
      .att-shifts-number{
        display:grid;
        place-items:center;
        min-height:42px;
        font-size:17px;
        font-weight:900;
        color:#f0f2f7;
      }
      .att-summary-head small{
        display:block;
        margin-top:3px;
        color:#777f8c;
        font-size:8px;
        font-weight:600;
      }
      .att-person{
        position:sticky!important;
      }
      .att-22-btn{
        margin-top:6px;
        padding:4px 7px;
        border:1px solid #343947;
        border-radius:7px;
        background:#171a22;
        color:#b9c0cc;
        font-size:9px;
        font-weight:800;
        cursor:pointer;
      }
      .att-22-btn:hover{
        border-color:#7455d8;
        color:#ddd4ff;
        background:#1d1930;
      }
      .att-quick-input{
        display:block;
        width:100%;
        height:100%;
        min-height:43px;
        border:0;
        outline:2px solid #8b5cf6;
        outline-offset:-2px;
        background:#171426;
        color:#fff;
        text-align:center;
        font:900 13px/1 system-ui,-apple-system,Segoe UI,sans-serif;
        text-transform:uppercase;
        box-sizing:border-box;
      }
      .attendance-fast-hint{
        margin-top:8px;
        color:#747c89;
        font-size:10px;
      }
      .attendance-fast-hint b{color:#c7cbd3}
      .att-excel-btn{
        white-space:nowrap;
      }
      .attendance-table tfoot th,
      .attendance-table tfoot td{
        position:sticky;
        bottom:0;
        z-index:5;
        height:39px;
        background:#151923;
        border-top:1px solid #353b49;
        color:#d6dae2;
        font-weight:900;
      }
      .attendance-table tfoot .att-person{
        z-index:8;
        background:#191d27!important;
        text-align:left!important;
        padding:0 12px!important;
      }
      .attendance-table tfoot .att-on-shift{
        color:#86efac;
        font-size:12px;
      }
      .attendance-table tfoot .att-summary{
        z-index:8;
        background:#191d27!important;
      }
      .att-cell.fast-saving{
        opacity:.55;
        pointer-events:none;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeFastStatus(value) {
    let s = String(value || '').trim().toUpperCase();

    // На случай английской раскладки.
    s = s.replace(/^1B$/, '1В')
         .replace(/^B$/, 'В')
         .replace(/^1L$/, '1Л')
         .replace(/^L$/, 'Л');

    return s;
  }

  function cellStatus(cell) {
    const input = cell.querySelector('.att-quick-input');
    if (input) return normalizeFastStatus(input.value);

    const text = Array.from(cell.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('')
      .trim();

    return text === '·' ? '' : normalizeFastStatus(text);
  }

  function currentAttendanceRegionId() {
    const code = document.getElementById('regionSelect')?.value;
    if (code && code !== 'all' && REGIONS?.[code]?.id) {
      return REGIONS[code].id;
    }

    const firstCell = document.querySelector('.att-cell[data-att-user]');
    if (!firstCell) return null;

    const allowed = typeof allowedRegionCodes === 'function'
      ? allowedRegionCodes()
      : Object.keys(REGIONS || {});

    for (const c of allowed) {
      if (REGIONS?.[c]?.id) return REGIONS[c].id;
    }

    return null;
  }

  function rowShiftCount(row) {
    return Array.from(row.querySelectorAll('.att-cell'))
      .reduce((sum, cell) => sum + (FAST_SHIFT.has(cellStatus(cell)) ? 1 : 0), 0);
  }

  function updateShiftTotals(table) {
    const head = table.querySelector('.att-summary-head');
    if (head) {
      head.innerHTML = `Смен<small>1 + 1В + 1Л</small>`;
    }

    table.querySelectorAll('tbody tr').forEach(row => {
      const summary = row.querySelector('.att-summary');
      if (!summary) return;

      summary.innerHTML = `<div class="att-shifts-number">${rowShiftCount(row)}</div>`;
      summary.title = 'Количество смен: 1 + 1В + 1Л';
    });
  }

  function updateOnShiftFooter(table) {
    table.querySelector('tfoot')?.remove();

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (!rows.length) return;

    const firstDayCells = Array.from(rows[0].querySelectorAll('.att-cell'));
    const tfoot = document.createElement('tfoot');
    const tr = document.createElement('tr');

    const label = document.createElement('th');
    label.className = 'att-person';
    label.textContent = 'На смене';
    label.title = 'Считаются только фактические отметки 1';
    tr.appendChild(label);

    for (let dayIndex = 0; dayIndex < firstDayCells.length; dayIndex++) {
      let count = 0;

      for (const row of rows) {
        const cell = row.querySelectorAll('.att-cell')[dayIndex];
        if (cellStatus(cell) === '1') count++;
      }

      const td = document.createElement('td');
      td.className = 'att-on-shift';
      td.textContent = String(count);
      td.title = 'Фактически на смене';
      tr.appendChild(td);
    }

    const end = document.createElement('td');
    end.className = 'att-summary';
    end.textContent = '—';
    tr.appendChild(end);

    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }

  function nextEditableTarget(cell) {
    const row = cell.closest('tr');
    const tbody = row?.parentElement;
    if (!row || !tbody) return null;

    const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
    const cellsInRow = Array.from(row.querySelectorAll('.att-cell'));
    const rowIndex = rows.indexOf(row);
    const dayIndex = cellsInRow.indexOf(cell);

    if (rowIndex >= 0 && rowIndex + 1 < rows.length) {
      const next = rows[rowIndex + 1].querySelectorAll('.att-cell')[dayIndex];
      if (next?.classList.contains('editable')) {
        return {
          userId: next.dataset.attUser,
          date: next.dataset.attDate
        };
      }
    }

    if (dayIndex >= 0 && dayIndex + 1 < cellsInRow.length && rows.length) {
      const next = rows[0].querySelectorAll('.att-cell')[dayIndex + 1];
      if (next?.classList.contains('editable')) {
        return {
          userId: next.dataset.attUser,
          date: next.dataset.attDate
        };
      }
    }

    return null;
  }

  function focusTargetAfterRender(target) {
    if (!target) return;

    requestAnimationFrame(() => {
      const cell = document.querySelector(
        `.att-cell[data-att-user="${CSS.escape(target.userId)}"][data-att-date="${CSS.escape(target.date)}"]`
      );

      if (!cell) return;
      cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      startInlineEdit(cell);
    });
  }

  async function saveQuickStatus(cell, input) {
    if (input.dataset.saving === '1') return;

    const regionId = currentAttendanceRegionId();
    const userId = cell.dataset.attUser;
    const date = cell.dataset.attDate;
    const oldStatus = cell.dataset.fastOriginalStatus || '';
    const newStatus = normalizeFastStatus(input.value);

    if (!regionId || !userId || !date) {
      toast('Не удалось определить регион или сотрудника', true);
      return;
    }

    if (newStatus && !FAST_VALID.has(newStatus)) {
      toast('Допустимо: 1, 1В, 1Л, В, Л', true);
      input.focus();
      input.select();
      return;
    }

    const target = nextEditableTarget(cell);

    if (newStatus === oldStatus) {
      input.replaceWith(document.createTextNode(oldStatus || '·'));
      focusTargetAfterRender(target);
      return;
    }

    input.dataset.saving = '1';
    cell.classList.add('fast-saving');

    try {
      const { error } = await sb.rpc('attendance_set_status_quick', {
        p_region_id: regionId,
        p_user_id: userId,
        p_attendance_date: date,
        p_status: newStatus || null
      });

      if (error) throw error;

      await renderPage();
      focusTargetAfterRender(target);
    } catch (err) {
      console.error(err);
      cell.classList.remove('fast-saving');
      input.dataset.saving = '0';
      toast(err.message || 'Не удалось сохранить отметку', true);
      input.focus();
      input.select();
    }
  }

  function cancelInlineEdit(cell, input) {
    const oldStatus = cell.dataset.fastOriginalStatus || '';
    input.replaceWith(document.createTextNode(oldStatus || '·'));
  }

  function startInlineEdit(cell) {
    if (!cell?.classList.contains('editable')) return;
    if (cell.querySelector('.att-quick-input')) {
      cell.querySelector('.att-quick-input').focus();
      return;
    }

    const oldStatus = cellStatus(cell);
    cell.dataset.fastOriginalStatus = oldStatus;

    const input = document.createElement('input');
    input.className = 'att-quick-input';
    input.value = oldStatus;
    input.maxLength = 2;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.inputMode = 'text';

    cell.innerHTML = '';
    cell.appendChild(input);

    input.focus();
    input.select();

    input.addEventListener('input', () => {
      input.value = normalizeFastStatus(input.value).slice(0, 2);
    });

    input.addEventListener('keydown', async event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await saveQuickStatus(cell, input);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelInlineEdit(cell, input);
      }
    });
  }

  function bindQuickEditing(table) {
    table.querySelectorAll('.att-cell.editable').forEach(cell => {
      if (cell.dataset.fastBound === '1') return;
      cell.dataset.fastBound = '1';

      const originalClick = cell.onclick;
      let singleTimer = null;

      cell.onclick = event => {
        event.preventDefault();

        clearTimeout(singleTimer);
        singleTimer = setTimeout(() => {
          startInlineEdit(cell);
        }, 180);
      };

      cell.ondblclick = event => {
        event.preventDefault();
        clearTimeout(singleTimer);

        // Старое окно attendance.js: комментарий, автор, время и история.
        if (typeof originalClick === 'function') {
          originalClick.call(cell, event);
        }
      };
    });
  }

  function add2x2Buttons(table) {
    const hasToday = !!table.querySelector('.att-day-head.today');
    if (!hasToday) return;

    table.querySelectorAll('tbody tr').forEach(row => {
      const firstEditable = row.querySelector('.att-cell.editable[data-att-user]');
      const personCell = row.querySelector('.att-person');

      if (!firstEditable || !personCell || personCell.querySelector('.att-22-btn')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'att-22-btn';
      button.textContent = '2/2 с сегодня';
      button.title = 'Поставить 1 по графику 2/2 от сегодняшней даты. Уже заполненные дни не изменятся.';

      button.onclick = async event => {
        event.preventDefault();
        event.stopPropagation();

        const regionId = currentAttendanceRegionId();
        const userId = firstEditable.dataset.attUser;
        const name = personCell.querySelector('b')?.textContent?.trim() || 'сотрудника';

        if (!regionId || !userId) {
          toast('Не удалось определить регион', true);
          return;
        }

        if (!confirm(`Поставить график 2/2 с сегодняшнего дня для ${name}?\n\nУже заполненные дни останутся без изменений.`)) {
          return;
        }

        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = 'Ставим…';

        try {
          const { data, error } = await sb.rpc('attendance_apply_2x2', {
            p_region_id: regionId,
            p_user_id: userId,
            p_start_date: todayKyiv()
          });

          if (error) throw error;

          const added = Number(data?.added || 0);
          const skipped = Number(data?.skippedExisting || 0);
          toast(`2/2 готово: добавлено ${added}${skipped ? `, пропущено заполненных ${skipped}` : ''}`);

          await renderPage();
        } catch (err) {
          console.error(err);
          toast(err.message || 'Не удалось применить график 2/2', true);
        } finally {
          button.disabled = false;
          button.textContent = oldText;
        }
      };

      personCell.appendChild(button);
    });
  }

  function addFastHint() {
    const top = document.querySelector('.attendance-top');
    if (!top || top.querySelector('.attendance-fast-hint')) return;

    const left = top.firstElementChild;
    if (!left) return;

    const hint = document.createElement('div');
    hint.className = 'attendance-fast-hint';
    hint.innerHTML = '<b>Быстрый ввод:</b> клик по ячейке → 1 / 1В / 1Л / В / Л → Enter. Enter переходит к следующему сотруднику. Двойной клик — комментарий и история.';
    left.appendChild(hint);
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;

    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.async = true;
      script.onload = () => resolve(window.XLSX);
      script.onerror = () => reject(new Error('Не удалось загрузить модуль Excel'));
      document.head.appendChild(script);
    });

    return xlsxPromise;
  }

  function safeFilePart(value) {
    return String(value || '')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async function exportAttendanceExcel(button) {
    const table = document.querySelector('.attendance-table');
    if (!table) return;

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = 'Готовим Excel…';

    try {
      const XLSX = await loadXlsx();
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const dayHeaders = Array.from(table.querySelectorAll('thead .att-day-head'));

      const aoa = [];
      aoa.push([
        'Сотрудник',
        ...dayHeaders.map(h => h.querySelector('b')?.textContent?.trim() || ''),
        'Смен'
      ]);

      rows.forEach(row => {
        const name = row.querySelector('.att-person b')?.textContent?.trim() || '';
        const statuses = Array.from(row.querySelectorAll('.att-cell')).map(cell => cellStatus(cell));
        aoa.push([name, ...statuses, rowShiftCount(row)]);
      });

      const onShift = ['На смене'];
      for (let i = 0; i < dayHeaders.length; i++) {
        let count = 0;
        for (const row of rows) {
          const cell = row.querySelectorAll('.att-cell')[i];
          if (cellStatus(cell) === '1') count++;
        }
        onShift.push(count);
      }
      onShift.push('');
      aoa.push(onShift);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 34 },
        ...dayHeaders.map(() => ({ wch: 5 })),
        { wch: 9 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Табель');

      const title = document.querySelector('.attendance-top h3')?.textContent?.trim() || 'Табель';
      XLSX.writeFile(wb, `${safeFilePart(title)}.xlsx`);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Не удалось скачать Excel', true);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  function addExcelButton() {
    const top = document.querySelector('.attendance-top');
    if (!top) return;

    let controls = top.querySelector('.attendance-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'attendance-controls';
      top.appendChild(controls);
    }

    if (controls.querySelector('.att-excel-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ghost att-excel-btn';
    button.textContent = '↓ Скачать Excel';
    button.onclick = () => exportAttendanceExcel(button);

    controls.appendChild(button);
  }

  function enhanceAttendance() {
    if (currentPage !== 'attendance') return;

    const table = document.querySelector('.attendance-table');
    if (!table || table.dataset.fastEnhanced === '1') return;

    table.dataset.fastEnhanced = '1';

    addFastStyles();
    updateShiftTotals(table);
    updateOnShiftFooter(table);
    bindQuickEditing(table);
    add2x2Buttons(table);
    addFastHint();
    addExcelButton();
  }

  function scheduleEnhanceAttendance() {
    clearTimeout(fastEnhanceTimer);
    fastEnhanceTimer = setTimeout(enhanceAttendance, 25);
  }

  renderPage = async function (...args) {
    const result = await previousRenderPageFast.apply(this, args);
    if (currentPage === 'attendance') enhanceAttendance();
    return result;
  };

  const content = document.getElementById('content');
  if (content) {
    const observer = new MutationObserver(() => {
      if (currentPage === 'attendance') scheduleEnhanceAttendance();
    });

    observer.observe(content, {
      childList: true,
      subtree: true
    });
  }

  addFastStyles();
  setTimeout(enhanceAttendance, 0);
})();
