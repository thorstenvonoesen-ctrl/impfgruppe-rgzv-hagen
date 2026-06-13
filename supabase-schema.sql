create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  firstname text not null,
  lastname text not null,
  street text,
  housenumber text,
  zipcode text,
  city text,
  email text not null,
  phone text,
  tsk_number text not null,
  animal_count integer not null,
  vaccine text not null check (vaccine in ('Newcastle','IB','ILT','Marek','Kokzidiose','Salmonellen')),
  payment_status text not null default 'offen' check (payment_status in ('offen','bezahlt')),
  payment_method text,
  payment_amount numeric not null default 10.00,
  payment_date timestamptz,
  payment_id text,
  created_at timestamptz default now()
);
alter table participants enable row level security;
drop policy if exists "public insert participants" on participants;
drop policy if exists "admin read participants" on participants;
drop policy if exists "admin update participants" on participants;
create policy "public insert participants" on participants for insert to anon with check (true);
create policy "admin read participants" on participants for select to anon using (true);
create policy "admin update participants" on participants for update to anon using (true) with check (true);
