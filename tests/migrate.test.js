// IndexedDB schema upgrade v1 -> v2, run on a fixture captured from the real v1 app
// (tests/fixtures/v1-indexeddb.json: sample data, a goal, a learned rule, three settings).
import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Dexie from 'dexie'
import { merchantKey } from '../src/lib/categorize.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/v1-indexeddb.json', import.meta.url), 'utf8'))

async function seedV1() {
  const v1 = new Dexie('money-leak-finder')
  v1.version(1).stores({ transactions: '++id, date, type, category, source', rules: 'merchant', goals: '++id, createdAt', settings: 'key' })
  await v1.open()
  for (const [name, rows] of Object.entries(fixture.tables)) await v1.table(name).bulkPut(rows)
  v1.close()
}

test('fixture is real v1 data', () => {
  assert.equal(fixture.idbVersion, 10) // Dexie stores version 1 as 10
  assert.equal(fixture.tables.transactions.length, 130)
  assert.equal(fixture.tables.rules.length, 1)
  assert.equal(fixture.tables.goals.length, 1)
  assert.equal(fixture.tables.settings.length, 3)
})

test('v1 database upgrades to v2 with every record intact', async () => {
  await seedV1()
  const { db, SCHEMA_VERSION, recategorize } = await import('../src/db.js')
  await db.open()
  assert.equal(db.verno, SCHEMA_VERSION)
  const meta = await db.meta.get('schema')
  assert.equal(meta.value, 2); assert.equal(meta.upgradedFrom, 1)

  const after = await db.transactions.toArray()
  assert.equal(after.length, fixture.tables.transactions.length)
  for (const before of fixture.tables.transactions) {
    const t = after.find((x) => x.id === before.id)
    const { merchant, ...rest } = t
    assert.deepEqual(rest, before, `txn ${before.id} changed`)
    assert.equal(merchant, merchantKey(before.description))
  }
  assert.deepEqual(await db.goals.toArray(), fixture.tables.goals)
  assert.deepEqual(await db.rules.toArray(), fixture.tables.rules)
  assert.deepEqual((await db.settings.toArray()).sort((a, b) => a.key.localeCompare(b.key)), [...fixture.tables.settings].sort((a, b) => a.key.localeCompare(b.key)))

  // The new index works: recategorize a merchant and every row from it follows.
  const t = after.find((x) => x.type === 'expense')
  await recategorize(t, 'groceries', true)
  const same = await db.transactions.where('merchant').equals(merchantKey(t.description)).toArray()
  assert.ok(same.length >= 1 && same.every((x) => x.type !== t.type || x.category === 'groceries'))

  // New writes get a merchant key too.
  const id = await db.transactions.add({ date: '2026-11-02', description: 'SONIC DRIVE IN #12', amount: 941, type: 'expense', category: 'eating_out' })
  assert.equal((await db.transactions.get(id)).merchant, merchantKey('SONIC DRIVE IN #12'))
  db.close()
})
