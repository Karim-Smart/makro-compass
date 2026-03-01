/**
 * Base de données complète des runes League of Legends.
 * IDs et icônes Data Dragon pour les 5 arbres + stat shards.
 * Génération de pages de runes par champion, variant et style.
 */

import type { CoachingStyle, FullRunePage, RunePageSet } from './types'
import { CHAMPION_RUNES } from './draft-data'

// ─── Types locaux ────────────────────────────────────────────────────────────

export interface RuneInfo {
  id: number
  name: string
  icon: string  // chemin relatif Data Dragon perk-images
}

export interface RuneTier {
  runes: RuneInfo[]
}

export interface RuneTree {
  id: number
  name: string
  icon: string
  keystones: RuneInfo[]
  tiers: [RuneTier, RuneTier, RuneTier]  // 3 tiers sous les keystones
}

// ─── Les 5 arbres de runes ──────────────────────────────────────────────────

export const RUNE_TREES: RuneTree[] = [
  // ─── PRECISION (8000) ───────────────────────────────────────────
  {
    id: 8000,
    name: 'Precision',
    icon: 'Styles/7201_Precision.png',
    keystones: [
      { id: 8005, name: 'Press the Attack', icon: 'Styles/Precision/PressTheAttack/PressTheAttack.png' },
      { id: 8008, name: 'Lethal Tempo', icon: 'Styles/Precision/LethalTempo/LethalTempoTemp.png' },
      { id: 8021, name: 'Fleet Footwork', icon: 'Styles/Precision/FleetFootwork/FleetFootwork.png' },
      { id: 8010, name: 'Conqueror', icon: 'Styles/Precision/Conqueror/Conqueror.png' },
    ],
    tiers: [
      { runes: [
        { id: 9101, name: 'Overheal', icon: 'Styles/Precision/Overheal.png' },
        { id: 9111, name: 'Triumph', icon: 'Styles/Precision/Triumph.png' },
        { id: 8009, name: 'Presence of Mind', icon: 'Styles/Precision/PresenceOfMind/PresenceOfMind.png' },
      ]},
      { runes: [
        { id: 9104, name: 'Legend: Alacrity', icon: 'Styles/Precision/LegendAlacrity/LegendAlacrity.png' },
        { id: 9105, name: 'Legend: Tenacity', icon: 'Styles/Precision/LegendTenacity/LegendTenacity.png' },
        { id: 9103, name: 'Legend: Bloodline', icon: 'Styles/Precision/LegendBloodline/LegendBloodline.png' },
      ]},
      { runes: [
        { id: 8014, name: 'Coup de Grace', icon: 'Styles/Precision/CoupDeGrace/CoupDeGrace.png' },
        { id: 8017, name: 'Cut Down', icon: 'Styles/Precision/CutDown/CutDown.png' },
        { id: 8299, name: 'Last Stand', icon: 'Styles/Precision/LastStand/LastStand.png' },
      ]},
    ],
  },

  // ─── DOMINATION (8100) ──────────────────────────────────────────
  {
    id: 8100,
    name: 'Domination',
    icon: 'Styles/7200_Domination.png',
    keystones: [
      { id: 8112, name: 'Electrocute', icon: 'Styles/Domination/Electrocute/Electrocute.png' },
      { id: 8124, name: 'Predator', icon: 'Styles/Domination/Predator/Predator.png' },
      { id: 8128, name: 'Dark Harvest', icon: 'Styles/Domination/DarkHarvest/DarkHarvest.png' },
      { id: 9923, name: 'Hail of Blades', icon: 'Styles/Domination/HailOfBlades/HailOfBlades.png' },
    ],
    tiers: [
      { runes: [
        { id: 8126, name: 'Cheap Shot', icon: 'Styles/Domination/CheapShot/CheapShot.png' },
        { id: 8139, name: 'Taste of Blood', icon: 'Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png' },
        { id: 8143, name: 'Sudden Impact', icon: 'Styles/Domination/SuddenImpact/SuddenImpact.png' },
      ]},
      { runes: [
        { id: 8136, name: 'Zombie Ward', icon: 'Styles/Domination/ZombieWard/ZombieWard.png' },
        { id: 8120, name: 'Ghost Poro', icon: 'Styles/Domination/GhostPoro/GhostPoro.png' },
        { id: 8138, name: 'Eyeball Collection', icon: 'Styles/Domination/EyeballCollection/EyeballCollection.png' },
      ]},
      { runes: [
        { id: 8135, name: 'Treasure Hunter', icon: 'Styles/Domination/TreasureHunter/TreasureHunter.png' },
        { id: 8134, name: 'Ingenious Hunter', icon: 'Styles/Domination/IngeniousHunter/IngeniousHunter.png' },
        { id: 8105, name: 'Relentless Hunter', icon: 'Styles/Domination/RelentlessHunter/RelentlessHunter.png' },
      ]},
    ],
  },

  // ─── SORCERY (8200) ─────────────────────────────────────────────
  {
    id: 8200,
    name: 'Sorcery',
    icon: 'Styles/7202_Sorcery.png',
    keystones: [
      { id: 8214, name: 'Summon Aery', icon: 'Styles/Sorcery/SummonAery/SummonAery.png' },
      { id: 8229, name: 'Arcane Comet', icon: 'Styles/Sorcery/ArcaneComet/ArcaneComet.png' },
      { id: 8230, name: 'Phase Rush', icon: 'Styles/Sorcery/PhaseRush/PhaseRush.png' },
    ],
    tiers: [
      { runes: [
        { id: 8224, name: 'Nullifying Orb', icon: 'Styles/Sorcery/NullifyingOrb/Pokeshield.png' },
        { id: 8226, name: 'Manaflow Band', icon: 'Styles/Sorcery/ManaflowBand/ManaflowBand.png' },
        { id: 8275, name: 'Nimbus Cloak', icon: 'Styles/Sorcery/NimbusCloak/6361.png' },
      ]},
      { runes: [
        { id: 8210, name: 'Transcendence', icon: 'Styles/Sorcery/Transcendence/Transcendence.png' },
        { id: 8234, name: 'Celerity', icon: 'Styles/Sorcery/Celerity/CelerityTemp.png' },
        { id: 8233, name: 'Absolute Focus', icon: 'Styles/Sorcery/AbsoluteFocus/AbsoluteFocus.png' },
      ]},
      { runes: [
        { id: 8237, name: 'Scorch', icon: 'Styles/Sorcery/Scorch/Scorch.png' },
        { id: 8232, name: 'Waterwalking', icon: 'Styles/Sorcery/Waterwalking/Waterwalking.png' },
        { id: 8236, name: 'Gathering Storm', icon: 'Styles/Sorcery/GatheringStorm/GatheringStorm.png' },
      ]},
    ],
  },

  // ─── RESOLVE (8400) ─────────────────────────────────────────────
  {
    id: 8400,
    name: 'Resolve',
    icon: 'Styles/7204_Resolve.png',
    keystones: [
      { id: 8437, name: 'Grasp of the Undying', icon: 'Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png' },
      { id: 8439, name: 'Aftershock', icon: 'Styles/Resolve/VeteranAftershock/VeteranAftershock.png' },
      { id: 8465, name: 'Guardian', icon: 'Styles/Resolve/Guardian/Guardian.png' },
    ],
    tiers: [
      { runes: [
        { id: 8446, name: 'Demolish', icon: 'Styles/Resolve/Demolish/Demolish.png' },
        { id: 8463, name: 'Font of Life', icon: 'Styles/Resolve/FontOfLife/FontOfLife.png' },
        { id: 8401, name: 'Shield Bash', icon: 'Styles/Resolve/MirrorShell/MirrorShell.png' },
      ]},
      { runes: [
        { id: 8429, name: 'Conditioning', icon: 'Styles/Resolve/Conditioning/Conditioning.png' },
        { id: 8444, name: 'Second Wind', icon: 'Styles/Resolve/SecondWind/SecondWind.png' },
        { id: 8473, name: 'Bone Plating', icon: 'Styles/Resolve/BonePlating/BonePlating.png' },
      ]},
      { runes: [
        { id: 8451, name: 'Overgrowth', icon: 'Styles/Resolve/Overgrowth/Overgrowth.png' },
        { id: 8453, name: 'Revitalize', icon: 'Styles/Resolve/Revitalize/Revitalize.png' },
        { id: 8242, name: 'Unflinching', icon: 'Styles/Resolve/Unflinching/Unflinching.png' },
      ]},
    ],
  },

  // ─── INSPIRATION (8300) ─────────────────────────────────────────
  {
    id: 8300,
    name: 'Inspiration',
    icon: 'Styles/7203_Whimsy.png',
    keystones: [
      { id: 8351, name: 'Glacial Augment', icon: 'Styles/Inspiration/GlacialAugment/GlacialAugment.png' },
      { id: 8360, name: 'Unsealed Spellbook', icon: 'Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png' },
      { id: 8369, name: 'First Strike', icon: 'Styles/Inspiration/FirstStrike/FirstStrike.png' },
    ],
    tiers: [
      { runes: [
        { id: 8306, name: 'Hextech Flashtraption', icon: 'Styles/Inspiration/HextechFlashtraption/HextechFlashtraption.png' },
        { id: 8304, name: 'Magical Footwear', icon: 'Styles/Inspiration/MagicalFootwear/MagicalFootwear.png' },
        { id: 8313, name: 'Triple Tonic', icon: 'Styles/Inspiration/PerfectTiming/PerfectTiming.png' },
      ]},
      { runes: [
        { id: 8321, name: 'Future\'s Market', icon: 'Styles/Inspiration/FuturesMarket/FuturesMarket.png' },
        { id: 8316, name: 'Minion Dematerializer', icon: 'Styles/Inspiration/MinionDematerializer/MinionDematerializer.png' },
        { id: 8345, name: 'Biscuit Delivery', icon: 'Styles/Inspiration/BiscuitDelivery/BiscuitDelivery.png' },
      ]},
      { runes: [
        { id: 8347, name: 'Cosmic Insight', icon: 'Styles/Inspiration/CosmicInsight/CosmicInsight.png' },
        { id: 8410, name: 'Approach Velocity', icon: 'Styles/Inspiration/ApproachVelocity/ApproachVelocity.png' },
        { id: 8352, name: 'Time Warp Tonic', icon: 'Styles/Inspiration/TimeWarpTonic/TimeWarpTonic.png' },
      ]},
    ],
  },
]

