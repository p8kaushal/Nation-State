import { NationState, DecisionOption, PendingEffect, RandomEvent } from './types';
import eventsData from './events.json';

let seed = 42;
export function setSeed(newSeed: number) {
  seed = newSeed;
}
export function seededRandom(min: number, max: number): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  const r = seed / 4294967296;
  return min + r * (max - min);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function getInitialState(): NationState {
  return {
    turn: 1,
    population: 10000000,
    gdp: 50000000000,
    gdpGrowthRate: 0.015,
    povertyRate: 18.0,
    unemploymentRate: 7.5,
    educationIndex: 48,
    healthcareIndex: 45,
    approvalRating: 45,
    militaryStrength: 38,
    corruptionLevel: 25,
    environmentIndex: 68,
    treasuryBudget: 5000000000,
    nationalDebt: 28000000000,
    crimeRate: 35,
    foreignRelationsIndex: 55,
    debtCrisis: false,
    pendingEffects: [],
    recentLogs: [],
    gameOver: false,
    gameResult: null,
    gameOverReason: null,
  };
}

export function evaluateExpression(state: any, expression: string): number {
  const keys = Object.keys(state).filter(k => typeof state[k] === 'number' || typeof state[k] === 'boolean');
  let expr = expression;
  for (const key of keys) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    expr = expr.replace(regex, `(${Number(state[key])})`);
  }
  try {
    return new Function(`return ${expr};`)();
  } catch (e) {
    return 0;
  }
}

export function applyEffect(state: NationState, effectStr: string) {
  const match = effectStr.match(/^([a-zA-Z]+)\s*([+\-=])\s*(.+)$/);
  if (!match) return;
  const stat = match[1] as keyof NationState;
  const operator = match[2];
  const rhs = evaluateExpression(state, match[3]);
  
  let current = Number(state[stat] || 0);
  if (operator === '+') (state as any)[stat] = current + rhs;
  else if (operator === '-') (state as any)[stat] = current - rhs;
  else if (operator === '=') (state as any)[stat] = rhs;

  if (state.recentLogs) {
    state.recentLogs.push(`    [Engine] ${stat} changed from ${current.toFixed(1)} to ${Number((state as any)[stat]).toFixed(1)}`);
  }
}

export function applyDecision(state: NationState, option: DecisionOption) {
  state.recentLogs.push(`Decision chosen: ${option.title}`);
  if (option.immediateEffects) {
    for (const effect of option.immediateEffects) {
      applyEffect(state, effect);
    }
  }
  if (option.delayedEffects) {
    state.pendingEffects.push({
      targetTurn: state.turn + option.delayedEffects.delayTurns,
      effects: option.delayedEffects.effects,
      description: `Delayed effects from: ${option.title}`
    });
  }
}

