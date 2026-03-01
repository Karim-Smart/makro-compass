/**
 * AI Matchup Briefing — Analyse IA du matchup de lane au début de partie.
 * Tier requis : Pro+
 * Se déclenche une seule fois quand le matchup est détecté.
 */
import Anthropic from '@anthropic-ai/sdk'
import { DEV_MOCK_AI } from '../../shared/constants'
import { IPC } from '../../shared/ipc-channels'
import { guardFeature } from './subscriptionAgent'
import { broadcastToWindows } from '../main/ipcHandlers'
import type { GameData, MatchupBriefingData, CoachAdvice } from '../../shared/types'

let anthropic: Anthropic | null = null
let briefingSent = false

export function setMatchupBriefingClient(client: Anthropic): void {
  anthropic = client
}

const SYSTEM_PROMPT = `Tu es un expert LoL des matchups de lane. Analyse le matchup et donne un briefing tactique.

RÉPONDS UNIQUEMENT en JSON valide avec ce format exact :
{
  "summary": "Résumé en 1 phrase du matchup",
  "powerSpikes": [
    { "phase": "early", "advantage": "you", "tip": "Conseil pour cette phase" },
    { "phase": "mid", "advantage": "enemy", "tip": "Conseil" },
    { "phase": "late", "advantage": "even", "tip": "Conseil" }
  ],
  "dangerLevel": "medium",
  "keyTip": "Le conseil le plus important du matchup en 1 phrase"
}

RÈGLES :
- "advantage" : "you" (tu domines), "enemy" (il domine), "even" (équilibré)
- "dangerLevel" : "low", "medium", "high"
- Exactement 3 powerSpikes (early, mid, late)
- Langue : FRANÇAIS uniquement
- Sois concret : mentionne les sorts et niveaux clés`

// ── Données de matchup connues pour le mock ──────────────────────────────────

interface ChampArchetype {
  type: 'assassin' | 'mage' | 'tank' | 'fighter' | 'marksman' | 'support' | 'bruiser'
  earlyStrength: number  // 1-5
  lateStrength: number
  burstDanger: number
}

