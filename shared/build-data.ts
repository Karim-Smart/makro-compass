/**
 * Base de données des items recommandés par classe de champion.
 * Utilisé par buildEngine.ts pour générer les recommandations de build.
 */

import type { ChampionClass } from './champion-data'
import type { CoachingStyle } from './types'

export interface ClassBuild {
  coreItems: BuildItem[]         // 3 items core
  boots: BuildItem
  bootsAP: BuildItem             // boots adaptatives vs AP
  bootsAD: BuildItem             // boots adaptatives vs AD
  situationalAP: BuildItem[]     // vs comp AP
  situationalAD: BuildItem[]     // vs comp AD
  situationalTank: BuildItem[]   // vs comp tanky
  situationalHeal: BuildItem[]   // vs comp heal
  survivalItem: BuildItem        // item de survie si on meurt beaucoup
}

export interface BuildItem {
  name: string
  itemId: number
}

// ─── Items par classe de champion ───────────────────────────────────────────

export const CLASS_BUILDS: Record<ChampionClass, ClassBuild> = {
  assassin: {
    coreItems: [
      { name: 'Youmuu\'s Ghostblade', itemId: 3142 },
      { name: 'Edge of Night', itemId: 3814 },
      { name: 'Opportunity', itemId: 6701 },
    ],
    boots: { name: 'Ionian Boots of Lucidity', itemId: 3158 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Maw of Malmortius', itemId: 3156 }],
    situationalAD: [{ name: 'Death\'s Dance', itemId: 6333 }],
    situationalTank: [{ name: 'Serylda\'s Grudge', itemId: 6694 }],
    situationalHeal: [{ name: 'Chempunk Chainsword', itemId: 6609 }],
    survivalItem: { name: 'Guardian Angel', itemId: 3026 },
  },
  mage: {
    coreItems: [
      { name: 'Luden\'s Echo', itemId: 6655 },
      { name: 'Shadowflame', itemId: 4645 },
      { name: 'Rabadon\'s Deathcap', itemId: 3089 },
    ],
    boots: { name: 'Sorcerer\'s Shoes', itemId: 3020 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Banshee\'s Veil', itemId: 3102 }],
    situationalAD: [{ name: 'Zhonya\'s Hourglass', itemId: 3157 }],
    situationalTank: [{ name: 'Void Staff', itemId: 3135 }],
    situationalHeal: [{ name: 'Morellonomicon', itemId: 3165 }],
    survivalItem: { name: 'Zhonya\'s Hourglass', itemId: 3157 },
  },
  marksman: {
    coreItems: [
      { name: 'Infinity Edge', itemId: 3031 },
      { name: 'Phantom Dancer', itemId: 3046 },
      { name: 'Bloodthirster', itemId: 3072 },
    ],
    boots: { name: 'Berserker\'s Greaves', itemId: 3006 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Wit\'s End', itemId: 3091 }],
    situationalAD: [{ name: 'Guardian Angel', itemId: 3026 }],
    situationalTank: [{ name: 'Lord Dominik\'s Regards', itemId: 3036 }],
    situationalHeal: [{ name: 'Mortal Reminder', itemId: 3033 }],
    survivalItem: { name: 'Guardian Angel', itemId: 3026 },
  },
  bruiser: {
    coreItems: [
      { name: 'Trinity Force', itemId: 3078 },
      { name: 'Sterak\'s Gage', itemId: 3053 },
      { name: 'Death\'s Dance', itemId: 6333 },
    ],
    boots: { name: 'Plated Steelcaps', itemId: 3047 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Maw of Malmortius', itemId: 3156 }],
    situationalAD: [{ name: 'Randuin\'s Omen', itemId: 3143 }],
    situationalTank: [{ name: 'Black Cleaver', itemId: 3071 }],
    situationalHeal: [{ name: 'Chempunk Chainsword', itemId: 6609 }],
    survivalItem: { name: 'Sterak\'s Gage', itemId: 3053 },
  },
  tank: {
    coreItems: [
      { name: 'Sunfire Aegis', itemId: 3068 },
      { name: 'Thornmail', itemId: 3075 },
      { name: 'Spirit Visage', itemId: 3065 },
    ],
    boots: { name: 'Plated Steelcaps', itemId: 3047 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Force of Nature', itemId: 4401 }],
    situationalAD: [{ name: 'Frozen Heart', itemId: 3110 }],
    situationalTank: [{ name: 'Warmog\'s Armor', itemId: 3083 }],
    situationalHeal: [{ name: 'Thornmail', itemId: 3075 }],
    survivalItem: { name: 'Warmog\'s Armor', itemId: 3083 },
  },
  enchanter: {
    coreItems: [
      { name: 'Moonstone Renewer', itemId: 6617 },
      { name: 'Staff of Flowing Water', itemId: 6616 },
      { name: 'Redemption', itemId: 3107 },
    ],
    boots: { name: 'Ionian Boots of Lucidity', itemId: 3158 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Banshee\'s Veil', itemId: 3102 }],
    situationalAD: [{ name: 'Zhonya\'s Hourglass', itemId: 3157 }],
    situationalTank: [{ name: 'Ardent Censer', itemId: 3504 }],
    situationalHeal: [{ name: 'Chemtech Putrifier', itemId: 3011 }],
    survivalItem: { name: 'Zhonya\'s Hourglass', itemId: 3157 },
  },
  engage: {
    coreItems: [
      { name: 'Locket of the Iron Solari', itemId: 3190 },
      { name: 'Knight\'s Vow', itemId: 3109 },
      { name: 'Zeke\'s Convergence', itemId: 3050 },
    ],
    boots: { name: 'Boots of Swiftness', itemId: 3009 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Force of Nature', itemId: 4401 }],
    situationalAD: [{ name: 'Frozen Heart', itemId: 3110 }],
    situationalTank: [{ name: 'Warmog\'s Armor', itemId: 3083 }],
    situationalHeal: [{ name: 'Thornmail', itemId: 3075 }],
    survivalItem: { name: 'Warmog\'s Armor', itemId: 3083 },
  },
  skirmisher: {
    coreItems: [
      { name: 'Blade of the Ruined King', itemId: 3153 },
      { name: 'Trinity Force', itemId: 3078 },
      { name: 'Death\'s Dance', itemId: 6333 },
    ],
    boots: { name: 'Plated Steelcaps', itemId: 3047 },
    bootsAP: { name: 'Mercury\'s Treads', itemId: 3111 },
    bootsAD: { name: 'Plated Steelcaps', itemId: 3047 },
    situationalAP: [{ name: 'Wit\'s End', itemId: 3091 }],
    situationalAD: [{ name: 'Randuin\'s Omen', itemId: 3143 }],
    situationalTank: [{ name: 'Black Cleaver', itemId: 3071 }],
    situationalHeal: [{ name: 'Chempunk Chainsword', itemId: 6609 }],
    survivalItem: { name: 'Death\'s Dance', itemId: 6333 },
  },
}

// ─── Champions avec du healing significatif (pas seulement les enchanters) ──

export const HEALING_CHAMPIONS: Set<string> = new Set([
  // Enchanters
  'Soraka', 'Yuumi', 'Nami', 'Sona', 'Lulu', 'Janna', 'Milio',
  // Self-heal / drain tanks
  'Aatrox', 'Dr. Mundo', 'Warwick', 'Swain', 'Vladimir', 'Illaoi',
  'Fiddlesticks', 'Sylas', 'Briar',
  // ADC/fighters avec lifesteal intégré
  'Samira', 'Aphelios', 'Draven',
  // Supports avec heal
  'Seraphine', 'Renata Glasc',
])

// ─── Conseils par style ─────────────────────────────────────────────────────

export const STYLE_BUILD_TIPS: Record<CoachingStyle, string> = {
  LCK: 'Build safe et optimisé pour le teamfight. Priorité vision et objectifs.',
  LEC: 'Build snowball — maximise les dégâts pour forcer les avantages.',
  LCS: 'Build teamfight — items qui brillent dans les fights prolongés.',
  LPL: 'Build ultra-agressif — one-shot ou être one-shot. YOLO.',
}
