import { getInitialState, resolveTurn, setSeed, evaluateExpression } from './simulation';
import { NationState, Decision, RandomEvent } from './types';
import decisionsData from './decisions.json';
import eventsData from './events.json';

console.log("=== STARTING PHASE 4 CONTENT VALIDATION ===");

// 1. Validate decisions.json
const decisions = decisionsData as Decision[];
console.log(`✓ decisions.json imported successfully with ${decisions.length} decisions.`);

if (decisions.length < 15) {
  throw new Error(`Expected at least 15 decisions, got ${decisions.length}`);
} else {
  console.log(`✓ Decision count (>= 15): ${decisions.length}`);
}

// 2. Validate events.json
const events = eventsData as RandomEvent[];
console.log(`✓ events.json imported successfully with ${events.length} events.`);

if (events.length < 8) {
  throw new Error(`Expected at least 8 events, got ${events.length}`);
} else {
  console.log(`✓ Event count (>= 8): ${events.length}`);
}

const sampleState = getInitialState();
const validKeys = new Set(Object.keys(sampleState));

// Verify decision IDs, options, and effects
const decisionIds = new Set<string>();
const optionIds = new Set<string>();

for (const d of decisions) {
  if (!d.id || typeof d.id !== 'string') throw new Error(`Decision missing id: ${JSON.stringify(d)}`);
  if (decisionIds.has(d.id)) throw new Error(`Duplicate decision id: ${d.id}`);
  decisionIds.add(d.id);

  if (!d.title || typeof d.title !== 'string') throw new Error(`Decision ${d.id} missing title`);
  if (!d.description || typeof d.description !== 'string') throw new Error(`Decision ${d.id} missing description`);
  if (!Array.isArray(d.options) || d.options.length < 2 || d.options.length > 3) {
    throw new Error(`Decision ${d.id} has ${d.options?.length} options (expected 2-3)`);
  }

  for (const opt of d.options) {
    if (!opt.id || typeof opt.id !== 'string') throw new Error(`Option missing id in decision ${d.id}`);
    if (optionIds.has(opt.id)) throw new Error(`Duplicate option id: ${opt.id}`);
    optionIds.add(opt.id);

    if (!opt.title || typeof opt.title !== 'string') throw new Error(`Option ${opt.id} missing title`);

    if (opt.immediateEffects) {
      if (!Array.isArray(opt.immediateEffects)) throw new Error(`immediateEffects must be array in ${opt.id}`);
      for (const eff of opt.immediateEffects) {
        validateEffectFormula(eff, `Option ${opt.id} immediateEffect`);
      }
    }

    if (opt.factionEffects) {
      if (!Array.isArray(opt.factionEffects)) throw new Error(`factionEffects must be array in ${opt.id}`);
      for (const eff of opt.factionEffects) {
        validateEffectFormula(eff, `Option ${opt.id} factionEffect`);
      }
    }

    if (opt.delayedEffects) {
      if (typeof opt.delayedEffects.delayTurns !== 'number' || opt.delayedEffects.delayTurns <= 0) {
        throw new Error(`delayedEffects.delayTurns must be positive number in ${opt.id}`);
      }
      if (opt.delayedEffects.effects) {
        if (!Array.isArray(opt.delayedEffects.effects) || opt.delayedEffects.effects.length === 0) {
          throw new Error(`delayedEffects.effects must be non-empty array in ${opt.id}`);
        }
        for (const eff of opt.delayedEffects.effects) {
          validateEffectFormula(eff, `Option ${opt.id} delayedEffect`);
        }
      }
    }
  }
}
console.log(`✓ All ${decisions.length} decisions and ${optionIds.size} options are strictly valid.`);

// Verify events
const eventIds = new Set<string>();
for (const ev of events) {
  if (!ev.id || typeof ev.id !== 'string') throw new Error(`Event missing id: ${JSON.stringify(ev)}`);
  if (eventIds.has(ev.id)) throw new Error(`Duplicate event id: ${ev.id}`);
  eventIds.add(ev.id);

  if (!ev.title || typeof ev.title !== 'string') throw new Error(`Event ${ev.id} missing title`);
  if (!ev.description || typeof ev.description !== 'string') throw new Error(`Event ${ev.id} missing description`);
  if (!ev.triggerCondition || typeof ev.triggerCondition !== 'string') throw new Error(`Event ${ev.id} missing triggerCondition`);
  if (!ev.probabilityWeight || typeof ev.probabilityWeight !== 'string') throw new Error(`Event ${ev.id} missing probabilityWeight`);

  // Test trigger condition evaluation
  try {
    const res = evaluateExpression(sampleState, ev.triggerCondition);
    if (typeof res !== 'number' && typeof res !== 'boolean') {
      throw new Error(`triggerCondition evaluated to non-number/boolean: ${res}`);
    }
  } catch (e: any) {
    throw new Error(`Error evaluating triggerCondition for ${ev.id}: ${e.message}`);
  }

  // Test probability weight evaluation
  try {
    const weight = evaluateExpression(sampleState, ev.probabilityWeight);
    if (typeof weight !== 'number' || isNaN(weight)) {
      throw new Error(`probabilityWeight evaluated to invalid number/NaN: ${weight}`);
    }
  } catch (e: any) {
    throw new Error(`Error evaluating probabilityWeight for ${ev.id}: ${e.message}`);
  }

  if (!Array.isArray(ev.effects) || ev.effects.length === 0) {
    throw new Error(`Event ${ev.id} must have non-empty effects array`);
  }
  for (const eff of ev.effects) {
    validateEffectFormula(eff, `Event ${ev.id} effect`);
  }
}
console.log(`✓ All ${events.length} events are strictly valid with testable trigger conditions and probability weights.`);

function validateEffectFormula(effectStr: string, context: string) {
  const match = effectStr.match(/^([a-zA-Z]+)\s*([+\-=])\s*(.+)$/);
  if (!match) {
    throw new Error(`Invalid effect formula format in ${context}: "${effectStr}"`);
  }
  const stat = match[1];
  if (!validKeys.has(stat)) {
    throw new Error(`Unknown stat "${stat}" in ${context}: "${effectStr}"`);
  }
  const testState = getInitialState();
  const rhs = evaluateExpression(testState, match[3]);
  if (typeof rhs !== 'number' || isNaN(rhs)) {
    throw new Error(`RHS expression evaluated to NaN or non-number in ${context}: "${match[3]}"`);
  }
}

// Run multi-turn simulation test
console.log("\n=== RUNNING 20-TURN SIMULATION TEST WITH EXPANDED CONTENT ===");
setSeed(12345);
let state = getInitialState();
for (let turn = 1; turn <= 20; turn++) {
  const currentDecision = decisions[(turn - 1) % decisions.length];
  // pick option based on turn modulo
  const option = currentDecision.options[(turn - 1) % currentDecision.options.length];
  state = resolveTurn(state, option);
  console.log(`Turn ${state.turn - 1} -> ${currentDecision.title} (Option: ${option.title}) | GDP: $${(state.gdp / 1e9).toFixed(1)}B | Debt%: ${((state.nationalDebt/state.gdp)*100).toFixed(1)}% | Appr: ${state.approvalRating.toFixed(1)}`);
}

console.log("\n✓ All checks and simulations passed successfully!");
