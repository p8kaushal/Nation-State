import { getInitialState, resolveTurn, setSeed } from './simulation';
import { NationState, Decision } from './types';
import decisionsData from './decisions.json';

function runGameTest() {
  setSeed(42);
  let state = getInitialState();
  const decisions = decisionsData as Decision[];

  console.log("=== NATION STATE: PHASE 2 TEST ===");

  // Setup overlapping effects and massive treasury drain for testing!
  state.pendingEffects.push({
    targetTurn: 3,
    effects: ["educationIndex + 5", "approvalRating + 5"],
    description: "Manual Inject 1 (Turn 3 Stack A)"
  });
  state.pendingEffects.push({
    targetTurn: 3,
    effects: ["educationIndex + 10", "approvalRating + 10"],
    description: "Manual Inject 2 (Turn 3 Stack B)"
  });
  
  // Massive treasury drain on Turn 1
  state.treasuryBudget = -50000000000; // -50 Billion
  console.log(`[TEST SETUP] Forced Treasury to -50B to check routing to Debt.`);

  for (let i = 0; i < 5; i++) {
    console.log(`\n--- TURN ${state.turn} ---`);
    console.log(`Treasury(B): ${(state.treasuryBudget / 1000000000).toFixed(2)} | Debt%: ${((state.nationalDebt / state.gdp) * 100).toFixed(1)}`);
    console.log(`Edu: ${state.educationIndex.toFixed(1)} | Appr: ${state.approvalRating.toFixed(1)}`);

    const decision = decisions[i % decisions.length];
    console.log(`\nEvent: ${decision.title}`);
    const chosenOption = decision.options[0];
    console.log(`> Player chose: ${chosenOption.title}\n`);

    state = resolveTurn(state, chosenOption);

    if (state.recentLogs.length > 0) {
      console.log("Logs:");
      for (const log of state.recentLogs) {
        console.log(`  - ${log}`);
      }
    }
  }

  console.log(`\n--- FINAL STATE (Turn ${state.turn}) ---`);
  console.log(`Treasury(B): ${(state.treasuryBudget / 1000000000).toFixed(2)} | Debt%: ${((state.nationalDebt / state.gdp) * 100).toFixed(1)}`);
  console.log(`Edu: ${state.educationIndex.toFixed(1)} | Appr: ${state.approvalRating.toFixed(1)}`);
}

runGameTest();
