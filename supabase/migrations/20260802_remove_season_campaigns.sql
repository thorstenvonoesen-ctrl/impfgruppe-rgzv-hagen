-- Entfernt ausschließlich die nicht mehr verwendete Saisonkampagnen-Funktion.
-- Die Migration ist absichtlich idempotent, da die produktive Datenbank die
-- Tabellen und die normalisierte E-Mail-Spalte derzeit möglicherweise nicht hat.

drop trigger if exists participants_mark_season_campaign_return
  on public.participants;

drop function if exists public.mark_season_campaign_return();
drop function if exists public.sync_season_campaign_returns(uuid);
drop function if exists public.season_campaign_summary(uuid);
drop function if exists public.season_campaign_detail(uuid, uuid);

drop table if exists public.season_email_recipients;
drop table if exists public.season_email_preferences;
drop table if exists public.season_email_campaigns;

alter table if exists public.participants
  drop column if exists email_normalized;

-- Andere Trigger auf public.participants, insbesondere die Check-in-Token-
-- Vergabe, bleiben vollständig unangetastet.