// ─── Stat Shards ────────────────────────────────────────────────────────────

export const STAT_SHARDS: [RuneInfo[], RuneInfo[], RuneInfo[]] = [
  // Ligne 1 : Offense
  [
    { id: 5008, name: 'Adaptive Force', icon: 'StatMods/StatModsAdaptiveForceIcon.png' },
    { id: 5005, name: 'Attack Speed', icon: 'StatMods/StatModsAttackSpeedIcon.png' },
    { id: 5007, name: 'Ability Haste', icon: 'StatMods/StatModsCDRScalingIcon.png' },
  ],
  // Ligne 2 : Flex
  [
    { id: 5008, name: 'Adaptive Force', icon: 'StatMods/StatModsAdaptiveForceIcon.png' },
    { id: 5002, name: 'Armor', icon: 'StatMods/StatModsArmorIcon.png' },
    { id: 5003, name: 'Magic Resist', icon: 'StatMods/StatModsMagicResIcon.png' },
  ],
  // Ligne 3 : Defense
  [
    { id: 5001, name: 'Health Scaling', icon: 'StatMods/StatModsHealthScalingIcon.png' },
    { id: 5002, name: 'Armor', icon: 'StatMods/StatModsArmorIcon.png' },
    { id: 5003, name: 'Magic Resist', icon: 'StatMods/StatModsMagicResIcon.png' },
  ],
]

