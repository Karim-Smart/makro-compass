/**
 * Base de données des winrates de matchup entre champions.
 * Données basées sur les statistiques publiques de League of Legends.
 *
 * Format brut : [champion1, champion2, winrate_du_champion1]
 * La fonction getMatchupWinrate() gère la normalisation et les fallbacks.
 */

import { CHAMPION_COUNTERS } from './draft-data'
import { getChampion } from './champion-data'

// ─── Normalisation des clés ──────────────────────────────────────────────────

function normalizeKey(a: string, b: string): string {
  return a.localeCompare(b) <= 0 ? `${a}|${b}` : `${b}|${a}`
}

function firstOfPair(a: string, b: string): string {
  return a.localeCompare(b) <= 0 ? a : b
}

// ─── Données brutes ──────────────────────────────────────────────────────────

const RAW: [string, string, number][] = [
  // ═══ TOP LANE ═══
  ['Aatrox', 'Darius', 51],
  ['Aatrox', 'Fiora', 44],
  ['Aatrox', 'Gwen', 50],
  ['Aatrox', 'Irelia', 46],
  ['Aatrox', 'Mordekaiser', 49],
  ['Aatrox', 'Renekton', 48],
  ['Aatrox', 'Riven', 50],
  ['Aatrox', 'Sett', 51],
  ['Aatrox', 'Vayne', 42],
  ['Camille', 'Darius', 47],
  ['Camille', 'Fiora', 45],
  ['Camille', 'Jax', 46],
  ['Camille', 'Riven', 49],
  ['Darius', 'Fiora', 47],
  ['Darius', 'Garen', 53],
  ['Darius', 'Mordekaiser', 51],
  ['Darius', 'Nasus', 55],
  ['Darius', 'Renekton', 51],
  ['Darius', 'Sett', 52],
  ['Darius', 'Shen', 54],
  ['Darius', 'Vayne', 43],
  ['Darius', 'Volibear', 51],
  ['Fiora', 'Garen', 54],
  ['Fiora', 'Gwen', 52],
  ['Fiora', 'Jax', 52],
  ['Fiora', 'K\'Sante', 56],
  ['Fiora', 'Malphite', 44],
  ['Fiora', 'Mordekaiser', 55],
  ['Fiora', 'Nasus', 53],
  ['Fiora', 'Ornn', 55],
  ['Fiora', 'Poppy', 44],
  ['Fiora', 'Sett', 54],
  ['Fiora', 'Shen', 54],
  ['Fiora', 'Volibear', 53],
  ['Gangplank', 'Camille', 46],
  ['Gangplank', 'Irelia', 44],
  ['Gangplank', 'Riven', 46],
  ['Garen', 'Mordekaiser', 48],
  ['Garen', 'Nasus', 51],
  ['Garen', 'Vayne', 42],
  ['Garen', 'Volibear', 48],
  ['Gwen', 'Irelia', 47],
  ['Gwen', 'K\'Sante', 54],
  ['Gwen', 'Malphite', 54],
  ['Gwen', 'Mordekaiser', 53],
  ['Gwen', 'Riven', 47],
  ['Illaoi', 'Mordekaiser', 46],
  ['Illaoi', 'Vayne', 43],
  ['Irelia', 'Jax', 48],
  ['Irelia', 'Renekton', 48],
  ['Irelia', 'Sett', 53],
  ['Irelia', 'Volibear', 47],
  ['Irelia', 'Yorick', 54],
  ['Jax', 'Malphite', 46],
  ['Jax', 'Poppy', 46],
  ['Jax', 'Tryndamere', 51],
  ['Jax', 'Yorick', 53],
  ['Malphite', 'Mordekaiser', 47],
  ['Nasus', 'Illaoi', 46],
  ['Nasus', 'Vayne', 43],
  ['Olaf', 'Malphite', 46],
  ['Olaf', 'Vayne', 43],
  ['Ornn', 'Vayne', 43],
  ['Renekton', 'Riven', 53],
  ['Renekton', 'Vayne', 44],
  ['Renekton', 'Yasuo', 58],
  ['Renekton', 'Yone', 57],
  ['Riven', 'Poppy', 45],
  ['Riven', 'Volibear', 46],
  ['Sett', 'Gwen', 47],
  ['Sett', 'Vayne', 43],
  ['Shen', 'Mordekaiser', 46],
  ['Tryndamere', 'Malphite', 44],
  ['Tryndamere', 'Nasus', 48],
  ['Tryndamere', 'Poppy', 45],
  ['Urgot', 'Aatrox', 48],
  ['Urgot', 'Fiora', 46],
  ['Urgot', 'Vayne', 44],
  ['Volibear', 'Vayne', 42],
  ['Yorick', 'Tryndamere', 47],

  // ═══ MID LANE ═══
  ['Ahri', 'Fizz', 45],
  ['Ahri', 'Kassadin', 44],
  ['Ahri', 'LeBlanc', 48],
  ['Ahri', 'Orianna', 50],
  ['Ahri', 'Syndra', 49],
  ['Ahri', 'Viktor', 50],
  ['Ahri', 'Yasuo', 46],
  ['Ahri', 'Zed', 47],
  ['Akali', 'Annie', 45],
  ['Akali', 'Galio', 44],
  ['Akali', 'Malzahar', 44],
  ['Akali', 'Zed', 49],
  ['Anivia', 'Fizz', 44],
  ['Anivia', 'Kassadin', 45],
  ['Anivia', 'Zed', 45],
  ['Annie', 'Lux', 54],
  ['Annie', 'Xerath', 45],
  ['Annie', 'Yasuo', 56],
  ['Annie', 'Yone', 56],
  ['Aurelion Sol', 'Fizz', 43],
  ['Aurelion Sol', 'Kassadin', 44],
  ['Aurelion Sol', 'Zed', 44],
  ['Azir', 'Fizz', 44],
  ['Azir', 'Kassadin', 45],
  ['Azir', 'Xerath', 47],
  ['Cassiopeia', 'Fizz', 44],
  ['Cassiopeia', 'Kassadin', 45],
  ['Cassiopeia', 'Zed', 45],
  ['Ekko', 'Zed', 48],
  ['Fizz', 'Galio', 44],
  ['Fizz', 'Lissandra', 44],
  ['Fizz', 'Lux', 56],
  ['Fizz', 'Malzahar', 44],
  ['Fizz', 'Orianna', 54],
  ['Fizz', 'Syndra', 54],
  ['Fizz', 'Veigar', 55],
  ['Fizz', 'Viktor', 55],
  ['Fizz', 'Xerath', 56],
  ['Galio', 'Kassadin', 55],
  ['Galio', 'Katarina', 56],
  ['Galio', 'LeBlanc', 56],
  ['Kassadin', 'LeBlanc', 48],
  ['Kassadin', 'Lux', 54],
  ['Kassadin', 'Malzahar', 53],
  ['Kassadin', 'Orianna', 53],
  ['Kassadin', 'Syndra', 53],
  ['Kassadin', 'Veigar', 53],
  ['Kassadin', 'Viktor', 53],
  ['Kassadin', 'Zed', 43],
  ['Katarina', 'Malzahar', 44],
  ['LeBlanc', 'Malzahar', 45],
  ['Lux', 'Yasuo', 45],
  ['Lux', 'Zed', 44],
  ['Malzahar', 'Yasuo', 56],
  ['Malzahar', 'Yone', 56],
  ['Malzahar', 'Zed', 56],
  ['Orianna', 'Yasuo', 47],
  ['Orianna', 'Zed', 46],
  ['Syndra', 'Yasuo', 46],
  ['Syndra', 'Zed', 46],
  ['Viktor', 'Zed', 45],
  ['Vladimir', 'Anivia', 47],
  ['Vladimir', 'Malzahar', 45],
  ['Vladimir', 'Orianna', 47],
  ['Veigar', 'Zed', 44],
  ['Xerath', 'Zed', 44],

  // ═══ JUNGLE ═══
  ['Amumu', 'Graves', 48],
  ['Amumu', 'Kindred', 47],
  ['Amumu', 'Lee Sin', 46],
  ['Diana', 'Graves', 48],
  ['Diana', 'Lee Sin', 46],
  ['Ekko', 'Graves', 48],
  ['Ekko', 'Lee Sin', 46],
  ['Ekko', 'Rengar', 47],
  ['Evelynn', 'Kha\'Zix', 48],
  ['Evelynn', 'Lee Sin', 45],
  ['Evelynn', 'Rengar', 46],
  ['Graves', 'Kindred', 51],
  ['Graves', 'Lee Sin', 48],
  ['Graves', 'Rammus', 45],
  ['Jarvan IV', 'Kindred', 48],
  ['Jarvan IV', 'Lee Sin', 47],
  ['Kha\'Zix', 'Lee Sin', 48],
  ['Kha\'Zix', 'Rammus', 44],
  ['Kindred', 'Lee Sin', 48],
  ['Kindred', 'Rengar', 48],
  ['Lee Sin', 'Rammus', 47],
  ['Lee Sin', 'Sejuani', 52],
  ['Lee Sin', 'Viego', 53],
  ['Master Yi', 'Amumu', 46],
  ['Master Yi', 'Jax', 47],
  ['Master Yi', 'Rammus', 42],
  ['Rammus', 'Rengar', 54],
  ['Rammus', 'Viego', 54],
  ['Rengar', 'Sejuani', 52],
  ['Shaco', 'Amumu', 52],
  ['Shaco', 'Lee Sin', 47],
  ['Shaco', 'Rammus', 44],
  ['Viego', 'Graves', 48],
  ['Zac', 'Graves', 48],
  ['Zac', 'Kindred', 47],
  ['Zac', 'Lee Sin', 47],

  // ═══ ADC ═══
  ['Aphelios', 'Caitlyn', 47],
  ['Aphelios', 'Draven', 44],
  ['Aphelios', 'Lucian', 46],
  ['Ashe', 'Draven', 44],
  ['Ashe', 'Lucian', 46],
  ['Ashe', 'Samira', 46],
  ['Caitlyn', 'Jinx', 52],
  ['Caitlyn', 'Samira', 53],
  ['Caitlyn', 'Vayne', 47],
  ['Draven', 'Jinx', 54],
  ['Draven', 'Tristana', 52],
  ['Draven', 'Vayne', 53],
  ['Ezreal', 'Draven', 45],
  ['Ezreal', 'Lucian', 46],
  ['Ezreal', 'Samira', 47],
  ['Jhin', 'Draven', 46],
  ['Jhin', 'Lucian', 47],
  ['Jhin', 'Samira', 46],
  ['Jinx', 'Lucian', 48],
  ['Kai\'Sa', 'Caitlyn', 47],
  ['Kai\'Sa', 'Draven', 45],
  ['Kai\'Sa', 'Miss Fortune', 47],
  ['Lucian', 'Kog\'Maw', 53],
  ['Lucian', 'Vayne', 52],
  ['Miss Fortune', 'Draven', 47],
  ['Miss Fortune', 'Samira', 47],
  ['Miss Fortune', 'Sivir', 52],
  ['Samira', 'Jinx', 52],
  ['Sivir', 'Caitlyn', 47],
  ['Sivir', 'Draven', 46],
  ['Sivir', 'Lucian', 47],
  ['Tristana', 'Caitlyn', 48],
  ['Vayne', 'Miss Fortune', 48],
  ['Xayah', 'Caitlyn', 48],
  ['Xayah', 'Draven', 47],
  ['Smolder', 'Draven', 44],
  ['Smolder', 'Lucian', 45],
  ['Smolder', 'Caitlyn', 46],
  ['Zeri', 'Draven', 44],
  ['Zeri', 'Caitlyn', 46],

  // ═══ SUPPORT ═══
  ['Alistar', 'Braum', 48],
  ['Alistar', 'Janna', 46],
  ['Blitzcrank', 'Braum', 47],
  ['Braum', 'Leona', 47],
  ['Braum', 'Nautilus', 47],
  ['Braum', 'Pyke', 54],
  ['Janna', 'Leona', 53],
  ['Janna', 'Nautilus', 52],
  ['Janna', 'Rakan', 53],
  ['Karma', 'Leona', 47],
  ['Karma', 'Nautilus', 47],
  ['Leona', 'Lulu', 53],
  ['Leona', 'Nami', 52],
  ['Leona', 'Soraka', 54],
  ['Leona', 'Yuumi', 56],
  ['Lulu', 'Nautilus', 46],
  ['Nami', 'Nautilus', 47],
  ['Nautilus', 'Rakan', 51],
  ['Nautilus', 'Soraka', 55],
  ['Nautilus', 'Yuumi', 56],
  ['Pyke', 'Nautilus', 48],
  ['Soraka', 'Blitzcrank', 45],
  ['Thresh', 'Braum', 52],
  ['Thresh', 'Janna', 48],
  ['Thresh', 'Leona', 49],
]

