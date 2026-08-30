import test from 'node:test'
import assert from 'node:assert/strict'
import { selectNextAppointment } from '../api/public-dashboard.js'

test('selects the appointment after today instead of stopping at todays completed date', () => {
  const dates = [
    { id: 'summer', title: 'ND Impfung Sommer', date: '2026-08-30', archived: false },
    { id: 'autumn', title: 'ND Impfung Herbst', date: '2026-11-29', archived: false }
  ]

  assert.deepEqual(selectNextAppointment(dates, '2026-08-30'), dates[1])
})

test('returns null when no appointment follows today', () => {
  assert.equal(selectNextAppointment([
    { id: 'today', date: '2026-08-30', archived: false }
  ], '2026-08-30'), null)
})
