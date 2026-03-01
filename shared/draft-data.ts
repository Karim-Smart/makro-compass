/**
 * Données de draft : counter picks, runes recommandées, pools par rôle.
 * Utilisé par la page Draft de l'app native pour conseiller le joueur.
 */

import type { PlayerRole, RuneSetup, ChampionRecommendation } from './types'
import { getChampion, analyzeEnemyComp, getClassMatchup } from './champion-data'

// ─── Champions par rôle ──────────────────────────────────────────────────────

export const ROLE_POOL: Record<PlayerRole, string[]> = {
  TOP: [
    'Aatrox', 'Ambessa', 'Camille', 'Darius', 'Fiora', 'Gangplank', 'Garen',
    'Gwen', 'Illaoi', 'Irelia', 'Jax', 'K\'Sante', 'Mordekaiser', 'Nasus',
    'Olaf', 'Renekton', 'Riven', 'Sett', 'Urgot', 'Volibear', 'Yorick',
    'Tryndamere', 'Ornn', 'Malphite', 'Poppy', 'Shen',
  ],
  JUNGLE: [
    'Amumu', 'Diana', 'Ekko', 'Evelynn', 'Graves', 'Jarvan IV', 'Kha\'Zix',
    'Kindred', 'Lee Sin', 'Master Yi', 'Rammus', 'Rengar', 'Sejuani', 'Shaco',
    'Viego', 'Volibear', 'Zac', 'Gragas',
  ],
  MID: [
    'Ahri', 'Akali', 'Anivia', 'Annie', 'Aurora', 'Aurelion Sol', 'Azir',
    'Cassiopeia', 'Diana', 'Ekko', 'Fizz', 'Galio', 'Hwei', 'Kassadin',
    'Katarina', 'LeBlanc', 'Lissandra', 'Lux', 'Malzahar', 'Orianna',
    'Syndra', 'Twisted Fate', 'Veigar', 'Viktor', 'Vladimir', 'Xerath',
    'Yasuo', 'Yone', 'Zed', 'Zoe',
  ],
  ADC: [
    'Aphelios', 'Ashe', 'Caitlyn', 'Draven', 'Ezreal', 'Jhin', 'Jinx',
    'Kai\'Sa', 'Kalista', 'Kog\'Maw', 'Lucian', 'Miss Fortune', 'Samira',
    'Sivir', 'Tristana', 'Twitch', 'Varus', 'Vayne', 'Xayah', 'Zeri',
    'Smolder',
  ],
  SUPPORT: [
    'Alistar', 'Blitzcrank', 'Braum', 'Janna', 'Karma', 'Leona', 'Lulu',
    'Millio', 'Nami', 'Nautilus', 'Pyke', 'Rakan', 'Rell', 'Renata Glasc',
    'Sona', 'Soraka', 'Thresh', 'Yuumi',
  ],
}

// ─── Counters par champion (top 3-5 picks qui le contrent) ──────────────────