const CHAMPION_ARCHETYPES: Record<string, ChampArchetype> = {
  // Assassins
  'Zed': { type: 'assassin', earlyStrength: 3, lateStrength: 4, burstDanger: 5 },
  'Talon': { type: 'assassin', earlyStrength: 4, lateStrength: 3, burstDanger: 5 },
  'Katarina': { type: 'assassin', earlyStrength: 2, lateStrength: 5, burstDanger: 5 },
  'Fizz': { type: 'assassin', earlyStrength: 2, lateStrength: 4, burstDanger: 5 },
  'Akali': { type: 'assassin', earlyStrength: 3, lateStrength: 4, burstDanger: 5 },
  'LeBlanc': { type: 'assassin', earlyStrength: 4, lateStrength: 3, burstDanger: 4 },
  'Qiyana': { type: 'assassin', earlyStrength: 3, lateStrength: 3, burstDanger: 5 },
  // Mages
  'Orianna': { type: 'mage', earlyStrength: 3, lateStrength: 5, burstDanger: 3 },
  'Viktor': { type: 'mage', earlyStrength: 2, lateStrength: 5, burstDanger: 3 },
  'Syndra': { type: 'mage', earlyStrength: 4, lateStrength: 4, burstDanger: 4 },
  'Ahri': { type: 'mage', earlyStrength: 3, lateStrength: 3, burstDanger: 3 },
  'Lux': { type: 'mage', earlyStrength: 3, lateStrength: 3, burstDanger: 3 },
  'Xerath': { type: 'mage', earlyStrength: 3, lateStrength: 4, burstDanger: 2 },
  'Veigar': { type: 'mage', earlyStrength: 1, lateStrength: 5, burstDanger: 5 },
  'Anivia': { type: 'mage', earlyStrength: 2, lateStrength: 5, burstDanger: 3 },
  // Fighters / Bruisers top
  'Darius': { type: 'fighter', earlyStrength: 5, lateStrength: 2, burstDanger: 4 },
  'Garen': { type: 'fighter', earlyStrength: 3, lateStrength: 3, burstDanger: 3 },
  'Aatrox': { type: 'bruiser', earlyStrength: 4, lateStrength: 3, burstDanger: 3 },
  'Jax': { type: 'fighter', earlyStrength: 2, lateStrength: 5, burstDanger: 3 },
  'Fiora': { type: 'fighter', earlyStrength: 3, lateStrength: 5, burstDanger: 4 },
  'Camille': { type: 'fighter', earlyStrength: 3, lateStrength: 4, burstDanger: 4 },
  'Irelia': { type: 'fighter', earlyStrength: 4, lateStrength: 4, burstDanger: 4 },
  'Riven': { type: 'fighter', earlyStrength: 4, lateStrength: 4, burstDanger: 4 },
  'K\'Sante': { type: 'tank', earlyStrength: 3, lateStrength: 4, burstDanger: 2 },
  'Malphite': { type: 'tank', earlyStrength: 2, lateStrength: 4, burstDanger: 3 },
  'Ornn': { type: 'tank', earlyStrength: 3, lateStrength: 5, burstDanger: 2 },
  // ADC
  'Jinx': { type: 'marksman', earlyStrength: 2, lateStrength: 5, burstDanger: 2 },
  'Kai\'Sa': { type: 'marksman', earlyStrength: 2, lateStrength: 5, burstDanger: 4 },
  'Ezreal': { type: 'marksman', earlyStrength: 3, lateStrength: 4, burstDanger: 2 },
  'Draven': { type: 'marksman', earlyStrength: 5, lateStrength: 3, burstDanger: 4 },
  'Caitlyn': { type: 'marksman', earlyStrength: 4, lateStrength: 4, burstDanger: 2 },
  'Vayne': { type: 'marksman', earlyStrength: 1, lateStrength: 5, burstDanger: 4 },
  'Lucian': { type: 'marksman', earlyStrength: 5, lateStrength: 3, burstDanger: 3 },
  'Miss Fortune': { type: 'marksman', earlyStrength: 3, lateStrength: 4, burstDanger: 3 },
  'Aphelios': { type: 'marksman', earlyStrength: 2, lateStrength: 5, burstDanger: 3 },
  'Jhin': { type: 'marksman', earlyStrength: 3, lateStrength: 4, burstDanger: 3 },
  // Junglers
  'Lee Sin': { type: 'fighter', earlyStrength: 5, lateStrength: 2, burstDanger: 4 },
  'Graves': { type: 'marksman', earlyStrength: 4, lateStrength: 4, burstDanger: 3 },
  'Kha\'Zix': { type: 'assassin', earlyStrength: 3, lateStrength: 4, burstDanger: 5 },
  'Evelynn': { type: 'assassin', earlyStrength: 1, lateStrength: 5, burstDanger: 5 },
  'Viego': { type: 'fighter', earlyStrength: 3, lateStrength: 4, burstDanger: 4 },
  'Hecarim': { type: 'bruiser', earlyStrength: 3, lateStrength: 4, burstDanger: 3 },
  'Nidalee': { type: 'assassin', earlyStrength: 5, lateStrength: 2, burstDanger: 4 },
  'Vi': { type: 'bruiser', earlyStrength: 4, lateStrength: 3, burstDanger: 4 },
  'Elise': { type: 'assassin', earlyStrength: 5, lateStrength: 2, burstDanger: 4 },
  'Jarvan IV': { type: 'bruiser', earlyStrength: 4, lateStrength: 3, burstDanger: 3 },
  // Supports
  'Thresh': { type: 'support', earlyStrength: 3, lateStrength: 3, burstDanger: 2 },
  'Nautilus': { type: 'support', earlyStrength: 4, lateStrength: 3, burstDanger: 2 },
  'Lulu': { type: 'support', earlyStrength: 3, lateStrength: 5, burstDanger: 1 },
  'Yuumi': { type: 'support', earlyStrength: 1, lateStrength: 5, burstDanger: 1 },
  'Pyke': { type: 'assassin', earlyStrength: 4, lateStrength: 3, burstDanger: 5 },
  'Leona': { type: 'support', earlyStrength: 4, lateStrength: 3, burstDanger: 2 },
  'Blitzcrank': { type: 'support', earlyStrength: 4, lateStrength: 2, burstDanger: 2 },
  // Mages mid supplémentaires
  'Yasuo': { type: 'fighter', earlyStrength: 2, lateStrength: 5, burstDanger: 4 },
  'Yone': { type: 'fighter', earlyStrength: 2, lateStrength: 5, burstDanger: 5 },
  'Sylas': { type: 'bruiser', earlyStrength: 3, lateStrength: 4, burstDanger: 4 },
  'Cassiopeia': { type: 'mage', earlyStrength: 3, lateStrength: 5, burstDanger: 4 },
  'Azir': { type: 'mage', earlyStrength: 2, lateStrength: 5, burstDanger: 3 },
  // Tanks/Bruisers top
  'Sett': { type: 'bruiser', earlyStrength: 5, lateStrength: 3, burstDanger: 4 },
  'Mordekaiser': { type: 'bruiser', earlyStrength: 3, lateStrength: 4, burstDanger: 4 },
  'Gnar': { type: 'fighter', earlyStrength: 4, lateStrength: 4, burstDanger: 3 },
  'Renekton': { type: 'fighter', earlyStrength: 5, lateStrength: 2, burstDanger: 4 },
  'Gangplank': { type: 'fighter', earlyStrength: 1, lateStrength: 5, burstDanger: 4 },
  'Nasus': { type: 'fighter', earlyStrength: 1, lateStrength: 5, burstDanger: 3 },
  'Tryndamere': { type: 'fighter', earlyStrength: 3, lateStrength: 5, burstDanger: 5 },
  'Shen': { type: 'tank', earlyStrength: 3, lateStrength: 3, burstDanger: 2 },
  'Cho\'Gath': { type: 'tank', earlyStrength: 2, lateStrength: 4, burstDanger: 3 },
}

