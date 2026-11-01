import test from 'node:test'
import assert from 'node:assert/strict'
import { vaccinationDatePayload, vaccinationDateError, saveVaccinationDate } from '../vaccination-date-save.js'

const fixture = {
  title: 'ND Impfung Winter', date: '2027-01-10', time: '10:00',
  registration_closes_at: '2027-01-09T23:00:00+01:00', registration_closed: true,
  venue_name: 'Impfstandort RGZV Hagen', street: 'Sonntagstrasse', house_number: '3',
  postal_code: '58099', city: 'Hagen', address_public: true
}

test('exact winter inputs preserve local date/time and convert deadline to UTC', () => {
  const p = vaccinationDatePayload(fixture)
  assert.equal(p.date, '2027-01-10')
  assert.equal(p.time, '10:00')
  assert.equal(p.registration_closes_at, '2027-01-09T22:00:00.000Z')
  assert.equal(p.registration_closed, true)
  assert.equal(p.address_public, true)
  assert.equal(p.street, 'Sonntagstrasse')
  assert.equal(vaccinationDatePayload({ ...fixture, registration_closes_at: '2027-07-09T23:00:00+02:00' }).registration_closes_at, '2027-07-09T21:00:00.000Z')
})

test('invalid fields fail before any write; optional fields become null', () => {
  for (const change of [{ title: ' ' }, { date: '2027-02-30' }, { time: '25:00' }, { registration_closes_at: 'bad' }]) {
    assert.throws(() => vaccinationDatePayload({ ...fixture, ...change }))
  }
  const p = vaccinationDatePayload({ title: 'Termin', date: '2027-01-10' })
  assert.equal(p.time, null)
  assert.equal(p.registration_closes_at, null)
  assert.equal(p.registration_closed, false)
})

test('create and edit round trip, both open and closed, retain server-owned fields', async () => {
  let row
  const db = { from(table) {
    assert.equal(table, 'vaccination_dates')
    let payload, editing = false
    const q = {
      insert(p) { payload = p; return q },
      update(p) { payload = p; editing = true; return q },
      eq(key, value) { assert.equal(row[key], value); return q },
      select(s) { assert.equal(s, '*'); return q },
      async single() {
        row = editing ? { ...row, ...payload } : { id: 'date-1', archived: false, vet_certificate_sent_at: 'unchanged', ...payload }
        return { data: { ...row }, error: null }
      }
    }
    return q
  } }
  for (const closed of [true, false]) {
    const created = await saveVaccinationDate(db, 'club-1', { ...fixture, registration_closed: closed })
    const updated = await saveVaccinationDate(db, 'club-1', { ...created, title: 'Bearbeitet', archived: true, vet_certificate_sent_at: 'overwrite' })
    assert.equal(updated.title, 'Bearbeitet')
    assert.equal(updated.registration_closed, closed)
    assert.equal(updated.archived, false)
    assert.equal(updated.vet_certificate_sent_at, 'unchanged')
  }
})

test('database failures and invisible update targets never report success or leak SQL', async () => {
  for (const error of [{ code: 'PGRST204', message: 'secret SQL' }, { code: '42501' }, null]) {
    const q = { insert() { return q }, select() { return q }, async single() { return { data: null, error } } }
    await assert.rejects(saveVaccinationDate({ from: () => q }, 'club-1', fixture), /Datenbank|Berechtigung|Termin/)
    assert.doesNotMatch(vaccinationDateError(error), /secret SQL/)
  }
})
