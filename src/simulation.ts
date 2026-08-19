import { NationState, DecisionOption, PendingEffect, RandomEvent, Decision } from './types';
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

export function recordDelta(state: NationState, stat: string, delta: number, source: string) {
  if (delta === 0) return;
  state.recentDeltas.push({ stat, delta, source });
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
    militaryTrust: 50,
    businessTrust: 50,
    publicTrust: 50,
    internationalTrust: 50,
    debtCrisis: false,
    pendingEffects: [],
    recentLogs: [],
    gameOver: false,
    gameResult: null,
    gameOverReason: null,
    resolvedDecisionIds: [] as string[],
    activeSpawnedDecisionId: null,
    eventFlags: {},
    activeEscalations: [],
    recentDeltas: [],
  };
}

export function evaluateExpression(state: any, expression: string): number {
  const keys = Object.keys(state).filter(k => typeof state[k] === 'number' || typeof state[k] === 'boolean');
  let expr = expression;
  for (const key of keys) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    expr = expr.replace(regex, `(${Number(state[key])})`);
  }
  
  if (state.eventFlags) {
    for (const key of Object.keys(state.eventFlags)) {
      const regex = new RegExp(`\\beventFlags\\.${key}\\b`, 'g');
      expr = expr.replace(regex, `(${state.eventFlags[key] ? 1 : 0})`);
    }
  }
  expr = expr.replace(/\beventFlags\.[a-zA-Z0-9_]+\b/g, '(0)');
  
  try {
    return new Function(`return ${expr};`)();
  } catch (e) {
    return 0;
  }
}

export function applyEffect(state: NationState, effectStr: string, source: string) {
  const match = effectStr.match(/^([a-zA-Z]+)\s*([+\-=])\s*(.+)$/);
  if (!match) return;
  const stat = match[1] as keyof NationState;
  const operator = match[2];
  const rhs = evaluateExpression(state, match[3]);
  
  let current = Number(state[stat] || 0);
  let nextValue = current;

  if (operator === '+') nextValue = current + rhs;
  else if (operator === '-') nextValue = current - rhs;
  else if (operator === '=') nextValue = rhs;

  (state as any)[stat] = nextValue;
  recordDelta(state, stat, nextValue - current, source);

  if (state.recentLogs) {
    state.recentLogs.push(`    [Engine] ${stat} changed from ${current.toFixed(1)} to ${nextValue.toFixed(1)}`);
  }
}

export function applyDecision(state: NationState, option: DecisionOption, decisionId?: string) {
  state.recentLogs.push(`Decision chosen: ${option.title}`);
  if (decisionId && !state.resolvedDecisionIds.includes(decisionId)) {
    state.resolvedDecisionIds.push(decisionId);
  }
  if (state.activeSpawnedDecisionId === decisionId) {
    state.activeSpawnedDecisionId = null;
  }

  if (option.immediateEffects) {
    for (const effect of option.immediateEffects) {
      applyEffect(state, effect, option.title);
    }
  }
  if (option.factionEffects) {
    for (const effect of option.factionEffects) {
      applyEffect(state, effect, option.title);
    }
  }
  if (option.delayedEffects) {
    state.pendingEffects.push({
      targetTurn: state.turn + option.delayedEffects.delayTurns,
      effects: option.delayedEffects.effects || [],
      spawnDecisionId: option.delayedEffects.spawnDecisionId,
      description: `Delayed effects from: ${option.title}`
    });
  }
}