function getArchetype(champion: string): ChampArchetype {
  return CHAMPION_ARCHETYPES[champion] ?? { type: 'fighter', earlyStrength: 3, lateStrength: 3, burstDanger: 3 }
}

function generateMockBriefing(myChampion: string, enemyChampion: string): MatchupBriefingData {
  const me = getArchetype(myChampion)
  const enemy = getArchetype(enemyChampion)

  const earlyAdv = me.earlyStrength > enemy.earlyStrength ? 'you' as const
    : me.earlyStrength < enemy.earlyStrength ? 'enemy' as const : 'even' as const
  const lateAdv = me.lateStrength > enemy.lateStrength ? 'you' as const
    : me.lateStrength < enemy.lateStrength ? 'enemy' as const : 'even' as const
  const midAdv = earlyAdv === lateAdv ? earlyAdv : 'even' as const

  const dangerLevel = enemy.burstDanger >= 5 ? 'high' as const
    : enemy.burstDanger >= 3 ? 'medium' as const : 'low' as const

  // Tips contextuels
  const earlyTips: Record<string, string> = {
    'you': `Tu domines l'early — trade agressivement niveaux 1-3 et zone ${enemyChampion} du CS.`,
    'enemy': `${enemyChampion} est plus fort early. Farm safe, concède du CS si nécessaire, et attends ton spike.`,
    'even': `Matchup équilibré early. Prends des trades courts et gère ta barre de vie pour un all-in niveu 6.`,
  }
  const midTips: Record<string, string> = {
    'you': `Tu as l'avantage mid-game. Push et roam pour snowball d'autres lanes.`,
    'enemy': `${enemyChampion} spike en mid-game. Joue autour de la vision et évite les 1v1 isolés.`,
    'even': `Joue autour des objectifs avec ton équipe. Le premier à impacter une autre lane prend l'avantage.`,
  }
  const lateTips: Record<string, string> = {
    'you': `Tu scales mieux — joue patient et arrive au late en bon état. Le temps joue pour toi.`,
    'enemy': `${enemyChampion} scale mieux. Ferme la game avant 30 min en forçant les objectifs.`,
    'even': `Late game serré. Le positionnement en teamfight et le contrôle d'objectifs décideront.`,
  }

  // Summary contextuel
  let summary: string
  if (enemy.type === 'assassin') {
    summary = `Matchup contre un assassin — respecte les powerspikes de ${enemyChampion} et garde tes sorts défensifs.`
  } else if (enemy.type === 'tank') {
    summary = `Face à un tank — les trades longs te favorisent, mais ne sous-estime pas son CC.`
  } else if (me.earlyStrength > enemy.earlyStrength + 1) {
    summary = `Tu as un gros avantage early contre ${enemyChampion}. Joue agressif et snowball.`
  } else if (enemy.earlyStrength > me.earlyStrength + 1) {
    summary = `${enemyChampion} est un lane bully — survive l'early et tu seras plus utile en teamfight.`
  } else {
    summary = `Matchup skill-based contre ${enemyChampion}. La gestion des cooldowns et la vision décideront.`
  }

  // Key tip
  let keyTip: string
  if (enemy.burstDanger >= 5) {
    keyTip = `Garde TOUJOURS un sort d'escape contre le burst de ${enemyChampion}. Un seul combo = mort si tu es à 60% HP.`
  } else if (me.lateStrength >= 5 && enemy.lateStrength <= 3) {
    keyTip = `Tu scales beaucoup mieux — ne force pas de fights risqués, chaque minute qui passe augmente ton avantage.`
  } else if (me.earlyStrength >= 4) {
    keyTip = `Ton early est ton arme. Prends un avantage de CS ou un kill avant 10 min pour snowball le game.`
  } else {
    keyTip = `Adapte ton style au matchup : trade quand tes sorts sont up, back off quand ils sont en cooldown.`
  }

  return {
    summary,
    powerSpikes: [
      { phase: 'early', advantage: earlyAdv, tip: earlyTips[earlyAdv] },
      { phase: 'mid', advantage: midAdv, tip: midTips[midAdv] },
      { phase: 'late', advantage: lateAdv, tip: lateTips[lateAdv] },
    ],
    dangerLevel,
    keyTip,
  }
}

