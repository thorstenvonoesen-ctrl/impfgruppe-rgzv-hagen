-- Keep public club metadata available without exposing the price-relevant member code.
revoke select on table public.clubs from anon;

grant select (
  id,
  name,
  slug,
  guest_price,
  member_price
) on table public.clubs to anon;
