import { useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useCoachingStore } from '../stores/coachingStore'
import { COACHING_STYLES } from '../../../shared/constants'
import type { OverlayPanels } from '../../../shared/types'

// ─── Icônes ───────────────────────────────────────────────────────────────────

function IconSave() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Composants ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-600 mb-3 mt-1 px-1">
      {children}
    </div>
  )
}

const PANEL_META: { key: keyof OverlayPanels; label: string; desc: string }[] = [
  { key: 'stats',   label: 'Stats en jeu',        desc: 'KDA, CS, or, timer — haut-gauche' },
  { key: 'timers',  label: 'Timers & objectifs',   desc: 'Dragons, baron, herald — bas-gauche' },
  { key: 'advice',  label: 'Conseils macro',        desc: 'Tips en temps réel — haut-droite' },
  { key: 'style',   label: 'Switch de style',       desc: 'LCK / LEC / LCS / LPL — droite' },
  { key: 'build',   label: 'Build recommandé',      desc: 'Items situationnels — droite' },
]

export default function Settings() {
  const { settings, updateSettings } = useSettingsStore()
  const { selectedStyle } = useCoachingStore()
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const [saved, setSaved] = useState(false)

  const panels = settings.overlayPanels ?? { stats: true, timers: true, advice: true, style: true, build: true }

  const togglePanel = (key: keyof OverlayPanels) => {
    const updated = { ...panels, [key]: !panels[key] }
    updateSettings({ overlayPanels: updated })
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const card = {
    background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
    border: `1px solid ${c.border}`,
  }

  const inputBase = {
    backgroundColor: '#0a0e17',
    border: `1px solid ${c.border}`,
    color: c.text,
  }

  const labelCls = "block text-xs font-semibold mb-2" as const

  return (
    <div className="p-5 max-w-lg overflow-auto h-full flex flex-col gap-0">

      {/* ── Panneaux overlay ── */}
      <SectionLabel>Panneaux overlay</SectionLabel>

      <div className="rounded-xl p-4 mb-3 flex flex-col gap-3" style={card}>
        {PANEL_META.map(({ key, label, desc }) => {
          const active = panels[key]
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold" style={{ color: c.text, opacity: active ? 0.85 : 0.35 }}>
                  {label}
                </div>
                <div className="text-[10px]" style={{ color: c.text, opacity: 0.3 }}>
                  {desc}
                </div>
              </div>
              <button
                onClick={() => togglePanel(key)}
                className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: active ? c.accent : `${c.border}80`,
                  boxShadow: active ? `0 0 10px ${c.accent}50` : 'none',
                }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
                  style={{ left: active ? 'calc(100% - 1.125rem)' : '2px' }}
                />
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Voix ── */}
      <SectionLabel>Alertes vocales</SectionLabel>

      <div className="rounded-xl p-4 mb-3 flex flex-col gap-4" style={card}>
        {/* Toggle voix */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold" style={{ color: c.text, opacity: settings.voiceAlerts ? 0.85 : 0.35 }}>
              Voix activée
            </div>
            <div className="text-[10px]" style={{ color: c.text, opacity: 0.3 }}>
              Lit les alertes à voix haute (accent mexicain)
            </div>
          </div>
          <button
            onClick={() => updateSettings({ voiceAlerts: !settings.voiceAlerts })}
            className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-200"
            style={{
              backgroundColor: settings.voiceAlerts ? c.accent : `${c.border}80`,
              boxShadow: settings.voiceAlerts ? `0 0 10px ${c.accent}50` : 'none',
            }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
              style={{ left: settings.voiceAlerts ? 'calc(100% - 1.125rem)' : '2px' }}
            />
          </button>
        </div>

        {/* Slider volume */}
        <div style={{ opacity: settings.voiceAlerts ? 1 : 0.35, transition: 'opacity 0.2s' }}>
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls} style={{ color: c.text, opacity: 0.65, marginBottom: 0 }}>
              Volume
            </label>
            <span className="font-mono font-black text-sm" style={{ color: c.accent }}>
              {Math.round((settings.voiceVolume ?? 0.8) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((settings.voiceVolume ?? 0.8) * 100)}
            onChange={(e) => updateSettings({ voiceVolume: Number(e.target.value) / 100 })}
            disabled={!settings.voiceAlerts}
            className="range-slider w-full"
            style={{ '--accent': c.accent } as React.CSSProperties}
          />
        </div>
      </div>

      {/* ── Overlay ── */}
      <SectionLabel>Overlay en jeu</SectionLabel>

      <div className="rounded-xl p-4 mb-3" style={card}>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls} style={{ color: c.text, opacity: 0.65, marginBottom: 0 }}>
            Opacité
          </label>
          <span className="font-mono font-black text-sm" style={{ color: c.accent }}>
            {Math.round(settings.overlayOpacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(settings.overlayOpacity * 100)}
          onChange={(e) => updateSettings({ overlayOpacity: Number(e.target.value) / 100 })}
          className="range-slider w-full"
          style={{ '--accent': c.accent } as React.CSSProperties}
        />
      </div>

      <div className="rounded-xl p-4 mb-3" style={card}>
        <label className={labelCls} style={{ color: c.text, opacity: 0.65 }}>
          Raccourci clavier
        </label>
        <div className="flex items-center gap-3">
          <kbd
            className="px-4 py-2 rounded-lg border text-sm font-mono font-black tracking-widest"
            style={{ borderColor: `${c.accent}60`, color: c.accent, backgroundColor: `${c.accent}10` }}
          >
            {settings.hotkey}
          </kbd>
          <span className="text-xs" style={{ color: c.text, opacity: 0.35 }}>
            Affiche / masque l'overlay en partie
          </span>
        </div>
      </div>

      {/* ── Compte ── */}
      <SectionLabel>Compte & Région</SectionLabel>

      <div className="rounded-xl p-4 mb-3" style={card}>
        <label className={labelCls} style={{ color: c.text, opacity: 0.65 }}>
          Serveur de jeu
        </label>
        <select
          value={settings.region}
          onChange={(e) => updateSettings({ region: e.target.value })}
          className="px-3 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
          style={inputBase}
          onFocus={(e) => (e.target.style.borderColor = c.accent)}
          onBlur={(e) => (e.target.style.borderColor = c.border)}
        >
          {['EUW', 'EUNE', 'NA', 'KR', 'CN', 'BR', 'LAN', 'LAS', 'OCE', 'TR', 'RU'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* ── Sauvegarder ── */}
      <button
        onClick={handleSave}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98] flex-shrink-0 mt-2"
        style={{
          backgroundColor: saved ? '#22c55e' : c.accent,
          color: saved ? '#fff' : c.bg,
          boxShadow: saved ? '0 0 24px #22c55e35' : `0 0 24px ${c.accent}25`,
        }}
      >
        {saved ? <><IconSave /> Sauvegardé</> : 'Sauvegarder les paramètres'}
      </button>

    </div>
  )
}