/**
 * Génère et broadcast le briefing matchup une fois au début de partie.
 */
export async function triggerMatchupBriefing(gameData: GameData): Promise<void> {
  if (briefingSent) return
  if (!gameData.matchup) return

  const hasAccess = await guardFeature('matchup_briefing')
  if (!hasAccess) return

  briefingSent = true
  const myChampion = gameData.champion
  const enemyChampion = gameData.matchup.champion

  console.log(`[MatchupBriefing] Briefing ${myChampion} vs ${enemyChampion}`)

  let briefing: MatchupBriefingData

  if (DEV_MOCK_AI) {
    briefing = generateMockBriefing(myChampion, enemyChampion)
  } else if (anthropic) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 350,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Analyse le matchup : ${myChampion} vs ${enemyChampion} en ${gameData.matchup.position}. Retourne le JSON.`,
        }],
      })
      const text = message.content.find(c => c.type === 'text')
      if (text && text.type === 'text') {
        const fallback = generateMockBriefing(myChampion, enemyChampion)
        const parsed = JSON.parse(text.text) as MatchupBriefingData
        // Validation : garder le mock si des champs critiques manquent
        briefing = {
          summary: parsed.summary ?? fallback.summary,
          powerSpikes: Array.isArray(parsed.powerSpikes) && parsed.powerSpikes.length === 3
            ? parsed.powerSpikes
            : fallback.powerSpikes,
          dangerLevel: ['low', 'medium', 'high'].includes(parsed.dangerLevel)
            ? parsed.dangerLevel
            : fallback.dangerLevel,
          keyTip: parsed.keyTip ?? fallback.keyTip,
        }
      } else {
        briefing = generateMockBriefing(myChampion, enemyChampion)
      }
    } catch (err) {
      console.error('[MatchupBriefing] Erreur API:', (err as Error).message)
      briefing = generateMockBriefing(myChampion, enemyChampion)
    }
  } else {
    briefing = generateMockBriefing(myChampion, enemyChampion)
  }

  // Broadcast le briefing complet
  broadcastToWindows(IPC.MATCHUP_BRIEFING, briefing)

  // Envoyer aussi comme advice haute priorité pour l'overlay advice
  const adviceText = `[MATCHUP] ${briefing.summary} ${briefing.keyTip}`
  const advice: CoachAdvice = {
    text: adviceText,
    style: 'LCK',
    priority: 'high',
    timestamp: Date.now(),
    gameTime: gameData.gameTime,
    category: 'matchup-briefing',
  }
  broadcastToWindows(IPC.OVERLAY_SHOW_ADVICE, advice)
}

export function resetMatchupBriefing(): void {
  briefingSent = false
}
