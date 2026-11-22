import test from 'node:test'
import assert from 'node:assert/strict'
import { drainMail } from '../server/mail-delivery.js'

const appointment = { id: 'appointment', club_id: 'club', title: 'Impftermin 10:00', date: '2099-06-20' }
const participant = { id: 'participant', club_id: 'club', email: 'fixture@example.invalid', firstname: 'Max', lastname: 'Mustermann', registration_status: 'cancelled' }

function memoryDb(jobs) {
  return {
    async rpc(_name, { delivery_id }) {
      const job = jobs.find(item => item.id === delivery_id)
      if (!job || !['pending', 'failed'].includes(job.status)) return { data: [] }
      job.status = 'sending'
      job.attempts++
      return { data: [structuredClone(job)] }
    },
    from(table) {
      const filters = []
      let update
      const query = {
        select() { return query },
        update(values) { update = values; return query },
        eq(key, value) { filters.push(row => row[key] === value); return query },
        is(key, value) { filters.push(row => (row[key] ?? null) === value); return query },
        in(key, values) { filters.push(row => values.includes(row[key])); return query },
        lt(key, value) { filters.push(row => row[key] != null && row[key] < value); return query },
        lte(key, value) { filters.push(row => row[key] != null && row[key] <= value); return query },
        order() { return query },
        limit() { return query },
        execute() {
          const rows = table === 'mail_deliveries' ? jobs.filter(row => filters.every(filter => filter(row))) : []
          if (update) rows.forEach(row => Object.assign(row, update))
          return { data: rows, error: null }
        },
        then(resolve, reject) { return Promise.resolve(query.execute()).then(resolve, reject) }
      }
      return query
    }
  }
}

test('reminder worker drains more than 20 deliveries with bounded concurrency', async () => {
  const jobs = Array.from({ length: 200 }, (_, index) => ({
    id: `delivery-${index}`,
    event_key: `cancelled:${index}`,
    kind: 'cancelled',
    status: 'pending',
    attempts: 0,
    next_attempt_at: new Date(0).toISOString(),
    participant_id: null,
    appointment_id: appointment.id,
    recipient: `fixture-${index}@example.invalid`,
    payload: { participant, appointment }
  }))
  const db = memoryDb(jobs)
  let active = 0
  let peak = 0
  let sent = 0
  const transport = {
    async sendMail() {
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 2))
      active--
      sent++
      return { messageId: `fake-${sent}` }
    }
  }

  const result = await drainMail({ db, transport, limit: 1000, concurrency: 5, budgetMs: 40000 })
  assert.equal(result.sent, 200)
  assert.equal(sent, 200)
  assert.ok(peak > 1 && peak <= 5)
  assert.ok(jobs.every(job => job.status === 'sent'))
})