function simulateNaturalDrift(next: NationState): void {
  // 1. Economic Growth -> Unemployment
  const growthDiff = next.gdpGrowthRate - 0.02;
  next.unemploymentRate -= growthDiff * 30;
  next.unemploymentRate += (6.0 - next.unemploymentRate) * 0.03;
  next.unemploymentRate += seededRandom(-0.15, 0.15);
  next.unemploymentRate = clamp(next.unemploymentRate);

  // 2. Unemployment -> Poverty
  const unempDiff = next.unemploymentRate - 6.0;
  const eduMitigation = (next.educationIndex - 50) * 0.02;
  next.povertyRate += unempDiff * 0.2 - eduMitigation;
  next.povertyRate += (15.0 - next.povertyRate) * 0.03;
  next.povertyRate = clamp(next.povertyRate);

  // 3. Poverty & Corruption -> Crime
  const povertyCrimeFactor = (next.povertyRate - 15.0) * 0.02;
  const corruptionCrimeFactor = (next.corruptionLevel - 20.0) * 0.05;
  const militaryMitigation = (next.militaryStrength - 40.0) * 0.05;
  next.crimeRate += povertyCrimeFactor + corruptionCrimeFactor - militaryMitigation;
  
  if (next.approvalRating < 40) { 
    next.crimeRate += 0.1; 
  }
  next.crimeRate += (30.0 - next.crimeRate) * 0.03;
  next.crimeRate += seededRandom(-0.2, 0.2);
  next.crimeRate = clamp(next.crimeRate);

  // 4. Crime & Corruption -> Foreign Relations
  const crimeFRDrop = (next.crimeRate - 30.0) * 0.02;
  const corruptionFRDrop = (next.corruptionLevel - 20.0) * 0.05;
  next.foreignRelationsIndex -= (crimeFRDrop + corruptionFRDrop);
  next.foreignRelationsIndex += (60.0 - next.foreignRelationsIndex) * 0.03;
  next.foreignRelationsIndex += seededRandom(-0.2, 0.2);
  next.foreignRelationsIndex = clamp(next.foreignRelationsIndex);

  // 5. Foreign Relations & Education & Corruption & Debt -> GDP Growth
  const frGrowthFactor = (next.foreignRelationsIndex - 60) * 0.0005;
  const eduGrowthFactor = (next.educationIndex - 50) * 0.0005; 
  const corruptionGrowthDrag = (next.corruptionLevel - 20) * 0.0005;
  const debtToGDP = next.nationalDebt / next.gdp;
  const debtGrowthDrag = Math.max(0, (debtToGDP - 0.5) * 0.02);
  
  next.gdpGrowthRate = 0.02 + frGrowthFactor + eduGrowthFactor - corruptionGrowthDrag - debtGrowthDrag;
  next.gdpGrowthRate = Math.max(-0.1, Math.min(0.15, next.gdpGrowthRate));

  next.gdp += next.gdp * next.gdpGrowthRate;
  next.gdp = Math.max(0, next.gdp);

  // 6. Population Drifts
  const healthPopFactor = (next.healthcareIndex - 50) * 0.0001;
  const envPopDrag = (70 - next.environmentIndex) * 0.0001;
  const popGrowthRate = 0.008 + healthPopFactor - envPopDrag;
  next.population += next.population * popGrowthRate;
  next.population = Math.max(0, next.population);

  // Passive Index Drifts
  next.educationIndex = clamp(next.educationIndex - 0.2);
  next.healthcareIndex = clamp(next.healthcareIndex - 0.2);
  next.militaryStrength = clamp(next.militaryStrength - 0.3);
  next.corruptionLevel = clamp(next.corruptionLevel + 0.1);
  next.corruptionLevel += (20.0 - next.corruptionLevel) * 0.03;
  const envDecay = 0.1 * (next.gdp / 50000000000);
  next.environmentIndex = clamp(next.environmentIndex - envDecay + 0.05);

  // Budget, Reinvestment, and Debt
  const taxRate = Math.max(0.05, 0.20 - next.unemploymentRate * 0.002 - next.povertyRate * 0.001);
  const taxRevenue = next.gdp * taxRate;
  const baseMaintenance = next.gdp * 0.02;
  
  const militaryCost = next.gdp * (next.militaryStrength / 40.0) * 0.02;
  const healthCost = next.gdp * (next.healthcareIndex / 50.0) * 0.03;
  const eduCost = next.gdp * (next.educationIndex / 50.0) * 0.03;
  const maintenanceExpenses = baseMaintenance + militaryCost + healthCost + eduCost;
  
  const interestOnDebt = next.nationalDebt * 0.04;
  const netIncome = taxRevenue - maintenanceExpenses - interestOnDebt;
  
  const currentDebtToGDP = next.nationalDebt / next.gdp;

  if (netIncome > 0) {
    if (currentDebtToGDP < 0.3) {
      const debtPaydown = netIncome * 0.4;
      const surplusInvestment = netIncome * 0.6;
      
      next.nationalDebt -= debtPaydown;
      if (next.nationalDebt < 0) {
        next.treasuryBudget += Math.abs(next.nationalDebt);
        next.nationalDebt = 0;
      }
      
      const investmentPerStat = surplusInvestment / 3;
      const costPerPoint = next.gdp * 0.01;
      const pointsGained = investmentPerStat / costPerPoint;
      
      next.educationIndex = clamp(next.educationIndex + pointsGained);
      next.healthcareIndex = clamp(next.healthcareIndex + pointsGained);
      next.militaryStrength = clamp(next.militaryStrength + pointsGained);

    } else {
      next.nationalDebt -= netIncome;
      if (next.nationalDebt < 0) {
        next.treasuryBudget += Math.abs(next.nationalDebt);
        next.nationalDebt = 0;
      }
    }
  } else {
    next.nationalDebt += Math.abs(netIncome);
  }

  // Austerity Penalty
  if (currentDebtToGDP > 0.6) {
    next.educationIndex = clamp(next.educationIndex - 0.5);
    next.healthcareIndex = clamp(next.healthcareIndex - 0.5);
    next.militaryStrength = clamp(next.militaryStrength - 0.5);
  }

  // Cap treasury at 0 if borrowing
  if (next.treasuryBudget < 0) {
    next.nationalDebt += Math.abs(next.treasuryBudget);
    next.treasuryBudget = 0;
  }

  // Approval Rating
  const povertyPenalty = (next.povertyRate - 15) * 0.5;
  const unempPenalty = (next.unemploymentRate - 6) * 0.5;
  const corrPenalty = (next.corruptionLevel - 20) * 0.5;
  const growthBonus = (next.gdpGrowthRate - 0.02) * 500;

  next.approvalRating = 50 - povertyPenalty - unempPenalty - corrPenalty + growthBonus;
  next.approvalRating += (50.0 - next.approvalRating) * 0.05 + 0.3;
  next.approvalRating = clamp(next.approvalRating);

  next.debtCrisis = (next.nationalDebt / next.gdp) > 1.5;

  next.unemploymentRate = clamp(next.unemploymentRate);
  next.povertyRate = clamp(next.povertyRate);
  next.crimeRate = clamp(next.crimeRate);
  next.educationIndex = clamp(next.educationIndex);
  next.healthcareIndex = clamp(next.healthcareIndex);
  next.militaryStrength = clamp(next.militaryStrength);
  next.corruptionLevel = clamp(next.corruptionLevel);
  next.environmentIndex = clamp(next.environmentIndex);
  next.foreignRelationsIndex = clamp(next.foreignRelationsIndex);
  next.approvalRating = clamp(next.approvalRating);
}

