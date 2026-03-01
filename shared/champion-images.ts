/**
 * Helper pour les images de champions via Data Dragon (Riot CDN).
 * Les loading screen images ne nécessitent pas de version.
 */

const KEY_OVERRIDES: Record<string, string> = {
  'Wukong': 'MonkeyKing',
  'Nunu & Willump': 'Nunu',
  'Nunu': 'Nunu',
  'Renata Glasc': 'Renata',
  'Millio': 'Milio',
}

function toDataDragonKey(name: string): string {
  if (KEY_OVERRIDES[name]) return KEY_OVERRIDES[name]
  // Enlève espaces, apostrophes, points
  return name.replace(/[\s'.]/g, '')
}

/** Image loading screen portrait (308×560, sans version requise) */
export function getChampionLoadingUrl(name: string): string {
  if (!name) return ''
  const key = toDataDragonKey(name)
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${key}_0.jpg`
}

/** Image splash art (1215×717, sans version requise) */
export function getChampionSplashUrl(name: string): string {
  if (!name) return ''
  const key = toDataDragonKey(name)
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`
}

/** Icône carrée du champion (120×120) via Data Dragon CDN */
export function getChampionIconUrl(name: string): string {
  if (!name) return ''
  const key = toDataDragonKey(name)
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/${key}.png`
}

/** Icône d'item via Data Dragon CDN */
export function getItemIconUrl(itemId: number): string {
  if (!itemId) return ''
  return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${itemId}.png`
}
