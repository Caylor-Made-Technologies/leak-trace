// Charts load in their own chunk (recharts is ~118 KB gzip), after the first screen has painted.
// Each one reserves its height while loading so nothing jumps.
import { lazy, Suspense } from 'react'

const load = () => import('./charts.jsx')
const wrap = (name, height) => {
  const C = lazy(() => load().then((m) => ({ default: m[name] })))
  function Lazy(props) {
    return (
      <Suspense fallback={<div className="skeleton" style={{ height }} role="status" aria-label="Loading chart" />}>
        <C {...props} />
      </Suspense>
    )
  }
  Lazy.displayName = `Lazy${name}`
  return Lazy
}

export const IncomeSpendingChart = wrap('IncomeSpendingChart', 220)
export const GroupDonut = wrap('GroupDonut', 200)
export const CategoryBars = wrap('CategoryBars', 240)
export const GrowthChart = wrap('GrowthChart', 220)
