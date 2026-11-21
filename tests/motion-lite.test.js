// The small motion stand-in: the one piece of math it owns.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpolate } from '../src/lib/interpolate.js'

test('interpolate maps and clamps like useTransform', () => {
  const f = (v) => interpolate([-110, -40, 0], [1, 0.4, 0], v)
  assert.equal(f(-200), 1); assert.equal(f(0), 0); assert.equal(f(10), 0)
  assert.ok(Math.abs(f(-40) - 0.4) < 1e-9)
  assert.ok(Math.abs(f(-75) - 0.7) < 1e-9)
})
