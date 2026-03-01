import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useCoachingStore } from '../stores/coachingStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'

interface QuotaInfo { used: number; resetAt: number }

// ─── Icônes ───────────────────────────────────────────────────────────────────

function EyeOpen() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

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

export default function Settings() {
  const { settings, updateSettings } = useSettingsStore()
  const { selectedStyle } = useCoachingStore()
  const { status: subStatus } = useSubscriptionStore()
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const [apiKey, setApiKey] = useState(settings.apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)

  useEffect(() => {
    window.electronAPI.invoke(IPC.QUOTA_STATUS)
      .then((data) => setQuota(data as QuotaInfo))
      .catch(() => null)
  }, [])

  const handleSave = () => {
    updateSettings({ apiKey, overlayOpacity: settings.overlayOpacity })
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

      {/* ── IA ── */}
      <SectionLabel>Intelligence artificielle</SectionLabel>

      <div className="rounded-xl p-4 mb-3" style={card}>
        <label className={labelCls} style={{ color: c.text, opacity: 0.65 }}>
          Clé API Anthropic
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="w-full pr-10 px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none transition-colors"
            style={inputBase}
            onFocus={(e) => (e.target.style.borderColor = c.accent)}
            onBlur={(e) => (e.target.style.borderColor = c.border)}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-35 hover:opacity-70 transition-opacity"
            style={{ color: c.text }}
            tabIndex={-1}
          >
            {showKey ? <EyeOff /> : <EyeOpen />}
          </button>
        </div>
        <p className="text-[10px] mt-1.5 px-0.5" style={{ color: c.text, opacity: 0.3 }}>
          Utilisée pour générer des conseils via Claude Haiku.
          Obtenir une clé sur <span className="underline opacity-60">console.anthropic.com</span>
        </p>
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

      <div className="rounded-xl p-4 mb-5" style={card}>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls} style={{ color: c.text, opacity: 0.65, marginBottom: 0 }}>
            Quota de conseils IA
          </label>
          {subStatus && (
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase"
              style={{ backgroundColor: c.accent, color: c.bg }}
            >
              {subStatus.tier}
            </span>
          )}
        </div>

        {quota && subStatus ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-black text-2xl" style={{ color: c.accent }}>
                {quota.used}
              </span>
              <span className="font-mono text-sm" style={{ color: c.text, opacity: 0.35 }}>
                / {subStatus.quotaMax ?? '∞'}
              </span>
              <span className="text-[10px] ml-0.5" style={{ color: c.text, opacity: 0.28 }}>
                aujourd'hui
              </span>
            </div>

            {subStatus.quotaMax && (
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${c.border}80` }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (quota.used / subStatus.quotaMax) * 100)}%`,
                    backgroundColor: c.accent,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            )}

            <p className="text-[10px]" style={{ color: c.text, opacity: 0.28 }}>
              Réinitialisation le {new Date(quota.resetAt).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        ) : (
          <div className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: c.border }} />
        )}
      </div>

      {/* ── Sauvegarder ── */}
      <button
        onClick={handleSave}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98] flex-shrink-0"
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
