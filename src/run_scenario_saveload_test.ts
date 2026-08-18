import { scenarios, getScenarioInitialState } from './scenarios';
import { resolveTurn, getInitialState } from './simulation';
import { NationState } from './types';

function runScenarioAndSaveLoadTest() {
  console.log("=== RUNNING SCENARIO & SAVE/LOAD TESTS ===");

  // 1. Verify Scenarios Dictionary
  const scenarioKeys = ['default', 'post_war', 'petrostate', 'fragile_democracy'] as const;
  for (const key of scenarioKeys) {
    if (!scenarios[key]) {
      throw new Error(`Scenario ${key} missing from scenarios dictionary!`);
    }
    const state = getScenarioInitialState(key);
    if (!state || state.turn !== 1) {
      throw new Error(`Failed to initialize state for scenario ${key}`);
    }
    console.log(`✓ Scenario ${key} initialized properly.`);
  }

  // 2. Verify scenario specific values
  const postWar = scenarios.post_war;
  if (
    postWar.approvalRating !== 30 ||
    postWar.publicTrust !== 25 ||
    postWar.internationalTrust !== 25 ||
    postWar.educationIndex !== 30 ||
    postWar.healthcareIndex !== 30 ||
    postWar.militaryStrength !== 40 ||
    postWar.corruptionLevel !== 30 ||
    postWar.environmentIndex !== 50 ||
    postWar.nationalDebt !== 45_000_000_000
  ) {
    throw new Error('post_war scenario has incorrect stats!');
  }
  console.log('✓ post_war scenario stats verified.');

  const petrostate = scenarios.petrostate;
  if (
    petrostate.gdp !== 150_000_000_000 ||
    petrostate.treasuryBudget !== 30_000_000_000 ||
    petrostate.environmentIndex !== 20 ||
    petrostate.corruptionLevel !== 60 ||
    petrostate.educationIndex !== 30
  ) {
    throw new Error('petrostate scenario has incorrect stats!');
  }
  console.log('✓ petrostate scenario stats verified.');

  const fragileDemocracy = scenarios.fragile_democracy;
  if (
    fragileDemocracy.militaryTrust !== 30 ||
    fragileDemocracy.publicTrust !== 30 ||
    fragileDemocracy.approvalRating !== 35
  ) {
    throw new Error('fragile_democracy scenario has incorrect stats!');
  }
  console.log('✓ fragile_democracy scenario stats verified.');

  // 3. Verify Serialization & Deserialization
  const originalState = getScenarioInitialState('petrostate');
  const simulatedState = resolveTurn(originalState);
  const serialized = JSON.stringify({
    state: simulatedState,
    decisionIndex: 2,
    turnLogsHistory: ['Log 1', 'Log 2'],
    scenario: 'petrostate',
  });

  const parsed = JSON.parse(serialized);
  if (
    parsed.state.turn !== simulatedState.turn ||
    parsed.state.gdp !== simulatedState.gdp ||
    parsed.scenario !== 'petrostate' ||
    parsed.turnLogsHistory.length !== 2
  ) {
    throw new Error('Save/load serialization mismatch!');
  }
  console.log('✓ Serialization / Deserialization verified.');

  console.log("=== ALL SCENARIO & SAVE/LOAD TESTS PASSED ===");
}

runScenarioAndSaveLoadTest();
