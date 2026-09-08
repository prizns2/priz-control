(() => {
  const originalBuildShell = buildShell;
  const originalGo = go;
  const originalRenderPage = renderPage;

  let attendanceSelectedMonth = null;
  let attendanceArchiveCache = null;
  let attendanceLastPayload = null;

  const ATT_STATUS_CLASS = {
    '1': 'work',
    '1В': 'paid-vac',
    '1Л': 'paid-sick',
    'В': 'vac',
    'Л': 'sick'
  };

  const ATT_STATUS_LABEL = {
    '1': 'Работает',
    '1В': 'Оплачиваемый отпуск',
    '1Л': 'Оплачиваемый больничный',
    'В': 'Неоплачиваемый отпуск',
    'Л': 'Неоплачиваемый больничный'
  };

  function injectAttendanceStyles() {
    if (document.getElementById('attendanceStyles')) return;

    const style = document.createElement('style');
    style.id = 'attendanceStyles';
    style.textContent = `
      .attendance-top{
        display:flex;align-items:flex-start;justify-content:space-between;
        gap:14px;flex-wrap:wrap;margin-bottom:14px
      }
      .attendance-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .attendance-controls select{width:auto;min-width:210px}
      .attendance-legend{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 0}
      .att-legend-item{
        display:inline-flex;align-items:center;gap:6px;padding:5px 8px;
        border:1px solid #282d39;border-radius:999px;background:#101218;
        color:#aeb4bf;font-size:11px
      }
      .att-legend-code{
        min-width:27px;height:22px;padding:0 6px;border-radius:7px;
        display:inline-grid;place-items:center;font-weight:900;color:#fff
      }
      .att-work{background:#123023!important;color:#86efac!important}
      .att-paid-vac{background:#2b2145!important;color:#d8c8ff!important}
      .att-paid-sick{background:#142c43!important;color:#9bd0ff!important}
      .att-vac{background:#322511!important;color:#f7c870!important}
      .att-sick{background:#421d23!important;color:#ffb0b8!important}
      .attendance-archive-note{
        padding:11px 13px;border:1px solid #6d541d;background:#211b0f;
        color:#e7ca83;border-radius:12px;font-size:12px;margin-bottom:14px
      }
      .attendance-table-wrap{
        overflow:auto;border:1px solid #222631;border-radius:14px;
        max-height:calc(100vh - 255px);background:#101218
      }
      .attendance-table{
        border-collapse:separate;border-spacing:0;
        width:max-content;min-width:100%;font-size:12px
      }
      .attendance-table th,.attendance-table td{
        border-right:1px solid #20242d;border-bottom:1px solid #20242d;
        padding:0;text-align:center;vertical-align:middle
      }
      .attendance-table thead th{
        position:sticky;top:0;z-index:5;background:#11131a;
        color:#8f96a3;font-size:10px;font-weight:800
      }
      .attendance-table .att-person-head,
      .attendance-table .att-person{
        position:sticky;left:0;z-index:6;min-width:245px;max-width:245px;
        text-align:left;background:#13161d
      }
      .attendance-table .att-person-head{z-index:8;padding:12px}
      .attendance-table .att-person{
        padding:9px 12px
      }
      .att-person b{display:block;font-size:12px;color:#e8eaf0}
      .att-person span{display:block;margin-top:3px;font-size:10px;color:#747c89}
      .att-day-head{width:45px;min-width:45px;height:48px}
      .att-day-head b{display:block;color:#d4d7de;font-size:11px}
      .att-day-head span{display:block;margin-top:3px;font-size:9px}
      .att-day-head.today{background:#211d35!important;color:#c4b5fd!important}
      .att-cell{
        position:relative;width:45px;min-width:45px;height:43px;
        background:#0f1117;color:#5f6672;font-weight:900;
        cursor:default;user-select:none;transition:.12s
      }
      .att-cell.editable{cursor:pointer}
      .att-cell.editable:hover,.att-cell.readable:hover{
        filter:brightness(1.18);outline:1px solid #5f4bc3;outline-offset:-1px
      }
      .att-cell.readable{cursor:pointer}
      .att-cell.today{box-shadow:inset 0 0 0 1px rgba(139,92,246,.35)}
      .att-cell .comment-dot{
        position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:50%;
        background:#f1f3f5;box-shadow:0 0 0 2px rgba(0,0,0,.25)
      }
      .att-summary-head,.att-summary{
        min-width:205px;max-width:205px;background:#12151c!important;
        position:sticky;right:0;z-index:6
      }
      .att-summary-head{z-index:8;padding:10px!important}
      .att-summary{padding:8px 10px!important;text-align:left!important}
      .att-summary-grid{
        display:grid;grid-template-columns:repeat(5,1fr);gap:4px
      }
      .att-summary-grid div{
        padding:5px 3px;border-radius:7px;background:#0d0f14;
        text-align:center;font-size:9px;color:#8f96a3
      }
      .att-summary-grid b{display:block;color:#e7e9ee;font-size:11px}
      .att-empty{
        padding:42px;text-align:center;color:#7f8794
      }
      .attendance-dialog-card{width:min(610px,92vw)}
      .att-status-picker{
        display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px
      }
      .att-status-btn{
        border:1px solid #2b303c;background:#141720;color:#c8cdd6;
        min-height:58px;border-radius:11px;cursor:pointer;font-weight:900
      }
      .att-status-btn small{
        display:block;margin-top:3px;font-size:9px;font-weight:600;opacity:.78
      }
      .att-status-btn.selected{
        outline:2px solid #8b5cf6;outline-offset:1px;filter:brightness(1.15)
      }
      .att-meta{
        display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px
      }
      .att-meta>div{
        padding:10px;border:1px solid #222631;background:#0f1117;border-radius:10px
      }
      .att-meta span{display:block;color:#737b88;font-size:10px;margin-bottom:4px}
      .att-meta b{font-size:12px}
      .att-history-list{display:grid;gap:8px;margin-top:10px}
      .att-history-item{
        padding:10px 12px;border:1px solid #242936;background:#0f1117;border-radius:11px
      }
      .att-history-head{display:flex;justify-content:space-between;gap:12px}
      .att-history-head b{font-size:12px}
      .att-history-head span{font-size:10px;color:#737b88}
      .att-history-body{font-size:11px;color:#aeb4bf;margin-top:5px;line-height:1.45}
      @media(max-width:900px){
        .att-status-picker{grid-template-columns:repeat(2,1fr)}
        .attendance-table .att-person-head,.attendance-table .att-person{
          min-width:190px;max-width:190px
        }
        .att-summary-head,.att-summary{position:static}
      }
    `;
    document.head.appendChild(style);
  }

  function monthLabel(isoDate) {
    if (!isoDate) return 'Текущий месяц';
    const d = new Date(`${isoDate}T12:00:00Z`);
    const s = new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function isoDay(monthStart, day) {
    const [y, m] = String(monthStart).split('-').map(Number);
    return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function weekdayShort(monthStart, day) {
    const [y, m] = String(monthStart).split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day, 12));
    return new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      timeZone: 'UTC'
    }).format(d).replace('.', '');
  }

  function dateHuman(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function defaultAttendanceRegionCode() {
    const selected = $('#regionSelect')?.value;
    if (selected && selected !== 'all' && REGIONS[selected]) return selected;

    if (REGIONS.kharkiv && ['owner','boss'].includes(currentUser?.role)) {
      return 'kharkiv';
    }

    const allowed = allowedRegionCodes();
    return allowed[0] || Object.keys(REGIONS)[0] || null;
  }

  async function getArchiveMonths() {
    if (currentUser?.role !== 'owner') return [];
    const { data, error } = await sb.rpc('attendance_archive_months');
    if (error) throw error;
    attendanceArchiveCache = Array.isArray(data) ? data : [];
    return attendanceArchiveCache;
  }

  function ensureAttendanceDialog() {
    let d = document.getElementById('attendanceDialog');
    if (d) return d;

    d = document.createElement('dialog');
    d.id = 'attendanceDialog';
    d.className = 'dialog';
    d.innerHTML = '<div id="attendanceDialogBody"></div>';
    document.body.appendChild(d);
    return d;
  }

  function statusButtonClass(code) {
    const cls = ATT_STATUS_CLASS[code];
    return cls ? `att-${cls}` : '';
  }

  function entryMapFromPayload(payload) {
    const map = new Map();
    for (const e of payload?.entries || []) {
      map.set(`${e.userId}|${e.date}`, e);
    }
    return map;
  }

  function statusCountsForUser(payload, userId) {
    const counts = {'1':0,'1В':0,'1Л':0,'В':0,'Л':0};
    for (const e of payload?.entries || []) {
      if (e.userId === userId && Object.prototype.hasOwnProperty.call(counts, e.status)) {
        counts[e.status]++;
      }
    }
    return counts;
  }

  function renderSummary(counts) {
    return `
      <div class="att-summary-grid">
        <div><b>${counts['1']}</b>1</div>
        <div><b>${counts['1В']}</b>1В</div>
        <div><b>${counts['1Л']}</b>1Л</div>
        <div><b>${counts['В']}</b>В</div>
        <div><b>${counts['Л']}</b>Л</div>
      </div>
    `;
  }

  function renderAttendanceTable(payload) {
    const staff = payload?.staff || [];
    const entries = entryMapFromPayload(payload);
    const today = todayKyiv();

    if (!staff.length) {
      return '<div class="att-empty"><b>В этом регионе пока нет сотрудников для табеля.</b></div>';
    }

    const dayHeads = [];
    for (let day = 1; day <= Number(payload.daysInMonth || 31); day++) {
      const date = isoDay(payload.monthStart, day);
      dayHeads.push(`
        <th class="att-day-head ${date === today ? 'today' : ''}">
          <b>${String(day).padStart(2,'0')}</b>
          <span>${esc(weekdayShort(payload.monthStart, day))}</span>
        </th>
      `);
    }

    const rows = staff.map(person => {
      const cells = [];

      for (let day = 1; day <= Number(payload.daysInMonth || 31); day++) {
        const date = isoDay(payload.monthStart, day);
        const entry = entries.get(`${person.userId}|${date}`) || null;
        const cls = entry ? statusButtonClass(entry.status) : '';
        const canOpen = !!entry || !!payload.canEdit;
        const modeCls = payload.canEdit ? 'editable' : (entry ? 'readable' : '');
        const titleParts = [];

        if (entry) {
          titleParts.push(`${entry.status} — ${ATT_STATUS_LABEL[entry.status] || entry.status}`);
          if (entry.comment) titleParts.push(`Комментарий: ${entry.comment}`);
          if (entry.updatedByName) titleParts.push(`Изменил: ${entry.updatedByName}`);
        } else if (payload.canEdit) {
          titleParts.push('Нажмите, чтобы поставить отметку');
        }

        cells.push(`
          <td class="att-cell ${cls} ${modeCls} ${date === today ? 'today' : ''}"
              ${canOpen ? `data-att-user="${esc(person.userId)}" data-att-date="${esc(date)}"` : ''}
              title="${esc(titleParts.join('\n'))}">
            ${entry ? esc(entry.status) : '·'}
            ${entry?.comment ? '<i class="comment-dot"></i>' : ''}
          </td>
        `);
      }

      const counts = statusCountsForUser(payload, person.userId);
      const roleLabel = person.role === 'senior' ? 'Старший оператор' : 'Оператор';

      return `
        <tr>
          <td class="att-person">
            <b>${esc(person.fullName)}</b>
            <span>${esc(roleLabel)}</span>
          </td>
          ${cells.join('')}
          <td class="att-summary">${renderSummary(counts)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="attendance-table-wrap">
        <table class="attendance-table">
          <thead>
            <tr>
              <th class="att-person-head">Сотрудник</th>
              ${dayHeads.join('')}
              <th class="att-summary-head">Итого за месяц</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function loadAttendancePayload(regionId, monthStart) {
    const { data, error } = await sb.rpc('attendance_month_payload', {
      p_region_id: regionId,
      p_month_start: monthStart || null
    });
    if (error) throw error;
    return data || {};
  }

  async function showAttendanceHistory(entry) {
    if (!entry?.id) return;

    const body = document.getElementById('attendanceHistoryArea');
    if (!body) return;

    body.innerHTML = '<div class="loading-line">Загрузка истории…</div>';

    const { data, error } = await sb.rpc('attendance_entry_history', {
      p_entry_id: entry.id
    });

    if (error) {
      body.innerHTML = `<div class="empty"><b>Не удалось загрузить историю</b>${esc(error.message || '')}</div>`;
      return;
    }

    const history = Array.isArray(data) ? data : [];

    if (!history.length) {
      body.innerHTML = '<div class="muted small">История пока пустая.</div>';
      return;
    }

    const actionLabel = {
      create: 'Отметка создана',
      update: 'Отметка изменена',
      delete: 'Отметка удалена'
    };

    body.innerHTML = `
      <div class="att-history-list">
        ${history.map(h => {
          const statusChange = h.oldStatus !== h.newStatus
            ? `${h.oldStatus || '—'} → ${h.newStatus || '—'}`
            : (h.newStatus || h.oldStatus || '—');

          let commentText = '';
          if ((h.oldComment || '') !== (h.newComment || '')) {
            commentText = `<div>Комментарий: ${esc(h.oldComment || '—')} → ${esc(h.newComment || '—')}</div>`;
          }

          return `
            <div class="att-history-item">
              <div class="att-history-head">
                <b>${esc(actionLabel[h.action] || h.action)}</b>
                <span>${esc(fmtDateTime(h.changedAt))}</span>
              </div>
              <div class="att-history-body">
                <div>${esc(h.actorName || 'Система')} · ${esc(statusChange)}</div>
                ${commentText}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function openAttendanceCell(userId, date) {
    const payload = attendanceLastPayload;
    if (!payload) return;

    const person = (payload.staff || []).find(x => x.userId === userId);
    if (!person) return;

    const entry = (payload.entries || []).find(x => x.userId === userId && x.date === date) || null;

    if (!payload.canEdit && !entry) return;

    const d = ensureAttendanceDialog();
    const body = document.getElementById('attendanceDialogBody');

    let selectedStatus = entry?.status || '1';

    body.innerHTML = `
      <div class="dialog-card attendance-dialog-card">
        <div class="dialog-head">
          <div>
            <h3>${esc(person.fullName)}</h3>
            <p class="muted">${esc(dateHuman(date))} · ${esc(payload.regionName || '')}</p>
          </div>
          <button type="button" class="close-x" id="attendanceClose">×</button>
        </div>

        ${payload.canEdit ? `
          <label>Статус</label>
          <div class="att-status-picker">
            ${Object.entries(ATT_STATUS_LABEL).map(([code,label]) => `
              <button type="button"
                      class="att-status-btn ${statusButtonClass(code)} ${selectedStatus === code ? 'selected' : ''}"
                      data-status="${esc(code)}">
                ${esc(code)}
                <small>${esc(label)}</small>
              </button>
            `).join('')}
          </div>

          <label style="margin-top:14px">
            Комментарий к дню
            <textarea id="attendanceComment"
                      placeholder="Необязательно">${esc(entry?.comment || '')}</textarea>
          </label>
        ` : `
          <div class="detail-grid">
            <div class="detail">
              <div class="k">Статус</div>
              <div class="v">${esc(entry?.status || '—')} ${entry?.status ? `· ${esc(ATT_STATUS_LABEL[entry.status] || '')}` : ''}</div>
            </div>
            <div class="detail full">
              <div class="k">Комментарий</div>
              <div class="v">${esc(entry?.comment || '—')}</div>
            </div>
          </div>
        `}

        ${entry ? `
          <div class="att-meta">
            <div>
              <span>Поставил</span>
              <b>${esc(entry.createdByName || '—')}</b>
              <div class="muted small">${esc(fmtDateTime(entry.createdAt))}</div>
            </div>
            <div>
              <span>Последнее изменение</span>
              <b>${esc(entry.updatedByName || '—')}</b>
              <div class="muted small">${esc(fmtDateTime(entry.updatedAt))}</div>
            </div>
          </div>
        ` : ''}

        <div id="attendanceHistoryArea"></div>

        <div class="dialog-actions">
          ${entry ? '<button type="button" class="btn ghost" id="attendanceHistoryBtn">История</button>' : ''}
          ${payload.canEdit && entry ? '<button type="button" class="btn danger" id="attendanceClearBtn">Очистить</button>' : ''}
          <button type="button" class="btn ghost" id="attendanceCancelBtn">Закрыть</button>
          ${payload.canEdit ? '<button type="button" class="btn primary" id="attendanceSaveBtn">Сохранить</button>' : ''}
        </div>
      </div>
    `;

    d.showModal();

    document.getElementById('attendanceClose').onclick = () => d.close();
    document.getElementById('attendanceCancelBtn').onclick = () => d.close();

    $$('.att-status-btn', body).forEach(btn => {
      btn.onclick = () => {
        selectedStatus = btn.dataset.status;
        $$('.att-status-btn', body).forEach(x => x.classList.toggle('selected', x === btn));
      };
    });

    const historyBtn = document.getElementById('attendanceHistoryBtn');
    if (historyBtn) historyBtn.onclick = () => showAttendanceHistory(entry);

    const clearBtn = document.getElementById('attendanceClearBtn');
    if (clearBtn) {
      clearBtn.onclick = async () => {
        if (!confirm(`Очистить отметку ${person.fullName} за ${dateHuman(date)}?`)) return;
        setBusy(clearBtn, true, 'Очищаем…');
        try {
          const { error } = await sb.rpc('attendance_set_entry', {
            p_region_id: payload.regionId,
            p_user_id: userId,
            p_attendance_date: date,
            p_status: null,
            p_comment: null
          });
          if (error) throw error;
          d.close();
          toast('Отметка очищена');
          await renderAttendancePage();
        } catch (err) {
          toast(err.message || 'Не удалось очистить отметку', true);
        } finally {
          setBusy(clearBtn, false);
        }
      };
    }

    const saveBtn = document.getElementById('attendanceSaveBtn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const comment = document.getElementById('attendanceComment')?.value || '';
        setBusy(saveBtn, true, 'Сохраняем…');

        try {
          const { error } = await sb.rpc('attendance_set_entry', {
            p_region_id: payload.regionId,
            p_user_id: userId,
            p_attendance_date: date,
            p_status: selectedStatus,
            p_comment: comment
          });

          if (error) throw error;

          d.close();
          toast('Табель сохранён');
          await renderAttendancePage();
        } catch (err) {
          toast(err.message || 'Не удалось сохранить табель', true);
        } finally {
          setBusy(saveBtn, false);
        }
      };
    }
  }

  function bindAttendanceCells() {
    $$('.att-cell[data-att-user]').forEach(cell => {
      cell.onclick = () => openAttendanceCell(cell.dataset.attUser, cell.dataset.attDate);
    });
  }

  async function renderAttendancePage() {
    injectAttendanceStyles();

    if (!currentUser) return;

    if (currentUser.role !== 'owner') {
      attendanceSelectedMonth = null;
      attendanceArchiveCache = null;
    }

    let regionCode = defaultAttendanceRegionCode();
    if (!regionCode || !REGIONS[regionCode]) {
      $('#content').innerHTML = '<div class="empty"><b>Регион не назначен</b>Обратись к владельцу системы.</div>';
      return;
    }

    const regionSelect = $('#regionSelect');
    if (regionSelect && regionSelect.value === 'all') {
      regionSelect.value = regionCode;
    } else if (regionSelect?.value && regionSelect.value !== 'all') {
      regionCode = regionSelect.value;
    }

    const region = REGIONS[regionCode];
    $('#pageTitle').textContent = 'Табель посещения';
    $('#pageEyebrow').textContent = region?.eyebrow || (region?.name || regionCode).toUpperCase();
    $('#content').innerHTML = '<div class="loading-line">Загрузка табеля…</div>';

    try {
      const payloadPromise = loadAttendancePayload(region.id, attendanceSelectedMonth);
      const archivePromise = currentUser.role === 'owner'
        ? getArchiveMonths()
        : Promise.resolve([]);

      const [payload, archiveMonths] = await Promise.all([payloadPromise, archivePromise]);
      attendanceLastPayload = payload;

      const currentOption = `<option value="">Текущий · ${esc(monthLabel(payload.isArchive ? null : payload.monthStart))}</option>`;
      const archiveOptions = archiveMonths.map(x => `
        <option value="${esc(x.month_start)}" ${attendanceSelectedMonth === x.month_start ? 'selected' : ''}>
          Архив · ${esc(monthLabel(x.month_start))}
        </option>
      `).join('');

      $('#content').innerHTML = `
        <div class="panel" style="margin-top:0">
          <div class="attendance-top">
            <div>
              <h3>${esc(payload.regionName || region.name)} · ${esc(monthLabel(payload.monthStart))}</h3>
              <div class="muted small" style="margin-top:5px">
                ${payload.canEdit
                  ? 'Можно заполнять и исправлять отметки.'
                  : 'Режим просмотра. Изменение табеля недоступно.'}
              </div>

              <div class="attendance-legend">
                ${Object.entries(ATT_STATUS_LABEL).map(([code,label]) => `
                  <span class="att-legend-item">
                    <span class="att-legend-code ${statusButtonClass(code)}">${esc(code)}</span>
                    ${esc(label)}
                  </span>
                `).join('')}
              </div>
            </div>

            ${currentUser.role === 'owner' ? `
              <div class="attendance-controls">
                <select id="attendanceMonthSelect">
                  ${currentOption}
                  ${archiveOptions}
                </select>
              </div>
            ` : ''}
          </div>

          ${payload.isArchive ? `
            <div class="attendance-archive-note">
              Архивный табель. Этот месяц доступен только владельцу PRIZ Control.
              Ты можешь просматривать и исправлять архивные отметки.
            </div>
          ` : ''}

          ${renderAttendanceTable(payload)}
        </div>
      `;

      const monthSelect = document.getElementById('attendanceMonthSelect');
      if (monthSelect) {
        monthSelect.value = attendanceSelectedMonth || '';
        monthSelect.onchange = async () => {
          attendanceSelectedMonth = monthSelect.value || null;
          await renderAttendancePage();
        };
      }

      bindAttendanceCells();
    } catch (err) {
      console.error(err);
      $('#content').innerHTML = `
        <div class="empty">
          <b>Не удалось открыть табель</b>
          ${esc(err.message || 'Ошибка загрузки')}
        </div>
      `;
    }
  }

  buildShell = function (...args) {
    const result = originalBuildShell.apply(this, args);

    const nav = document.getElementById('nav');
    if (!nav || nav.querySelector('[data-page="attendance"]')) return result;

    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.page = 'attendance';
    btn.innerHTML = '<span class="nav-ico">▦</span>Табель';

    const recordsBtn = nav.querySelector('[data-page="records"]');
    if (recordsBtn?.nextSibling) {
      nav.insertBefore(btn, recordsBtn.nextSibling);
    } else if (recordsBtn) {
      nav.appendChild(btn);
    } else {
      nav.prepend(btn);
    }

    btn.onclick = () => go('attendance');
    return result;
  };

  go = function (page) {
    if (page === 'attendance') {
      currentPage = 'attendance';
      $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === 'attendance'));
      renderPage();
      return;
    }

    return originalGo(page);
  };

  renderPage = async function (...args) {
    if (currentPage === 'attendance') {
      return renderAttendancePage();
    }

    return originalRenderPage.apply(this, args);
  };

  injectAttendanceStyles();
})();