function simulateNaturalDrift(next: NationState): void {
  // Helper to record drift deltas safely
  const record = (stat: keyof NationState, newVal: number, source: string) => {
    const oldVal = Number(next[stat]);
    if (typeof newVal !== 'number' || isNaN(newVal)) return;
    (next as any)[stat] = newVal;
    recordDelta(next, stat, newVal - oldVal, source);
  };

  // 1. Economic Growth -> Unemployment
  const growthDiff = next.gdpGrowthRate - 0.02;
  let unemp = next.unemploymentRate;
  unemp -= growthDiff * 30;
  unemp += (6.0 - unemp) * 0.03;
  unemp += seededRandom(-0.15, 0.15);
  record('unemploymentRate', clamp(unemp), "Economic Growth Feedback");

  // 2. Unemployment -> Poverty
  const unempDiff = next.unemploymentRate - 6.0;
  const eduMitigation = (next.educationIndex - 50) * 0.02;
  let pov = next.povertyRate;
  pov += unempDiff * 0.2 - eduMitigation;
  pov += (15.0 - pov) * 0.03;
  record('povertyRate', clamp(pov), "Unemployment Feedback");

  // 3. Poverty & Corruption -> Crime
  const povertyCrimeFactor = (next.povertyRate - 15.0) * 0.02;
  const corruptionCrimeFactor = (next.corruptionLevel - 20.0) * 0.05;
  const militaryMitigation = (next.militaryStrength - 40.0) * 0.05;
  let cr = next.crimeRate;
  cr += povertyCrimeFactor + corruptionCrimeFactor - militaryMitigation;
  if (next.approvalRating < 40) cr += 0.1; 
  cr += (30.0 - cr) * 0.03;
  cr += seededRandom(-0.2, 0.2);
  record('crimeRate', clamp(cr), "Poverty & Corruption Feedback");

  // 4. Crime & Corruption -> Foreign Relations
  const crimeFRDrop = (next.crimeRate - 30.0) * 0.02;
  const corruptionFRDrop = (next.corruptionLevel - 20.0) * 0.05;
  let fr = next.foreignRelationsIndex;
  fr -= (crimeFRDrop + corruptionFRDrop);
  fr += (60.0 - fr) * 0.03;
  fr += seededRandom(-0.2, 0.2);
  record('foreignRelationsIndex', clamp(fr), "Crime & Corruption Feedback");

  // 5. Foreign Relations & Education & Corruption & Debt -> GDP Growth
  const frGrowthFactor = (next.foreignRelationsIndex - 60) * 0.0005;
  const eduGrowthFactor = (next.educationIndex - 50) * 0.0005; 
  const corruptionGrowthDrag = (next.corruptionLevel - 20) * 0.0005;
  const debtToGDP = next.nationalDebt / next.gdp;
  const debtGrowthDrag = Math.max(0, (debtToGDP - 0.5) * 0.02);
  
  let gdpG = 0.02 + frGrowthFactor + eduGrowthFactor - corruptionGrowthDrag - debtGrowthDrag;
  gdpG = Math.max(-0.1, Math.min(0.15, gdpG));
  record('gdpGrowthRate', gdpG, "Geopolitical & Fiscal Feedback");

  let newGdp = next.gdp + next.gdp * next.gdpGrowthRate;
  newGdp = Math.max(0, newGdp);
  record('gdp', newGdp, "Economic Growth Compounding");

  // 6. Population Drifts
  const healthPopFactor = (next.healthcareIndex - 50) * 0.0001;
  const envPopDrag = (70 - next.environmentIndex) * 0.0001;
  const popGrowthRate = 0.008 + healthPopFactor - envPopDrag;
  let pop = next.population + next.population * popGrowthRate;
  record('population', Math.max(0, pop), "Demographic Drift");

  // Passive Index Drifts
  record('educationIndex', clamp(next.educationIndex - 0.2), "Passive Public Service Depreciation");
  record('healthcareIndex', clamp(next.healthcareIndex - 0.2), "Passive Public Service Depreciation");
  record('militaryStrength', clamp(next.militaryStrength - 0.3), "Passive Public Service Depreciation");
  
  let corr = next.corruptionLevel + 0.1;
  corr += (20.0 - corr) * 0.03;
  record('corruptionLevel', clamp(corr), "Bureaucratic Creep");
  
  const envDecay = 0.1 * (next.gdp / 50000000000);
  record('environmentIndex', clamp(next.environmentIndex - envDecay + 0.05), "Industrial Drag & Natural Recovery");

  // Trust Drifts
  record('militaryTrust', clamp(next.militaryTrust + (50.0 - next.militaryTrust) * 0.02), "Faction Trust Normalization");
  record('businessTrust', clamp(next.businessTrust + (50.0 - next.businessTrust) * 0.02), "Faction Trust Normalization");
  record('publicTrust', clamp(next.publicTrust + (50.0 - next.publicTrust) * 0.02), "Faction Trust Normalization");
  record('internationalTrust', clamp(next.internationalTrust + (50.0 - next.internationalTrust) * 0.02), "Faction Trust Normalization");

  // Faction Interdependency Rules
  if (next.businessTrust < 30) {
    record('gdpGrowthRate', next.gdpGrowthRate - 0.01, "Low Business Trust Penalty");
  }
  if (next.publicTrust < 30) {
    record('approvalRating', clamp(next.approvalRating - 5), "Low Public Trust Unrest");
  }
  if (next.internationalTrust < 30) {
    record('foreignRelationsIndex', clamp(next.foreignRelationsIndex - 5), "Low International Trust Penalty");
  }

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
      
      let newDebt = next.nationalDebt - debtPaydown;
      let newTreasury = next.treasuryBudget;
      if (newDebt < 0) {
        newTreasury += Math.abs(newDebt);
        newDebt = 0;
      }
      record('nationalDebt', newDebt, "Debt Service & Treasury Net Balance");
      record('treasuryBudget', newTreasury, "Debt Service & Treasury Net Balance");
      
      const investmentPerStat = surplusInvestment / 3;
      const costPerPoint = next.gdp * 0.01;
      const pointsGained = investmentPerStat / costPerPoint;
      
      record('educationIndex', clamp(next.educationIndex + pointsGained), "Surplus Budget Reinvestment");
      record('healthcareIndex', clamp(next.healthcareIndex + pointsGained), "Surplus Budget Reinvestment");
      record('militaryStrength', clamp(next.militaryStrength + pointsGained), "Surplus Budget Reinvestment");

    } else {
      let newDebt = next.nationalDebt - netIncome;
      let newTreasury = next.treasuryBudget;
      if (newDebt < 0) {
        newTreasury += Math.abs(newDebt);
        newDebt = 0;
      }
      record('nationalDebt', newDebt, "Debt Service & Treasury Net Balance");
      record('treasuryBudget', newTreasury, "Debt Service & Treasury Net Balance");
    }
  } else {
    record('nationalDebt', next.nationalDebt + Math.abs(netIncome), "Debt Service & Treasury Net Balance");
  }

  // Austerity Penalty
  if (currentDebtToGDP > 0.6) {
    record('educationIndex', clamp(next.educationIndex - 0.5), "Austerity Penalty");
    record('healthcareIndex', clamp(next.healthcareIndex - 0.5), "Austerity Penalty");
    record('militaryStrength', clamp(next.militaryStrength - 0.5), "Austerity Penalty");
  }

  // Cap treasury at 0 if borrowing
  if (next.treasuryBudget < 0) {
    record('nationalDebt', next.nationalDebt + Math.abs(next.treasuryBudget), "Debt Service & Treasury Net Balance");
    record('treasuryBudget', 0, "Debt Service & Treasury Net Balance");
  }

  // Approval Rating
  const povertyPenalty = (next.povertyRate - 15) * 0.5;
  const unempPenalty = (next.unemploymentRate - 6) * 0.5;
  const corrPenalty = (next.corruptionLevel - 20) * 0.5;
  const growthBonus = (next.gdpGrowthRate - 0.02) * 500;

  let appr = 50 - povertyPenalty - unempPenalty - corrPenalty + growthBonus;
  appr += (50.0 - appr) * 0.05 + 0.3;
  record('approvalRating', clamp(appr), "Public Approval Feedback");

  next.debtCrisis = (next.nationalDebt / next.gdp) > 1.5;

  // Final Clamping guarantees
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

