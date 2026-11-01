// Classify known failures without exposing database row contents or raw SQL errors.
const identifier = value => /^[a-z_][a-z0-9_]{0,100}$/.test(value||'') ? value : undefined
export function registrationFailure(error,stage) {
  const rawCode=String(error?.code||'')
  const code=/^(?:[0-9A-Z]{5}|PGRST\d{3}|REGISTRATION_RESULT)$/.test(rawCode)?rawCode:'REGISTRATION_FAILURE'
  const message=String(error?.message||'')
  const constraint=identifier(error?.constraint||message.match(/constraint "([^"]+)"/i)?.[1])
  const column=identifier(error?.column||message.match(/column "([^"]+)"/i)?.[1])
  let status=500,reason='UNKNOWN',text='Die Anmeldung konnte nicht gespeichert werden. Bitte den Verein mit der folgenden Referenz verständigen.'
  if(stage==='SERVER_CONFIG') {status=503;reason='SERVER_CONFIG';text='Die Serververbindung zur Datenbank ist nicht vollständig eingerichtet. Bitte die Administration verständigen.'}
  else if(code==='42883' && /gen_random_bytes/.test(message)) {status=503;reason='CHECKIN_GENERATOR_MISSING';text='Die sichere QR-Code-Erstellung ist in der Datenbank nicht vollständig eingerichtet. Bitte die Administration verständigen.'}
  else if(['PGRST202','42883'].includes(code)) {status=503;reason='DATABASE_FUNCTION_MISSING';text='Eine benötigte Speicherfunktion fehlt oder ist im API-Schema nicht verfügbar. Bitte die Administration verständigen.'}
  else if(['42P01','PGRST205','42703','PGRST204'].includes(code)) {status=503;reason='DATABASE_SCHEMA_INCOMPLETE';text='Die Datenbank ist für die Anmeldung und den Bestätigungsauftrag noch nicht vollständig eingerichtet. Bitte die Administration verständigen.'}
  else if(code==='42501') {status=503;reason='DATABASE_PERMISSION';text='Die Serverberechtigung zum Speichern der Anmeldung fehlt. Bitte die Administration verständigen.'}
  else if(code==='23505' || (code==='P0001' && /^(Für diese Adresse besteht bereits eine Anmeldung\.|Für diese E-Mail-Adresse besteht bereits)/.test(message))) {status=409;reason='DUPLICATE_REGISTRATION';text='Für diese E-Mail-Adresse besteht bereits eine Anmeldung zu diesem Impftermin. Bitte nicht erneut anmelden.'}
  else if(['55000','P0001'].includes(code) && message==='Die Anmeldung ist geschlossen.') {status=409;reason='REGISTRATION_CLOSED';text='Die Anmeldung für diesen Impftermin ist geschlossen.'}
  else if(code==='55000' && message==='Die Check-in-Grundlage fehlt.') {status=503;reason='CHECKIN_NOT_CONFIGURED';text='Die QR-Code-Erstellung ist noch nicht eingerichtet. Bitte die Administration verständigen.'}
  else if(code==='23502') {status=400;reason='REQUIRED_FIELD_MISSING';text='Eine erforderliche Angabe fehlt. Bitte die Pflichtfelder prüfen. Falls sie ausgefüllt sind, die Administration verständigen.'}
  else if(code==='23514') {status=/^participants_(chicken|bantam|turkey)_count_nonnegative$/.test(constraint||'')?400:503;reason='DATABASE_VALIDATION';text='Eine Datenbankregel blockiert die Anmeldung oder den Bestätigungsauftrag. Bitte die Angaben prüfen und bei korrekten Angaben die Administration verständigen.'}
  else if(['55P03','40P01','57014'].includes(code)) {status=503;reason='DATABASE_BUSY';text='Die Anmeldung konnte wegen einer gleichzeitigen Verarbeitung nicht abgeschlossen werden. Bitte erst den Anmeldestatus prüfen und danach erneut versuchen.'}
  else if(code==='PGRST116') {status=503;reason='REQUIRED_RECORD_MISSING';text='Benötigte Vereins- oder Termindaten sind nicht mehr verfügbar. Bitte die Seite neu laden.'}
  else if(code==='22P02') {status=400;reason='INVALID_INPUT_FORMAT';text='Eine Angabe hat ein ungültiges Format. Bitte den Termin neu auswählen und die Eingaben prüfen.'}
  else if(code==='REGISTRATION_RESULT') {status=502;reason='COMMIT_RESULT_UNKNOWN';text='Das Ergebnis der Speicherung konnte nicht bestätigt werden. Bitte vor einem erneuten Versuch den Anmeldestatus durch den Verein prüfen lassen.'}
  return {status,text,diagnostic:{stage,code,reason,...(constraint?{constraint}:{}),...(column?{column}:{})}}
}
