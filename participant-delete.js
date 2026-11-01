export function participantDeleteError(error) {
  const messages={
    '42501':'Keine Berechtigung zum Löschen dieser Anmeldung. Bitte die aktive Administratorzuordnung prüfen.',
    P0002:'Die Anmeldung ist nicht mehr vorhanden oder gehört nicht zum ausgewählten Verein. Bitte die Liste aktualisieren.',
    '55000':'Anmeldungen archivierter Impftermine sind schreibgeschützt und können nicht gelöscht werden.',
    '55006':'Für diese Anmeldung läuft gerade ein E-Mail-Versand. Bitte nach Abschluss den Versandstatus prüfen und erneut versuchen.',
    '23503':'Abhängige Datensätze verhindern das Löschen. Die Löschung wurde vollständig zurückgenommen. Bitte die Administration verständigen.',
    '23514':'Die Vereins- oder Terminzuordnung der abhängigen Daten ist widersprüchlich. Es wurde nichts gelöscht. Bitte die Administration verständigen.',
    PGRST202:'Die sichere Löschfunktion fehlt im API-Schema. Bitte die Migration 20261107_safe_participant_delete.sql ausführen und den Schemacache neu laden.',
    '42883':'Die sichere Löschfunktion fehlt. Bitte die Migration 20261107_safe_participant_delete.sql ausführen.',
    '55P03':'Die Anmeldung wird gerade verarbeitet. Bitte kurz warten und erneut versuchen.',
    '40P01':'Die Anmeldung wurde gleichzeitig verarbeitet. Es wurde nichts gelöscht. Bitte erneut versuchen.'
  }
  return messages[error?.code]||'Die Löschung konnte nicht bestätigt werden. Bitte Verbindung und Anmeldung prüfen und vor einem erneuten Versuch die Liste aktualisieren.'
}
export async function deleteParticipantRegistration(db,clubId,participantId) {
  if(!clubId||!participantId) throw new Error('Vereins- oder Teilnehmerzuordnung fehlt. Bitte die Seite neu laden.')
  try {
    const {data,error}=await db.rpc('delete_participant_registration',{target_club:clubId,target_participant:participantId})
    if(error) throw error
    if(data?.deleted!==true||String(data.participantId)!==String(participantId)) throw {code:'P0002'}
    return data
  }catch(error){throw new Error(participantDeleteError(error))}
}
