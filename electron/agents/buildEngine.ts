/**
 * Moteur de génération de recommandations de build.
 * Analyse la composition ennemie et recommande items adaptés.
 */

import type { GameData, CoachingStyle, BuildRecommendations, EnemyDamageProfile, RecommendedItem, ChampionBuild } from '../../shared/types'
import { getChampion } from '../../shared/champion-data'
import type { ChampionClass } from '../../shared/champion-data'
import { CLASS_BUILDS, STYLE_BUILD_TIPS } from '../../shared/build-data'

function analyzeEnemyProfile(enemies: string[]): EnemyDamageProfile {
  let apCount = 0
  let adCount = 0
  let tankCount = 0
  let healCount = 0
  let assassinCount = 0

  const apClasses: ChampionClass[] = ['mage', 'enchanter']
  const adClasses: ChampionClass[] = ['marksman', 'assassin', 'skirmisher']
  const tankClasses: ChampionClass[] = ['tank', 'engage']
  const healClasses: ChampionClass[] = ['enchanter']

  for (const enemy of enemies) {
    const info = getChampion(enemy)
    if (!info) continue

    if (apClasses.includes(info.class)) apCount++
    if (adClasses.includes(info.class)) adCount++
    if (tankClasses.includes(info.class)) tankCount++
    if (healClasses.includes(info.class)) healCount++
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
  style: CoachingStyle
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

  const boots: RecommendedItem = {
    name: classBuild.boots.name,
    itemId: classBuild.boots.itemId,
    reason: 'Boots',
    situational: false,
  }

  // Choisir l'item situationnel en fonction du profil ennemi
  const situationalItems: RecommendedItem[] = []

  if (profile.healCount >= 2) {
    const item = classBuild.situationalHeal[0]
    situationalItems.push({ name: item.name, itemId: item.itemId, reason: 'Anti-heal (compo heal ennemie)', situational: true })
  } else if (profile.dominantType === 'ap') {
    const item = classBuild.situationalAP[0]
    situationalItems.push({ name: item.name, itemId: item.itemId, reason: 'Résistance AP (compo AP ennemie)', situational: true })
  } else if (profile.dominantType === 'ad') {
    const item = classBuild.situationalAD[0]
    situationalItems.push({ name: item.name, itemId: item.itemId, reason: 'Résistance AD (compo AD ennemie)', situational: true })
  } else if (profile.dominantType === 'tank') {
    const item = classBuild.situationalTank[0]
    situationalItems.push({ name: item.name, itemId: item.itemId, reason: 'Anti-tank (compo tanky ennemie)', situational: true })
  } else {
    // Mixed : choisir AD ou AP selon ce qu'il y a le plus
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
  const myBuild = buildChampionBuild(gameData.champion, profile, style)

  return {
    myBuild,
    enemyProfile: profile,
    gamePhase: getGamePhase(gameData.gameTime),
    style,
  }
}
