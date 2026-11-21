// "Where it leaks": the piping run with this month's open leaks. A flat drawing of the same run
// paints at once and stays on weak devices, without WebGL, or with Reduce Motion on. Otherwise the
// 3D view (pipeScene.js + three.js, its own chunk) loads after first paint and fades in over it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { afterFirstPaint, decide3D, forcedMode, probeDevice } from '../../caylor-ui/three/support.js'
import { buildModel, PATH } from './pipeModel.js'

// Isometric projection close to the 3D camera (above, slightly in front).
const P = ([x, y, z]) => [x * 100, z * 46 - y * 60]

function Drawing({ model }) {
  const d = PATH.map((p, i) => (i ? 'L' : 'M') + P(p).map((n) => n.toFixed(1)).join(' ')).join(' ')
  const flow = model.focus ? model.focus.t : 1
  return (
    <svg viewBox="-340 -80 680 200" className="pipe-svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="0" cy="10" rx="330" ry="70" className="pipe-floor" />
      <path d={d} className="pipe-body" />
      <path d={d} className="pipe-shine" />
      <path d={d} className="pipe-flow-mask" pathLength="1" strokeDasharray={`${flow} 1`} />
      <circle cx={P(PATH[0])[0]} cy={P(PATH[0])[1] - 22} r="13" className="pipe-valve" />
      {model.points.map((pt) => {
        const [x, y] = P(pt.pos)
        return (
          <g key={pt.id} className={pt.focus ? 'pipe-leak is-focus' : 'pipe-leak'}>
            <ellipse cx={x} cy={y + 34} rx={40 * pt.size} ry={12 * pt.size} className="pipe-puddle" />
            <circle cx={x} cy={y} r={30 * pt.size} className="pipe-glow" />
            <rect x={x - 6} y={y - 17} width="12" height="34" rx="3" className="pipe-flange" />
            <circle cx={x} cy={y + 18} r={4 + 3 * pt.size} className="pipe-drip" />
          </g>
        )
      })}
    </svg>
  )
}

export default function PipeRun({ leaks, focusId }) {
  const model = useMemo(() => buildModel(leaks, focusId), [leaks, focusId])
  const canvasRef = useRef(null)
  const view = useRef(null)
  const latest = useRef(model)
  latest.current = model
  const [mode, setMode] = useState('2d')
  const [live, setLive] = useState(false)

  useEffect(() => {
    const gate = decide3D(probeDevice(), forcedMode())
    if (!gate.use3D) { setMode('2d:' + gate.reason); return }
    let alive = true
    setMode('3d-pending')
    afterFirstPaint().then(() => import('./pipeScene.js')).then((m) => {
      if (!alive || !canvasRef.current) return
      view.current = m.mount(canvasRef.current, {
        model: latest.current,
        onLost: () => { view.current?.dispose(); view.current = null; setLive(false); setMode('2d:context-lost') },
      })
      if (location.search.includes('debug3d')) window.__scene3d = view.current
      setMode('3d')
      view.current.firstFrame.then(() => alive && setLive(true))
    }).catch(() => alive && setMode('2d:load-failed'))
    return () => { alive = false; view.current?.dispose(); view.current = null }
  }, [])

  useEffect(() => { view.current?.update(model) }, [model])

  const show3D = mode === '3d' || mode === '3d-pending'
  return (
    <div className="stage3d pipe-stage" data-live={live} data-mode={mode}>
      <Drawing model={model} />
      {show3D && <canvas ref={canvasRef} aria-hidden="true" />}
    </div>
  )
}