export const CHAMPION_COUNTERS: Record<string, string[]> = {
  // TOP
  'Aatrox':      ['Fiora', 'Irelia', 'Vayne'],
  'Ambessa':     ['Darius', 'Volibear', 'Garen'],
  'Camille':     ['Jax', 'Fiora', 'Darius'],
  'Darius':      ['Vayne', 'Kayle', 'Quinn'],
  'Fiora':       ['Malphite', 'Poppy', 'Quinn'],
  'Gangplank':   ['Irelia', 'Camille', 'Riven'],
  'Garen':       ['Vayne', 'Darius', 'Quinn'],
  'Gwen':        ['Irelia', 'Riven', 'Darius'],
  'Illaoi':      ['Mordekaiser', 'Vayne', 'Kayle'],
  'Irelia':      ['Volibear', 'Garen', 'Sett'],
  'Jax':         ['Malphite', 'Garen', 'Poppy'],
  'K\'Sante':    ['Fiora', 'Gwen', 'Vayne'],
  'Mordekaiser': ['Fiora', 'Vayne', 'Gwen'],
  'Nasus':       ['Darius', 'Vayne', 'Illaoi'],
  'Olaf':        ['Vayne', 'Kayle', 'Malphite'],
  'Renekton':    ['Vayne', 'Quinn', 'Illaoi'],
  'Riven':       ['Renekton', 'Poppy', 'Volibear'],
  'Sett':        ['Gwen', 'Fiora', 'Vayne'],
  'Urgot':       ['Fiora', 'Vayne', 'Aatrox'],
  'Volibear':    ['Vayne', 'Kayle', 'Fiora'],
  'Yorick':      ['Irelia', 'Jax', 'Tryndamere'],
  'Tryndamere':  ['Malphite', 'Nasus', 'Poppy'],
  'Ornn':        ['Fiora', 'Vayne', 'Gwen'],
  'Malphite':    ['Gwen', 'Mordekaiser', 'Garen'],
  'Shen':        ['Fiora', 'Mordekaiser', 'Darius'],

  // JUNGLE
  'Amumu':       ['Lee Sin', 'Graves', 'Kindred'],
  'Diana':       ['Lee Sin', 'Graves', 'Elise'],
  'Ekko':        ['Lee Sin', 'Graves', 'Rengar'],
  'Evelynn':     ['Lee Sin', 'Rengar', 'Kha\'Zix'],
  'Graves':      ['Rammus', 'Lee Sin', 'Kindred'],
  'Jarvan IV':   ['Lee Sin', 'Graves', 'Kindred'],
  'Kha\'Zix':    ['Rammus', 'Lee Sin', 'Graves'],
  'Kindred':     ['Lee Sin', 'Rengar', 'Graves'],
  'Lee Sin':     ['Rammus', 'Amumu', 'Sejuani'],
  'Master Yi':   ['Rammus', 'Jax', 'Amumu'],
  'Rammus':      ['Graves', 'Lillia', 'Kindred'],
  'Rengar':      ['Rammus', 'Amumu', 'Sejuani'],
  'Sejuani':     ['Graves', 'Kindred', 'Lee Sin'],
  'Shaco':       ['Lee Sin', 'Rammus', 'Amumu'],
  'Viego':       ['Rammus', 'Lee Sin', 'Graves'],
  'Zac':         ['Lee Sin', 'Graves', 'Kindred'],

  // MID
  'Ahri':        ['Kassadin', 'Fizz', 'Yasuo'],
  'Akali':       ['Galio', 'Malzahar', 'Annie'],
  'Anivia':      ['Fizz', 'Kassadin', 'Zed'],
  'Annie':       ['Xerath', 'Lux', 'Vel\'Koz'],
  'Aurelion Sol': ['Fizz', 'Kassadin', 'Zed'],
  'Azir':        ['Fizz', 'Kassadin', 'Xerath'],
  'Cassiopeia':  ['Fizz', 'Kassadin', 'Zed'],
  'Fizz':        ['Galio', 'Malzahar', 'Lissandra'],
  'Galio':       ['Kassadin', 'Aurelion Sol', 'Azir'],
  'Kassadin':    ['Zed', 'Talon', 'Qiyana'],
  'Katarina':    ['Galio', 'Malzahar', 'Diana'],
  'LeBlanc':     ['Galio', 'Kassadin', 'Malzahar'],
  'Lux':         ['Fizz', 'Zed', 'Yasuo'],
  'Malzahar':    ['Kassadin', 'Fizz', 'Aurelion Sol'],
  'Orianna':     ['Fizz', 'Kassadin', 'Yasuo'],
  'Syndra':      ['Fizz', 'Yasuo', 'Zed'],
  'Viktor':      ['Fizz', 'Kassadin', 'Zed'],
  'Vladimir':    ['Malzahar', 'Anivia', 'Orianna'],
  'Yasuo':       ['Renekton', 'Annie', 'Malzahar'],
  'Yone':        ['Renekton', 'Annie', 'Malzahar'],
  'Zed':         ['Malzahar', 'Lissandra', 'Galio'],
  'Veigar':      ['Fizz', 'Kassadin', 'Zed'],

  // ADC
  'Aphelios':    ['Draven', 'Caitlyn', 'Lucian'],
  'Ashe':        ['Draven', 'Samira', 'Lucian'],
  'Caitlyn':     ['Vayne', 'Samira', 'Jinx'],
  'Draven':      ['Vayne', 'Jinx', 'Tristana'],
  'Ezreal':      ['Draven', 'Lucian', 'Samira'],
  'Jhin':        ['Samira', 'Draven', 'Lucian'],
  'Jinx':        ['Draven', 'Caitlyn', 'Lucian'],
  'Kai\'Sa':     ['Draven', 'Caitlyn', 'Miss Fortune'],
  'Lucian':      ['Vayne', 'Jinx', 'Kog\'Maw'],
  'Miss Fortune': ['Samira', 'Draven', 'Sivir'],
  'Samira':      ['Caitlyn', 'Jinx', 'Ashe'],
  'Sivir':       ['Caitlyn', 'Draven', 'Lucian'],
  'Tristana':    ['Caitlyn', 'Draven', 'Ashe'],
  'Vayne':       ['Draven', 'Caitlyn', 'Miss Fortune'],
  'Xayah':       ['Caitlyn', 'Draven', 'Ashe'],

  // SUPPORT
  'Alistar':     ['Janna', 'Morgana', 'Braum'],
  'Blitzcrank':  ['Morgana', 'Sivir', 'Braum'],
  'Braum':       ['Nautilus', 'Leona', 'Rell'],
  'Janna':       ['Nautilus', 'Leona', 'Blitzcrank'],
  'Karma':       ['Nautilus', 'Leona', 'Blitzcrank'],
  'Leona':       ['Janna', 'Braum', 'Alistar'],
  'Lulu':        ['Nautilus', 'Leona', 'Blitzcrank'],
  'Nami':        ['Nautilus', 'Leona', 'Blitzcrank'],
  'Nautilus':    ['Janna', 'Braum', 'Alistar'],
  'Pyke':        ['Braum', 'Nautilus', 'Alistar'],
  'Rakan':       ['Janna', 'Braum', 'Alistar'],
  'Soraka':      ['Nautilus', 'Blitzcrank', 'Leona'],
  'Thresh':      ['Janna', 'Braum', 'Leona'],
  'Yuumi':       ['Nautilus', 'Leona', 'Blitzcrank'],
}

// ─── Runes recommandées par champion ────────────────────────────────────────

