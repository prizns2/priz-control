(() => {
  const originalRenderSettingsBulkManagers = renderSettings;

  const tr = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ё':'e','ж':'zh','з':'z',
    'и':'y','і':'i','ї':'yi','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ы':'y',
    'ь':'','ъ':'','э':'e','ю':'yu','я':'ya'
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function latin(s='') {
    return String(s).toLowerCase().split('').map(ch => tr[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g,'.')
      .replace(/^\.+|\.+$/g,'')
      .replace(/\.{2,}/g,'.');
  }

  function baseLogin(fullName) {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    const surname = latin(parts[0] || 'manager').replace(/\./g,'');
    const first = latin(parts[1] || 'x').replace(/\./g,'');
    return `${surname}.${(first[0] || 'x')}`.slice(0, 42);
  }

  function randomPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const arr = Array.from(crypto.getRandomValues(new Uint32Array(14)), n => alphabet[n % alphabet.length]);
    return `Pm#${arr.join('')}!`;
  }

  function escBulkManager(s='') {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function isVacancy(name='') {
    return /^\s*ваканс(?:ия|ія)\s*$/i.test(String(name));
  }

  function regionNameById(regionId) {
    return REGION_BY_UUID?.[regionId]?.name || 'Регион';
  }

  async function loadManagerImportData() {
    const [{ data: managers, error: mErr }, { data: profiles, error: pErr }] = await Promise.all([
      sb.from('managers')
        .select('id,full_name,region_id,is_active')
        .eq('is_active', true)
        .order('full_name'),
      sb.from('profiles')
        .select('id,username,full_name,role,manager_id,is_active,login_enabled')
    ]);

    if (mErr) throw mErr;
    if (pErr) throw pErr;

    const linkedByManager = new Map(
      (profiles || [])
        .filter(p => p.manager_id)
        .map(p => [p.manager_id, p])
    );

    const vacancies = (managers || []).filter(m => isVacancy(m.full_name));
    const alreadyLinked = (managers || []).filter(m => !isVacancy(m.full_name) && linkedByManager.has(m.id));
    const candidates = (managers || [])
      .filter(m => !isVacancy(m.full_name) && !linkedByManager.has(m.id))
      .sort((a,b) => {
        const ra = regionNameById(a.region_id);
        const rb = regionNameById(b.region_id);
        return ra.localeCompare(rb, 'ru') || String(a.full_name).localeCompare(String(b.full_name), 'ru');
      });

    return { managers: managers || [], profiles: profiles || [], linkedByManager, vacancies, alreadyLinked, candidates };
  }

  function uniqueLogin(base, existing) {
    let candidate = base;
    let i = 2;
    while (existing.has(candidate)) candidate = `${base}${i++}`;
    existing.add(candidate);
    return candidate;
  }

  async function createManagerWithRetry(payload, attempts=3) {
    let lastErr;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await invokeAdminUsers(payload);
      } catch (err) {
        lastErr = err;
        if (attempt >= attempts) break;
        await sleep(900 * attempt);
      }
    }
    throw lastErr;
  }

  function groupCounts(items) {
    const map = new Map();
    for (const item of items) {
      const name = regionNameById(item.region_id);
      map.set(name, (map.get(name) || 0) + 1);
    }
    return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0], 'ru'));
  }

  async function openBulkManagerImport() {
    if (currentUser?.role !== 'owner') return;

    const d = document.getElementById('userDialog');
    const body = document.getElementById('userDialogBody');

    body.innerHTML = `
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>Массовое создание аккаунтов менеджеров</h3>
            <p class="muted">Загружаем актуальный справочник менеджеров из базы…</p>
          </div>
          <button type="button" class="close-x" id="bulkManagerClose">×</button>
        </div>
        <div id="bulkManagerLoading" class="server-note">Подготавливаем список…</div>
        <div id="bulkManagerContent" class="hidden"></div>
      </div>`;

    d.showModal();
    document.getElementById('bulkManagerClose').onclick = () => d.close();

    let prepared;
    try {
      prepared = await loadManagerImportData();
    } catch (err) {
      document.getElementById('bulkManagerLoading').textContent = `Ошибка: ${err?.message || 'не удалось загрузить менеджеров'}`;
      return;
    }

    const { candidates, alreadyLinked, vacancies, profiles } = prepared;
    const counts = groupCounts(candidates);
    const content = document.getElementById('bulkManagerContent');
    document.getElementById('bulkManagerLoading').classList.add('hidden');
    content.classList.remove('hidden');

    content.innerHTML = `
      <div class="notice">
        Будут созданы личные аккаунты роли <b>Менеджер</b> и привязаны к конкретному manager_id.
        Каждый менеджер увидит только свои магазины и записи. Вакансии не создаются.
      </div>

      <div class="settings-grid" style="margin-top:12px">
        <div class="settings-card">
          <h4>К созданию</h4>
          <div style="font-size:30px;font-weight:850">${candidates.length}</div>
        </div>
        <div class="settings-card">
          <h4>Уже имеют аккаунт</h4>
          <div style="font-size:30px;font-weight:850">${alreadyLinked.length}</div>
        </div>
      </div>

      <div class="server-note" style="margin-top:12px">
        ${counts.map(([region,count]) => `${escBulkManager(region)}: ${count}`).join(' · ')}
        ${vacancies.length ? ` · Вакансии исключены: ${vacancies.length}` : ''}
      </div>

      <div id="bulkManagerPreview" style="max-height:42vh;overflow:auto;margin-top:14px">
        ${candidates.map((x,i) => `
          <div class="user-row">
            <div>
              <b>${i + 1}. ${escBulkManager(x.full_name)}</b>
              <span>${escBulkManager(regionNameById(x.region_id))}</span>
            </div>
            <div class="role-pill">Менеджер</div>
          </div>`).join('') || '<div class="empty"><b>Создавать нечего</b>Все активные менеджеры уже имеют аккаунты.</div>'}
      </div>

      <div id="bulkManagerProgress" class="server-note" style="margin-top:12px">Готово к созданию.</div>
      <div id="bulkManagerResults" class="hidden" style="margin-top:14px"></div>

      <div class="dialog-actions">
        <button type="button" class="btn ghost" id="bulkManagerCancel">Отмена</button>
        <button type="button" class="btn primary" id="bulkManagerStart" ${candidates.length ? '' : 'disabled'}>
          Создать ${candidates.length} аккаунтов
        </button>
      </div>`;

    document.getElementById('bulkManagerCancel').onclick = () => d.close();

    document.getElementById('bulkManagerStart').onclick = async () => {
      const btn = document.getElementById('bulkManagerStart');
      const progress = document.getElementById('bulkManagerProgress');
      const results = document.getElementById('bulkManagerResults');
      btn.disabled = true;
      btn.textContent = 'Создаём…';

      const existingLogins = new Set((profiles || []).map(p => String(p.username || '').trim().toLowerCase()).filter(Boolean));
      const created = [];
      const failed = [];
      const skipped = [];
      const credentials = [];

      for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        progress.textContent = `${i + 1} из ${candidates.length}: ${item.full_name} · ${regionNameById(item.region_id)}`;

        try {
          const { data: recheck, error: recheckErr } = await sb
            .from('profiles')
            .select('id,username,manager_id')
            .eq('manager_id', item.id)
            .maybeSingle();

          if (recheckErr) throw recheckErr;
          if (recheck?.id) {
            skipped.push(`${item.full_name} — аккаунт уже появился`);
            continue;
          }

          const login = uniqueLogin(baseLogin(item.full_name), existingLogins);
          const password = randomPassword();

          await createManagerWithRetry({
            action: 'create',
            username: login,
            fullName: item.full_name,
            password,
            role: 'manager',
            regionIds: [],
            managerId: item.id
          });

          const { data: profile, error: verifyErr } = await sb
            .from('profiles')
            .select('id,username,full_name,role,manager_id,is_active,login_enabled')
            .eq('manager_id', item.id)
            .maybeSingle();

          if (verifyErr) throw verifyErr;
          if (!profile?.id || profile.role !== 'manager' || profile.manager_id !== item.id) {
            throw new Error('аккаунт создан, но привязка manager_id не подтверждена');
          }

          created.push(item.full_name);
          credentials.push({
            name: item.full_name,
            region: regionNameById(item.region_id),
            login,
            password
          });

          await sleep(120);
        } catch (err) {
          failed.push(`${item.full_name} — ${err?.message || 'ошибка'}`);
        }
      }

      progress.textContent = `Готово. Создано: ${created.length}. Пропущено: ${skipped.length}. Ошибок: ${failed.length}.`;

      const credentialText = credentials.map(x =>
        `${x.name}\nРегион: ${x.region}\nЛогин: ${x.login}\nВременный пароль: ${x.password}`
      ).join('\n\n');

      const creds = credentials.length
        ? `<div class="settings-card">
             <div class="panel-head compact-head">
               <h4>Данные менеджеров — обязательно сохрани</h4>
               <button type="button" class="btn ghost small-btn" id="bulkManagerCopy">Копировать все</button>
             </div>
             <textarea id="bulkManagerCredentials" readonly style="width:100%;min-height:260px;box-sizing:border-box">${escBulkManager(credentialText)}</textarea>
           </div>`
        : '';

      const errors = failed.length
        ? `<div class="settings-card"><h4>Не удалось создать</h4><div class="muted small">${failed.map(escBulkManager).join('<br>')}</div></div>`
        : '';

      const skips = skipped.length
        ? `<div class="server-note">Пропущено, потому что аккаунт уже существовал: ${skipped.length}</div>`
        : '';

      results.innerHTML = `${creds}${errors}${skips}`;
      results.classList.remove('hidden');
      btn.textContent = 'Создание завершено';

      document.getElementById('bulkManagerCopy')?.addEventListener('click', async () => {
        const text = document.getElementById('bulkManagerCredentials')?.value || '';
        try {
          await navigator.clipboard.writeText(text);
          toast('Логины и пароли скопированы');
        } catch (_) {
          const ta = document.getElementById('bulkManagerCredentials');
          ta?.focus();
          ta?.select();
          toast('Выделил данные — нажми Ctrl+C');
        }
      });

      toast(failed.length ? 'Создание менеджеров завершено с ошибками' : 'Аккаунты менеджеров созданы', !!failed.length);
    };
  }

  function attachBulkManagerButton() {
    if (currentUser?.role !== 'owner') return;
    const add = document.getElementById('addUserBtn');
    if (!add || document.getElementById('bulkAddManagersBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'bulkAddManagersBtn';
    btn.className = 'btn ghost small-btn';
    btn.textContent = '+ Менеджеры';
    btn.onclick = openBulkManagerImport;
    add.parentElement?.insertBefore(btn, add);
  }

  renderSettings = async function (...args) {
    const out = await originalRenderSettingsBulkManagers.apply(this, args);
    attachBulkManagerButton();
    return out;
  };
})();
