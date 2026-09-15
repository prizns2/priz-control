-- RLS regression checks for PRIZ Control.
--
-- Structural invariants, not hardcoded row counts — they stay valid as the
-- dataset grows. Each block impersonates a role via a rolled-back
-- transaction, so nothing here ever writes real data.
--
-- IMPORTANT shape: inside each transaction, the profile id lookup and the
-- request.jwt.claims setup happen together in one PL/pgSQL block *before*
-- `set local role authenticated`. Do the lookup after switching role and
-- you hit a chicken-and-egg bug: the lookup itself runs under profiles_read
-- RLS with no JWT sub set yet, returns 0 rows, and the impersonation
-- silently no-ops (every later check then passes vacuously). Also avoid
-- round-tripping the id through a second custom GUC (e.g. reading it back
-- with current_setting() in a later statement) — that was observed to
-- intermittently return an empty string on this project's pooled
-- connection, which crashes auth.uid()'s cast to uuid.
--
-- Run: paste into the Supabase SQL editor, or via the Supabase MCP
-- execute_sql tool against the project. Every block must produce a PASS
-- notice and no statement may raise; a RAISE EXCEPTION means a real
-- regression. Depends on the test_owner/test_boss/test_senior/
-- test_operator/test_manager accounts created for QA — if those are ever
-- deleted, recreate them (or point the lookups below at other known
-- accounts with the matching role) before running this file.

-- 1. owner sees every row in records (no region/manager filtering).
begin;
do $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where username = 'test_owner';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_id, 'aal', 'aal2', 'role', 'authenticated'
  )::text, true);
end $$;
set local role authenticated;
do $$
declare visible bigint; distinct_regions bigint;
begin
  select count(*), count(distinct region_id) into visible, distinct_regions from public.records;
  if visible = 0 then
    raise exception 'FAIL: owner sees 0 records — impersonation likely broken';
  end if;
  if distinct_regions < 2 then
    raise exception 'FAIL: owner only sees records from % region(s) — expected no region filtering', distinct_regions;
  end if;
  raise notice 'PASS: owner sees % records across % regions (no region filter)', visible, distinct_regions;
end $$;
rollback;

-- 2. senior never sees a record outside their assigned regions.
begin;
do $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where username = 'test_senior';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_id, 'aal', 'aal1', 'role', 'authenticated'
  )::text, true);
end $$;
set local role authenticated;
do $$
declare leaked bigint; visible bigint;
begin
  select count(*) into visible from public.records;
  select count(*) into leaked
  from public.records r
  where not (r.region_id = any (coalesce(authz_private.current_profile_region_ids(), '{}'::uuid[])));
  if visible = 0 then
    raise exception 'FAIL: senior sees 0 records — impersonation likely broken';
  end if;
  if leaked > 0 then
    raise exception 'FAIL: senior can see % record(s) outside assigned regions', leaked;
  end if;
  raise notice 'PASS: senior region isolation (% visible, 0 leaked)', visible;
end $$;
rollback;

-- 3. manager sees only records tied to their own manager_id — zero leakage
--    even into their own region's other records.
begin;
do $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where username = 'test_manager';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_id, 'aal', 'aal1', 'role', 'authenticated'
  )::text, true);
end $$;
set local role authenticated;
do $$
declare leaked bigint; my_manager_id uuid;
begin
  select authz_private.current_profile_manager_id() into my_manager_id;
  if my_manager_id is null then
    raise exception 'FAIL: test_manager has no linked manager_id — impersonation likely broken';
  end if;
  select count(*) into leaked
  from public.records r
  where r.manager_id is distinct from my_manager_id;
  if leaked > 0 then
    raise exception 'FAIL: manager can see % record(s) not tied to their manager_id', leaked;
  end if;
  raise notice 'PASS: manager record isolation (manager_id=%)', my_manager_id;
end $$;
rollback;

-- 4. anon cannot read private.pending_profiles directly.
begin;
set local role anon;
do $$
declare visible bigint;
begin
  begin
    select count(*) into visible from private.pending_profiles;
  exception when insufficient_privilege then
    visible := 0;
  end;
  if visible > 0 then
    raise exception 'FAIL: anon can read % row(s) of private.pending_profiles', visible;
  end if;
  raise notice 'PASS: pending_profiles locked down from anon';
end $$;
rollback;

-- 5. operator cannot write to owner-only tables (regions here as a proxy;
--    same RLS shape covers managers/profiles/stores/violation_types).
begin;
do $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where username = 'test_operator';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_id, 'aal', 'aal1', 'role', 'authenticated'
  )::text, true);
end $$;
set local role authenticated;
do $$
declare affected integer;
begin
  update public.regions set is_active = is_active; -- value-preserving; RLS must still block it for operator
  get diagnostics affected = row_count;
  if affected > 0 then
    raise exception 'FAIL: operator updated % region row(s)', affected;
  end if;
  raise notice 'PASS: operator blocked from writing regions';
end $$;
rollback;

-- 6. only owner (with aal2) may call clear_audit_history; senior must be rejected.
begin;
do $$
declare v_id uuid;
begin
  select id into v_id from public.profiles where username = 'test_senior';
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_id, 'aal', 'aal1', 'role', 'authenticated'
  )::text, true);
end $$;
set local role authenticated;
do $$
begin
  begin
    perform public.clear_audit_history(null);
    raise exception 'FAIL: senior was allowed to call clear_audit_history';
  exception when others then
    if sqlerrm not like '%not allowed%' and sqlerrm not like '%aal2%' then
      raise exception 'FAIL: unexpected error from clear_audit_history: %', sqlerrm;
    end if;
    raise notice 'PASS: senior rejected by clear_audit_history (%)', sqlerrm;
  end;
end $$;
rollback;
