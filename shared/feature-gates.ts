/**
 * Feature gating centralisé par tier d'abonnement.
 * Code pur (pas de dépendance Node) — importable depuis main process ET renderers.
 */

import type { SubscriptionTier } from './types'

// 16 fonctionnalités gatées
export type GatedFeature =
  | 'overlay_advice'       // Panneau overlay conseils IA
  | 'overlay_build'        // Panneau overlay build
  | 'overlay_style'        // Panneau overlay style switcher
  | 'all_coaching_styles'  // Styles LEC/LCS/LPL (LCK gratuit)
  | 'all_rune_variants'    // Variantes offensive/defensive (standard gratuit)
  | 'ranked_import'        // Import historique LCU
  | 'draft_oracle'         // AI Draft Oracle
  | 'postgame_debrief'     // AI Post-Game Debrief
  | 'matchup_briefing'     // AI Matchup Briefing
  | 'smart_recap'          // AI Smart Recap
  | 'wincondition_tracker' // AI Win Condition Tracker
  | 'shotcaller_mode'      // Mode Shotcaller (conseils directifs)
  | 'custom_coach'         // Coach personnalisé (ton custom)
  | 'voice_coaching'       // Voice coaching TTS
  | 'tilt_detector'        // AI Tilt Detector
  | 'unlimited_advice'     // Conseils illimités (pas de quota)

// Tier minimum requis pour chaque feature
const FEATURE_TIERS: Record<GatedFeature, SubscriptionTier> = {
  overlay_advice:       'pro',
  overlay_build:        'pro',
  overlay_style:        'pro',
  all_coaching_styles:  'pro',
  all_rune_variants:    'pro',
  ranked_import:        'pro',
  draft_oracle:         'pro',
  postgame_debrief:     'pro',
  matchup_briefing:     'pro',
  smart_recap:          'pro',
  wincondition_tracker: 'elite',
  shotcaller_mode:      'elite',
  custom_coach:         'elite',
  voice_coaching:       'elite',
  tilt_detector:        'elite',
  unlimited_advice:     'elite',
}

// Hiérarchie des tiers (index plus élevé = plus de droits)
const TIER_HIERARCHY: SubscriptionTier[] = ['free', 'pro', 'elite']

function tierIndex(tier: SubscriptionTier): number {
  return TIER_HIERARCHY.indexOf(tier)
}

/**
 * Vérifie si un tier a accès à une fonctionnalité.
 */
export function canAccess(feature: GatedFeature, tier: SubscriptionTier): boolean {
  const required = FEATURE_TIERS[feature]
  return tierIndex(tier) >= tierIndex(required)
}

/**
 * Retourne le tier minimum requis pour une fonctionnalité.
 */
export function requiredTier(feature: GatedFeature): SubscriptionTier {
  return FEATURE_TIERS[feature]
}

/**
 * Retourne la liste des features accessibles pour un tier donné.
 */
export function accessibleFeatures(tier: SubscriptionTier): GatedFeature[] {
  return (Object.keys(FEATURE_TIERS) as GatedFeature[]).filter(
    (feature) => canAccess(feature, tier)
  )
}
