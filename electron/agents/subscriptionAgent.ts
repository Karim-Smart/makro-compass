import axios from 'axios'
import { getQuotaStatus } from './quotaManager'
import { QUOTA_RULES, DEV_OVERRIDE_TIER } from '../../shared/constants'
import type { SubscriptionStatus, SubscriptionTier } from '../../shared/types'
import { canAccess, type GatedFeature } from '../../shared/feature-gates'

// URL du backend Railway (à configurer dans .env)
const BACKEND_URL = process.env.BACKEND_URL ?? 'https://localhost:8000'

// Cache local pour éviter des appels réseau trop fréquents
let cachedStatus: SubscriptionStatus | null = null
let lastCheckTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Vérifie le statut de l'abonnement auprès du backend.
 * Utilise un cache pour ne pas surcharger le backend.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const now = Date.now()

  // quotaUsed est toujours lu en temps réel depuis SQLite (pas mis en cache)
  const quota = getQuotaStatus()

  // ── Dev mode : tier simulé, pas d'appel backend ─────────────────────────
  if (DEV_OVERRIDE_TIER) {
    const rules = QUOTA_RULES[DEV_OVERRIDE_TIER]
    cachedStatus = {
      tier: DEV_OVERRIDE_TIER,
      isActive: true,
      expiresAt: null,
      quotaUsed: quota.used,
      quotaMax: rules.maxPerDay,
      nextResetAt: quota.resetAt,
    }
    if (lastCheckTime === 0) {
      console.log(`[SubscriptionAgent] Mode dev — tier simulé: ${DEV_OVERRIDE_TIER}`)
    }
    lastCheckTime = now
    return cachedStatus
  }

  // Le tier/abonnement est mis en cache 5 min pour éviter les appels réseau
  if (cachedStatus && now - lastCheckTime < CACHE_TTL_MS) {
    return {
      ...cachedStatus,
      quotaUsed: quota.used,
      nextResetAt: quota.resetAt
    }
  }

  try {
    // Appel au backend Railway
    const response = await axios.get<BackendSubscriptionResponse>(
      `${BACKEND_URL}/api/subscription/status`,
      {
        timeout: 5000,
        headers: {
          // TODO: Ajouter le JWT utilisateur ici
          // 'Authorization': `Bearer ${userToken}`
        }
      }
    )

    const tier = response.data.tier as SubscriptionTier
    const rules = QUOTA_RULES[tier]

    cachedStatus = {
      tier,
      isActive: response.data.isActive,
      expiresAt: response.data.expiresAt,
      quotaUsed: quota.used,
      quotaMax: rules.maxPerDay,
      nextResetAt: quota.resetAt
    }

  } catch (error) {
    console.warn('[SubscriptionAgent] Impossible de vérifier l\'abonnement, mode offline:', (error as Error).message)

    // Mode offline : conserver le dernier tier connu si disponible, sinon fallback free
    if (cachedStatus) {
      console.log(`[SubscriptionAgent] Utilisation du cache expiré (tier: ${cachedStatus.tier})`)
      cachedStatus = {
        ...cachedStatus,
        quotaUsed: quota.used,
        nextResetAt: quota.resetAt,
      }
    } else {
      const rules = QUOTA_RULES.free
      cachedStatus = {
        tier: 'free',
        isActive: true,
        expiresAt: null,
        quotaUsed: quota.used,
        quotaMax: rules.maxPerDay,
        nextResetAt: quota.resetAt
      }
    }
  }

  lastCheckTime = now
  return cachedStatus!
}

/**
 * Invalide le cache pour forcer une revérification.
 */
export function invalidateSubscriptionCache(): void {
  cachedStatus = null
  lastCheckTime = 0
}

/**
 * Vérifie si le tier actuel a accès à une fonctionnalité gatée.
 * Retourne true si l'accès est autorisé, false sinon.
 */
export async function guardFeature(feature: GatedFeature): Promise<boolean> {
  const status = await getSubscriptionStatus()
  return canAccess(feature, status.tier)
}

interface BackendSubscriptionResponse {
  tier: string
  isActive: boolean
  expiresAt: number | null
}
