-- Automatic directory-based tariff for NEW registrations only. No historical repricing.
-- Requires migrations 08 and 11. RPC remains callable by service_role only.
begin;
set local lock_timeout='5s';
do $$
declare definition text;
begin
  select pg_get_functiondef('public.register_with_tariff_confirmation(jsonb)'::regprocedure) into definition;
  if position('lower(trim(m.email))=verified' in definition)=0 then
    raise exception 'Normalisierte Tarif-RPC fehlt. Zuerst vollständiges Reparaturpaket installieren.';
  end if;
  if position('verified := lower(trim(registration->>''verified_email''));' in definition)>0 then
    definition:=replace(definition,'verified := lower(trim(registration->>''verified_email''));',
      'verified := lower(trim(input.email)); -- AUTOMATIC_DIRECTORY_TARIFF');
    definition:=replace(definition,'exception when others then needs_review := true;',
      'exception when others then raise; -- Never silently charge a member the guest tariff.');
    execute definition;
  elsif position('AUTOMATIC_DIRECTORY_TARIFF' in definition)=0 then
    raise exception 'Unbekannte Tarif-RPC. Keine Änderungen vorgenommen.';
  end if;
end;
$$;
notify pgrst,'reload schema';
commit;
