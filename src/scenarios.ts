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
    name: 'Golden Era',
    description: 'Balanced starting stats, stable debt.',
  },
  post_war: {
    id: 'post_war',
    name: 'Post-War Reconstruction',
    description: 'Ravaged services, low trust, and crushing debt.',
  },
  petrostate: {
    id: 'petrostate',
    name: 'Petrostate',
    description: 'Resource-rich, massive GDP but high pollution and corruption.',
  },
  fragile_democracy: {
    id: 'fragile_democracy',
    name: 'Fragile Democracy',
    description: 'Strong economy but volatile military/public trust.',
  },
};

export const scenarios: Record<ScenarioKey, NationState> = {
  default: {
    ...getInitialState(),
  },
  post_war: {
    ...getInitialState(),
    approvalRating: 38,
    publicTrust: 42,
    internationalTrust: 35,
    educationIndex: 40,
    healthcareIndex: 40,
    militaryStrength: 45,
    corruptionLevel: 25,
    environmentIndex: 55,
    nationalDebt: 30_000_000_000,
    povertyRate: 18.0,
    unemploymentRate: 8.5,
    crimeRate: 34,
    foreignRelationsIndex: 45,
    gdpGrowthRate: 0.002,
  },
  petrostate: {
    ...getInitialState(),
    gdp: 150_000_000_000,
    treasuryBudget: 30_000_000_000,
    environmentIndex: 40,
    corruptionLevel: 40,
    educationIndex: 30,
    healthcareIndex: 42,
    militaryStrength: 55,
    nationalDebt: 25_000_000_000,
    foreignRelationsIndex: 50,
    businessTrust: 65,
    publicTrust: 55,
    approvalRating: 60,
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