export function getAvailableDecisions(state: NationState, pool: Decision[]): Decision[] {
  if (state.activeSpawnedDecisionId) {
    const spawned = pool.find(d => d.id === state.activeSpawnedDecisionId);
    if (spawned) return [spawned];
  }

  return pool.filter(decision => {
    // Check if already resolved as one-time
    if (decision.oneTime && state.resolvedDecisionIds.includes(decision.id)) {
      return false;
    }
    // Evaluate unlock condition
    if (decision.unlockCondition) {
      const val = evaluateExpression(state, decision.unlockCondition);
      if (val <= 0) return false;
    }
    return true;
  });
}

/**
 * Visibility and Timeline Convention:
 * A decision made on Turn N is applied during resolveTurn(N). 
 * If it has a delay of D, its targetTurn is N + D.
 * When the loop reaches Turn N + D, resolveTurn(N + D) will process the pending effect FIRST,
 * applying its stat changes, and THEN natural drift and random events will run.
 * The resulting stats are displayed to the player at the start of Turn N + D + 1.
 */
export function resolveTurn(state: NationState, chosenOption?: DecisionOption, decisionId?: string): NationState {
  const next = { 
    ...state, 
    pendingEffects: [...state.pendingEffects], 
    recentLogs: [] as string[], 
    resolvedDecisionIds: [...state.resolvedDecisionIds],
    eventFlags: { ...state.eventFlags },
    activeEscalations: [...state.activeEscalations],
    recentDeltas: []
  };
  
  if (chosenOption) {
    applyDecision(next, chosenOption, decisionId);
  }

  const remainingEffects: PendingEffect[] = [];
  for (const effect of next.pendingEffects) {
    if (effect.targetTurn === next.turn) {
      next.recentLogs.push(`Resolving pending effect: ${effect.description}`);
      for (const eff of effect.effects) {
        applyEffect(next, eff, effect.description);
      }
      if (effect.spawnDecisionId) {
        next.activeSpawnedDecisionId = effect.spawnDecisionId;
      }
    } else {
      remainingEffects.push(effect);
    }
  }
  next.pendingEffects = remainingEffects;

  simulateNaturalDrift(next);

  const events = eventsData as RandomEvent[];
  
  // 1. Process Escalations
  const remainingEscalations: typeof state.activeEscalations = [];
  for (const esc of next.activeEscalations) {
    if (esc.targetTurn === next.turn) {
      const ev = events.find(e => e.id === esc.eventId);
      if (ev) {
        const conditionVal = evaluateExpression(next, ev.triggerCondition);
        if (conditionVal > 0) {
          next.recentLogs.push(`Escalation Triggered: ${ev.title} - ${ev.description}`);
          for (const eff of ev.effects) applyEffect(next, eff, ev.title);
          if (ev.setFlag) next.eventFlags[ev.setFlag] = true;
          if (ev.clearFlag) delete next.eventFlags[ev.clearFlag];
          if (ev.escalatesTo && ev.escalateTurns) {
            remainingEscalations.push({ eventId: ev.escalatesTo, targetTurn: next.turn + ev.escalateTurns });
          }
        }
      }
    } else {
      remainingEscalations.push(esc);
    }
  }
  next.activeEscalations = remainingEscalations;

  // 2. Process Standard Random Events
  let eventTriggered = false;
  for (const ev of events) {
    if (eventTriggered) break;
    
    const conditionVal = evaluateExpression(next, ev.triggerCondition);
    if (conditionVal > 0) {
      const weight = evaluateExpression(next, ev.probabilityWeight);
      if (weight > 0) {
        const roll = seededRandom(0, 1);
        if (roll < weight) {
          next.recentLogs.push(`Random Event: ${ev.title} - ${ev.description}`);
          for (const eff of ev.effects) {
            applyEffect(next, eff, ev.title);
          }
          if (ev.setFlag) next.eventFlags[ev.setFlag] = true;
          if (ev.clearFlag) delete next.eventFlags[ev.clearFlag];
          if (ev.escalatesTo && ev.escalateTurns) {
            next.activeEscalations.push({ eventId: ev.escalatesTo, targetTurn: next.turn + ev.escalateTurns });
          }
          eventTriggered = true;
        }
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
  next.militaryTrust = clamp(next.militaryTrust);
  next.businessTrust = clamp(next.businessTrust);
  next.publicTrust = clamp(next.publicTrust);
  next.internationalTrust = clamp(next.internationalTrust);

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

  if (state.businessTrust < 15) {
    state.gameOver = true;
    state.gameResult = 'lose';
    state.gameOverReason = 'Economic Collapse: Complete loss of business trust triggered capital flight, hyper-inflation, and national bankruptcy.';
    return state;
  }

  if (state.militaryTrust < 20) {
    state.gameOver = true;
    state.gameResult = 'lose';
    state.gameOverReason = 'Military Coup: Disgruntled generals revolted and overthrew your administration.';
    return state;
  }

  if (state.approvalRating < 25 && state.corruptionLevel > 50) {
    state.gameOver = true;
    state.gameResult = 'lose';
    state.gameOverReason = 'Military Coup: High corruption and abysmal approval triggered a government overthrow.';
    return state;
  }

  if (state.turn === 10) {
    if (state.approvalRating < 40) {
      state.gameOver = true;
      state.gameResult = 'lose';
      state.gameOverReason = 'Election Defeat: The populace voted you out of office.';
      return state;
    } else {
      state.recentLogs.push('Election won! You have secured another term.');
    }
  }

  if (state.turn > 20) {
    state.gameOver = true;
    state.gameResult = 'win';
    state.gameOverReason = 'Congratulations! You have completed your 20-turn administration and stabilized the nation.';
    return state;
  }

  return state;
}