// ─── Sélections par défaut par arbre primary ────────────────────────────────

// Pour chaque arbre primary, quel tier choisir par variant
// Index dans le tableau de runes du tier (0, 1, ou 2)
type TierPicks = [number, number, number]  // [tier1, tier2, tier3]

const TREE_DEFAULTS: Record<number, Record<string, TierPicks>> = {
  // Precision
  8000: {
    standard:  [1, 0, 0],  // Triumph, Alacrity, Coup de Grace
    offensive: [2, 0, 1],  // Presence of Mind, Alacrity, Cut Down
    defensive: [1, 1, 2],  // Triumph, Tenacity, Last Stand
  },
  // Domination
  8100: {
    standard:  [1, 2, 0],  // Taste of Blood, Eyeball, Treasure Hunter
    offensive: [2, 2, 0],  // Sudden Impact, Eyeball, Treasure Hunter
    defensive: [1, 0, 1],  // Taste of Blood, Zombie Ward, Ingenious Hunter
  },
  // Sorcery
  8200: {
    standard:  [1, 0, 2],  // Manaflow, Transcendence, Gathering Storm
    offensive: [2, 2, 0],  // Nimbus Cloak, Absolute Focus, Scorch
    defensive: [1, 0, 2],  // Manaflow, Transcendence, Gathering Storm
  },
  // Resolve
  8400: {
    standard:  [0, 1, 0],  // Demolish, Second Wind, Overgrowth
    offensive: [0, 2, 2],  // Demolish, Bone Plating, Unflinching
    defensive: [1, 1, 1],  // Font of Life, Second Wind, Revitalize
  },
  // Inspiration
  8300: {
    standard:  [1, 2, 0],  // Magical Footwear, Biscuit, Cosmic Insight
    offensive: [0, 0, 0],  // Hexflash, Future's Market, Cosmic Insight
    defensive: [1, 2, 2],  // Magical Footwear, Biscuit, Time Warp Tonic
  },
}

