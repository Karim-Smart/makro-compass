import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettingsStore } from '../stores/settingsStore'
import { useCoachingStore } from '../stores/coachingStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { COACHING_STYLES, TIER_LABELS } from '../../../shared/constants'
import type { OverlayPanels } from '../../../shared/types'
import FeatureLock from '../components/FeatureLock'

// ─── Composants partagés ──────────────────────────────────────────────────────

function Toggle({ active, onToggle, accent, border }: {
  active: boolean
  onToggle: () => void
  accent: string
  border: string
}) {
  return (
    <button
      onClick={onToggle}
      className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-200"
      style={{
        backgroundColor: active ? accent : `${border}80`,
        boxShadow: active ? `0 0 10px ${accent}50` : 'none',
      }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{ left: active ? 'calc(100% - 1.125rem)' : '2px' }}
      />
    </button>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex-shrink-0" style={{ color: '#C89B3C' }}>{icon}</div>
      <div>
        <div className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: '#F0E6D2', opacity: 0.8 }}>{title}</div>
        {subtitle && <div className="text-[9px] mt-0.5" style={{ color: '#A0A7B4' }}>{subtitle}</div>}
      </div>
    </div>
  )
}

const PANEL_META: { key: keyof OverlayPanels; label: string; desc: string; pos: string }[] = [
  { key: 'stats',         label: 'Stats en jeu',       desc: 'KDA, CS, or, timer',           pos: 'Haut ↖'  },
  { key: 'timers',        label: 'Timers objectifs',    desc: 'Dragon, baron, herald',        pos: 'Bas ↙'   },
  { key: 'advice',        label: 'Conseils macro',      desc: 'Tips IA + alertes',            pos: 'Haut ↗'  },
  { key: 'style',         label: 'Switch de style',     desc: 'LCK / LEC / LCS / LPL',       pos: 'Milieu →' },
  { key: 'build',         label: 'Build recommandé',    desc: 'Items situationnels',          pos: 'Milieu →' },
  { key: 'wincondition',  label: 'Win Condition',       desc: 'Probabilité victoire (Elite)', pos: 'Haut ↑'  },
  { key: 'scoreboard',   label: 'Scoreboard',          desc: 'Gold diff par lane (5v5)',     pos: 'Bas ↓'   },
]

const REGIONS = ['EUW', 'EUNE', 'NA', 'KR', 'CN', 'BR', 'LAN', 'LAS', 'OCE', 'TR', 'RU']

