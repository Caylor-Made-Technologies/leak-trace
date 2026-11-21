// The piping-run model: leaks -> joints on the pipe, focus fallback, sizes by money.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildModel, pointAt, PATH, MAX_POINTS } from '../src/three/pipeModel.js'

const L = (id, yearly) => ({ id, title: id, yearly })

test('no leaks: clean pipe, flow runs the whole length', () => {
  for (const x of [[], null, undefined, [null, { id: 'x', yearly: 0 }]]) {
    const m = buildModel(x, null)
    assert.equal(m.points.length, 0); assert.equal(m.focus, null); assert.equal(m.flowTo, 1)
  }
})

test('focus falls back to the biggest leak; flow ends at the focused joint', () => {
  const m = buildModel([L('a', 1000), L('b', 9000), L('c', 3000)], 'missing')
  assert.equal(m.focus.id, 'b')
  assert.equal(m.flowTo, m.focus.t)
  assert.equal(buildModel([L('a', 1000), L('b', 9000)], 'a').focus.id, 'a')
})

test('at most five joints, in order along the pipe, sized by money', () => {
  const m = buildModel([1, 2, 3, 4, 5, 6, 7].map((i) => L('l' + i, i * 1000)), null)
  assert.equal(m.points.length, MAX_POINTS)
  for (let i = 1; i < m.points.length; i++) assert.ok(m.points[i].t > m.points[i - 1].t)
  for (const p of m.points) assert.ok(p.t > 0 && p.t < 1 && p.size > 0 && p.size <= 1)
  assert.ok(m.points[4].size > m.points[0].size)
})

test('pointAt walks the path end to end', () => {
  assert.deepEqual(pointAt(0), PATH[0])
  assert.deepEqual(pointAt(1), PATH[PATH.length - 1])
  assert.deepEqual(pointAt(-5), PATH[0])
})
