import { useEffect, useState } from 'react'
import { useCoachingStore } from '../stores/coachingStore'
import { COACHING_STYLES } from '../../../shared/constants'
import { IPC } from '../../../shared/ipc-channels'
import { getChampionIconUrl } from '../../../shared/champion-images'
import { computeInsights } from '../../../shared/game-analysis'
import type { RankedGame } from '../../../shared/types'

// ─── Calcul des métriques GPI ─────────────────────────────────────────────────

interface GPIMetrics {
  farming: number       // CS/min normalisé (ADC: 7+ = 100)
  vision: number        // Ward score / min (Support: 2+ = 100)
  kda: number           // KDA moyen (5+ = 100)
  winrate: number       // % victoires
  consistency: number   // Faible variance = haute consistance
  killParticipation: number  // KP% moyen
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

function computeGPI(games: RankedGame[]): GPIMetrics {
  const recent = games.slice(0, 20)
  if (!recent.length) {
    return { farming: 0, vision: 0, kda: 0, winrate: 0, consistency: 0, killParticipation: 0 }
  }

  // Farming — ADC benchmark : 7 CS/min = 100, 4 CS/min = 50
  const csPerMin = recent.map(g => g.gameTime > 0 ? g.cs / (g.gameTime / 60) : 0)
  const farming = clamp(Math.round((avg(csPerMin) / 7) * 100))

  // Vision — Support benchmark : 2 wards/min = 100
  const wardPerMin = recent.map(g => g.gameTime > 0 ? g.wardScore / (g.gameTime / 60) : 0)
  const vision = clamp(Math.round((avg(wardPerMin) / 2) * 100))

  // KDA — 5.0 KDA = 100
  const kdas = recent.map(g => g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths)
  const kda = clamp(Math.round((avg(kdas) / 5) * 100))

  // Winrate brut
  const wins = recent.filter(g => g.result === 'win').length
  const winrate = Math.round((wins / recent.length) * 100)

  // Consistance — faible écart-type de KDA = haute consistance
  const meanKda = avg(kdas)
  const stddev = Math.sqrt(avg(kdas.map(k => Math.pow(k - meanKda, 2))))
  const consistency = clamp(Math.round(100 - (stddev / (meanKda + 0.1)) * 60))

  // Kill participation
  const kp = recent.map(g => g.teamKills > 0 ? ((g.kills + g.assists) / g.teamKills) * 100 : 0)
  const killParticipation = clamp(Math.round(avg(kp)))

  return { farming, vision, kda, winrate, consistency, killParticipation }
}

interface ChampionStat {
  name: string
  games: number
  wins: number
  kda: number
  csPerMin: number
}

function computeChampionPool(games: RankedGame[]): ChampionStat[] {
  const map: Record<string, { games: number; wins: number; kdasSum: number; csSum: number; timeSum: number }> = {}
  for (const g of games) {
    if (!map[g.champion]) map[g.champion] = { games: 0, wins: 0, kdasSum: 0, csSum: 0, timeSum: 0 }
    const e = map[g.champion]
    e.games++
    if (g.result === 'win') e.wins++
    const kda = g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths
    e.kdasSum += kda
    e.csSum += g.cs
    e.timeSum += g.gameTime
  }
  return Object.entries(map)
    .map(([name, s]) => ({
      name,
      games: s.games,
      wins: s.wins,
      kda: Math.round((s.kdasSum / s.games) * 100) / 100,
      csPerMin: s.timeSum > 0 ? Math.round((s.csSum / (s.timeSum / 60)) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5)
}

// ─── Radar SVG (hexagone) ─────────────────────────────────────────────────────

const RADAR_LABELS = ['Farming', 'Vision', 'KDA', 'Winrate', 'Consistance', 'KP%']

function RadarChart({ metrics, accent, border, text }: {
  metrics: GPIMetrics
  accent: string
  border: string
  text: string
}) {
  const values = [
    metrics.farming,
    metrics.vision,
    metrics.kda,
    metrics.winrate,
    metrics.consistency,
    metrics.killParticipation,
  ]

  const size = 180
  const cx = size / 2
  const cy = size / 2
  const maxR = 70
  const levels = [20, 40, 60, 80, 100]
  const n = values.length

  function polarToXY(angle: number, r: number) {
    const rad = (angle - 90) * (Math.PI / 180)
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function levelPolygon(pct: number) {
    const r = (pct / 100) * maxR
    return Array.from({ length: n }, (_, i) => {
      const { x, y } = polarToXY((360 / n) * i, r)
      return `${x},${y}`
    }).join(' ')
  }

  function dataPolygon() {
    return values.map((v, i) => {
      const r = (v / 100) * maxR
      const { x, y } = polarToXY((360 / n) * i, r)
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grilles de fond */}
      {levels.map(l => (
        <polygon
          key={l}
          points={levelPolygon(l)}
          fill="none"
          stroke={`${border}`}
          strokeWidth={l === 100 ? 1 : 0.5}
          opacity={l === 100 ? 0.6 : 0.25}
        />
      ))}

      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const { x, y } = polarToXY((360 / n) * i, maxR)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={border} strokeWidth={0.5} opacity={0.35} />
      })}

      {/* Données */}
      <polygon
        points={dataPolygon()}
        fill={`${accent}22`}
        stroke={accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Points de données */}
      {values.map((v, i) => {
        const r = (v / 100) * maxR
        const { x, y } = polarToXY((360 / n) * i, r)
        return (
          <circle key={i} cx={x} cy={y} r={3} fill={accent} opacity={0.9} />
        )
      })}

      {/* Labels */}
      {RADAR_LABELS.map((label, i) => {
        const { x, y } = polarToXY((360 / n) * i, maxR + 14)
        const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'
        return (
          <text
            key={i}
            x={x}
            y={y + 4}
            textAnchor={anchor}
            fontSize={8.5}
            fontWeight={700}
            fill={text}
            opacity={0.5}
            fontFamily="monospace"
            textLength={undefined}
          >
            {label}
          </text>
        )
      })}

      {/* Score global au centre */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={900} fill={accent} fontFamily="monospace">
        {Math.round(Object.values(metrics).reduce((a, b) => a + b, 0) / 6)}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={7} fontWeight={700} fill={text} opacity={0.35} fontFamily="monospace">
        GPI
      </text>
    </svg>
  )
}

// ─── Page Profil ──────────────────────────────────────────────────────────────

export default function Profile() {
  const { selectedStyle } = useCoachingStore()
  const style = COACHING_STYLES[selectedStyle]
  const c = style.colors

  const [games, setGames] = useState<RankedGame[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    // Charger toutes les parties (Solo + Flex) pour le GPI
    window.electronAPI.invoke(IPC.RANKED_HISTORY)
      .then((data) => setGames((data as RankedGame[]) ?? []))
      .catch(() => setGames([]))
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Auto-refresh quand une partie se termine ou que l'import LCU se complète
  useEffect(() => {
    const onImportDone = () => setRefreshKey((k) => k + 1)
    window.electronAPI.on(IPC.RANKED_IMPORT_DONE, onImportDone)
    return () => window.electronAPI.removeListener(IPC.RANKED_IMPORT_DONE, onImportDone)
  }, [])

  const gpi = computeGPI(games)
  const championPool = computeChampionPool(games)
  const insights = computeInsights(games)
  const recent20 = games.slice(0, 20)
  const recent10 = games.slice(0, 10)

  const totalGames = games.length
  const totalWins = games.filter(g => g.result === 'win').length
  const globalWinrate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  // Streak actuel
  let streak = 0
  let streakType: 'win' | 'loss' | null = null
  for (const g of games) {
    if (!streakType) { streakType = g.result; streak = 1 }
    else if (g.result === streakType) streak++
    else break
  }

  // Parties du jour
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayGames = games.filter(g => g.timestamp >= todayStart.getTime())
  const todayWins = todayGames.filter(g => g.result === 'win').length

  const GPI_LABELS: { key: keyof GPIMetrics; label: string; desc: string }[] = [
    { key: 'farming',           label: 'Farming',     desc: 'CS/min moyen' },
    { key: 'vision',            label: 'Vision',      desc: 'Wards/min moyen' },
    { key: 'kda',               label: 'KDA',         desc: 'KDA moyen' },
    { key: 'winrate',           label: 'Winrate',     desc: '% victoires' },
    { key: 'consistency',       label: 'Consistance', desc: 'Régularité du KDA' },
    { key: 'killParticipation', label: 'KP%',         desc: 'Participation aux kills' },
  ]

  function scoreColor(v: number) {
    if (v >= 70) return '#22c55e'
    if (v >= 45) return c.accent
    return '#ef4444'
  }

  return (
    <div className="flex flex-col gap-4 p-5 h-full overflow-auto">

      {/* ── Header ── */}
      <div
        className="clip-bevel-lg px-5 py-4 flex items-center justify-between"
        style={{
          background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border}70 100%)`,
          border: `1px solid ${c.border}`,
          boxShadow: `0 0 40px ${c.accent}10`,
        }}
      >
        <div className="flex items-center gap-4">
          {/* Avatar placeholder */}
          <div
            className="w-12 h-12 clip-bevel flex items-center justify-center font-black text-lg flex-shrink-0"
            style={{ background: `${c.accent}20`, border: `1.5px solid ${c.accent}50`, color: c.accent }}
          >
            {selectedStyle}
          </div>
          <div>
            <div className="font-black text-white text-base leading-tight">Summoner</div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: c.text, opacity: 0.4 }}>
              {style.label} · {style.region}
            </div>
          </div>
        </div>

        {/* Streak + winrate global */}
        <div className="flex items-center gap-5">
          {streak > 1 && streakType && (
            <div className="text-right">
              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: streakType === 'win' ? '#22c55e' : '#ef4444', opacity: 0.7 }}>
                {streakType === 'win' ? 'WinStreak' : 'LoseStreak'}
              </div>
              <div className="font-mono font-black text-2xl leading-none" style={{ color: streakType === 'win' ? '#22c55e' : '#ef4444' }}>
                {streak}
              </div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: c.text, opacity: 0.35 }}>Winrate</div>
            <div className="font-mono font-black text-2xl leading-none" style={{ color: globalWinrate >= 50 ? '#22c55e' : '#ef4444' }}>
              {globalWinrate}%
            </div>
            <div className="text-[9px] font-mono" style={{ color: c.text, opacity: 0.3 }}>{totalGames} parties</div>
          </div>
        </div>
      </div>

      {/* ── Corps en 2 colonnes ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Colonne gauche : radar + métriques ── */}
        <div className="flex flex-col gap-3 w-[260px] flex-shrink-0">

          {/* Radar GPI */}
          <div
            className="clip-bevel-lg p-4"
            style={{
              background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
              border: `1px solid ${c.border}`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-0.5 h-3.5 rounded-full" style={{ backgroundColor: c.accent }} />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: c.text, opacity: 0.4 }}>
                Performance GPI
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center" style={{ height: 180 }}>
                <div className="text-[10px] font-mono animate-pulse" style={{ color: c.accent, opacity: 0.5 }}>
                  Chargement...
                </div>
              </div>
            ) : games.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2" style={{ height: 180 }}>
                <div className="text-[10px] font-mono text-center" style={{ color: c.text, opacity: 0.3 }}>
                  Joue des parties classées<br/>pour voir ton GPI
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <RadarChart metrics={gpi} accent={c.accent} border={c.border} text={c.text} />
              </div>
            )}
          </div>

          {/* Barres de métriques */}
          <div
            className="clip-bevel-lg p-4 flex flex-col gap-2"
            style={{
              background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
              border: `1px solid ${c.border}`,
            }}
          >
            {GPI_LABELS.map(({ key, label, desc }) => {
              const val = gpi[key]
              const color = scoreColor(val)
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-[72px] flex-shrink-0">
                    <div className="text-[9px] font-black" style={{ color: c.text, opacity: 0.5 }}>{label}</div>
                    <div className="text-[8px] font-mono" style={{ color: c.text, opacity: 0.25 }}>{desc}</div>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${c.border}` }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${val}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="w-7 text-right font-mono font-black text-[10px] flex-shrink-0" style={{ color }}>
                    {val}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Colonne droite : résultats + champion pool ── */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">

          {/* Série récente + session du jour */}
          <div className="grid grid-cols-2 gap-3">

            {/* Série récente */}
            <div
              className="clip-bevel-lg px-4 py-3"
              style={{
                background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
                border: `1px solid ${c.border}`,
              }}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-2.5" style={{ color: c.text, opacity: 0.35 }}>
                Série récente (10 dernières)
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {recent10.length === 0 ? (
                  <span className="text-[10px] font-mono" style={{ color: c.text, opacity: 0.2 }}>Aucune partie</span>
                ) : (
                  recent10.map((g, i) => (
                    <div
                      key={i}
                      title={`${g.champion} · ${g.kills}/${g.deaths}/${g.assists}`}
                      className="rounded font-black text-[8px] flex items-center justify-center transition-transform hover:scale-110"
                      style={{
                        width: 20,
                        height: 20,
                        backgroundColor: g.result === 'win' ? '#22c55e20' : '#ef444420',
                        border: `1px solid ${g.result === 'win' ? '#22c55e60' : '#ef444460'}`,
                        color: g.result === 'win' ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {g.result === 'win' ? 'W' : 'L'}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Aujourd'hui */}
            <div
              className="clip-bevel-lg px-4 py-3"
              style={{
                background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
                border: `1px solid ${c.border}`,
              }}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: c.text, opacity: 0.35 }}>
                Aujourd'hui
              </div>
              {todayGames.length === 0 ? (
                <div className="text-[10px] font-mono" style={{ color: c.text, opacity: 0.2 }}>Aucune partie</div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="font-mono font-black text-2xl" style={{ color: todayWins > todayGames.length / 2 ? '#22c55e' : c.accent }}>
                    {todayWins}W
                  </span>
                  <span className="font-mono font-black text-2xl" style={{ color: '#ef4444' }}>
                    {todayGames.length - todayWins}L
                  </span>
                  <span className="text-[10px] font-mono ml-1" style={{ color: c.text, opacity: 0.3 }}>
                    {todayGames.length} parties
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Champion pool */}
          <div
            className="clip-bevel-lg p-4 flex-1"
            style={{
              background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
              border: `1px solid ${c.border}`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-0.5 h-3.5 rounded-full" style={{ backgroundColor: c.accent }} />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: c.text, opacity: 0.4 }}>
                Champion Pool
              </span>
            </div>

            {loading ? (
              <div className="text-[10px] font-mono animate-pulse" style={{ color: c.accent, opacity: 0.5 }}>Chargement...</div>
            ) : championPool.length === 0 ? (
              <div className="text-[10px] font-mono" style={{ color: c.text, opacity: 0.3 }}>
                Aucune partie classée enregistrée
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {championPool.map((champ, rank) => {
                  const wr = Math.round((champ.wins / champ.games) * 100)
                  const wrColor = wr >= 55 ? '#22c55e' : wr >= 45 ? c.accent : '#ef4444'
                  return (
                    <div key={champ.name} className="flex items-center gap-3">
                      {/* Rank */}
                      <div className="w-4 text-center flex-shrink-0">
                        <span className="text-[9px] font-black font-mono" style={{ color: c.text, opacity: rank === 0 ? 0.7 : 0.25 }}>
                          #{rank + 1}
                        </span>
                      </div>

                      {/* Icône champion */}
                      <div className="w-8 h-8 clip-bevel overflow-hidden flex-shrink-0" style={{ border: `1px solid ${c.border}` }}>
                        <img
                          src={getChampionIconUrl(champ.name)}
                          alt={champ.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold truncate" style={{ color: c.text }}>{champ.name}</span>
                          <span className="text-[10px] font-mono font-black ml-2 flex-shrink-0" style={{ color: wrColor }}>{wr}%</span>
                        </div>
                        {/* Barre winrate */}
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${c.border}` }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${wr}%`, backgroundColor: wrColor }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] font-mono" style={{ color: c.text, opacity: 0.3 }}>
                            {champ.games}G · {champ.wins}W · KDA {champ.kda.toFixed(1)}
                          </span>
                          <span className="text-[8px] font-mono ml-auto" style={{ color: c.text, opacity: 0.25 }}>
                            {champ.csPerMin}/min
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stats moyennes globales */}
          {!loading && recent20.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'KDA moyen',
                  value: gpi.kda === 0 ? '—' : (avg(recent20.map(g => g.deaths === 0 ? 5 : (g.kills + g.assists) / g.deaths))).toFixed(2),
                  color: scoreColor(gpi.kda),
                },
                {
                  label: 'CS/min moyen',
                  value: (avg(recent20.map(g => g.gameTime > 0 ? g.cs / (g.gameTime / 60) : 0))).toFixed(1),
                  color: scoreColor(gpi.farming),
                },
                {
                  label: 'Vision/min',
                  value: (avg(recent20.map(g => g.gameTime > 0 ? g.wardScore / (g.gameTime / 60) : 0))).toFixed(1),
                  color: scoreColor(gpi.vision),
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="clip-bevel-lg px-3 py-2.5 text-center"
                  style={{
                    background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}50 100%)`,
                    border: `1px solid ${c.border}`,
                  }}
                >
                  <div className="text-[8px] font-black uppercase tracking-[0.15em] mb-1" style={{ color: c.text, opacity: 0.35 }}>{label}</div>
                  <div className="font-mono font-black text-base leading-none" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Insights comportementaux */}
          {!loading && insights.length > 0 && (
            <div
              className="clip-bevel-lg p-4"
              style={{
                background: `linear-gradient(160deg, ${c.bg} 0%, ${c.border}40 100%)`,
                border: `1px solid ${c.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-0.5 h-3.5 rounded-full" style={{ backgroundColor: c.accent }} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: c.text, opacity: 0.4 }}>
                  Insights
                </span>
                <span className="ml-auto text-[8px] font-mono" style={{ color: c.text, opacity: 0.2 }}>
                  {recent20.length} parties analysées
                </span>
              </div>
              <div className="flex flex-col gap-2 stagger-enter">
                {insights.map((insight, i) => {
                  const insightColor = insight.type === 'warning' ? '#ef4444'
                    : insight.type === 'success' ? '#22c55e'
                    : '#f59e0b'
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 clip-bevel px-3 py-2"
                      style={{ backgroundColor: `${insightColor}0D` }}
                    >
                      <span className="text-sm flex-shrink-0">{insight.icon}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold leading-none mb-0.5" style={{ color: insightColor }}>
                          {insight.title}
                        </p>
                        <p className="text-[9px] leading-relaxed" style={{ color: c.text, opacity: 0.6 }}>
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
