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
    approvalRating: 30,
    publicTrust: 25,
    internationalTrust: 25,
    educationIndex: 30,
    healthcareIndex: 30,
    militaryStrength: 40,
    corruptionLevel: 30,
    environmentIndex: 50,
    nationalDebt: 45_000_000_000, // 90% of 50B GDP
    povertyRate: 25.0,
    unemploymentRate: 12.0,
    crimeRate: 42,
    foreignRelationsIndex: 40,
    gdpGrowthRate: -0.01,
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
    gdpGrowthRate: 0.03,
    treasuryBudget: 10_000_000_000,
    nationalDebt: 20_000_000_000,
    povertyRate: 10.0,
    unemploymentRate: 4.5,
    educationIndex: 65,
    healthcareIndex: 62,
    militaryTrust: 30,
    publicTrust: 30,
    approvalRating: 35,
    corruptionLevel: 18,
    foreignRelationsIndex: 65,
    environmentIndex: 70,
  },
};

export function getScenarioInitialState(scenarioKey: ScenarioKey | string): NationState {
  const base = scenarios[scenarioKey as ScenarioKey] || scenarios.default;
  return JSON.parse(JSON.stringify(base));
}
