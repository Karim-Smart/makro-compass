import { useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import StylePicker from './pages/StylePicker'
import Draft from './pages/Draft'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Runes from './pages/Runes'
import Build from './pages/Build'
import Profile from './pages/Profile'
import Pricing from './pages/Pricing'
import { TitleBar } from './components/TitleBar'
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

function IconUser() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconCrown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5 flex-shrink-0">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M3 20h18" />
    </svg>
  )
}

// ─── Items de navigation ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/profile',   label: 'Profil',     Icon: IconUser     },
  { path: '/dashboard', label: 'Dashboard',  Icon: IconGrid     },
  { path: '/draft',     label: 'Draft',      Icon: IconSwords   },
  { path: '/runes',     label: 'Runes',      Icon: IconRunes    },
  { path: '/build',     label: 'Build',      Icon: IconBuild    },
  { path: '/stats',     label: 'Classées',   Icon: IconBarChart },
  { path: '/style',     label: 'Style',      Icon: IconGlobe    },
  { path: '/pricing',   label: 'Plans',      Icon: IconCrown    },
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
      <div className="flex flex-col h-screen" style={{ backgroundColor: '#010A13' }}>

        {/* ── Title bar frameless ── */}
        <TitleBar />

        {/* ── Barre de navigation LoL ── */}
        <nav
          className="flex items-center gap-0.5 px-3 py-0 flex-shrink-0"
          style={{
            backgroundColor: 'var(--hextech-blue-3)',
            borderBottom: '1px solid rgba(200, 155, 60, 0.2)',
          }}
        >
          {/* Liens */}
          {NAV_ITEMS.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all duration-150 relative"
              style={({ isActive }) => ({
                color: isActive ? 'var(--hextech-gold)' : 'var(--hextech-silver)',
                opacity: isActive ? 1 : 0.6,
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? 'var(--hextech-gold)' : 'currentColor' }}>
                    <Icon />
                  </span>
                  {label}
                  {/* Bordure basse dorée active */}
                  {isActive && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-0.5"
                      style={{ background: 'linear-gradient(90deg, transparent, var(--hextech-gold), transparent)' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Contenu ── */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/style"     element={<StylePicker />} />
            <Route path="/profile"   element={<Profile />} />
            <Route path="/draft"     element={<Draft />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/runes"     element={<Runes />} />
            <Route path="/build"     element={<Build />} />
            <Route path="/stats"     element={<Stats />} />
            <Route path="/pricing"   element={<Pricing />} />
            <Route path="/settings"  element={<Settings />} />
          </Routes>
        </main>

      </div>
    </HashRouter>
  )
}

export default App
