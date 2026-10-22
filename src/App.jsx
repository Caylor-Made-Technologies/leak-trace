import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AppProvider, useApp } from './state.jsx'
import Logo from './components/Logo.jsx'
import { IconButton, haptic, spring } from './components/ui.jsx'
import { DropIcon, EyeIcon, EyeOffIcon, GearIcon, HomeIcon, ListIcon, PlusIcon, TargetIcon } from './components/icons.jsx'
import Toast from './components/Toast.jsx'
import Home from './screens/Home.jsx'
import Activity from './screens/Activity.jsx'
import Leaks from './screens/Leaks.jsx'
import Plan from './screens/Plan.jsx'
import AddSheet from './screens/AddSheet.jsx'

const Settings = lazy(() => import('./screens/Settings.jsx'))

const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'activity', label: 'Activity', Icon: ListIcon },
  { id: 'add' },
  { id: 'leaks', label: 'Leaks', Icon: DropIcon },
  { id: 'plan', label: 'Plan', Icon: TargetIcon },
]
const ORDER = ['home', 'activity', 'leaks', 'plan']

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { privacy, togglePrivacy, leaks, plugged } = useApp()
  const [tab, setTab] = useState(() => {
    const h = location.hash.slice(1)
    return ORDER.includes(h) ? h : 'home'
  })
  const [dir, setDir] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [addMode, setAddMode] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => { history.replaceState(null, '', `#${tab}`) }, [tab])

  const go = (id) => {
    if (id === tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setDir(ORDER.indexOf(id) > ORDER.indexOf(tab) ? 1 : -1)
    setTab(id)
    window.scrollTo({ top: 0 })
  }
  const openAdd = (mode = null) => { setAddMode(mode); setAddOpen(true) }
  const openLeaks = leaks.filter((l) => !plugged.has(l.id)).length

  const screens = {
    home: <Home go={go} openAdd={openAdd} />,
    activity: <Activity openAdd={openAdd} />,
    leaks: <Leaks go={go} openAdd={openAdd} />,
    plan: <Plan />,
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <div className="backdrop" aria-hidden="true"><div className="grid" /><div className="orb a" /><div className="orb b" /></div>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-3 focus:text-white">Skip to content</a>

      <header className="glass sticky top-0 z-30 border-b border-line safe-top">
        <div className="flex items-center gap-2.5 px-4 py-2">
          <Logo size={42} simple />
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="font-display text-[17px] font-extrabold uppercase tracking-wide">Money Leak <span className="text-accent">Finder</span></h1>
            <p className="text-[11px] text-faint">by Caylor Made Technologies</p>
          </div>
          <IconButton label={privacy ? 'Show amounts' : 'Hide amounts'} onClick={() => { haptic(); togglePrivacy() }} aria-pressed={privacy}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={privacy ? 'off' : 'on'} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring}>
                {privacy ? <EyeOffIcon size={22} /> : <EyeIcon size={22} />}
              </motion.span>
            </AnimatePresence>
          </IconButton>
          <IconButton label="Settings and privacy" onClick={() => setSettingsOpen(true)}>
            <motion.span whileHover={{ rotate: 90 }} transition={spring}><GearIcon size={22} /></motion.span>
          </IconButton>
        </div>
      </header>

      <main id="main" className="px-4 pb-32 pt-3">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={tab}
            custom={dir}
            variants={{
              enter: (d) => ({ x: d * 40, opacity: 0, filter: 'blur(4px)' }),
              center: { x: 0, opacity: 1, filter: 'blur(0px)' },
              exit: (d) => ({ x: d * -40, opacity: 0, filter: 'blur(4px)' }),
            }}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {screens[tab]}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-line safe-bottom">
        <ul className="grid grid-cols-5 items-end px-2 pt-1.5">
          {TABS.map((t) => t.id === 'add' ? (
            <li key="add" className="flex justify-center">
              <motion.button
                onClick={() => { haptic(12); openAdd() }}
                aria-label="Add money in or out"
                whileTap={{ scale: 0.86, rotate: 90 }}
                whileHover={{ scale: 1.06 }}
                transition={spring}
                className="shine -mt-7 grid h-16 w-16 place-items-center rounded-[22px] bg-gradient-to-br from-brand-2 to-brand text-white shadow-[0_10px_30px_-6px_rgba(27,99,235,0.9)] ring-4 ring-bg"
              >
                <PlusIcon size={30} strokeWidth={2.6} />
              </motion.button>
            </li>
          ) : (
            <li key={t.id}>
              <button
                onClick={() => { haptic(); go(t.id) }}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-colors ${tab === t.id ? 'text-accent' : 'text-faint'}`}
              >
                {tab === t.id && <motion.span layoutId="tabGlow" className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-brand-2 shadow-[0_0_12px_2px_rgba(61,139,255,0.7)]" transition={spring} />}
                <motion.span animate={{ y: tab === t.id ? -2 : 0, scale: tab === t.id ? 1.12 : 1 }} transition={spring} className="relative">
                  <t.Icon size={23} />
                  {t.id === 'leaks' && openLeaks > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}
                      className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#d92d20] px-1 text-[10px] font-bold text-white"
                      aria-hidden="true"
                    >{openLeaks}</motion.span>
                  )}
                </motion.span>
                {t.label}
                {t.id === 'leaks' && openLeaks > 0 && <span className="sr-only">, {openLeaks} open</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <AddSheet open={addOpen} mode={addMode} setMode={setAddMode} onClose={() => setAddOpen(false)} />
      {settingsOpen && (
        <Suspense fallback={null}>
          <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      <Toast />
    </div>
  )
}
