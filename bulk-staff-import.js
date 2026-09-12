(() => {
  const STAFF = [
    {name:'МАРЧЕНКО Юлія Володимирівна', role:'operator', regions:['kyiv','chernihiv']},
    {name:'Волошин Олександр Віталійович', role:'operator', regions:['kyiv','chernihiv']},

    {name:'Воленко Андрій Миколайович', role:'senior', regions:['zaporizhzhia']},
    {name:'Дума Аліса Сергіївна', role:'operator', regions:['zaporizhzhia']},
    {name:'Калашніков Максим Володимирович', role:'operator', regions:['zaporizhzhia']},

    {name:'Куземченко Світлана Євгенівна', role:'senior', regions:['zhytomyr']},
    {name:'Пожидаєва Тетяна Володимирівна', role:'operator', regions:['zhytomyr']},
    {name:'Лісовик Катерина Петрівна', role:'operator', regions:['zhytomyr']},
    {name:'Вербицька Оксана Юріївна', role:'operator', regions:['zhytomyr']},

    {name:'Іванов Владислав', role:'operator', regions:['dnipro']},
    {name:'Школа Анна', role:'senior', regions:['dnipro']},
    {name:'Гальченко Алла', role:'operator', regions:['dnipro']},
    {name:"Мар'ясич Ліна", role:'operator', regions:['dnipro']},

    {name:'Оцвій Н.О.', role:'senior', regions:['bila_tserkva']},
    {name:'Король М.В.', role:'operator', regions:['bila_tserkva']},
    {name:'Горбачова К.С.', role:'operator', regions:['bila_tserkva']},
    {name:'Клименко І.І.', role:'operator', regions:['bila_tserkva']},
    {name:'Колодник О.Г.', role:'operator', regions:['bila_tserkva']},

    {name:'Щепановська Юлія', role:'senior', regions:['kryvyi_rih']},
    {name:'Сумінський Ян', role:'operator', regions:['kryvyi_rih']},
    {name:'Самофал Олександр', role:'operator', regions:['kryvyi_rih']},
    {name:'Фастовець Наталя', role:'operator', regions:['kryvyi_rih']},

    {name:'Тішина Марта Василівна', role:'senior', regions:['odesa']},
    {name:'Мазур Тетьяна Володимирівна', role:'operator', regions:['odesa']},
    {name:'Закревська Олена Георгіївна', role:'operator', regions:['odesa']},
    {name:'Рибасова Олена Олександрівна', role:'operator', regions:['odesa']}
  ];

  const originalRenderSettingsBulkStaff = renderSettings;

  const tr = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ё':'e','ж':'zh','з':'z',
    'и':'y','і':'i','ї':'yi','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ы':'y',
    'ь':'','ъ':'','э':'e','ю':'yu','я':'ya'
  };

  function latin(s='') {
    return String(s).toLowerCase().split('').map(ch => tr[ch] ?? ch)
      .join('')
      .replace(/[^a-z0-9]+/g,'.')
      .replace(/^\.+|\.+$/g,'')
      .replace(/\.{2,}/g,'.');
  }

  function baseLogin(fullName) {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    const surname = latin(parts[0] || 'staff').replace(/\./g,'');
    const first = latin(parts[1] || 'x').replace(/\./g,'');
    return `${surname}.${(first[0] || 'x')}`.slice(0, 42);
  }

  function randomPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const arr = Array.from(crypto.getRandomValues(new Uint32Array(14)), n => alphabet[n % alphabet.length]);
    return `Pz#${arr.join('')}!`;
  }

  async function uniqueLogin(base, existing) {
    let candidate = base;
    let i = 2;
    while (existing.has(candidate)) candidate = `${base}${i++}`;
    existing.add(candidate);
    return candidate;
  }

  function escBulk(s='') {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  async function openBulkStaffImport() {
    if (currentUser?.role !== 'owner') return;

    const d = document.getElementById('userDialog');
    const body = document.getElementById('userDialogBody');

    body.innerHTML = `
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>Массовое добавление сотрудников</h3>
            <p class="muted">Подготовлено ${STAFF.length} сотрудников из текущего списка.</p>
          </div>
          <button type="button" class="close-x" id="bulkClose">×</button>
        </div>
        <div class="notice">
          Обычным операторам персональный вход будет автоматически отключён.
          Старшим операторам будут созданы личные логины и временные пароли.
        </div>
        <div id="bulkPreview" style="max-height:42vh;overflow:auto;margin-top:14px"></div>
        <div id="bulkProgress" class="server-note" style="margin-top:12px">Готово к импорту.</div>
        <div id="bulkResults" class="hidden" style="margin-top:14px"></div>
        <div class="dialog-actions">
          <button type="button" class="btn ghost" id="bulkCancel">Отмена</button>
          <button type="button" class="btn primary" id="bulkStart">Создать ${STAFF.length} сотрудников</button>
        </div>
      </div>`;

    const regionLabel = code => REGIONS?.[code]?.name || code;
    document.getElementById('bulkPreview').innerHTML = STAFF.map((x, i) => `
      <div class="user-row">
        <div>
          <b>${i + 1}. ${escBulk(x.name)}</b>
          <span>${x.regions.map(regionLabel).join(', ')}</span>
        </div>
        <div class="role-pill">${x.role === 'senior' ? 'Старший оператор' : 'Оператор'}</div>
      </div>`).join('');

    d.showModal();
    const close = () => d.close();
    document.getElementById('bulkClose').onclick = close;
    document.getElementById('bulkCancel').onclick = close;

    document.getElementById('bulkStart').onclick = async () => {
      const btn = document.getElementById('bulkStart');
      const progress = document.getElementById('bulkProgress');
      const results = document.getElementById('bulkResults');
      btn.disabled = true;
      btn.textContent = 'Создаём…';

      const { data: existingProfiles, error: profileErr } = await sb
        .from('profiles')
        .select('id,username,full_name,role,is_shared_region_account,login_enabled');
      if (profileErr) {
        toast(profileErr.message || 'Не удалось прочитать профили', true);
        btn.disabled = false;
        btn.textContent = `Создать ${STAFF.length} сотрудников`;
        return;
      }

      const byName = new Map((existingProfiles || []).map(p => [String(p.full_name || '').trim().toLowerCase(), p]));
      const existingLogins = new Set((existingProfiles || []).map(p => String(p.username || '').trim().toLowerCase()));
      const created = [];
      const skipped = [];
      const failed = [];
      const seniorCredentials = [];

      for (let i = 0; i < STAFF.length; i++) {
        const item = STAFF[i];
        progress.textContent = `${i + 1} из ${STAFF.length}: ${item.name}`;

        const key = item.name.trim().toLowerCase();
        if (byName.has(key)) {
          skipped.push(`${item.name} — уже существует`);
          continue;
        }

        const regionIds = item.regions.map(code => REGIONS?.[code]?.id).filter(Boolean);
        if (regionIds.length !== item.regions.length) {
          failed.push(`${item.name} — не найден регион`);
          continue;
        }

        try {
          const login = await uniqueLogin(baseLogin(item.name), existingLogins);
          const password = randomPassword();

          await invokeAdminUsers({
            action: 'create',
            username: login,
            fullName: item.name,
            password,
            role: item.role,
            regionIds
          });

          const { data: profile, error: findErr } = await sb
            .from('profiles')
            .select('id,username,full_name')
            .eq('username', login)
            .maybeSingle();

          if (findErr) throw findErr;

          if (item.role === 'operator' && profile?.id) {
            const { error: disableErr } = await sb
              .from('profiles')
              .update({ login_enabled: false })
              .eq('id', profile.id);
            if (disableErr) throw disableErr;
          }

          created.push(`${item.name} — ${login}`);
          byName.set(key, profile || {username: login, full_name: item.name});

          if (item.role === 'senior') {
            seniorCredentials.push({
              name: item.name,
              login,
              password,
              regions: item.regions.map(regionLabel).join(', ')
            });
          }
        } catch (err) {
          failed.push(`${item.name} — ${err?.message || 'ошибка'}`);
        }
      }

      progress.textContent = `Готово. Создано: ${created.length}. Уже были: ${skipped.length}. Ошибок: ${failed.length}.`;

      const creds = seniorCredentials.length
        ? `<div class="settings-card">
             <h4>Данные старших операторов — сохрани</h4>
             <textarea readonly style="width:100%;min-height:190px;box-sizing:border-box">${escBulk(
               seniorCredentials.map(x =>
                 `${x.name}\nЛогин: ${x.login}\nВременный пароль: ${x.password}\nРегионы: ${x.regions}`
               ).join('\n\n')
             )}</textarea>
           </div>`
        : '';

      const errors = failed.length
        ? `<div class="settings-card"><h4>Не удалось создать</h4><div class="muted small">${failed.map(escBulk).join('<br>')}</div></div>`
        : '';

      const skips = skipped.length
        ? `<div class="server-note">Пропущено как уже существующие: ${skipped.length}</div>`
        : '';

      results.innerHTML = `${creds}${errors}${skips}`;
      results.classList.remove('hidden');
      btn.textContent = 'Импорт завершён';
      toast(failed.length ? 'Импорт завершён с ошибками' : 'Сотрудники добавлены', !!failed.length);

      try { await renderSettings(); } catch (_) {}
    };
  }

  function attachBulkButton() {
    if (currentUser?.role !== 'owner') return;
    const add = document.getElementById('addUserBtn');
    if (!add || document.getElementById('bulkAddStaffBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'bulkAddStaffBtn';
    btn.className = 'btn ghost small-btn';
    btn.textContent = '+ Массово';
    btn.onclick = openBulkStaffImport;
    add.parentElement?.insertBefore(btn, add);
  }

  renderSettings = async function (...args) {
    const out = await originalRenderSettingsBulkStaff.apply(this, args);
    attachBulkButton();
    return out;
  };
})();