export const CHAMPION_RUNES: Record<string, RuneSetup> = {
  // TOP
  'Aatrox':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Sustain en fights prolongés' },
  'Ambessa':     { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Damage soutenu en trade' },
  'Camille':     { keystone: 'Grasp of the Undying', primary: 'Résolution', secondary: 'Inspiration', tip: 'Short trades + sustain en lane' },
  'Darius':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Stack hémorragie + heal en fight' },
  'Fiora':       { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Duels longs, heal avec vitals' },
  'Gangplank':   { keystone: 'First Strike', primary: 'Inspiration', secondary: 'Précision', tip: 'Gold bonus sur les barils' },
  'Garen':       { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Tankiness + damage soutenu' },
  'Gwen':        { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'DPS en fight long avec W' },
  'Illaoi':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Heal massif en ult multi' },
  'Irelia':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'All-in avec stacks + heal' },
  'Jax':         { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Split push + duels' },
  'K\'Sante':    { keystone: 'Grasp of the Undying', primary: 'Résolution', secondary: 'Précision', tip: 'Tank trades en lane' },
  'Mordekaiser': { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Damage + heal dans le Death Realm' },
  'Nasus':       { keystone: 'Fleet Footwork', primary: 'Précision', secondary: 'Résolution', tip: 'Sustain pour farm les stacks' },
  'Olaf':        { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'All-in, inarrêtable avec ult' },
  'Renekton':    { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Lane bully, short trades' },
  'Riven':       { keystone: 'Conqueror', primary: 'Précision', secondary: 'Sorcellerie', tip: 'Combo burst + sustain' },
  'Sett':        { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Trade long + W shield' },
  'Urgot':       { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Damage soutenu avec legs' },
  'Volibear':    { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'All-in brutal early' },
  'Yorick':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Split push avec Maiden' },
  'Tryndamere':  { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Résolution', tip: 'DPS auto-attack + crit' },
  'Ornn':        { keystone: 'Grasp of the Undying', primary: 'Résolution', secondary: 'Inspiration', tip: 'Tank trades, scale avec upgrades' },
  'Malphite':    { keystone: 'Arcane Comet', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Poke en lane, ult engage' },
  'Poppy':       { keystone: 'Grasp of the Undying', primary: 'Résolution', secondary: 'Inspiration', tip: 'Anti-dash, tankiness' },
  'Shen':        { keystone: 'Grasp of the Undying', primary: 'Résolution', secondary: 'Précision', tip: 'Tank trade + ult global' },

  // JUNGLE
  'Amumu':       { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'Engage + tankiness' },
  'Diana':       { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Burst + sustain en multi' },
  'Ekko':        { keystone: 'Electrocute', primary: 'Domination', secondary: 'Inspiration', tip: 'Burst rapide sur ganks' },
  'Evelynn':     { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'One-shot depuis invisible' },
  'Graves':      { keystone: 'Fleet Footwork', primary: 'Précision', secondary: 'Sorcellerie', tip: 'Sustain en clear + kiting' },
  'Jarvan IV':   { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Engage + damage soutenu' },
  'Kha\'Zix':    { keystone: 'First Strike', primary: 'Inspiration', secondary: 'Domination', tip: 'Gold sur isolated picks' },
  'Kindred':     { keystone: 'Press the Attack', primary: 'Précision', secondary: 'Domination', tip: 'DPS dans les marks' },
  'Lee Sin':     { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Ganks early + insec' },
  'Master Yi':   { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Domination', tip: 'DPS hyper late, resets' },
  'Rammus':      { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'Anti-AD, taunt lock' },
  'Rengar':      { keystone: 'Electrocute', primary: 'Domination', secondary: 'Précision', tip: 'One-shot depuis bush/ult' },
  'Sejuani':     { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'CC chain + frontline' },
  'Shaco':       { keystone: 'Hail of Blades', primary: 'Domination', secondary: 'Précision', tip: 'Burst rapide en gank' },
  'Viego':       { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Resets de possessions' },
  'Zac':         { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'Engage long range + CC' },

  // MID
  'Ahri':        { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'Burst combo charm + orb' },
  'Akali':       { keystone: 'Electrocute', primary: 'Domination', secondary: 'Résolution', tip: 'Burst + survie en lane' },
  'Anivia':      { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'Burst Q-E + zone control' },
  'Annie':       { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'Flash Tibbers burst' },
  'Aurelion Sol': { keystone: 'Arcane Comet', primary: 'Sorcellerie', secondary: 'Inspiration', tip: 'Stacking + poke' },
  'Azir':        { keystone: 'Conqueror', primary: 'Précision', secondary: 'Sorcellerie', tip: 'DPS soutenu late game' },
  'Cassiopeia':  { keystone: 'Conqueror', primary: 'Précision', secondary: 'Sorcellerie', tip: 'DPS mage, pas de boots' },
  'Fizz':        { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'All-in burst niv 6' },
  'Galio':       { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Sorcellerie', tip: 'Anti-AP, engage + roam' },
  'Kassadin':    { keystone: 'Fleet Footwork', primary: 'Précision', secondary: 'Résolution', tip: 'Survive early, scale late' },
  'Katarina':    { keystone: 'Conqueror', primary: 'Précision', secondary: 'Résolution', tip: 'Resets + healing en fight' },
  'LeBlanc':     { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'Burst combo W-Q-R' },
  'Lux':         { keystone: 'Arcane Comet', primary: 'Sorcellerie', secondary: 'Inspiration', tip: 'Poke + burst long range' },
  'Malzahar':    { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Inspiration', tip: 'Push + suppress safe' },
  'Orianna':     { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Inspiration', tip: 'Poke + ult teamfight' },
  'Syndra':      { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'One-shot un carry' },
  'Viktor':      { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Inspiration', tip: 'Poke + scale avec upgrades' },
  'Vladimir':    { keystone: 'Phase Rush', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Disengage + sustain' },
  'Yasuo':       { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Résolution', tip: 'DPS + windwall' },
  'Yone':        { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Résolution', tip: 'Engage long range + DPS' },
  'Zed':         { keystone: 'Electrocute', primary: 'Domination', secondary: 'Sorcellerie', tip: 'Burst ult combo' },
  'Veigar':      { keystone: 'Electrocute', primary: 'Domination', secondary: 'Inspiration', tip: 'Stack + cage zone' },

  // ADC
  'Aphelios':    { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Domination', tip: 'DPS multi-armes' },
  'Ashe':        { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Sorcellerie', tip: 'Slow + ult engage' },
  'Caitlyn':     { keystone: 'Fleet Footwork', primary: 'Précision', secondary: 'Sorcellerie', tip: 'Poke + range + traps' },
  'Draven':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Domination', tip: 'Snowball adoration stacks' },
  'Ezreal':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Sorcellerie', tip: 'Poke safe + Sheen proc' },
  'Jhin':        { keystone: 'Fleet Footwork', primary: 'Précision', secondary: 'Sorcellerie', tip: 'Poke + 4th shot burst' },
  'Jinx':        { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Domination', tip: 'DPS hyper, resets passif' },
  'Kai\'Sa':     { keystone: 'Hail of Blades', primary: 'Domination', secondary: 'Précision', tip: 'Burst stack plasma rapide' },
  'Lucian':      { keystone: 'Press the Attack', primary: 'Précision', secondary: 'Domination', tip: 'Short trade burst niv 2' },
  'Miss Fortune': { keystone: 'Arcane Comet', primary: 'Sorcellerie', secondary: 'Domination', tip: 'Poke E + ult AoE' },
  'Samira':      { keystone: 'Conqueror', primary: 'Précision', secondary: 'Domination', tip: 'Stack S rank pour ult' },
  'Sivir':       { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Inspiration', tip: 'Waveclear + ult engage' },
  'Tristana':    { keystone: 'Hail of Blades', primary: 'Domination', secondary: 'Précision', tip: 'All-in burst bomb niv 2' },
  'Vayne':       { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Résolution', tip: 'DPS true damage late' },
  'Xayah':       { keystone: 'Lethal Tempo', primary: 'Précision', secondary: 'Domination', tip: 'DPS + root plumes' },

  // SUPPORT
  'Alistar':     { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'Engage headbutt-pulverize' },
  'Blitzcrank':  { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Inspiration', tip: 'Hook = kill' },
  'Braum':       { keystone: 'Guardian', primary: 'Résolution', secondary: 'Précision', tip: 'Peel bouclier + stun passif' },
  'Janna':       { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Shields + disengage' },
  'Karma':       { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Poke + speed boost' },
  'Leona':       { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'Engage all-in niv 2-3' },
  'Lulu':        { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Peel + polymorph' },
  'Nami':        { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Heal + bulle CC' },
  'Nautilus':    { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Précision', tip: 'Hook + ult point-click' },
  'Pyke':        { keystone: 'Hail of Blades', primary: 'Domination', secondary: 'Résolution', tip: 'Hook + ult execute' },
  'Rakan':       { keystone: 'Guardian', primary: 'Résolution', secondary: 'Inspiration', tip: 'Engage charm AoE rapide' },
  'Soraka':      { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Heal global + silence' },
  'Thresh':      { keystone: 'Aftershock', primary: 'Résolution', secondary: 'Inspiration', tip: 'Hook + lanterne utility' },
  'Yuumi':       { keystone: 'Summon Aery', primary: 'Sorcellerie', secondary: 'Résolution', tip: 'Buff le carry fed' },
}

// ─── Synergies entre champions ───────────────────────────────────────────────

export const CHAMPION_SYNERGIES: Record<string, Array<{ with: string; tip: string; bonus: number }>> = {
  // Knock-up combos pour Yasuo/Yone
  'Yasuo':    [
    { with: 'Malphite', tip: 'Malphite ult → Yasuo ult combo mortel', bonus: 25 },
    { with: 'Diana', tip: 'Diana ult → Yasuo ult multi knock-up', bonus: 20 },
    { with: 'Alistar', tip: 'Alistar combo → Yasuo ult follow', bonus: 18 },
    { with: 'Wukong', tip: 'Wukong ult → Yasuo ult double knock', bonus: 20 },
    { with: 'Rell', tip: 'Rell crash → Yasuo ult AoE', bonus: 18 },
    { with: 'Gragas', tip: 'Gragas ult regroupe → Yasuo ult', bonus: 15 },
    { with: 'Jarvan IV', tip: 'J4 ult cage → Yasuo ult piégés', bonus: 18 },
  ],
  'Yone':     [
    { with: 'Malphite', tip: 'Malphite ult → Yone ult combo AoE', bonus: 22 },
    { with: 'Amumu', tip: 'Amumu ult → Yone ult, double AoE CC', bonus: 20 },
    { with: 'Orianna', tip: 'Orianna balle sur Yone → combo dévastateur', bonus: 20 },
  ],
  // Wombo combo AoE
  'Miss Fortune': [
    { with: 'Amumu', tip: 'Amumu ult stun → MF ult full channel', bonus: 25 },
    { with: 'Leona', tip: 'Leona ult → MF ult, lane kill combo', bonus: 20 },
    { with: 'Sejuani', tip: 'Sejuani ult → MF ult follow-up', bonus: 18 },
    { with: 'Jarvan IV', tip: 'J4 cage → MF ult piégés', bonus: 22 },
    { with: 'Orianna', tip: 'Orianna ult regroupe → MF ult', bonus: 20 },
  ],
  'Orianna':  [
    { with: 'Malphite', tip: 'Balle sur Malphite → ult combo mortel', bonus: 25 },
    { with: 'Wukong', tip: 'Balle sur Wukong → ult combo AoE', bonus: 22 },
    { with: 'Jarvan IV', tip: 'Balle sur J4 → cage + Orianna ult', bonus: 20 },
    { with: 'Rengar', tip: 'Rengar jump → Orianna ult surprise', bonus: 15 },
  ],
  // ADC + Support synergies
  'Samira':   [
    { with: 'Nautilus', tip: 'Nautilus CC chain → Samira stack S vite', bonus: 22 },
    { with: 'Leona', tip: 'Leona all-in → Samira dash + ult', bonus: 22 },
    { with: 'Rell', tip: 'Rell engage AoE → Samira ult dans la mêlée', bonus: 20 },
    { with: 'Alistar', tip: 'Alistar combo → Samira follow', bonus: 18 },
  ],
  'Jinx':     [
    { with: 'Lulu', tip: 'Lulu ult + shield = Jinx inarrêtable', bonus: 22 },
    { with: 'Thresh', tip: 'Thresh lanterne save + hook setup', bonus: 15 },
    { with: 'Nami', tip: 'Nami bubble + E buff → Jinx poke', bonus: 15 },
  ],
  'Kog\'Maw': [
    { with: 'Lulu', tip: 'Lulu + Kog = combo légendaire, peel total', bonus: 28 },
    { with: 'Braum', tip: 'Braum peel + Kog DPS = inarrêtable', bonus: 20 },
  ],
  'Vayne':    [
    { with: 'Lulu', tip: 'Lulu shield/ult → Vayne survie + DPS', bonus: 22 },
    { with: 'Braum', tip: 'Braum peel → Vayne kite safe', bonus: 18 },
    { with: 'Janna', tip: 'Janna disengage → Vayne free DPS', bonus: 18 },
  ],
  'Draven':   [
    { with: 'Leona', tip: 'Leona engage niv 2 → Draven burst instant', bonus: 22 },
    { with: 'Nautilus', tip: 'Nautilus hook → Draven axe burst', bonus: 20 },
    { with: 'Thresh', tip: 'Thresh hook → Draven all-in', bonus: 18 },
  ],
  'Lucian':   [
    { with: 'Nami', tip: 'Nami E sur Lucian → combo passif dévastateur', bonus: 25 },
    { with: 'Braum', tip: 'Braum passive + Lucian passive = stun rapide', bonus: 20 },
  ],
  // Engage combos
  'Malphite': [
    { with: 'Yasuo', tip: 'Malphite ult → Yasuo ult combo', bonus: 25 },
    { with: 'Orianna', tip: 'Balle sur Malphite → double ult', bonus: 25 },
    { with: 'Miss Fortune', tip: 'Malphite ult → MF ult groupé', bonus: 20 },
  ],
  'Amumu':    [
    { with: 'Miss Fortune', tip: 'Amumu ult → MF ult wipe', bonus: 25 },
    { with: 'Katarina', tip: 'Amumu ult → Kata ult spin-to-win', bonus: 20 },
    { with: 'Brand', tip: 'Amumu ult → Brand ult bounce groupé', bonus: 20 },
  ],
  // Dive comps
  'Diana':    [
    { with: 'Yasuo', tip: 'Diana ult → Yasuo ult combo AoE', bonus: 22 },
    { with: 'Leona', tip: 'Double dive all-in', bonus: 15 },
  ],
  // Split push / 1-3-1
  'Fiora':    [
    { with: 'Shen', tip: 'Shen ult global → Fiora split + backup', bonus: 18 },
    { with: 'Twisted Fate', tip: 'TF ult + Fiora split, double pression', bonus: 15 },
  ],
  'Tryndamere': [
    { with: 'Shen', tip: 'Shen ult → Trynd dive immune', bonus: 18 },
  ],
  // Protect the carry
  'Lulu':     [
    { with: 'Kog\'Maw', tip: 'Duo légendaire : buff + peel = DPS monstre', bonus: 28 },
    { with: 'Jinx', tip: 'Lulu R + shield → Jinx teamfight carry', bonus: 22 },
    { with: 'Vayne', tip: 'Lulu peel → Vayne kite librement', bonus: 22 },
    { with: 'Twitch', tip: 'Twitch stealth + Lulu buff = team wipe', bonus: 20 },
  ],
  // CC chain
  'Leona':    [
    { with: 'Samira', tip: 'Leona lock → Samira stack + ult', bonus: 22 },
    { with: 'Draven', tip: 'Leona engage → Draven burst early', bonus: 22 },
    { with: 'Miss Fortune', tip: 'Leona ult → MF ult follow', bonus: 18 },
  ],
  'Nautilus': [
    { with: 'Samira', tip: 'Naut CC chain → Samira stack S', bonus: 22 },
    { with: 'Draven', tip: 'Naut hook → Draven follow burst', bonus: 20 },
    { with: 'Jhin', tip: 'Naut hook → Jhin W root chain', bonus: 15 },
  ],
  'Thresh':   [
    { with: 'Draven', tip: 'Hook + lanterne → Draven all-in', bonus: 18 },
    { with: 'Kalista', tip: 'Kalista ult lance Thresh → engage combo', bonus: 22 },
  ],
}

/**
 * Calcule le score de synergie d'un champion avec les alliés.
 */
export function getSynergyScore(champion: string, allies: string[]): { score: number; tips: string[] } {
  const synergies = CHAMPION_SYNERGIES[champion]
  if (!synergies || allies.length === 0) return { score: 0, tips: [] }

  let score = 0
  const tips: string[] = []
  const allySet = new Set(allies.map((a) => a.toLowerCase()))

  for (const syn of synergies) {
    if (allySet.has(syn.with.toLowerCase())) {
      score += syn.bonus
      tips.push(syn.tip)
    }
  }

  // Vérifier aussi dans l'autre sens (allié a une synergie avec ce champion)
  for (const ally of allies) {
    if (!ally) continue
    const allySyn = CHAMPION_SYNERGIES[ally]
    if (!allySyn) continue
    for (const syn of allySyn) {
      if (syn.with.toLowerCase() === champion.toLowerCase()) {
        // Ne pas doubler si déjà compté
        if (!tips.includes(syn.tip)) {
          score += syn.bonus
          tips.push(syn.tip)
        }
      }
    }
  }

  return { score, tips }
}

// ─── Génération d'explications détaillées ────────────────────────────────────

function generateDetailedReason(
  champion: string,
  enemyPicks: string[],
  allyPicks: string[],
  role: PlayerRole,
): string {
  const sentences: string[] = []
  const champInfo = getChampion(champion)

  // 1. Analyse des counters
  const countered: string[] = []
  for (const enemy of enemyPicks) {
    const counters = CHAMPION_COUNTERS[enemy]
    if (counters?.some((c) => c.toLowerCase() === champion.toLowerCase())) {
      countered.push(enemy)
    }
  }

  if (countered.length >= 2) {
    sentences.push(`${champion} counter à la fois ${countered.join(' et ')}, un pick dévastateur contre cette draft`)
  } else if (countered.length === 1) {
    const enemyInfo = getChampion(countered[0])
    if (enemyInfo) {
      sentences.push(`${champion} domine ${countered[0]} — ${enemyInfo.tip.charAt(0).toLowerCase()}${enemyInfo.tip.slice(1)}`)
    }
  }

  // 2. Analyse des synergies
  const synergy = getSynergyScore(champion, allyPicks)
  if (synergy.tips.length > 0) {
    sentences.push(synergy.tips[0])
    if (synergy.tips.length > 1) sentences.push(synergy.tips[1])
  }

  // 3. Power curve vs comp ennemie
  if (champInfo && enemyPicks.length > 0) {
    const enemyLate = enemyPicks.filter((e) => getChampion(e)?.power === 'late').length
    const enemyEarly = enemyPicks.filter((e) => getChampion(e)?.power === 'early').length

    if (champInfo.power === 'early' && enemyLate >= 2) {
      sentences.push(`${champion} domine l'early game — punish cette comp qui scale tard, finis vite`)
    } else if (champInfo.power === 'late' && enemyEarly >= 2) {
      sentences.push(`${champion} outscale cette comp early game — joue safe et tu gagnes en late`)
    }
  }

  // 4. Analyse de classe ennemie
  if (champInfo && enemyPicks.length > 0) {
    const enemyClasses = enemyPicks.map((e) => getChampion(e)?.class).filter(Boolean)
    const adCount = enemyClasses.filter((c) => c === 'marksman' || c === 'assassin').length
    const apCount = enemyClasses.filter((c) => c === 'mage' || c === 'enchanter').length

    if (champInfo.class === 'tank' && adCount >= 3) {
      sentences.push(`Son armor stack neutralise cette comp heavy AD`)
    } else if (champInfo.class === 'tank' && apCount >= 3) {
      sentences.push(`Excellente frontline contre cette comp à dominante AP`)
    }
  }

  // 5. Conseil runes
  const runes = CHAMPION_RUNES[champion]
  if (runes) {
    sentences.push(`${runes.keystone} en keystone — ${runes.tip}`)
  }

  if (sentences.length === 0) {
    sentences.push(`${champion} est un pick solide pour ${role} dans cette configuration de draft`)
  }

  return sentences.join('. ') + '.'
}

// ─── Moteur de recommandation ────────────────────────────────────────────────

/**
 * Génère les recommandations de counter picks pour un rôle donné
 * en fonction des picks ennemis et de la synergie avec les alliés.
 */
export function getRecommendations(
  enemyPicks: string[],
  myRole: PlayerRole,
  allyPicks: string[] = [],
): ChampionRecommendation[] {
  const pool = ROLE_POOL[myRole]
  const filledEnemies = enemyPicks.filter(Boolean)
  const filledAllies = allyPicks.filter(Boolean)

  if (filledEnemies.length === 0 && filledAllies.length === 0) return []

  // Exclure les champions déjà pick par les alliés
  const allySet = new Set(filledAllies.map((a) => a.toLowerCase()))

  const scored: ChampionRecommendation[] = []

  for (const champ of pool) {
    // Ne pas recommander un champion déjà pick par un allié
    if (allySet.has(champ.toLowerCase())) continue

    let score = 0
    const reasons: string[] = []

    // Counter score vs ennemis
    for (const enemy of filledEnemies) {
      const counters = CHAMPION_COUNTERS[enemy]
      if (counters?.map((c) => c.toLowerCase()).includes(champ.toLowerCase())) {
        score += 30
        reasons.push(`counter ${enemy}`)
      }
    }

    // Power curve advantage vs premier ennemi
    const enemyInfo = filledEnemies[0] ? getChampion(filledEnemies[0]) : null
    const champInfo = getChampion(champ)
    if (champInfo && enemyInfo) {
      if (champInfo.power === 'late' && enemyInfo.power === 'early') {
        score += 5
        reasons.push('outscale')
      } else if (champInfo.power === 'early' && enemyInfo.power === 'late') {
        score += 5
        reasons.push('domine en early')
      }
    }

    // Synergie avec les alliés
    if (filledAllies.length > 0) {
      const synergy = getSynergyScore(champ, filledAllies)
      if (synergy.score > 0) {
        score += synergy.score
        reasons.push(...synergy.tips.slice(0, 2))
      }
    }

    if (score > 0) {
      const runes = CHAMPION_RUNES[champ] ?? {
        keystone: '?', primary: '?', secondary: '?', tip: '',
      }
      scored.push({
        champion: champ,
        reason: reasons.join(' | '),
        detailedReason: generateDetailedReason(champ, filledEnemies, filledAllies, myRole),
        score,
        runes,
      })
    }
  }

  // Tri par score décroissant, top 5
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 5)
}

/**
 * Retourne les tips de composition basés sur les picks ennemis.
 */
export function getDraftCompTips(enemyPicks: string[]): string[] {
  const filtered = enemyPicks.filter(Boolean)
  if (filtered.length === 0) return []
  return analyzeEnemyComp(filtered)
}

// ─── Réaction à un lock ennemi ───────────────────────────────────────────────

/**
 * Génère un commentaire contextuel quand un nouvel ennemi est lock-in.
 * Si le joueur a déjà pick, l'analyse est orientée matchup.
 * Sinon, elle donne un conseil de draft.
 */
export function generateLockReaction(
  lockedChampion: string,
  allEnemies: string[],
  allAllies: string[],
  myChampion: string | null,
  myRole: PlayerRole,
): string {
  const enemy = getChampion(lockedChampion)
  if (!enemy) return `${lockedChampion} locké.`

  const sentences: string[] = []

  // Qui est-ce ?
  const classLabels: Record<string, string> = {
    assassin: 'assassin', mage: 'mage', marksman: 'ADC', bruiser: 'bruiser',
    tank: 'tank', enchanter: 'enchanter', engage: 'engage tank', skirmisher: 'duelliste',
  }
  const powerLabels: Record<string, string> = {
    early: 'fort en early', mid: 'spike au mid game', late: 'hyper carry late', all: 'fort à tous les stades',
  }

  sentences.push(`${lockedChampion} locké — ${classLabels[enemy.class] ?? enemy.class}, ${powerLabels[enemy.power] ?? ''}`)

  // Si j'ai déjà pick : analyse directe
  if (myChampion) {
    const me = getChampion(myChampion)
    const iCounterThem = CHAMPION_COUNTERS[lockedChampion]?.some(
      (c) => c.toLowerCase() === myChampion.toLowerCase(),
    ) ?? false
    const theyCounterMe = CHAMPION_COUNTERS[myChampion]?.some(
      (c) => c.toLowerCase() === lockedChampion.toLowerCase(),
    ) ?? false

    if (iCounterThem) {
      sentences.push(`Bonne nouvelle : ${myChampion} counter ${lockedChampion}`)
    } else if (theyCounterMe) {
      sentences.push(`Attention : ${lockedChampion} counter ${myChampion} — joue prudemment`)
    }

    // Synergie ennemie
    const enemyFilled = allEnemies.filter(Boolean)
    if (enemyFilled.length >= 2) {
      const classes = enemyFilled.map((e) => getChampion(e)?.class).filter(Boolean)
      const adCount = classes.filter((c) => c === 'marksman' || c === 'bruiser' || c === 'assassin').length
      const apCount = classes.filter((c) => c === 'mage' || c === 'enchanter').length
      if (adCount >= 3 && me) sentences.push(`Comp heavy AD ennemie — armor stack efficace`)
      if (apCount >= 3 && me) sentences.push(`Comp heavy AP ennemie — build MR tôt`)
    }

    // Tip mécanique
    if (enemy.tip) sentences.push(enemy.tip)

  } else {
    // Pas encore pick : conseil de draft
    const pool = ROLE_POOL[myRole]
    const counters = pool.filter((c) => {
      return CHAMPION_COUNTERS[lockedChampion]?.some(
        (x) => x.toLowerCase() === c.toLowerCase(),
      )
    })
    if (counters.length > 0) {
      sentences.push(`Counter possible : ${counters.slice(0, 3).join(', ')}`)
    }

    // Danger level
    if (enemy.dangerLevel && enemy.dangerLevel >= 2) {
      sentences.push(`Menace ${'!'.repeat(enemy.dangerLevel)} — ${enemy.tip}`)
    } else if (enemy.tip) {
      sentences.push(enemy.tip)
    }
  }

  return sentences.join('. ') + '.'
}

// ─── Auto-détection des rôles ennemis ────────────────────────────────────────

const ROLE_ORDER: PlayerRole[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']

/**
 * Déduit le rôle de chaque ennemi à partir de ROLE_POOL.
 * Retourne un tableau de 5 éléments : roleMapping[roleIdx] = pickIdx.
 * Ex: [2, 0, 1, 3, 4] → l'ennemi index 2 joue TOP, 0 joue JGL, etc.
 */
export function deduceEnemyRoles(enemies: string[]): number[] {
  const result: number[] = [-1, -1, -1, -1, -1]

  // Pour chaque ennemi, trouver les rôles possibles
  const possibleRoles = new Map<number, number[]>()
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i]) continue
    const roles: number[] = []
    for (let r = 0; r < ROLE_ORDER.length; r++) {
      if (ROLE_POOL[ROLE_ORDER[r]].some((c) => c.toLowerCase() === enemies[i].toLowerCase())) {
        roles.push(r)
      }
    }
    // Si aucun pool ne correspond, autoriser tous les rôles
    if (roles.length === 0) {
      for (let r = 0; r < ROLE_ORDER.length; r++) roles.push(r)
    }
    possibleRoles.set(i, roles)
  }

  // Greedy : les champions avec le moins d'options d'abord
  const indices = [...possibleRoles.keys()].sort(
    (a, b) => (possibleRoles.get(a)?.length ?? 99) - (possibleRoles.get(b)?.length ?? 99),
  )

  const usedRoles = new Set<number>()
  const usedPicks = new Set<number>()

  for (const pickIdx of indices) {
    const roles = possibleRoles.get(pickIdx)!
    for (const roleIdx of roles) {
      if (!usedRoles.has(roleIdx)) {
        result[roleIdx] = pickIdx
        usedRoles.add(roleIdx)
        usedPicks.add(pickIdx)
        break
      }
    }
  }

  // Remplir les rôles restants
  const unusedRoles = ROLE_ORDER.map((_, i) => i).filter((r) => !usedRoles.has(r))
  const unusedPicks = enemies.map((_, i) => i).filter((i) => enemies[i] && !usedPicks.has(i))
  for (let i = 0; i < Math.min(unusedRoles.length, unusedPicks.length); i++) {
    result[unusedRoles[i]] = unusedPicks[i]
  }

  return result
}

// ─── Analyse de matchup détaillée (mécaniques) ──────────────────────────────

export interface MatchupAnalysis {
  advantage: 'you' | 'them' | 'even'
  summary: string
  sections: { icon: string; label: string; text: string }[]
}

export function generateMatchupAnalysis(
  myChampion: string,
  enemyChampion: string,
): MatchupAnalysis {
  const me = getChampion(myChampion)
  const enemy = getChampion(enemyChampion)

  if (!enemy) {
    return { advantage: 'even', summary: `vs ${enemyChampion}`, sections: [] }
  }

  // Si pas de champion allié (pas encore pick), analyse l'ennemi seul
  if (!myChampion || !me) {
    return {
      advantage: 'even',
      summary: `Focus : ${enemyChampion}`,
      sections: [
        { icon: '🎯', label: `Mécanique ${enemyChampion}`, text: enemy.tip },
        { icon: '📈', label: 'Power curve', text: getPowerDesc(enemy.power, enemyChampion) },
        ...getClassTips(enemy.class, enemyChampion),
      ],
    }
  }

  const iCounterThem = CHAMPION_COUNTERS[enemyChampion]?.some(
    (c) => c.toLowerCase() === myChampion.toLowerCase(),
  ) ?? false
  const theyCounterMe = CHAMPION_COUNTERS[myChampion]?.some(
    (c) => c.toLowerCase() === enemyChampion.toLowerCase(),
  ) ?? false

  const advantage = iCounterThem ? 'you' : theyCounterMe ? 'them' : 'even'
  const sections: { icon: string; label: string; text: string }[] = []

  // 1. Avantage / Désavantage
  if (iCounterThem) {
    sections.push({
      icon: '✅', label: 'Avantage matchup',
      text: `${myChampion} counter ${enemyChampion}. Tu as le dessus — joue agressif en respectant les ganks. Zone-le du CS et cherche les kills en solo.`,
    })
  } else if (theyCounterMe) {
    sections.push({
      icon: '⚠️', label: 'Désavantage matchup',
      text: `${enemyChampion} counter ${myChampion}. Matchup difficile — joue safe, farm sous tour. Cherche les roams ou les 2v2 avec ton jungler pour compenser.`,
    })
  }

  // 2. Mécanique ennemie
  sections.push({
    icon: '🎯', label: `Mécanique vs ${enemyChampion}`,
    text: enemy.tip,
  })

  // 3. Classe vs Classe
  const classRule = getClassMatchup(myChampion, enemyChampion)
  if (classRule) {
    sections.push({ icon: '⚔️', label: 'Phase de lane', text: classRule.text })
  }

  // 4. Power spikes
  sections.push({
    icon: '📈', label: 'Niveaux clés',
    text: getPowerSpikes(me.power, enemy.power, myChampion, enemyChampion),
  })

  // 5. Win condition
  sections.push({
    icon: '🏆', label: 'Win condition',
    text: getWinCondition(me, enemy, myChampion, enemyChampion),
  })

  // 6. Items
  const items = getItemAdvice(me.class, enemy.class, enemyChampion)
  if (items) {
    sections.push({ icon: '🛒', label: 'Items', text: items })
  }

  return { advantage, summary: `${myChampion} vs ${enemyChampion}`, sections }
}

// ── Helpers matchup ──

function getPowerDesc(power: string, name: string): string {
  const m: Record<string, string> = {
    early: `${name} est fort niveaux 1-9. Respecte sa pression en early, il tombe après 2-3 items ennemis.`,
    mid: `${name} spike au mid game (1-2 items). C'est sa fenêtre de puissance maximale.`,
    late: `${name} scale en monstre. Il est faible en early — punish-le avant qu'il atteigne 2-3 items.`,
    all: `${name} est fort à tous les stades de la game. Pas de fenêtre de faiblesse claire.`,
  }
  return m[power] ?? ''
}

function getClassTips(cls: string, name: string): { icon: string; label: string; text: string }[] {
  const tips: { icon: string; label: string; text: string }[] = []
  if (cls === 'assassin') {
    tips.push({ icon: '🗡️', label: 'Menace assassin', text: `${name} cherche le one-shot. Toujours garder un sort défensif (flash/dash), ne pas rester low HP en lane. Ward les flancs.` })
  } else if (cls === 'tank' || cls === 'engage') {
    tips.push({ icon: '🛡️', label: 'Frontline ennemie', text: `${name} veut engager et te CC. Ne gaspille pas tout sur lui — focus les carries derrière. Build pénétration si besoin.` })
  } else if (cls === 'mage') {
    tips.push({ icon: '🔮', label: 'Menace mage', text: `${name} poke de loin. Dodge les skillshots latéralement, force l'engage au corps à corps quand ses sorts sont en CD.` })
  } else if (cls === 'marksman') {
    tips.push({ icon: '🏹', label: 'Menace ADC', text: `${name} fait des dégâts soutenus. Engage sur lui quand ses sorts défensifs sont en CD — il est fragile au corps à corps.` })
  }
  return tips
}

function getPowerSpikes(myPower: string, enemyPower: string, me: string, enemy: string): string {
  const key = `${myPower}_${enemyPower}`
  const m: Record<string, string> = {
    'early_early': `Matchup agressif dès le niv 1. Trade courts, respect les CDs. Le premier à faire une erreur perd.`,
    'early_mid': `Tu domines niv 1-5. Punish ${enemy} avant son spike niv 6-9. Si tu ne snowball pas, il te rattrape.`,
    'early_late': `Tu as une fenêtre énorme niv 1-14. Zone ${enemy} du CS, dive-le, finis avant 25 min.`,
    'mid_early': `${enemy} te domine niv 1-5. Concède du CS, ton spike arrive niv 6+. Après 1 item, tu peux combattre.`,
    'mid_mid': `Matchup équilibré. Le premier item complété fait la différence. Farm bien, trade après niv 6.`,
    'mid_late': `Tu es plus fort au mid game (15-25 min). Force les fights dans cette fenêtre, ${enemy} te dépasse en late.`,
    'late_early': `Tu es faible maintenant. Joue ultra safe, farm sous tour, concède les premiers drakes. Tu gagnes après 25 min.`,
    'late_mid': `Tu es faible avant 2 items. Évite les 1v1 jusqu'à 2-3 items. Après, tu surpasses ${enemy}.`,
    'late_late': `Les deux scale — le macro et le teamplay décident plus que le 1v1. Farm proprement, joue les objectifs.`,
    'all_early': `${enemy} est fort en early mais ${me} reste constant. Respecte son burst, trade quand ses CDs sont down.`,
    'all_mid': `Matchup de skill pur. Track les CDs et punish chaque erreur.`,
    'all_late': `${enemy} scale plus en théorie. Force les objectifs avant qu'il soit full build.`,
    'early_all': `Tu spike en early mais ${enemy} reste fort toute la game. Snowball tôt ou il te rattrape.`,
    'mid_all': `${enemy} est constant, toi tu spike au mid. Profite de ta fenêtre 1-2 items.`,
    'late_all': `Survis la lane. ${enemy} est fort partout mais tu le dépasses en late game.`,
    'all_all': `Matchup de skill. Les deux sont forts à tous les stades — le meilleur joueur gagne.`,
  }
  return m[key] ?? `Analyse les spikes de ${enemy} et trade quand tu as l'avantage de niveaux.`
}

function getWinCondition(me: { class: string; power: string }, enemy: { class: string; power: string }, myName: string, enemyName: string): string {
  // Basé sur la classe du joueur
  const classWin: Record<string, string> = {
    assassin: `Cherche les picks isolés. Trade en short burst (in-out rapide). Ne fais pas de long trades contre ${enemyName}. Roam dès que tu push ta vague.`,
    mage: `Contrôle la vague et poke de loin. Cherche les trades quand ${enemyName} gaspille un sort clé. En teamfight, reste derrière ta frontline.`,
    marksman: `Farm proprement, ne meurs pas en lane. Ton scaling est ta win condition. En teamfight, kite en arrière et DPS la cible la plus proche.`,
    bruiser: `Cherche les trades prolongés quand ${enemyName} a ses CDs down. Après un kill, push et roam ou take platings.`,
    skirmisher: `Joue autour de tes pics de puissance. Cherche le split push pour forcer ${enemyName} à te 1v1 ou perdre des tours.`,
    tank: `Ton objectif est de survivre la lane et dominer les teamfights. Ne force pas le 1v1, groupe et engage sur les carries.`,
    engage: `Même si tu perds la lane, ton utilité en teamfight est énorme. Farm safe et cherche les engages 5v5.`,
    enchanter: `Joue safe, poke quand c'est possible. Ton impact viendra en protégeant tes carries en teamfight.`,
  }
  return classWin[me.class] ?? `Joue autour de tes forces et minimise tes faiblesses face à ${enemyName}.`
}

function getItemAdvice(myClass: string, enemyClass: string, enemyName: string): string | null {
  if (enemyClass === 'assassin' || enemyClass === 'skirmisher') {
    if (myClass === 'mage') return `Zhonya rush contre le burst de ${enemyName}. Stopwatch au premier back peut sauver ta lane. Tabis si AD.`
    if (myClass === 'marksman') return `Galeforce/flash pour esquiver. Guardian Angel mid game. Tabis réduisent son burst auto-attack.`
    return `Stopwatch/Zhonya aide énormément. Un item défensif tôt (Seeker's, Hexdrinker) peut retourner le matchup.`
  }
  if (enemyClass === 'mage') {
    if (myClass === 'assassin') return `Hexdrinker si AD, Banshee si AP. Mercury Treads pour le tenacity + MR. Null Mantle au premier back.`
    return `Mercury Treads pour MR + tenacity. Spectre's Cowl ou Hexdrinker tôt neutralise le poke de ${enemyName}.`
  }
  if (enemyClass === 'bruiser') {
    if (myClass === 'marksman') return `Tabis ninja + BotRK pour le kiting. Gardien de l'Ange mid game. Ne te fais jamais isoler.`
    return `Tabis ninja si AD heavy. Bramble Vest si heal. Anti-heal (Oblivion Orb ou Executioner) si ${enemyName} a du sustain.`
  }
  if (enemyClass === 'tank' || enemyClass === 'engage') {
    return `Build pénétration (Void Staff / Lord Dom). Ne gaspille pas ton burst sur le tank — contourne-le et focus les carries.`
  }
  if (enemyClass === 'marksman') {
    return `Tabis ninja réduisent le DPS auto. Cherche l'engage au CàC — ${enemyName} est fragile sans peel.`
  }
  if (enemyClass === 'enchanter') {
    return `Anti-heal (Oblivion Orb / Executioner) en priorité. Focus l'enchanter OU le carry, ne split pas ton damage.`
  }
  return null
}

