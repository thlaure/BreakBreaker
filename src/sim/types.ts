export interface Vec {
  x: number;
  y: number;
}

/** strike/throwRock are edge-triggered presses; act is held. */
export interface InputFrame {
  move: Vec;
  aim: Vec | null;
  run: boolean;
  strike: boolean;
  throwRock: boolean;
  act: boolean;
}

export type Variant = 'classic' | 'palestinian' | 'antifa';
export type Role = 'contact' | 'thrower' | 'degrader' | 'aggressor';

export type SimEvent =
  | { type: 'HitConfirmed'; targetLifeId: number; damage: number; source: 'melee' | 'rock' }
  | { type: 'EnemyThrowStarted'; from: Vec; to: Vec; until: number }
  /** An enemy rock actually left the thrower's hand (not emitted when the flying cap cancels the throw). */
  | { type: 'EnemyRockThrown'; rockId: number }
  | { type: 'ProjectileLanded'; rockId: number }
  | { type: 'ProjectilePickedUp'; rockId: number }
  | { type: 'ProjectileReturned'; rockId: number }
  | { type: 'ProtectedGroupBlockedImpact' }
  | { type: 'ActorKnockedOut'; lifeId: number }
  | { type: 'PlayerDamaged'; amount: number }
  | { type: 'BuildingThreatStarted'; incidentId: string }
  | { type: 'BuildingThreatPaused'; incidentId: string }
  | { type: 'BuildingDestroyed'; incidentId: string }
  | { type: 'SchoolRestored'; incidentId: string }
  /** The school assault is wave 1; `total` = rioters to knock out in it. */
  | { type: 'SchoolStarted'; incidentId: string; pos: Vec; wave: number; total: number }
  /** The rescue is wave 2; `total` = its aggressors. */
  | { type: 'RescueStarted'; incidentId: string; pos: Vec; kind: 'groupHarassed' | 'elderlyRobbed'; wave: number; total: number }
  | { type: 'RescueSecured'; incidentId: string }
  | { type: 'RescueCompleted'; incidentId: string }
  | { type: 'RescueFailed'; incidentId: string }
  | { type: 'HealCompleted' }
  | { type: 'WeaponSpawned'; kind: 'baton' | 'marteau' | 'panneau'; pos: Vec }
  | { type: 'WeaponPickedUp'; kind: 'baton' | 'marteau' | 'panneau' }
  | { type: 'WeaponBroken'; kind: 'baton' | 'marteau' | 'panneau' }
  /** A fill wave (3, 4, …) starts; `total` = rioters in it. */
  | { type: 'WaveAnnounced'; index: number; total: number }
  | { type: 'PlayerKnockedOut' };
