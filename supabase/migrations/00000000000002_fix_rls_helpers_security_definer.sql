-- Fix: dashboard not showing user's opco and roles.
--
-- The RLS helper functions current_opco_id(), has_role(), and is_super_admin()
-- are referenced from RLS policies on the same tables they query
-- (profiles and user_roles). When they run as SECURITY INVOKER, each call
-- re-triggers RLS on those tables, and the resulting policy evaluation
-- returns no rows for ordinary queries. Logged-in users appear to have no
-- opco and no roles even when the database is populated correctly.
--
-- Promoting the helpers to SECURITY DEFINER makes them run with the
-- function owner's privileges and bypass RLS on the inner reads, which is
-- the pattern Supabase documents for this class of helper.

create or replace function public.current_opco_id()
returns uuid language sql stable security definer set search_path = public as $$
  select opco_id from profiles where id = auth.uid() limit 1;
$$;

create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('super_admin','executive','corp_dev')
  );
$$;
