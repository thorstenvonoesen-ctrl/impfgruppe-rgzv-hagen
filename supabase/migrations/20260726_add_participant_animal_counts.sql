-- Store the exact animal composition of new participant registrations.
-- Existing registrations remain unchanged and continue to use animal_type/animal_count.
alter table public.participants
  add column if not exists chicken_count integer,
  add column if not exists bantam_count integer,
  add column if not exists turkey_count integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participants'::regclass
      and conname = 'participants_chicken_count_nonnegative'
  ) then
    alter table public.participants
      add constraint participants_chicken_count_nonnegative
      check (chicken_count is null or chicken_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participants'::regclass
      and conname = 'participants_bantam_count_nonnegative'
  ) then
    alter table public.participants
      add constraint participants_bantam_count_nonnegative
      check (bantam_count is null or bantam_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.participants'::regclass
      and conname = 'participants_turkey_count_nonnegative'
  ) then
    alter table public.participants
      add constraint participants_turkey_count_nonnegative
      check (turkey_count is null or turkey_count >= 0);
  end if;
end;
$$;