// ─── Construction de la map normalisée ───────────────────────────────────────

const WR_MAP: Record<string, number> = {}

for (const [a, b, winrateA] of RAW) {
  const key = normalizeKey(a, b)
  const first = firstOfPair(a, b)
  // Stocker le winrate du champion qui vient en premier alphabétiquement
  WR_MAP[key] = first === a ? winrateA : 100 - winrateA
}

// ─── Estimation basée sur les classes ────────────────────────────────────────

const CLASS_ADVANTAGE: Record<string, number> = {
  'assassin_vs_mage': 53,
  'assassin_vs_marksman': 54,
  'assassin_vs_enchanter': 55,
  'bruiser_vs_tank': 52,
  'bruiser_vs_mage': 53,
  'bruiser_vs_marksman': 53,
  'skirmisher_vs_tank': 52,
  'skirmisher_vs_mage': 52,
  'tank_vs_enchanter': 52,
  'engage_vs_enchanter': 53,
  'engage_vs_marksman': 52,
}

function getClassWinrate(myClass: string, enemyClass: string): number {
  const key = `${myClass}_vs_${enemyClass}`
  const reverseKey = `${enemyClass}_vs_${myClass}`
  if (CLASS_ADVANTAGE[key]) return CLASS_ADVANTAGE[key]
  if (CLASS_ADVANTAGE[reverseKey]) return 100 - CLASS_ADVANTAGE[reverseKey]
  return 50
}

