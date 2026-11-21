// The piping run in 3D (lazy chunk: three.js loads only here, after first paint).
// Draws only while the flow animates (~7 s after a change), then stops: 0 frames when idle.
import {
  AdditiveBlending, CanvasTexture, CatmullRomCurve3, CircleGeometry, Color, CylinderGeometry, InstancedMesh, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry, SRGBColorSpace, Sprite, SpriteMaterial,
  TorusGeometry, TubeGeometry, Vector3,
} from 'three'
import { createStage } from '../../caylor-ui/three/stage.js'
import { PATH } from './pipeModel.js'

const CYAN = 0x22d3ee
const WARN = 0xffb547
const FLOW_SECONDS = 7
const PARTICLES = 24

function softTexture(inner, outer) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, inner); g.addColorStop(1, outer)
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** @returns {{ update(model): void, dispose(): void, frames(): number, stats(): object, workStats(): object }} */
export function mount(canvas, { model, onLost }) {
  const stage = createStage(canvas, { camera: [0, 2.9, 4.1], target: [0, -0.05, -0.2], fov: 36, onLost })
  const { scene } = stage
  const curve = new CatmullRomCurve3(PATH.map((p) => new Vector3(...p)), false, 'catmullrom', 0.15)

  // Floor shadow + the pipe (one tube, painted steel) on two stands.
  const floor = new Mesh(new PlaneGeometry(8, 4.4), new MeshBasicMaterial({ map: softTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }))
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
  const steel = new MeshStandardMaterial({ color: 0x8d99a6, metalness: 0.75, roughness: 0.38 })
  scene.add(new Mesh(new TubeGeometry(curve, 160, 0.13, 14, false), steel))
  const standMat = new MeshStandardMaterial({ color: 0x2b333d, metalness: 0.4, roughness: 0.7 })
  for (const t of [0.08, 0.92]) {
    const p = curve.getPointAt(t)
    const s = new Mesh(new CylinderGeometry(0.035, 0.05, 0.35, 10), standMat)
    s.position.set(p.x, 0.17, p.z)
    scene.add(s)
  }
  // Inlet valve wheel (where pay comes in) so the direction reads at a glance.
  const inlet = curve.getPointAt(0.02)
  const wheel = new Mesh(new TorusGeometry(0.16, 0.025, 8, 24), new MeshStandardMaterial({ color: 0x0e7490, metalness: 0.3, roughness: 0.5 }))
  wheel.position.set(inlet.x, inlet.y + 0.32, inlet.z)
  wheel.rotation.x = Math.PI / 2
  scene.add(wheel)

  // Leak joints: a flange ring, a glow, a falling drip and a puddle. Rebuilt when the data changes.
  const glowTex = softTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)')
  const flangeMat = new MeshStandardMaterial({ color: 0x5b6672, metalness: 0.8, roughness: 0.45 })
  let joints = []
  const clearJoints = () => {
    for (const j of joints) for (const o of j.objs) { scene.remove(o); o.geometry?.dispose(); if (o.material !== flangeMat) o.material.dispose() }
    joints = []
  }

  // Flow particles: one instanced draw call.
  const dots = new InstancedMesh(new SphereGeometry(0.075, 8, 6), new MeshBasicMaterial({ color: 0x9ff3ff }), PARTICLES)
  scene.add(dots)
  const dummy = new Object3D()

  let model0 = model
  let flowTo = 1
  const placeDots = (time) => {
    for (let i = 0; i < PARTICLES; i++) {
      const u = ((i / PARTICLES) + time * 0.12) % 1
      const p = curve.getPointAt(Math.min(0.999, u * flowTo))
      dummy.position.copy(p)
      dummy.position.y += 0.15 // ride along the top of the pipe so the flow is visible
      // Fade toward the inlet and bunch up at the leak: smaller at the start, full size near the end.
      dummy.scale.setScalar(0.5 + 0.5 * u)
      dummy.updateMatrix()
      dots.setMatrixAt(i, dummy.matrix)
    }
    dots.instanceMatrix.needsUpdate = true
  }

  function update(model) {
    model0 = model
    clearJoints()
    flowTo = model.focus ? model.flowTo : 1
    for (const pt of model.points) {
      const p = curve.getPointAt(pt.t)
      const tan = curve.getTangentAt(pt.t)
      const color = pt.focus ? WARN : CYAN
      const flange = new Mesh(new CylinderGeometry(0.19, 0.19, 0.07, 18), flangeMat)
      flange.position.copy(p)
      flange.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), tan)
      const glow = new Sprite(new SpriteMaterial({ map: glowTex, color, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: pt.focus ? 0.9 : 0.45 }))
      glow.position.set(p.x, p.y, p.z)
      glow.scale.setScalar((pt.focus ? 1.1 : 0.6) * pt.size)
      const drip = new Mesh(new SphereGeometry(0.05 * (0.6 + pt.size), 10, 8), new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: 0.9, roughness: 0.2 }))
      drip.position.set(p.x, p.y - 0.15, p.z)
      const puddle = new Mesh(new CircleGeometry(0.42 * pt.size, 28), new MeshBasicMaterial({ color, transparent: true, opacity: pt.focus ? 0.35 : 0.18, depthWrite: false }))
      puddle.rotation.x = -Math.PI / 2
      puddle.position.set(p.x, 0.005, p.z)
      for (const o of [flange, glow, drip, puddle]) scene.add(o)
      joints.push({ pt, p, glow, drip, objs: [flange, glow, drip, puddle] })
    }
    // Ease the camera a little toward the leak in focus (stays wide enough to see the whole run).
    const f = model.focus ? curve.getPointAt(model.focus.t) : new Vector3(0, 0.1, 0)
    stage.flyTo([f.x * 0.12, 2.9, 4.1], [f.x * 0.15, -0.05, -0.2], 1000)
    run()
  }

  let runId = 0
  function run() {
    const me = ++runId
    let t = 0
    stage.animate((dt) => {
      if (me !== runId) return false
      t += dt
      placeDots(t)
      for (const j of joints) {
        if (!j.pt.focus) continue
        const fall = (t * 0.9) % 1
        j.drip.position.y = j.p.y - 0.15 - fall * (j.p.y - 0.2)
        j.drip.scale.setScalar(1 - fall * 0.4)
        j.glow.material.opacity = 0.65 + 0.3 * Math.sin(t * 3.2)
      }
      if (t < FLOW_SECONDS) return true
      for (const j of joints) if (j.pt.focus) { j.drip.position.y = j.p.y - 0.15; j.drip.scale.setScalar(1); j.glow.material.opacity = 0.9 }
      return false
    })
  }

  placeDots(0)
  update(model0)
  return {
    update,
    dispose() { runId++; clearJoints(); glowTex.dispose(); stage.dispose() },
    frames: stage.frames,
    stats: stage.stats,
    workStats: stage.workStats,
  }
}