export default function Settings() {
  const navigate = useNavigate()
  const { settings, updateSettings } = useSettingsStore()
  const { selectedStyle } = useCoachingStore()
  const { status: subStatus } = useSubscriptionStore()
  const tier = subStatus?.tier ?? 'free'
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const [saved, setSaved] = useState(false)
  const [capturingHotkey, setCapturingHotkey] = useState(false)

  // Capture globale de touche quand on attend le raccourci
  useEffect(() => {
    if (!capturingHotkey) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key === 'Escape') { setCapturingHotkey(false); return }
      if (/^F([1-9]|1[0-2])$/.test(e.key)) {
        updateSettings({ hotkey: e.key })
        setCapturingHotkey(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [capturingHotkey])

  const panels = settings.overlayPanels ?? { stats: true, timers: true, advice: true, style: true, build: true, wincondition: false }
  const togglePanel = (key: keyof OverlayPanels) =>
    updateSettings({ overlayPanels: { ...panels, [key]: !panels[key] } })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const card = {
    background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
    border: `1px solid ${c.border}`,
  }

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">

        {/* ─── Header page ─── */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-0.5 h-5 rounded-full" style={{ backgroundColor: '#C89B3C' }} />
          <h1 className="text-base font-black tracking-tight" style={{ color: '#F0E6D2', fontFamily: 'Cinzel, serif' }}>Paramètres</h1>
        </div>

        {/* ─── Layout 2 colonnes ─── */}
        <div className="grid grid-cols-2 gap-4 stagger-enter">

          {/* ── Colonne gauche ── */}
          <div className="flex flex-col gap-4">

            {/* Panneaux overlay */}
            <div className="clip-bevel-lg p-4" style={card}>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                }
                title="Panneaux overlay"
                subtitle="Visibilité pendant la partie"
              />
              <div className="flex flex-col gap-2.5">
                {PANEL_META.map(({ key, label, desc, pos }) => {
                  const active = panels[key]
                  return (
                    <div key={key} className="flex items-center gap-2.5">
                      {/* Indicateur position */}
                      <div
                        className="w-12 text-center py-0.5 clip-bevel-sm text-[7px] font-black flex-shrink-0"
                        style={{
                          backgroundColor: active ? `${c.accent}15` : `${c.border}50`,
                          color: active ? c.accent : '#4b5563',
                        }}
                      >
                        {pos}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold leading-none" style={{ color: c.text, opacity: active ? 0.85 : 0.35 }}>
                          {label}
                        </div>
                        <div className="text-[9px] mt-0.5" style={{ color: c.text, opacity: 0.25 }}>
                          {desc}
                        </div>
                      </div>
                      <Toggle active={active} onToggle={() => togglePanel(key)} accent={c.accent} border={c.border} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Alertes vocales */}
            <div className="clip-bevel-lg p-4" style={card}>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                }
                title="Alertes vocales"
                subtitle="Lecture TTS des alertes en partie"
              />

              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-semibold" style={{ color: c.text, opacity: settings.voiceAlerts ? 0.85 : 0.45 }}>
                    Voix activée
                  </div>
                  <div className="text-[9px]" style={{ color: c.text, opacity: 0.3 }}>
                    Accent mexicain — lit les alertes urgentes
                  </div>
                </div>
                <Toggle active={settings.voiceAlerts} onToggle={() => updateSettings({ voiceAlerts: !settings.voiceAlerts })} accent={c.accent} border={c.border} />
              </div>

              <div style={{ opacity: settings.voiceAlerts ? 1 : 0.3, transition: 'opacity 0.2s' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px]" style={{ color: c.text, opacity: 0.5 }}>Volume</span>
                  <span className="font-mono font-black text-xs" style={{ color: c.accent }}>
                    {Math.round((settings.voiceVolume ?? 0.8) * 100)}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={Math.round((settings.voiceVolume ?? 0.8) * 100)}
                  onChange={(e) => updateSettings({ voiceVolume: Number(e.target.value) / 100 })}
                  disabled={!settings.voiceAlerts}
                  className="range-slider w-full"
                  style={{ '--accent': c.accent } as React.CSSProperties}
                />
              </div>
            </div>

            {/* IA Avancée (Elite) */}
            <div className="clip-bevel-lg p-4" style={card}>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27A7 7 0 0 1 7.27 19H6a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                  </svg>
                }
                title="IA Avancée"
                subtitle="Fonctionnalités Elite"
              />

              <FeatureLock feature="shotcaller_mode">
                {/* Shotcaller Mode */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-semibold" style={{ color: c.text, opacity: settings.shotcallerMode ? 0.85 : 0.45 }}>
                      Mode Shotcaller
                    </div>
                    <div className="text-[9px] mt-0.5" style={{ color: c.text, opacity: 0.25 }}>
                      Ordres courts et directifs — parfait pour le TTS
                    </div>
                  </div>
                  <Toggle
                    active={settings.shotcallerMode ?? false}
                    onToggle={() => updateSettings({ shotcallerMode: !settings.shotcallerMode })}
                    accent={c.accent}
                    border={c.border}
                  />
                </div>
              </FeatureLock>

              <FeatureLock feature="custom_coach">
                {/* Custom Coach Tone */}
                <div>
                  <div className="text-[10px] font-semibold mb-1.5" style={{ color: c.text, opacity: 0.65 }}>
                    Personnalité du coach
                  </div>
                  <div className="text-[9px] mb-2" style={{ color: c.text, opacity: 0.25 }}>
                    Définit le ton des conseils IA (ex: "agressif et hype", "sarcastique")
                  </div>
                  <input
                    type="text"
                    value={settings.customCoachTone ?? ''}
                    onChange={(e) => updateSettings({ customCoachTone: e.target.value })}
                    placeholder="Ex: motivant et énergique"
                    maxLength={80}
                    className="w-full px-3 py-2 clip-bevel text-[11px] font-medium outline-none transition-all focus:ring-1"
                    style={{
                      backgroundColor: `${c.border}40`,
                      color: c.text,
                      border: `1px solid ${c.border}60`,
                      caretColor: c.accent,
                      // @ts-expect-error CSS custom prop
                      '--tw-ring-color': c.accent + '50',
                    }}
                  />
                </div>
              </FeatureLock>
            </div>

          </div>

          {/* ── Colonne droite ── */}
          <div className="flex flex-col gap-4">

            {/* Overlay — opacité + raccourci */}
            <div className="clip-bevel-lg p-4" style={card}>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                }
                title="Overlay en jeu"
                subtitle="Apparence de l'overlay LoL"
              />

              {/* Opacité */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px]" style={{ color: c.text, opacity: 0.5 }}>Opacité</span>
                  <span className="font-mono font-black text-xs" style={{ color: c.accent }}>
                    {Math.round(settings.overlayOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range" min={10} max={100}
                  value={Math.round(settings.overlayOpacity * 100)}
                  onChange={(e) => updateSettings({ overlayOpacity: Number(e.target.value) / 100 })}
                  className="range-slider w-full"
                  style={{ '--accent': c.accent } as React.CSSProperties}
                />
                {/* Aperçu visuel de l'opacité */}
                <div
                  className="mt-2 h-6 clip-bevel flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${c.border}80, ${c.bg})`,
                    border: `1px solid ${c.border}50`,
                    opacity: settings.overlayOpacity,
                  }}
                >
                  <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: c.accent }}>
                    Aperçu overlay
                  </span>
                </div>
              </div>

              {/* Raccourci */}
              <div>
                <div className="text-[10px] mb-1.5" style={{ color: c.text, opacity: 0.5 }}>Raccourci clavier</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCapturingHotkey(true)}
                    className="px-3 py-1.5 clip-bevel border text-sm font-mono font-black tracking-widest transition-all duration-150"
                    style={capturingHotkey ? {
                      borderColor: c.accent,
                      color: c.bg,
                      backgroundColor: c.accent,
                      boxShadow: `0 0 12px ${c.accent}50`,
                    } : {
                      borderColor: `${c.accent}60`,
                      color: c.accent,
                      backgroundColor: `${c.accent}10`,
                    }}
                    title="Cliquer pour changer le raccourci (F1-F12)"
                  >
                    {capturingHotkey ? '…' : settings.hotkey}
                  </button>
                  <span className="text-[9px]" style={{ color: c.text, opacity: 0.3 }}>
                    {capturingHotkey ? 'Appuie sur F1–F12 (Echap annule)' : 'Affiche / masque l\'overlay'}
                  </span>
                </div>
              </div>
            </div>

            {/* Compte & région */}
            <div className="clip-bevel-lg p-4" style={card}>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                  </svg>
                }
                title="Serveur de jeu"
                subtitle="Région Riot Games"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => updateSettings({ region: r })}
                    className="py-1.5 clip-bevel text-[10px] font-black transition-all duration-150"
                    style={settings.region === r ? {
                      backgroundColor: c.accent,
                      color: c.bg,
                      boxShadow: `0 0 8px ${c.accent}40`,
                    } : {
                      backgroundColor: `${c.border}50`,
                      color: c.text,
                      opacity: 0.5,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Abonnement */}
            <div className="clip-bevel-lg p-4" style={card}>
              <SectionHeader
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M3 20h18" />
                  </svg>
                }
                title="Abonnement"
                subtitle="Ton plan actuel"
              />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span
                    className="text-[10px] font-black px-2.5 py-1 clip-bevel-sm uppercase tracking-widest"
                    style={{
                      backgroundColor: tier === 'elite' ? '#FFD70020' : tier === 'pro' ? '#C89B3C20' : `${c.accent}20`,
                      color: tier === 'elite' ? '#FFD700' : tier === 'pro' ? '#C89B3C' : c.accent,
                      border: `1px solid ${tier === 'elite' ? '#FFD70040' : tier === 'pro' ? '#C89B3C40' : c.accent + '40'}`,
                    }}
                  >
                    {TIER_LABELS[tier]}
                  </span>
                </div>
                {subStatus?.expiresAt && (
                  <span className="text-[9px] font-mono" style={{ color: c.text, opacity: 0.3 }}>
                    Expire le {new Date(subStatus.expiresAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full py-2 clip-bevel text-xs font-bold transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: tier === 'free' ? '#C89B3C18' : `${c.accent}15`,
                  color: tier === 'free' ? '#C89B3C' : c.accent,
                  border: `1px solid ${tier === 'free' ? '#C89B3C40' : c.accent + '30'}`,
                }}
              >
                {tier === 'free' ? 'Passer à Pro' : 'Gérer mon abonnement'}
              </button>
            </div>

            {/* Info version */}
            <div
              className="clip-bevel-lg p-3 flex items-center justify-between"
              style={{ background: '#0A1628', border: '1px solid #C89B3C15' }}
            >
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#C89B3C', opacity: 0.5 }}>
                  ma<span style={{ color: '#F0E6D2' }}>K</span>ro Compass
                </div>
                <div className="text-[10px] font-mono" style={{ color: '#A0A7B4', opacity: 0.3 }}>
                  v0.1.0 · {selectedStyle} style
                </div>
              </div>
              <div
                className="text-[8px] font-black px-2 py-1 clip-bevel-sm tracking-widest"
                style={{ backgroundColor: '#C89B3C15', color: '#C89B3C', opacity: 0.7 }}
              >
                BETA
              </div>
            </div>

          </div>
        </div>

        {/* ─── Sauvegarder ─── */}
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 w-full py-2.5 clip-bevel-lg font-bold text-sm transition-all duration-200 active:scale-[0.98]"
          style={{
            backgroundColor: saved ? '#22c55e' : c.accent,
            color: saved ? '#fff' : c.bg,
            boxShadow: saved ? '0 0 24px #22c55e35' : `0 0 24px ${c.accent}25`,
          }}
        >
          {saved ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Sauvegardé
            </>
          ) : 'Sauvegarder les paramètres'}
        </button>

      </div>
    </div>
  )
}