// ─── API publique ────────────────────────────────────────────────────────────

/**
 * Retourne le winrate estimé de myChamp contre enemyChamp (0-100).
 * Sources par priorité :
 * 1. Données exactes de la table MATCHUP_WINRATES
 * 2. Relation de counter (CHAMPION_COUNTERS) → ~56%
 * 3. Avantage de classe → 51-55%
 * 4. Défaut → 50%
 */
export function getMatchupWinrate(myChamp: string, enemyChamp: string): number {
  if (!myChamp || !enemyChamp) return 50
  if (myChamp === enemyChamp) return 50

  // 1. Données exactes
  const key = normalizeKey(myChamp, enemyChamp)
  if (WR_MAP[key] !== undefined) {
    const first = firstOfPair(myChamp, enemyChamp)
    return first === myChamp ? WR_MAP[key] : 100 - WR_MAP[key]
  }

  // 2. Recherche case-insensitive
  const myLower = myChamp.toLowerCase()
  const enemyLower = enemyChamp.toLowerCase()
  for (const [k, v] of Object.entries(WR_MAP)) {
    const [a, b] = k.split('|')
    if (a.toLowerCase() === myLower && b.toLowerCase() === enemyLower) return v
    if (a.toLowerCase() === enemyLower && b.toLowerCase() === myLower) return 100 - v
  }

  // 3. Relation de counter
  const iCounterThem = CHAMPION_COUNTERS[enemyChamp]?.some(
    (c) => c.toLowerCase() === myLower,
  )
  if (iCounterThem) return 56

  const theyCounterMe = CHAMPION_COUNTERS[myChamp]?.some(
    (c) => c.toLowerCase() === enemyLower,
  )
  if (theyCounterMe) return 44

  // 4. Avantage de classe
  const me = getChampion(myChamp)
  const enemy = getChampion(enemyChamp)
  if (me && enemy) {
    return getClassWinrate(me.class, enemy.class)
  }

  // 5. Défaut
  return 50
}
