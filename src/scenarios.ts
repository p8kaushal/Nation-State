import { NationState } from './types';
import { getInitialState } from './simulation';

export type ScenarioKey = 'default' | 'post_war' | 'petrostate' | 'fragile_democracy';

export interface ScenarioMeta {
  id: ScenarioKey;
  name: string;
  description: string;
}

export const scenarioMetadata: Record<ScenarioKey, ScenarioMeta> = {
  default: {
    id: 'default',
    name: 'Default (Baseline)',
    description: 'Baseline scenario with balanced initial statistics and standard debt.',
  },
  post_war: {
    id: 'post_war',
    name: 'Post-War Reconstruction',
    description: 'A nation ravaged by conflict with degraded public services, low trust, and crushing debt (90% of GDP).',
  },
  petrostate: {
    id: 'petrostate',
    name: 'Petrostate',
    description: 'Resource-rich economy with massive GDP ($150B) and deep cash reserves ($30B), burdened by high corruption and pollution.',
  },
  fragile_democracy: {
    id: 'fragile_democracy',
    name: 'Fragile Democracy',
    description: 'A prosperous economy endangered by cynical public trust and restless military factions.',
  },
};

export const scenarios: Record<ScenarioKey, NationState> = {
  default: {
    ...getInitialState(),
  },
  post_war: {
    ...getInitialState(),
    approvalRating: 35, // increased from 30
    publicTrust: 35, // increased from 32 to avoid early penalty
    internationalTrust: 32,
    educationIndex: 35,
    healthcareIndex: 35,
    militaryStrength: 45, // increased from 40 to prevent early border skirmish triggers
    corruptionLevel: 25, // reduced from 28 to give more runway
    environmentIndex: 55,
    nationalDebt: 30_000_000_000, // decreased to 30B (60% of GDP) to avoid immediate Austerity penalty on turn 1
    povertyRate: 22.0,
    unemploymentRate: 9.5,
    crimeRate: 36,
    foreignRelationsIndex: 45,
    gdpGrowthRate: -0.005,
  },
  petrostate: {
    ...getInitialState(),
    gdp: 150_000_000_000,
    treasuryBudget: 30_000_000_000,
    environmentIndex: 20,
    corruptionLevel: 60,
    educationIndex: 30,
    healthcareIndex: 42,
    militaryStrength: 55,
    nationalDebt: 25_000_000_000,
    foreignRelationsIndex: 50,
    businessTrust: 65,
    publicTrust: 45,
  },
  fragile_democracy: {
    ...getInitialState(),
    gdp: 80_000_000_000,
    gdpGrowthRate: 0.01, // reduced from 0.03 to prevent instant boom
    treasuryBudget: 10_000_000_000,
    nationalDebt: 20_000_000_000,
    povertyRate: 10.0,
    unemploymentRate: 4.5,
    educationIndex: 65,
    healthcareIndex: 62,
    militaryTrust: 24, // reduced from 30 to activate military coup threat
    publicTrust: 26, // reduced from 30 to activate public trust warning
    approvalRating: 35,
    corruptionLevel: 35, // increased from 18 to make corruption drag immediate
    foreignRelationsIndex: 65,
    environmentIndex: 70,
  },
};

export function getScenarioInitialState(scenarioKey: ScenarioKey | string): NationState {
  const base = scenarios[scenarioKey as ScenarioKey] || scenarios.default;
  return JSON.parse(JSON.stringify(base));
}
