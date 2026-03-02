/**
 * Moteur de génération de recommandations de build.
 * Analyse la composition ennemie et recommande items adaptés.
 */

import type { GameData, CoachingStyle, BuildRecommendations, EnemyDamageProfile, RecommendedItem, ChampionBuild } from '../../shared/types'
import { getChampion } from '../../shared/champion-data'
import type { ChampionClass } from '../../shared/champion-data'
import { CLASS_BUILDS, STYLE_BUILD_TIPS, HEALING_CHAMPIONS } from '../../shared/build-data'

function analyzeEnemyProfile(enemies: string[]): EnemyDamageProfile {
  let apCount = 0
  let adCount = 0
  let tankCount = 0
  let healCount = 0
  let assassinCount = 0

  const apClasses: ChampionClass[] = ['mage', 'enchanter']
  const adClasses: ChampionClass[] = ['marksman', 'assassin', 'skirmisher']
  const tankClasses: ChampionClass[] = ['tank', 'engage']

  for (const enemy of enemies) {
    const info = getChampion(enemy)
    if (!info) continue

    if (apClasses.includes(info.class)) apCount++
    if (adClasses.includes(info.class)) adCount++
    if (tankClasses.includes(info.class)) tankCount++
    // Healing detection améliorée : check la liste dédiée + classe enchanter
    if (HEALING_CHAMPIONS.has(enemy) || info.class === 'enchanter') healCount++
    if (info.class === 'assassin') assassinCount++
  }

  let dominantType: EnemyDamageProfile['dominantType'] = 'mixed'
  if (apCount >= 3) dominantType = 'ap'
  else if (adCount >= 3) dominantType = 'ad'
  else if (tankCount >= 3) dominantType = 'tank'

  return { apCount, adCount, tankCount, healCount, assassinCount, dominantType }
}

function getGamePhase(gameTime: number): 'early' | 'mid' | 'late' {
  if (gameTime < 840) return 'early'   // < 14 min
  if (gameTime < 1500) return 'mid'    // < 25 min
  return 'late'
}

function buildChampionBuild(
  champion: string,
  profile: EnemyDamageProfile,
  style: CoachingStyle,
  deaths: number = 0,
  gameTime: number = 0,
): ChampionBuild {
  const info = getChampion(champion)
  const champClass: ChampionClass = info?.class ?? 'bruiser'
  const classBuild = CLASS_BUILDS[champClass]

  const coreItems: RecommendedItem[] = classBuild.coreItems.map(item => ({
    name: item.name,
    itemId: item.itemId,
    reason: 'Item core',
    situational: false,
  }))

  // ─── Boots adaptatives basées sur le profil ennemi ───────────
  let bootsItem = classBuild.boots
  let bootsReason = 'Boots par défaut'

  if (profile.dominantType === 'ap' || (profile.apCount >= 2 && profile.assassinCount >= 1)) {
    bootsItem = classBuild.bootsAP
    bootsReason = `Mercury's — ${profile.apCount} AP + CC ennemi`
  } else if (profile.dominantType === 'ad' || profile.assassinCount >= 2) {
    bootsItem = classBuild.bootsAD
    bootsReason = `Steelcaps — ${profile.adCount} AD + ${profile.assassinCount} assassins`
  }

  const boots: RecommendedItem = {
    name: bootsItem.name,
    itemId: bootsItem.itemId,
    reason: bootsReason,
    situational: false,
  }

  // ─── Items situationnels (peut en avoir 2 si nécessaire) ──────
  const situationalItems: RecommendedItem[] = []
  const addedItemIds = new Set<number>()

  // Priorité 1 : Anti-heal si 2+ healing champions
  if (profile.healCount >= 2) {
    const item = classBuild.situationalHeal[0]
    if (!addedItemIds.has(item.itemId)) {
      situationalItems.push({ name: item.name, itemId: item.itemId, reason: `Anti-heal (${profile.healCount} champs heal)`, situational: true })
      addedItemIds.add(item.itemId)
    }
  }

  // Priorité 2 : Résistance selon le type dominant
  if (profile.dominantType === 'ap' && situationalItems.length < 2) {
    const item = classBuild.situationalAP[0]
    if (!addedItemIds.has(item.itemId)) {
      situationalItems.push({ name: item.name, itemId: item.itemId, reason: `MR — ${profile.apCount} AP ennemis`, situational: true })
      addedItemIds.add(item.itemId)
    }
  } else if (profile.dominantType === 'ad' && situationalItems.length < 2) {
    const item = classBuild.situationalAD[0]
    if (!addedItemIds.has(item.itemId)) {
      situationalItems.push({ name: item.name, itemId: item.itemId, reason: `Armor — ${profile.adCount} AD ennemis`, situational: true })
      addedItemIds.add(item.itemId)
    }
  } else if (profile.dominantType === 'tank' && situationalItems.length < 2) {
    const item = classBuild.situationalTank[0]
    if (!addedItemIds.has(item.itemId)) {
      situationalItems.push({ name: item.name, itemId: item.itemId, reason: `Anti-tank (${profile.tankCount} tanks)`, situational: true })
      addedItemIds.add(item.itemId)
    }
  }

  // Priorité 3 : Item de survie si on meurt beaucoup (4+ morts avant 20 min, ou 6+ total)
  const needsSurvival = (deaths >= 4 && gameTime < 1200) || deaths >= 6
  if (needsSurvival && situationalItems.length < 2) {
    const item = classBuild.survivalItem
    if (!addedItemIds.has(item.itemId)) {
      situationalItems.push({ name: item.name, itemId: item.itemId, reason: `Survie (${deaths} morts — tu te fais focus)`, situational: true })
      addedItemIds.add(item.itemId)
    }
  }

  // Fallback si aucun situationnel : adaptif selon la comp la plus représentée
  if (situationalItems.length === 0) {
    const item = profile.apCount > profile.adCount
      ? classBuild.situationalAP[0]
      : classBuild.situationalAD[0]
    situationalItems.push({ name: item.name, itemId: item.itemId, reason: 'Adaptif (compo mixte)', situational: true })
  }

  return {
    champion,
    coreItems,
    boots,
    situationalItems,
    tip: STYLE_BUILD_TIPS[style],
  }
}

/**
 * Génère les recommandations de build basées sur les données de la partie.
 */
export function generateBuildRecommendations(
  gameData: GameData,
  style: CoachingStyle
): BuildRecommendations {
  const profile = analyzeEnemyProfile(gameData.enemies)
  const myBuild = buildChampionBuild(
    gameData.champion, profile, style,
    gameData.kda.deaths, gameData.gameTime,
  )

  return {
    myBuild,
    enemyProfile: profile,
    gamePhase: getGamePhase(gameData.gameTime),
    style,
  }
}