/**
 * Visibility and Timeline Convention:
 * A decision made on Turn N is applied during resolveTurn(N). 
 * If it has a delay of D, its targetTurn is N + D.
 * When the loop reaches Turn N + D, resolveTurn(N + D) will process the pending effect FIRST,
 * applying its stat changes, and THEN natural drift and random events will run.
 * The resulting stats are displayed to the player at the start of Turn N + D + 1.
 */
export function resolveTurn(state: NationState, chosenOption?: DecisionOption): NationState {
  const next: NationState = { ...state, pendingEffects: [...state.pendingEffects], recentLogs: [] };
  
  if (chosenOption) {
    applyDecision(next, chosenOption);
  }

  const remainingEffects: PendingEffect[] = [];
  for (const effect of next.pendingEffects) {
    if (effect.targetTurn === next.turn) {
      next.recentLogs.push(`Resolving pending effect: ${effect.description}`);
      for (const eff of effect.effects) {
        applyEffect(next, eff);
      }
    } else {
      remainingEffects.push(effect);
    }
  }
  next.pendingEffects = remainingEffects;

  simulateNaturalDrift(next);

  const events = eventsData as RandomEvent[];
  let eventTriggered = false;
  
  for (const ev of events) {
    if (eventTriggered) break;
    
    const conditionVal = evaluateExpression(next, ev.triggerCondition);
    if (conditionVal > 0) {
      const weight = evaluateExpression(next, ev.probabilityWeight);
      const roll = seededRandom(0, 1);
      if (roll < weight) {
        next.recentLogs.push(`Random Event: ${ev.title} - ${ev.description}`);
        for (const eff of ev.effects) {
          applyEffect(next, eff);
        }
        eventTriggered = true;
      }
    }
  }

  // Final Clamping Verification after events are resolved
  next.unemploymentRate = clamp(next.unemploymentRate);
  next.povertyRate = clamp(next.povertyRate);
  next.crimeRate = clamp(next.crimeRate);
  next.educationIndex = clamp(next.educationIndex);
  next.healthcareIndex = clamp(next.healthcareIndex);
  next.militaryStrength = clamp(next.militaryStrength);
  next.corruptionLevel = clamp(next.corruptionLevel);
  next.environmentIndex = clamp(next.environmentIndex);
  next.foreignRelationsIndex = clamp(next.foreignRelationsIndex);
  next.approvalRating = clamp(next.approvalRating);

  next.turn += 1;
  return checkGameEnd(next);
}

function checkGameEnd(state: NationState): NationState {
  if (state.gameOver) return state;

  if (state.nationalDebt / state.gdp > 2.0) {
    state.gameOver = true;
    state.gameResult = 'lose';
    state.gameOverReason = 'Economic Collapse: National debt exceeded 200% of GDP.';
    return state;
  }

  if (state.approvalRating < 25 && state.corruptionLevel > 50) {
    state.gameOver = true;
    state.gameResult = 'lose';
    state.gameOverReason = 'Military Coup: High corruption and abysmal approval triggered a government overthrow.';
    return state;
  }

  if (state.turn === 10 || state.turn === 20 || state.turn === 30 || state.turn === 40) {
    if (state.approvalRating < 45) {
      state.gameOver = true;
      state.gameResult = 'lose';
      state.gameOverReason = 'Election Defeat: The populace voted you out of office.';
      return state;
    } else {
      state.recentLogs.push('Election won! You have secured another term.');
    }
  }

  if (state.turn > 40) {
    state.gameOver = true;
    state.gameResult = 'win';
    state.gameOverReason = 'Congratulations! You have completed your presidency and stabilized the nation.';
    return state;
  }

  return state;
}
