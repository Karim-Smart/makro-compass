import { useCoachingStore } from '../stores/coachingStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { COACHING_STYLES, TIER_PRICING, TIER_LABELS } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'
import type { SubscriptionTier } from '../../../shared/types'

interface TierFeature {
  label: string
  free: boolean | string
  pro: boolean | string
  elite: boolean | string
}

const FEATURES: TierFeature[] = [
  { label: 'Overlay Stats + Timers',          free: true,          pro: true,          elite: true },
  { label: 'Macro tips (non-IA)',             free: true,          pro: true,          elite: true },
  { label: 'Build algorithmique',             free: true,          pro: true,          elite: true },
  { label: 'Grade post-game',                 free: true,          pro: true,          elite: true },
  { label: 'Draft statique',                  free: true,          pro: true,          elite: true },
  { label: 'Conseils IA / jour',              free: '5',           pro: '25',          elite: 'Illimité' },
  { label: 'Cooldown conseils',               free: '60s',         pro: '30s',         elite: '25s' },
  { label: 'Styles coaching',                 free: 'LCK',         pro: '4 styles',    elite: '4 styles' },
  { label: 'Overlay Conseils + Build + Style', free: false,        pro: true,          elite: true },
  { label: 'Variantes de runes',              free: 'Standard',    pro: '3 variantes', elite: '3 variantes' },
  { label: 'Import classé LCU',              free: false,         pro: true,          elite: true },
  { label: 'AI Draft Oracle',                 free: false,         pro: true,          elite: true },
  { label: 'AI Post-Game Debrief',            free: false,         pro: true,          elite: true },
  { label: 'AI Smart Recap',                  free: false,         pro: true,          elite: true },
  { label: 'AI Matchup Briefing',             free: false,         pro: true,          elite: true },
  { label: 'AI Win Condition Tracker',         free: false,         pro: false,         elite: true },
  { label: 'AI Tilt Detector',                free: false,         pro: false,         elite: true },
  { label: 'Mode Shotcaller',                 free: false,         pro: false,         elite: true },
  { label: 'Coach personnalisé',              free: false,         pro: false,         elite: true },
  { label: 'Voice coaching TTS',              free: false,         pro: false,         elite: true },
]

function Check() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Lock() {
  return (
    <svg className="w-3.5 h-3.5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function FeatureCell({ value, accentColor }: { value: boolean | string; accentColor: string }) {
  if (value === true) return <span style={{ color: accentColor }}><Check /></span>
  if (value === false) return <Lock />
  return <span className="text-[11px] font-medium" style={{ color: accentColor }}>{value}</span>
}

export default function Pricing() {
  const selectedStyle = useCoachingStore((s) => s.selectedStyle)
  const c = COACHING_STYLES[selectedStyle].colors
  const currentTier = useSubscriptionStore((s) => s.status?.tier ?? 'free')

  const handleUpgrade = (tier: SubscriptionTier) => {
    if (tier === currentTier || tier === 'free') return
    window.electronAPI.invoke(IPC.OPEN_CHECKOUT, tier)
  }

  const tiers: { key: SubscriptionTier; accent: string; border: string }[] = [
    { key: 'free',  accent: c.text,    border: c.border },
    { key: 'pro',   accent: '#9B6EF3', border: '#3D1F6B' },
    { key: 'elite', accent: '#FFD700', border: '#5C4A00' },
  ]

  return (
    <div className="h-full overflow-y-auto px-6 py-6" style={{ backgroundColor: c.bg }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black mb-2" style={{ color: c.accent }}>
          Choisis ton plan
        </h1>
        <p className="text-sm opacity-60" style={{ color: c.text }}>
          Débloque les fonctionnalités IA avancées pour dominer la Faille
        </p>
      </div>

      {/* 3 colonnes de prix */}
      <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
        {tiers.map(({ key, accent, border }) => {
          const isCurrent = key === currentTier
          const price = TIER_PRICING[key]
          const label = TIER_LABELS[key]

          return (
            <div
              key={key}
              className="clip-bevel-lg p-5 flex flex-col items-center gap-3 transition-all"
              style={{
                backgroundColor: `${c.bg}`,
                border: `2px solid ${isCurrent ? accent : border}`,
                boxShadow: isCurrent ? `0 0 20px ${accent}30` : 'none',
              }}
            >
              {/* Badge tier */}
              <span
                className="px-3 py-0.5 clip-bevel-sm text-[10px] font-black uppercase tracking-widest"
                style={{
                  backgroundColor: `${accent}20`,
                  color: accent,
                  border: `1px solid ${accent}40`,
                }}
              >
                {label}
              </span>

              {/* Prix */}
              <div className="text-center">
                <span className="text-3xl font-black" style={{ color: accent }}>
                  {price === 0 ? 'Gratuit' : `${price}€`}
                </span>
                {price > 0 && (
                  <span className="text-xs opacity-50 ml-1" style={{ color: c.text }}>/mois</span>
                )}
              </div>

              {/* Bouton */}
              {isCurrent ? (
                <span
                  className="w-full text-center py-2 clip-bevel text-xs font-bold"
                  style={{ backgroundColor: `${accent}15`, color: accent }}
                >
                  Plan actuel
                </span>
              ) : (
                <button
                  onClick={() => handleUpgrade(key)}
                  className="w-full py-2 clip-bevel text-xs font-bold transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: accent,
                    color: key === 'elite' ? '#000' : '#fff',
                  }}
                >
                  {key === 'free' ? 'Rétrograder' : `Passer à ${label}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Tableau comparatif */}
      <div className="max-w-3xl mx-auto clip-bevel-lg overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: `${c.border}40` }}>
              <th className="text-left px-4 py-2 text-xs font-bold" style={{ color: c.text }}>Fonctionnalité</th>
              {tiers.map(({ key, accent }) => (
                <th key={key} className="px-4 py-2 text-xs font-bold text-center" style={{ color: accent }}>
                  {TIER_LABELS[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((feat, i) => (
              <tr
                key={feat.label}
                style={{
                  backgroundColor: i % 2 === 0 ? 'transparent' : `${c.border}20`,
                  borderTop: `1px solid ${c.border}30`,
                }}
              >
                <td className="px-4 py-2 text-xs" style={{ color: c.text }}>{feat.label}</td>
                {tiers.map(({ key, accent }) => (
                  <td key={key} className="px-4 py-2 text-center">
                    <div className="flex justify-center">
                      <FeatureCell value={feat[key]} accentColor={accent} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