// ─── Sélections par défaut pour l'arbre secondaire ──────────────────────────

// [tierIndex, runeIndexInTier] × 2 sélections
type SecondaryPicks = [[number, number], [number, number]]

const SECONDARY_DEFAULTS: Record<number, Record<string, SecondaryPicks>> = {
  8000: {
    standard:  [[1, 0], [2, 0]],  // Alacrity, Coup de Grace
    offensive: [[0, 2], [2, 1]],  // Presence of Mind, Cut Down
    defensive: [[1, 1], [2, 2]],  // Tenacity, Last Stand
  },
  8100: {
    standard:  [[0, 1], [2, 0]],  // Taste of Blood, Treasure Hunter
    offensive: [[0, 2], [2, 0]],  // Sudden Impact, Treasure Hunter
    defensive: [[0, 1], [1, 0]],  // Taste of Blood, Zombie Ward
  },
  8200: {
    standard:  [[0, 1], [2, 2]],  // Manaflow, Gathering Storm
    offensive: [[1, 2], [2, 0]],  // Absolute Focus, Scorch
    defensive: [[0, 1], [1, 0]],  // Manaflow, Transcendence
  },
  8400: {
    standard:  [[1, 1], [2, 0]],  // Second Wind, Overgrowth
    offensive: [[0, 0], [2, 2]],  // Demolish, Unflinching
    defensive: [[1, 2], [2, 1]],  // Bone Plating, Revitalize
  },
  8300: {
    standard:  [[1, 2], [2, 0]],  // Biscuit, Cosmic Insight
    offensive: [[0, 1], [2, 0]],  // Magical Footwear, Cosmic Insight
    defensive: [[1, 2], [2, 2]],  // Biscuit, Time Warp Tonic
  },
}

// ─── Default stat shards par variant ────────────────────────────────────────

const SHARD_DEFAULTS: Record<string, [number, number, number]> = {
  standard:  [0, 0, 0],  // Adaptive, Adaptive, HP scaling
  offensive: [0, 0, 0],  // Adaptive, Adaptive, HP scaling
  defensive: [0, 1, 1],  // Adaptive, Armor, Armor
}

// ─── Overrides par style de coaching ────────────────────────────────────────

// Chaque style peut forcer un secondary tree différent ou modifier les picks
interface StyleOverride {
  preferredSecondary?: Record<number, number>  // primary tree → forced secondary tree
  shardOverride?: Record<string, [number, number, number]>
}

const STYLE_OVERRIDES: Record<CoachingStyle, StyleOverride> = {
  LCK: {
    // LCK préfère Resolve en secondary pour la sécurité
    preferredSecondary: {
      8000: 8400,  // Precision → Resolve
      8100: 8400,  // Domination → Resolve
      8200: 8400,  // Sorcery → Resolve
    },
  },
  LEC: {
    // LEC préfère Domination secondary pour le snowball
    preferredSecondary: {
      8000: 8100,  // Precision → Domination
      8200: 8100,  // Sorcery → Domination
      8400: 8100,  // Resolve → Domination
    },
  },
  LCS: {
    // LCS préfère Resolve/Inspiration pour le teamfight
    preferredSecondary: {
      8000: 8300,  // Precision → Inspiration
      8100: 8400,  // Domination → Resolve
    },
  },
  LPL: {
    // LPL full agressif — Domination partout
    preferredSecondary: {
      8000: 8100,  // Precision → Domination
      8200: 8100,  // Sorcery → Domination
      8400: 8100,  // Resolve → Domination
    },
    shardOverride: {
      standard:  [0, 0, 0],
      offensive: [1, 0, 0],  // Attack speed, Adaptive, HP
      defensive: [0, 0, 0],
    },
  },
}

// ─── Keystones par champion (lookup depuis draft-data) ──────────────────────

function getKeystoneForChampion(champion: string): number | null {
  const runeSetup = CHAMPION_RUNES[champion]
  if (!runeSetup) return null

  // Map le nom du keystone vers son ID
  const keystoneName = runeSetup.keystone
  for (const tree of RUNE_TREES) {
    const ks = tree.keystones.find(k => k.name === keystoneName)
    if (ks) return ks.id
  }
  return null
}

