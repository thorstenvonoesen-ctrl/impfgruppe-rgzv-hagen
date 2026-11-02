-- Allow existing member administrators to delete directory entries only.
-- No changes to participants, payments, attendance, or historical tariff amounts.
begin;
set local lock_timeout='5s';
drop policy if exists club_members_admin_delete on public.club_members;
create policy club_members_admin_delete on public.club_members
  for delete to authenticated using (public.can_manage_club_members(club_id));
grant delete on public.club_members to authenticated;
notify pgrst,'reload schema';
commit;
