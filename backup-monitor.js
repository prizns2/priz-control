(() => {
  const originalRenderSettings = renderSettings;

  function formatKyivDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Kyiv',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  function backupAgeText(value) {
    if (!value) return 'нет данных';

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'нет данных';

    const diff = Math.max(0, Date.now() - d.getTime());
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;

    const hours = Math.floor(minutes / 60);

    if (hours < 48) return `${hours} ч назад`;

    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  }

  function backupVisual(data) {
    const status = String(data?.backupLastStatus || 'unknown');

    const last = data?.backupLastSuccessAt
      ? new Date(data.backupLastSuccessAt)
      : null;

    const ageHours =
      last && !Number.isNaN(last.getTime())
        ? (Date.now() - last.getTime()) / 3600000
        : Infinity;

    const stale = ageHours > 30;

    if (status === 'running') {
      return {
        label: 'ВЫПОЛНЯЕТСЯ',
        icon: '↻',
        border: '#5b4bb7',
        badgeBg: '#242038',
        badgeColor: '#c4b5fd',
        note: 'GitHub Actions сейчас создаёт резервную копию.'
      };
    }

    if (status === 'failed') {
      return {
        label: 'ОШИБКА',
        icon: '!',
        border: '#7f2b32',
        badgeBg: '#4a171b',
        badgeColor: '#fecaca',
        note: 'Последний запуск backup завершился ошибкой. Проверь GitHub Actions.'
      };
    }

    if (status === 'ok' && !stale) {
      return {
        label: 'АКТУАЛЬНО',
        icon: '✓',
        border: '#1f6f46',
        badgeBg: '#123023',
        badgeColor: '#86efac',
        note: 'Последняя резервная копия создана и проверена.'
      };
    }

    if (status === 'ok' && stale) {
      return {
        label: 'ПРОСРОЧЕН',
        icon: '!',
        border: '#8a5b12',
        badgeBg: '#322511',
        badgeColor: '#f7c870',
        note: 'Успешной копии не было больше 30 часов.'
      };
    }

    return {
      label: 'НЕТ ДАННЫХ',
      icon: '?',
      border: '#353946',
      badgeBg: '#242833',
      badgeColor: '#c7ccd6',
      note: 'Статус резервного копирования пока не получен.'
    };
  }

  async function renderBackupStatusPanel() {
    if (currentUser?.role !== 'owner') return;

    const root = document.getElementById('content');
    if (!root) return;

    const old = document.getElementById('backupStatusPanel');
    if (old) old.remove();

    let data = null;
    let error = null;

    try {
      const response = await sb.rpc('owner_usage_stats');
      data = response.data;
      error = response.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      console.warn('Backup status:', error);

      root.insertAdjacentHTML(
        'afterbegin',
        `
        <div id="backupStatusPanel"
             class="panel"
             style="margin-top:0;border-color:#7f2b32">

          <div class="panel-head" style="margin-bottom:0">

            <div>
              <h3>Резервное копирование</h3>
              <div class="muted small">
                Не удалось получить статус backup.
              </div>
            </div>

            <span class="badge"
                  style="background:#4a171b;color:#fecaca">
              ! ОШИБКА СТАТУСА
            </span>

          </div>
        </div>
        `
      );

      return;
    }

    const visual = backupVisual(data);

    const runId = String(
      data?.backupLastRunId || ''
    ).trim();

    const archive = String(
      data?.backupLastArchive || ''
    ).trim();

    root.insertAdjacentHTML(
      'afterbegin',
      `
      <div id="backupStatusPanel"
           class="panel"
           style="margin-top:0;border-color:${visual.border}">

        <div class="panel-head">

          <div>
            <h3>Резервное копирование</h3>

            <div class="muted small">
              Supabase → Backblaze B2 · автоматический запуск ежедневно в 04:17
            </div>
          </div>

          <span class="badge"
                style="
                  background:${visual.badgeBg};
                  color:${visual.badgeColor}
                ">
            ${visual.icon} ${visual.label}
          </span>

        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:10px
        ">

          <div class="detail">
            <div class="k">
              Последний успешный backup
            </div>

            <div class="v">
              ${formatKyivDateTime(data?.backupLastSuccessAt)}
            </div>
          </div>

          <div class="detail">
            <div class="k">
              Давность
            </div>

            <div class="v">
              ${backupAgeText(data?.backupLastSuccessAt)}
            </div>
          </div>

          <div class="detail">
            <div class="k">
              Статус
            </div>

            <div class="v">
              ${visual.label}
            </div>
          </div>

        </div>

        <div class="server-note"
             style="margin-top:12px">

          ${visual.note}

          ${
            archive
              ? `<br>Файл: <b>${esc(archive)}</b>`
              : ''
          }

        </div>

        ${
          runId
            ? `
          <div style="margin-top:12px">

            <a class="btn ghost small-btn"
               style="
                 display:inline-flex;
                 text-decoration:none
               "
               href="https://github.com/prizns2/priz-control/actions/runs/${encodeURIComponent(runId)}"
               target="_blank"
               rel="noopener noreferrer">

              Открыть GitHub Actions

            </a>
          </div>
          `
            : ''
        }

      </div>
      `
    );
  }

  renderSettings = async function (...args) {
    await originalRenderSettings.apply(this, args);
    await renderBackupStatusPanel();
  };
})();
