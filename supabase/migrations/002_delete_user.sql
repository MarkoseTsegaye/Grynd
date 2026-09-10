-- Grynd — self-service account deletion
--
-- The client cannot call `auth.admin.deleteUser` directly — that path
-- requires the service_role key, which must stay server-only. Instead
-- the client calls `supabase.rpc('delete_user')`, and this Postgres
-- function runs as a definer (elevated) to delete the row in
-- `auth.users` for the calling user.
--
-- Row deletion cascades to the six data tables via
-- `on delete cascade` on their `user_id -> auth.users(id)` FKs, so a
-- single call clears everything the user owns.
--
-- The `where id = auth.uid()` clause is the safety net: even though
-- the function runs with definer privileges, it only ever deletes the
-- caller's own row. `auth.uid()` returns null for unauthenticated
-- callers, so a bare curl with no JWT deletes nothing.

set search_path = public;

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Only signed-in callers can invoke this — anonymous sessions count as
-- signed in for this purpose (they carry a real UID).
grant execute on function public.delete_user() to authenticated;
revoke execute on function public.delete_user() from anon;