function getTreeForKeystone(keystoneId: number): RuneTree | null {
  return RUNE_TREES.find(t => t.keystones.some(k => k.id === keystoneId)) ?? null
}

// ─── Choix de l'arbre secondaire ────────────────────────────────────────────

function pickSecondaryTree(primaryTreeId: number, style: CoachingStyle): number {
  const overrides = STYLE_OVERRIDES[style]
  if (overrides.preferredSecondary?.[primaryTreeId]) {
    return overrides.preferredSecondary[primaryTreeId]
  }

  // Default : choisir un arbre secondaire qui n'est pas le primary
  const fallbacks: Record<number, number> = {
    8000: 8400,  // Precision → Resolve
    8100: 8200,  // Domination → Sorcery
    8200: 8300,  // Sorcery → Inspiration
    8400: 8200,  // Resolve → Sorcery
    8300: 8200,  // Inspiration → Sorcery
  }
  return fallbacks[primaryTreeId] ?? 8400
}

// ─── Génération d'une page de runes ─────────────────────────────────────────

function buildRunePage(
  champion: string,
  variant: 'standard' | 'offensive' | 'defensive',
  style: CoachingStyle
): FullRunePage {
  const keystoneId = getKeystoneForChampion(champion)
  const primaryTree = keystoneId ? getTreeForKeystone(keystoneId) : RUNE_TREES[0]
  if (!primaryTree) {
    // Fallback Precision + Conqueror
    return buildFallbackPage(variant)
  }

  const primaryTreeId = primaryTree.id
  const subTreeId = pickSecondaryTree(primaryTreeId, style)
  const subTree = RUNE_TREES.find(t => t.id === subTreeId) ?? RUNE_TREES[3]

  // Primary : keystone + 3 tiers
  const ksId = keystoneId ?? primaryTree.keystones[0].id
  const primaryPicks = TREE_DEFAULTS[primaryTreeId]?.[variant] ?? [0, 0, 0]
  const primaryPerkIds = [
    ksId,
    primaryTree.tiers[0].runes[primaryPicks[0]].id,
    primaryTree.tiers[1].runes[primaryPicks[1]].id,
    primaryTree.tiers[2].runes[primaryPicks[2]].id,
  ]

  // Secondary : 2 picks parmi 3 tiers
  const secondaryPicks = SECONDARY_DEFAULTS[subTreeId]?.[variant] ?? [[0, 0], [1, 0]]
  const secondaryPerkIds = secondaryPicks.map(
    ([tierIdx, runeIdx]) => subTree.tiers[tierIdx].runes[runeIdx].id
  )

  // Stat shards
  const shardVariant = STYLE_OVERRIDES[style].shardOverride?.[variant] ?? SHARD_DEFAULTS[variant]
  const shardIds = shardVariant.map((idx, line) => STAT_SHARDS[line][idx].id)

  const variantLabel = variant === 'standard' ? 'Standard'
    : variant === 'offensive' ? 'Offensif' : 'Défensif'

  return {
    name: `${champion} — ${variantLabel} (${style})`,
    primaryTreeId,
    subTreeId,
    selectedPerkIds: [...primaryPerkIds, ...secondaryPerkIds, ...shardIds],
    variant,
  }
}

function buildFallbackPage(variant: 'standard' | 'offensive' | 'defensive'): FullRunePage {
  return {
    name: `Fallback — ${variant}`,
    primaryTreeId: 8000,
    subTreeId: 8400,
    selectedPerkIds: [
      8010, 9111, 9104, 8014,  // Conqueror, Triumph, Alacrity, Coup de Grace
      8444, 8451,               // Second Wind, Overgrowth
      5008, 5008, 5001,         // Adaptive, Adaptive, HP
    ],
    variant,
  }
}

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Génère les 3 pages de runes (Standard, Offensif, Défensif) pour un champion.
 */
export function generateRunePages(champion: string, style: CoachingStyle): RunePageSet {
  return {
    standard:  buildRunePage(champion, 'standard', style),
    offensive: buildRunePage(champion, 'offensive', style),
    defensive: buildRunePage(champion, 'defensive', style),
  }
}

/**
 * Retrouve un arbre par son ID.
 */
export function getRuneTree(treeId: number): RuneTree | undefined {
  return RUNE_TREES.find(t => t.id === treeId)
}

/**
 * URL Data Dragon pour une icône de rune.
 */
export function getRuneIconUrl(iconPath: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/perk-images/${iconPath}`
}
