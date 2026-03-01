/**
 * Instance Anthropic partagée entre tous les agents IA.
 * Centralise la gestion de la clé API.
 */
import Anthropic from '@anthropic-ai/sdk'
import { setDraftOracleClient } from './draftOracle'
import { setPostGameDebriefClient } from './postGameDebrief'
import { setWinConditionClient } from './winConditionTracker'
import { setMatchupBriefingClient } from './matchupBriefing'
import { setTiltDetectorClient } from './tiltDetector'
import { setSmartRecapClient } from './smartRecap'

let sharedClient: Anthropic | null = null

/**
 * Met à jour la clé API et propage le client à tous les agents IA.
 */
export function setAnthropicApiKey(apiKey: string): void {
  sharedClient = new Anthropic({ apiKey })
  // Propager à tous les agents
  setDraftOracleClient(sharedClient)
  setPostGameDebriefClient(sharedClient)
  setWinConditionClient(sharedClient)
  setMatchupBriefingClient(sharedClient)
  setTiltDetectorClient(sharedClient)
  setSmartRecapClient(sharedClient)
  console.log('[AnthropicClient] Clé API mise à jour et propagée à tous les agents.')
}

/**
 * Retourne le client partagé (ou null si pas de clé).
 */
export function getAnthropicClient(): Anthropic | null {
  return sharedClient
}
