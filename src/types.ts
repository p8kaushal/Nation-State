export interface PendingEffect {
  targetTurn: number;
  effects: string[]; // List of formula strings e.g. "educationIndex + 15"
  description: string;
  spawnDecisionId?: string;
}

export interface NationState {
  turn: number;
  population: number;
  gdp: number;
  gdpGrowthRate: number;
  povertyRate: number;
  unemploymentRate: number;
  educationIndex: number;
  healthcareIndex: number;
  approvalRating: number;
  militaryStrength: number;
  corruptionLevel: number;
  environmentIndex: number;
  treasuryBudget: number;
  nationalDebt: number;
  crimeRate: number;
  foreignRelationsIndex: number;
  militaryTrust: number;
  businessTrust: number;
  publicTrust: number;
  internationalTrust: number;
  debtCrisis: boolean;
  pendingEffects: PendingEffect[];
  recentLogs: string[];
  gameOver: boolean;
  gameResult: 'win' | 'lose' | null;
  gameOverReason: string | null;
  resolvedDecisionIds: string[];
  activeSpawnedDecisionId: string | null;
  eventFlags: Record<string, boolean>;
  activeEscalations: { eventId: string; targetTurn: number; }[];
  recentDeltas: StatDelta[];
}

export interface StatDelta {
  stat: string;
  delta: number;
  source: string;
}

export interface DecisionOption {
  id: string;
  title: string;
  immediateEffects?: string[];
  factionEffects?: string[];
  delayedEffects?: {
    delayTurns: number;
    effects?: string[];
    spawnDecisionId?: string;
  };
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  options: DecisionOption[];
  unlockCondition?: string;
  oneTime?: boolean;
}

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  triggerCondition: string; // e.g. "corruptionLevel > 40"
  probabilityWeight: string; // e.g. "corruptionLevel * 0.01"
  effects: string[];
  escalatesTo?: string;
  escalateTurns?: number;
  setFlag?: string;
  clearFlag?: string;
}
