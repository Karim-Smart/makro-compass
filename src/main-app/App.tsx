import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import StylePicker from './pages/StylePicker'
import Draft from './pages/Draft'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Runes from './pages/Runes'
import Build from './pages/Build'
import { initGameStoreIpc } from './stores/gameStore'
import { initCoachingStoreIpc } from './stores/coachingStore'
import { initSubscriptionStoreIpc } from './stores/subscriptionStore'
import { initOverlayStoreIpc } from './stores/overlayStore'
import { initSettingsStoreIpc } from './stores/settingsStore'
import { useCoachingStore } from './stores/coachingStore'
import { useDraftStore } from './stores/draftStore'
import { COACHING_STYLES } from '../../shared/constants'

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

function IconGlobe() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function IconBarChart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconGear() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconCompass() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4 flex-shrink-0">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function IconSwords() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="M16 16l4 4" />
      <path d="M9.5 6.5L21 18v3h-3L6.5 9.5" />
    </svg>
  )
}

function IconRunes() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function IconBuild() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

// ─── Items de navigation ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/',          label: 'Région',     Icon: IconGlobe    },
  { path: '/draft',     label: 'Draft',      Icon: IconSwords   },
  { path: '/dashboard', label: 'Dashboard',  Icon: IconGrid     },
  { path: '/runes',     label: 'Runes',      Icon: IconRunes    },
  { path: '/build',     label: 'Build',      Icon: IconBuild    },
  { path: '/stats',     label: 'Classées',   Icon: IconBarChart },
  { path: '/settings',  label: 'Paramètres', Icon: IconGear     },
] as const

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const selectedStyle = useCoachingStore((s) => s.selectedStyle)
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('[App] window.electronAPI non disponible — preload non chargé')
      return
    }
    initGameStoreIpc()
    initCoachingStoreIpc()
    initSubscriptionStoreIpc()
    initOverlayStoreIpc()
    initSettingsStoreIpc()
    useDraftStore.getState().init()
  }, [])

  return (
    <HashRouter>
      <div className="flex flex-col h-screen" style={{ backgroundColor: c.bg }}>

        {/* ── Barre de navigation ── */}
        <nav
          className="flex items-center gap-1 px-3 py-2 flex-shrink-0"
          style={{
            backgroundColor: `${c.bg}F0`,
            borderBottom: `1px solid ${c.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 mr-3 px-1" style={{ color: c.accent }}>
            <IconCompass />
            <span className="font-black text-sm tracking-tight">
              ma<span style={{ color: c.accent }}>K</span>ro
              <span className="font-medium opacity-60 ml-1 text-white">Compass</span>
            </span>
          </div>

          {/* Séparateur vertical */}
          <div className="h-4 w-px mr-2 opacity-20" style={{ backgroundColor: c.text }} />

          {/* Liens */}
          {NAV_ITEMS.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={({ isActive }) => ({
                color: isActive ? c.accent : c.text,
                backgroundColor: isActive ? `${c.accent}18` : 'transparent',
                opacity: isActive ? 1 : 0.55,
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? c.accent : 'currentColor' }}>
                    <Icon />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Contenu ── */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"          element={<StylePicker />} />
            <Route path="/draft"     element={<Draft />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/runes"     element={<Runes />} />
            <Route path="/build"     element={<Build />} />
            <Route path="/stats"     element={<Stats />} />
            <Route path="/settings"  element={<Settings />} />
          </Routes>
        </main>

      </div>
    </HashRouter>
  )
}

export default App
