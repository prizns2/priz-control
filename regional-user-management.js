(() => {
  const LOADING_CLASS = 'priz-regional-users-loading';

  const style = document.createElement('style');
  style.id = 'prizRegionalUsersNoFlashStyle';
  style.textContent = `
    html.${LOADING_CLASS} .settings-card:has(.users-list) {
      visibility: hidden !important;
    }
  `;
  document.getElementById(style.id)?.remove();
  document.head.appendChild(style);

  const originalLoadProfileRegionalUsers = loadProfile;
  const originalRenderSettingsRegionalUsers = renderSettings;

  loadProfile = async function (...args) {
    const profile = await originalLoadProfileRegionalUsers.apply(this, args);
    if (!profile?.id) return profile;

    const { data, error } = await sb
      .from('profiles')
      .select('login_enabled')
      .eq('id', profile.id)
      .maybeSingle();

    if (error) {
      console.warn('login_enabled check:', error);
      return profile;
    }

    if (data?.login_enabled === false) {
      try { await sb.auth.signOut(); } catch (_) {}
      return null;
    }

    return profile;
  };

  function buildRegionText(profile, linksByUser, managerRegionByManagerId) {
    if (['owner', 'boss'].includes(profile.role)) return 'Все регионы';

    if (profile.role === 'manager') {
      const regionId = managerRegionByManagerId.get(profile.manager_id) || null;
      return regionId ? (REGION_BY_UUID[regionId]?.name || 'Регион') : 'Регион не назначен';
    }

    const ids = linksByUser.get(profile.id)?.length
      ? linksByUser.get(profile.id)
      : (profile.region_id ? [profile.region_id] : []);

    return ids.map(id => REGION_BY_UUID[id]?.name || '—').join(', ') || '—';
  }

  function profileBelongsToRegion(profile, regionId, linksByUser, managerRegionByManagerId) {
    if (!regionId) return false;

    if (profile.role === 'manager') {
      return managerRegionByManagerId.get(profile.manager_id) === regionId;
    }

    const linked = linksByUser.get(profile.id) || [];
    return profile.region_id === regionId || linked.includes(regionId);
  }

  function renderUserRows(list, linksByUser, managerRegionByManagerId) {
    if (!list.length) {
      return '<div class="empty"><b>Нет аккаунтов</b>Для выбранного раздела аккаунты пока не созданы.</div>';
    }

    return list.map(u => {
      const rr = buildRegionText(u, linksByUser, managerRegionByManagerId);
      const shared = u.role === 'operator' && u.is_shared_region_account === true;
      const statusText = u.is_active
        ? (shared ? 'ОБЩИЙ ВХОД' : 'АКТИВЕН')
        : 'ОТКЛЮЧЁН';

      return `<div class="user-row">
        <div>
          <b>${esc(u.full_name)}</b>
          <span>${esc(u.username)} · ${esc(rr)}</span>
          <div class="user-status ${u.is_active ? 'on' : 'off'}">${statusText}</div>
        </div>
        <div class="user-actions">
          <div class="role-pill">${esc(ROLE_LABEL[u.role] || u.role)}</div>
          <button class="btn ghost tiny-btn edit-user regional-edit-user" data-id="${esc(u.id)}">Изменить</button>
        </div>
      </div>`;
    }).join('');
  }

  async function applyRegionalUserView() {
    if (currentUser?.role !== 'owner') return;

    const usersList = document.querySelector('.users-list');
    if (!usersList) return;

    const scope = document.getElementById('regionSelect')?.value || 'all';
    const regionId = scope !== 'all' ? REGIONS?.[scope]?.id : null;

    const [profilesRes, linksRes, managersRes] = await Promise.all([
      sb.from('profiles')
        .select('id,username,full_name,role,region_id,manager_id,is_active,is_shared_region_account,login_enabled,created_at')
        .order('full_name'),
      sb.from('user_regions').select('user_id,region_id'),
      sb.from('managers').select('id,region_id')
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (linksRes.error) throw linksRes.error;
    if (managersRes.error) throw managersRes.error;

    const profiles = profilesRes.data || [];
    const linksByUser = new Map();

    for (const row of linksRes.data || []) {
      if (!linksByUser.has(row.user_id)) linksByUser.set(row.user_id, []);
      linksByUser.get(row.user_id).push(row.region_id);
    }

    const managerRegionByManagerId = new Map(
      (managersRes.data || []).map(m => [m.id, m.region_id])
    );

    let visible;

    if (scope === 'all') {
      visible = profiles.filter(p => ['owner', 'boss', 'senior'].includes(p.role));
    } else {
      visible = profiles.filter(p => {
        if (p.role === 'operator') {
          return p.is_shared_region_account === true &&
            profileBelongsToRegion(p, regionId, linksByUser, managerRegionByManagerId);
        }

        if (p.role === 'manager') {
          return profileBelongsToRegion(p, regionId, linksByUser, managerRegionByManagerId);
        }

        return false;
      });
    }

    usersList.innerHTML = renderUserRows(visible, linksByUser, managerRegionByManagerId);

    const usersCard = usersList.closest('.settings-card');
    const usersTitle = usersCard?.querySelector('.panel-head h4');

    if (usersTitle) {
      usersTitle.textContent = scope === 'all'
        ? 'Руководители'
        : `Пользователи · ${REGIONS?.[scope]?.name || 'Регион'}`;
    }

    document.querySelectorAll('.regional-edit-user').forEach(btn => {
      btn.onclick = () => {
        const profile = profiles.find(p => p.id === btn.dataset.id);
        if (!profile) return;

        profile.region_ids = linksByUser.get(profile.id) || [];
        openUserDialog(profile);
      };
    });

    const storeHeading = [...document.querySelectorAll('#content .panel h3')]
      .find(el => String(el.textContent || '').startsWith('Магазины и менеджеры'));

    const storePanel = storeHeading?.closest('.panel');

    if (storePanel) {
      storePanel.classList.toggle('hidden', scope === 'all');
    }
  }

  renderSettings = async function (...args) {
    document.documentElement.classList.add(LOADING_CLASS);

    try {
      const result = await originalRenderSettingsRegionalUsers.apply(this, args);
      await applyRegionalUserView();
      return result;
    } catch (err) {
      console.error('regional user management:', err);
      toast('Не удалось обновить список пользователей', true);
    } finally {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove(LOADING_CLASS);
      });
    }
  };
})();
