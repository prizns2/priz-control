(() => {
  ROLE_LABEL.manager = 'Менеджер';

  const originalLoadProfileManager = loadProfile;
  const originalBuildShellManager = buildShell;
  const originalViewRecordManager = viewRecord;

  async function managerLinkedProfileBase() {
    const { data: { user }, error: uErr } = await sb.auth.getUser();
    if (uErr || !user) return null;

    const { data: p, error } = await sb
      .from('profiles')
      .select('id,username,full_name,role,region_id,manager_id,is_active,created_at')
      .eq('id', user.id)
      .single();

    if (error || !p || !p.is_active) return null;

    let regionIds = [];
    let manager = null;

    if (['senior', 'operator'].includes(p.role)) {
      const { data: links, error: lErr } = await sb
        .from('user_regions')
        .select('region_id')
        .eq('user_id', user.id);

      if (lErr) throw lErr;

      regionIds = [...new Set((links || []).map(x => x.region_id).filter(Boolean))];
      if (!regionIds.length && p.region_id) regionIds = [p.region_id];
    }

    if (p.role === 'manager' && p.manager_id) {
      const { data: managerRow, error: mErr } = await sb
        .from('managers')
        .select('id,full_name,region_id,is_active')
        .eq('id', p.manager_id)
        .maybeSingle();

      if (mErr) throw mErr;

      manager = managerRow || null;
      if (manager?.region_id) regionIds = [manager.region_id];
    }

    const regions = regionIds.map(regionCodeFromUuid).filter(Boolean);

    const region = ['owner', 'boss'].includes(p.role)
      ? 'all'
      : (regions[0] || (p.region_id ? regionCodeFromUuid(p.region_id) : null));

    return {
      id: p.id,
      login: p.username,
      name: p.full_name,
      role: p.role,
      region,
      regionId: p.region_id,
      regions,
      regionIds,
      active: p.is_active,
      managerId: p.manager_id || null,
      managerName: manager?.full_name || null,
      managerRegionId: manager?.region_id || null
    };
  }

  loadProfile = async function () {
    const profile = await managerLinkedProfileBase();
    if (profile) return profile;
    return originalLoadProfileManager();
  };

  buildShell = function (...args) {
    const result = originalBuildShellManager.apply(this, args);

    if (currentUser?.role === 'manager') {
      document.querySelector('[data-page="attendance"]')?.remove();

      const regionName = currentUser.managerRegionId
        ? (REGION_BY_UUID[currentUser.managerRegionId]?.name || '')
        : '';

      const userCard = document.getElementById('userCard');
      if (userCard) {
        userCard.innerHTML = `
          <b>${esc(currentUser.name)}</b>
          <span>${esc(regionName || 'Доступ по менеджеру')}</span>
          <div class="role-pill">Менеджер</div>
          <div class="sync-pill">Сервер подключён</div>
        `;
      }

      const quick = document.getElementById('quickAddBtn');
      if (quick) quick.classList.add('hidden');
    }

    return result;
  };

  async function getManagerAccountData(existing) {
    let existingManagerId = existing?.manager_id || null;

    if (existing?.id && !existingManagerId) {
      const { data } = await sb
        .from('profiles')
        .select('manager_id')
        .eq('id', existing.id)
        .maybeSingle();

      existingManagerId = data?.manager_id || null;
    }

    const [{ data: managers, error: mErr }, { data: linkedProfiles, error: pErr }] =
      await Promise.all([
        sb
          .from('managers')
          .select('id,full_name,region_id,is_active')
          .eq('is_active', true)
          .order('full_name'),
        sb
          .from('profiles')
          .select('id,manager_id')
          .not('manager_id', 'is', null)
      ]);

    if (mErr) throw mErr;
    if (pErr) throw pErr;

    const busy = new Map(
      (linkedProfiles || [])
        .filter(x => x.manager_id)
        .map(x => [x.manager_id, x.id])
    );

    return {
      managers: managers || [],
      busy,
      existingManagerId
    };
  }

  openUserDialog = async function (existing = null) {
    const isEdit = !!existing;

    let managerData;
    try {
      managerData = await getManagerAccountData(existing);
    } catch (err) {
      toast(err.message || 'Не удалось загрузить менеджеров', true);
      return;
    }

    const selectedIds = ['owner', 'boss', 'manager'].includes(existing?.role)
      ? []
      : (
          existing?.region_ids?.length
            ? existing.region_ids
            : (existing?.region_id ? [existing.region_id] : [])
        );

    const regionChecks = Object.values(REGIONS).map(r => `
      <label class="region-check">
        <input type="checkbox"
               name="regionIds"
               value="${esc(r.id)}"
               ${selectedIds.includes(r.id) ? 'checked' : ''}>
        <span>${esc(r.name)}</span>
      </label>
    `).join('');

    const managerOptions = managerData.managers.map(m => {
      const ownerProfileId = managerData.busy.get(m.id);
      const isOwn = ownerProfileId && existing?.id && ownerProfileId === existing.id;
      const unavailable = ownerProfileId && !isOwn;
      const regionName = REGION_BY_UUID[m.region_id]?.name || 'Регион';
      return `
        <option value="${esc(m.id)}"
                data-name="${esc(m.full_name)}"
                ${managerData.existingManagerId === m.id ? 'selected' : ''}
                ${unavailable ? 'disabled' : ''}>
          ${esc(regionName)} · ${esc(m.full_name)}${unavailable ? ' · аккаунт уже есть' : ''}
        </option>
      `;
    }).join('');

    $('#userDialogBody').innerHTML = `
      <form id="userForm" class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>${isEdit ? 'Изменить аккаунт' : 'Новый аккаунт'}</h3>
            <p class="muted">
              Оператору/старшему назначаются регионы. Менеджеру — конкретный менеджер из справочника.
            </p>
          </div>
          <button type="button" class="close-x">×</button>
        </div>

        <div class="form-grid">
          <label>
            Ф.И.О.
            <input name="name"
                   value="${esc(existing?.full_name || '')}"
                   required>
          </label>

          <label>
            Логин
            <input name="login"
                   value="${esc(existing?.username || '')}"
                   ${isEdit ? 'readonly' : ''}
                   placeholder="manager.kh"
                   required>
          </label>

          <label>
            Пароль
            <input name="password"
                   type="password"
                   placeholder="${isEdit ? 'Оставь пустым, чтобы не менять' : '12+ символов: A-z, 0-9, спецсимвол'}"
                   ${isEdit ? '' : 'required'}>
          </label>

          <label>
            Роль
            <select name="role">
              <option value="owner" ${existing?.role === 'owner' ? 'selected' : ''}>Владелец</option>
              <option value="boss" ${existing?.role === 'boss' ? 'selected' : ''}>Руководитель</option>
              <option value="senior" ${existing?.role === 'senior' ? 'selected' : ''}>Старший оператор</option>
              <option value="operator" ${!existing || existing?.role === 'operator' ? 'selected' : ''}>Оператор</option>
              <option value="manager" ${existing?.role === 'manager' ? 'selected' : ''}>Менеджер</option>
            </select>
          </label>

          <label class="full region-assign-wrap" id="managerAssignWrap">
            <span>Привязка к менеджеру</span>
            <select name="managerId" id="managerIdSelect">
              <option value="">Выберите менеджера</option>
              ${managerOptions}
            </select>
            <div class="file-hint">
              Аккаунт увидит только записи, где в записи указан этот manager_id.
            </div>
          </label>

          <label class="full region-assign-wrap">
            <span>Регионы</span>
            <div id="allRegionsNote" class="server-note hidden">
              Для владельца и руководителя автоматически доступны все регионы.
            </div>
            <div id="regionAssignBox" class="region-assign-grid">
              ${regionChecks}
            </div>
            <div id="regionCountHint" class="file-hint"></div>
          </label>

          <label class="toggle-label">
            <input name="active"
                   type="checkbox"
                   ${existing?.is_active === false ? '' : 'checked'}>
            <span>Аккаунт активен</span>
          </label>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn ghost cancel">Отмена</button>
          <button class="btn primary" id="userSubmit" type="submit">Сохранить</button>
        </div>
      </form>
    `;

    const d = $('#userDialog');
    const f = $('#userForm');
    const roleSelect = f.elements.role;
    const managerSelect = $('#managerIdSelect', f);
    const nameInput = f.elements.name;

    d.showModal();

    $('.close-x', f).onclick = () => d.close();
    $('.cancel', f).onclick = () => d.close();

    const syncManagerName = () => {
      if (roleSelect.value !== 'manager') return;
      const opt = managerSelect.selectedOptions?.[0];
      const name = opt?.dataset?.name || '';
      if (name) nameInput.value = name;
    };

    const syncAccessControls = () => {
      const role = roleSelect.value;
      const regionRestricted = ['senior', 'operator'].includes(role);
      const isManager = role === 'manager';
      const boxes = $$('input[name="regionIds"]', f);
      const checked = boxes.filter(x => x.checked).length;

      $('#managerAssignWrap', f).classList.toggle('hidden', !isManager);
      managerSelect.disabled = !isManager;

      $('#allRegionsNote', f).classList.toggle(
        'hidden',
        !['owner', 'boss'].includes(role)
      );

      $('#regionAssignBox', f).classList.toggle('hidden', !regionRestricted);

      boxes.forEach(x => {
        x.disabled = !regionRestricted || (checked >= 3 && !x.checked);
      });

      $('#regionCountHint', f).textContent = regionRestricted
        ? `Выбрано ${checked} из 3${checked === 0 ? ' · выбери хотя бы один' : ''}`
        : (
            isManager
              ? 'Для менеджера регионы отдельно не назначаются'
              : 'Все регионы доступны автоматически'
          );

      nameInput.readOnly = isManager;
      if (isManager) syncManagerName();
    };

    roleSelect.onchange = syncAccessControls;
    managerSelect.onchange = () => {
      syncManagerName();
      syncAccessControls();
    };

    $$('input[name="regionIds"]', f).forEach(box => {
      box.onchange = () => {
        const checked = $$('input[name="regionIds"]:checked', f);
        if (checked.length > 3) {
          box.checked = false;
          toast('Можно назначить не больше 3 регионов', true);
        }
        syncAccessControls();
      };
    });

    syncAccessControls();

    f.onsubmit = async e => {
      e.preventDefault();

      const btn = $('#userSubmit', f);
      const fd = new FormData(f);
      const role = String(fd.get('role') || 'operator');
      const regionIds = fd.getAll('regionIds').map(String);
      const managerId = String(fd.get('managerId') || '');

      if (['senior', 'operator'].includes(role) && regionIds.length < 1) {
        toast('Для оператора/старшего выбери хотя бы один регион', true);
        return;
      }

      if (regionIds.length > 3) {
        toast('Можно назначить не больше 3 регионов', true);
        return;
      }

      if (role === 'manager' && !managerId) {
        toast('Выбери менеджера для аккаунта', true);
        return;
      }

      setBusy(btn, true, 'Сохраняем…');

      try {
        const payload = {
          fullName: String(fd.get('name') || '').trim(),
          password: String(fd.get('password') || ''),
          role,
          regionIds: ['senior', 'operator'].includes(role) ? regionIds : [],
          managerId: role === 'manager' ? managerId : null
        };

        if (isEdit) {
          await invokeAdminUsers({
            action: 'update',
            id: existing.id,
            ...payload,
            isActive: !!fd.get('active')
          });
        } else {
          await invokeAdminUsers({
            action: 'create',
            username: String(fd.get('login') || '').trim(),
            ...payload
          });
        }

        d.close();
        toast(isEdit ? 'Аккаунт обновлён' : 'Аккаунт создан');
        renderSettings();
      } catch (err) {
        toast(err.message || 'Не удалось сохранить аккаунт', true);
      } finally {
        setBusy(btn, false);
      }
    };
  };

  async function addManagerPhotoButton(recordId) {
    if (currentUser?.role !== 'manager') return;

    const record = recordCache.find(x => x.id === recordId);
    if (!record || record.kind === 'eval') return;

    const body = document.getElementById('viewDialogBody');
    if (!body || body.querySelector('.manager-add-photo')) return;

    const actions = body.querySelector('.dialog-actions');
    if (!actions) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
    input.multiple = true;
    input.className = 'hidden';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ghost manager-add-photo';
    button.textContent = '📎 Добавить фото';

    actions.insertBefore(button, actions.firstChild);
    actions.appendChild(input);

    button.onclick = () => input.click();

    input.onchange = async () => {
      const files = [...(input.files || [])];
      if (!files.length) return;

      setBusy(button, true, `Загрузка 0/${files.length}`);

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          if (!String(file.type || '').startsWith('image/')) {
            throw new Error(`«${file.name}» — не фото`);
          }

          button.textContent = `Загрузка ${i + 1}/${files.length}…`;

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

        toast(files.length === 1 ? 'Фото прикреплено' : `Прикреплено фото: ${files.length}`);

        const dialog = document.getElementById('viewDialog');
        if (dialog?.open) dialog.close();

        await viewRecord(recordId);
      } catch (err) {
        console.error(err);
        toast(err.message || 'Не удалось прикрепить фото', true);
      } finally {
        setBusy(button, false);
        input.value = '';
      }
    };
  }

  viewRecord = async function (id) {
    await originalViewRecordManager(id);
    await addManagerPhotoButton(id);
  };
})();
