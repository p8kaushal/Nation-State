import { Decision, DecisionOption, NationState } from './types';
import { resolveTurn } from './simulation';

export function getRandomOption(decision: Decision): DecisionOption {
  if (!decision || !decision.options || decision.options.length === 0) {
    throw new Error('Invalid decision provided to getRandomOption');
  }
  const randomIndex = Math.floor(Math.random() * decision.options.length);
  return decision.options[randomIndex];
}

export function executeAutoplayStep(state: NationState, decision: Decision | undefined): { nextState: NationState, chosenOption?: DecisionOption, warnings: string[] } {
  let chosenOption: DecisionOption | undefined = undefined;
  if (decision) {
    chosenOption = getRandomOption(decision);
  }

  const nextState = resolveTurn(state, chosenOption);
  const warnings: string[] = [];

  // Check clamping warnings
  const checkClamp = (val: number, name: string) => {
    if (val <= 0 || val >= 100) {
      warnings.push(`WARNING: ${name} hit 0/100 limit! (Value: ${val.toFixed(1)})`);
    }
  };

  checkClamp(nextState.approvalRating, 'approvalRating');
  checkClamp(nextState.povertyRate, 'povertyRate');
  checkClamp(nextState.unemploymentRate, 'unemploymentRate');
  checkClamp(nextState.crimeRate, 'crimeRate');
  checkClamp(nextState.educationIndex, 'educationIndex');
  checkClamp(nextState.healthcareIndex, 'healthcareIndex');
  checkClamp(nextState.militaryStrength, 'militaryStrength');
  checkClamp(nextState.corruptionLevel, 'corruptionLevel');
  checkClamp(nextState.environmentIndex, 'environmentIndex');
  checkClamp(nextState.foreignRelationsIndex, 'foreignRelationsIndex');

  const debtRatio = nextState.nationalDebt / nextState.gdp;
  if (debtRatio > 2.0) {
    warnings.push(`WARNING: Debt-to-GDP ratio exceeded 2.0! (Value: ${(debtRatio * 100).toFixed(1)}%)`);
  }

  return { nextState, chosenOption, warnings };
}
