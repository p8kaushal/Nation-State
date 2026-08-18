export interface PendingEffect {
  targetTurn: number;
  effects: string[]; // List of formula strings e.g. "educationIndex + 15"
  description: string;
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
  debtCrisis: boolean;
  pendingEffects: PendingEffect[];
  recentLogs: string[];
  gameOver: boolean;
  gameResult: 'win' | 'lose' | null;
  gameOverReason: string | null;
}

export interface DecisionOption {
  id: string;
  title: string;
  immediateEffects?: string[];
  delayedEffects?: {
    delayTurns: number;
    effects: string[];
  };
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  options: DecisionOption[];
}

export interface RandomEvent {
  id: string;
  title: string;
  description: string;
  triggerCondition: string; // e.g. "corruptionLevel > 40"
  probabilityWeight: string; // e.g. "corruptionLevel * 0.01"
  effects: string[];
}
