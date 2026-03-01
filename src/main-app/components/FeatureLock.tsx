import { useNavigate } from 'react-router-dom'
import { canAccess, requiredTier, type GatedFeature } from '../../../shared/feature-gates'
import { TIER_LABELS } from '../../../shared/constants'
import { useSubscriptionStore } from '../stores/subscriptionStore'

interface FeatureLockProps {
  feature: GatedFeature
  children: React.ReactNode
}

/**
 * Wrapper de gating : si le tier actuel a accès → render children,
 * sinon → overlay flou avec badge tier requis + lien vers /pricing.
 */
export default function FeatureLock({ feature, children }: FeatureLockProps) {
  const tier = useSubscriptionStore((s) => s.status?.tier ?? 'free')
  const navigate = useNavigate()

  if (canAccess(feature, tier)) {
    return <>{children}</>
  }

  const needed = requiredTier(feature)
  const label = TIER_LABELS[needed]

  return (
    <div className="relative">
      <div className="pointer-events-none select-none" style={{ filter: 'blur(4px)', opacity: 0.4 }}>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span
          className="px-3 py-1 clip-bevel-sm text-xs font-bold uppercase tracking-wider"
          style={{
            backgroundColor: needed === 'elite' ? '#FFD70030' : '#9B6EF330',
            color: needed === 'elite' ? '#FFD700' : '#9B6EF3',
            border: `1px solid ${needed === 'elite' ? '#FFD70050' : '#9B6EF350'}`,
          }}
        >
          {label} requis
        </span>
        <button
          onClick={() => navigate('/pricing')}
          className="px-4 py-1.5 clip-bevel text-xs font-semibold transition-all hover:scale-105"
          style={{
            backgroundColor: needed === 'elite' ? '#FFD70020' : '#9B6EF320',
            color: needed === 'elite' ? '#FFD700' : '#9B6EF3',
            border: `1px solid ${needed === 'elite' ? '#FFD70040' : '#9B6EF340'}`,
          }}
        >
          Voir les plans
        </button>
      </div>
    </div>
  )
}
