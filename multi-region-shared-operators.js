(() => {
  const GROUPS = [
    {
      key: 'kh_poltava_sumy',
      username: 'operator.kharkiv_poltava_sumy',
      fullName: 'Операторы Харьков · Полтава · Сумы',
      regions: ['kharkiv', 'poltava', 'sumy']
    },
    {
      key: 'kyiv_chernihiv',
      username: 'operator.kyiv_chernihiv',
      fullName: 'Операторы Киев · Чернигов',
      regions: ['kyiv', 'chernihiv']
    }
  ];

  const originalRenderSettingsMultiRegion = renderSettings;
  const originalBuildShellMultiRegion = buildShell;

  const escLocal = value => String(value ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));

  function randomPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const arr = Array.from(
      crypto.getRandomValues(new Uint32Array(14)),
      n => alphabet[n % alphabet.length]
    );
    return `Pr#${arr.join('')}!`;
  }

  function multiRegionCodes() {
    if (!currentUser?.isSharedRegionAccount) return [];
    const list = Array.isArray(currentUser?.regions)
      ? currentUser.regions.filter(code => !!REGIONS?.[code])
      : [];
    return [...new Set(list)];
  }

  function regionStorageKey() {
    return currentUser?.id ? `priz.sharedMultiRegion.${currentUser.id}` : null;
  }

  function applyMultiRegionSelect() {
    const select = document.getElementById('regionSelect');
    if (!select || !currentUser?.isSharedRegionAccount) return;

    const allowed = multiRegionCodes();
    if (allowed.length <= 1) return;

    const key = regionStorageKey();
    const saved = key ? sessionStorage.getItem(key) : null;
    const current = select.value;
    const wanted = allowed.includes(saved)
      ? saved
      : (allowed.includes(current) ? current : allowed[0]);

    const expected = allowed.join('|');
    if (select.dataset.multiRegionSet !== expected) {
      select.innerHTML = allowed.map(code =>
        `<option value="${escLocal(code)}">${escLocal(REGIONS[code]?.name || code)}</option>`
      ).join('');
      select.dataset.multiRegionSet = expected;
    }

    select.disabled = false;
    select.value = wanted;

    if (!select.dataset.multiRegionBound) {
      select.dataset.multiRegionBound = '1';
      select.addEventListener('change', () => {
        const nowAllowed = multiRegionCodes();
        if (!nowAllowed.includes(select.value)) return;
        const storageKey = regionStorageKey();
        if (storageKey) sessionStorage.setItem(storageKey, select.value);
      });
    }

    const card = document.getElementById('userCard');
    const regionSpan = card?.querySelector('span');
    if (regionSpan) {
      regionSpan.textContent = allowed
        .map(code => REGIONS[code]?.name || code)
        .join(' · ');
    }
  }

  buildShell = function (...args) {
    const result = originalBuildShellMultiRegion.apply(this, args);
    applyMultiRegionSelect();
    return result;
  };

  const observer = new MutationObserver(() => {
    if (!currentUser?.isSharedRegionAccount) return;
    if (multiRegionCodes().length <= 1) return;
    queueMicrotask(applyMultiRegionSelect);
  });

  const startObserver = () => {
    const app = document.getElementById('appView');
    if (!app) return;
    observer.observe(app, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled']
    });
    applyMultiRegionSelect();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  async function findProfileByUsername(username) {
    const { data, error } = await sb
      .from('profiles')
      .select('id,username,full_name,role,region_id,is_active,login_enabled,is_shared_region_account')
      .eq('username', username)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function configureGroupProfile(profile, group) {
    const regionIds = group.regions.map(code => REGIONS?.[code]?.id).filter(Boolean);
    if (regionIds.length !== group.regions.length) {
      throw new Error(`Не найдены регионы для ${group.fullName}`);
    }

    const { error: pErr } = await sb
      .from('profiles')
      .update({
        full_name: group.fullName,
        role: 'operator',
        region_id: regionIds[0],
        is_active: true,
        login_enabled: true,
        is_shared_region_account: true
      })
      .eq('id', profile.id);
    if (pErr) throw pErr;

    const { error: delErr } = await sb
      .from('user_regions')
      .delete()
      .eq('user_id', profile.id);
    if (delErr) throw delErr;

    const rows = regionIds.map(region_id => ({
      user_id: profile.id,
      region_id
    }));

    const { error: insErr } = await sb
      .from('user_regions')
      .insert(rows);
    if (insErr) throw insErr;
  }

  async function createOrConfigureGroup(group) {
    let profile = await findProfileByUsername(group.username);
    let password = null;
    let created = false;

    if (!profile) {
      password = randomPassword();
      const regionIds = group.regions.map(code => REGIONS?.[code]?.id).filter(Boolean);
      if (regionIds.length !== group.regions.length) {
        throw new Error(`Не найдены регионы для ${group.fullName}`);
      }

      await invokeAdminUsers({
        action: 'create',
        username: group.username,
        fullName: group.fullName,
        password,
        role: 'operator',
        regionIds
      });

      profile = await findProfileByUsername(group.username);
      if (!profile?.id) throw new Error('Профиль не появился после создания');
      created = true;
    }

    await configureGroupProfile(profile, group);

    return {
      ...group,
      profileId: profile.id,
      password,
      created
    };
  }

  async function loadGroupStatus() {
    const rows = [];
    for (const group of GROUPS) {
      const profile = await findProfileByUsername(group.username);
      rows.push({ group, profile });
    }
    return rows;
  }

  async function openMultiRegionSetup() {
    if (currentUser?.role !== 'owner') return;

    const d = document.getElementById('userDialog');
    const body = document.getElementById('userDialogBody');

    let status;
    try {
      status = await loadGroupStatus();
    } catch (err) {
      toast(err.message || 'Не удалось проверить мульти-региональные аккаунты', true);
      return;
    }

    body.innerHTML = `
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>Общие аккаунты для нескольких регионов</h3>
            <p class="muted">
              Личных паролей операторам не нужно. Группа входит под одним общим аккаунтом,
              выбирает себя и затем регион сверху.
            </p>
          </div>
          <button type="button" class="close-x" id="multiRegionClose">×</button>
        </div>

        <div class="notice">
          Будут настроены две группы: <b>Харьков / Полтава / Сумы</b> и
          <b>Киев / Чернигов</b>. Обычные региональные аккаунты останутся без изменений.
        </div>

        <div style="display:grid;gap:10px;margin-top:14px">
          ${status.map(({group, profile}) => `
            <div class="user-row">
              <div>
                <b>${escLocal(group.fullName)}</b>
                <span>${group.regions.map(code => escLocal(REGIONS?.[code]?.name || code)).join(' · ')}</span>
              </div>
              <div class="role-pill">${profile ? 'Уже создан' : 'Будет создан'}</div>
            </div>
          `).join('')}
        </div>

        <div id="multiRegionProgress" class="server-note" style="margin-top:12px">
          Готово к настройке.
        </div>
        <div id="multiRegionResult" class="hidden" style="margin-top:14px"></div>

        <div class="dialog-actions">
          <button type="button" class="btn ghost" id="multiRegionCancel">Отмена</button>
          <button type="button" class="btn primary" id="multiRegionStart">
            Создать / настроить
          </button>
        </div>
      </div>
    `;

    d.showModal();
    const close = () => d.close();
    document.getElementById('multiRegionClose').onclick = close;
    document.getElementById('multiRegionCancel').onclick = close;

    document.getElementById('multiRegionStart').onclick = async () => {
      const btn = document.getElementById('multiRegionStart');
      const progress = document.getElementById('multiRegionProgress');
      const result = document.getElementById('multiRegionResult');

      btn.disabled = true;
      btn.textContent = 'Настраиваем…';

      const done = [];
      const failed = [];

      for (let i = 0; i < GROUPS.length; i++) {
        const group = GROUPS[i];
        progress.textContent = `${i + 1} из ${GROUPS.length}: ${group.fullName}`;
        try {
          done.push(await createOrConfigureGroup(group));
        } catch (err) {
          failed.push(`${group.fullName} — ${err?.message || 'ошибка'}`);
        }
      }

      progress.textContent = `Готово. Настроено: ${done.length}. Ошибок: ${failed.length}.`;

      const newCredentials = done.filter(x => x.created && x.password);
      const credsText = newCredentials.map(x =>
        `${x.fullName}\nЛогин: ${x.username}\nОбщий временный пароль: ${x.password}\nРегионы: ${x.regions.map(code => REGIONS?.[code]?.name || code).join(', ')}`
      ).join('\n\n');

      result.innerHTML = `
        ${newCredentials.length ? `
          <div class="settings-card">
            <h4>Общие данные для входа — сохрани</h4>
            <textarea id="multiRegionCredentials" readonly style="width:100%;min-height:180px;box-sizing:border-box">${escLocal(credsText)}</textarea>
            <button type="button" class="btn ghost small-btn" id="multiRegionCopy" style="margin-top:8px">Копировать</button>
          </div>
        ` : `
          <div class="server-note">Новые пароли не создавались — аккаунты уже существовали.</div>
        `}
        ${failed.length ? `
          <div class="settings-card" style="margin-top:10px">
            <h4>Ошибки</h4>
            <div class="muted small">${failed.map(escLocal).join('<br>')}</div>
          </div>
        ` : ''}
      `;
      result.classList.remove('hidden');

      document.getElementById('multiRegionCopy')?.addEventListener('click', async () => {
        const ta = document.getElementById('multiRegionCredentials');
        const text = ta?.value || '';
        try {
          await navigator.clipboard.writeText(text);
          toast('Данные скопированы');
        } catch (_) {
          ta?.focus();
          ta?.select();
          toast('Данные выделены — нажми Ctrl+C');
        }
      });

      btn.textContent = 'Настройка завершена';
      toast(failed.length ? 'Настройка завершена с ошибками' : 'Мульти-региональные аккаунты готовы', !!failed.length);
    };
  }

  function attachMultiRegionButton() {
    if (currentUser?.role !== 'owner') return;
    const add = document.getElementById('addUserBtn');
    if (!add || document.getElementById('multiRegionSharedBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'multiRegionSharedBtn';
    btn.className = 'btn ghost small-btn';
    btn.textContent = '+ Мульти-регионы';
    btn.onclick = openMultiRegionSetup;
    add.parentElement?.insertBefore(btn, add);
  }

  renderSettings = async function (...args) {
    const result = await originalRenderSettingsMultiRegion.apply(this, args);
    attachMultiRegionButton();
    return result;
  };
})();
