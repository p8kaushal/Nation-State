import { getInitialState, setSeed, getAvailableDecisions, seededRandom } from './simulation';
import { Decision } from './types';
import decisionsData from './decisions.json';
import { executeAutoplayStep } from './autoplay';

function runAutoplayTest() {
  setSeed(101); // Give it a fixed seed for reproducibility
  let state = getInitialState();
  const decisions = decisionsData as Decision[];

  console.log("=== NATION STATE: AUTOPLAY TEST (50 TURNS) ===");
  console.log("Turn\tPop(M)\tGDP(B)\tGrwth%\tDebt%\tAppr\tPov%\tUnemp%\tCrime\tFR\tEdu\tHlth\tMil\tCorr\tEnv\tAction");

  for (let i = 0; i < 50; i++) {
    if (state.gameOver) {
      console.log(`\nGAME OVER at Turn ${state.turn}`);
      console.log(`Result: ${state.gameResult?.toUpperCase()}`);
      console.log(`Reason: ${state.gameOverReason}`);
      break;
    }

    const availableDecisions = getAvailableDecisions(state, decisions);
    const randomIndex = Math.floor(seededRandom(0, availableDecisions.length));
    const decision = availableDecisions.length > 0 ? availableDecisions[randomIndex] : undefined;
    
    // We execute the step
    const { nextState, chosenOption, warnings } = executeAutoplayStep(state, decision);
    
    // Formatting stats
    const t = state.turn;
    const pop = (state.population / 1000000).toFixed(2);
    const gdp = (state.gdp / 1000000000).toFixed(2);
    const growth = (state.gdpGrowthRate * 100).toFixed(2);
    const debt = ((state.nationalDebt / state.gdp) * 100).toFixed(1);
    const appr = state.approvalRating.toFixed(1);
    const pov = state.povertyRate.toFixed(1);
    const unemp = state.unemploymentRate.toFixed(1);
    const crime = state.crimeRate.toFixed(1);
    const fr = state.foreignRelationsIndex.toFixed(1);
    const edu = state.educationIndex.toFixed(1);
    const hlth = state.healthcareIndex.toFixed(1);
    const mil = state.militaryStrength.toFixed(1);
    const corr = state.corruptionLevel.toFixed(1);
    const env = state.environmentIndex.toFixed(1);
    const actionStr = chosenOption ? chosenOption.title : "None";

    console.log(`${t}\t${pop}\t${gdp}\t${growth}\t${debt}\t${appr}\t${pov}\t${unemp}\t${crime}\t${fr}\t${edu}\t${hlth}\t${mil}\t${corr}\t${env}\t${actionStr}`);

    for (const w of warnings) {
      console.log(`  -> ${w}`);
    }

    state = nextState;
  }

  if (!state.gameOver) {
    console.log(`\nReached Turn 50 without Game Over.`);
  } else {
    // Print final state trigger if it triggered on exactly the last processed turn
    console.log(`\nGAME OVER at Turn ${state.turn}`);
    console.log(`Result: ${state.gameResult?.toUpperCase()}`);
    console.log(`Reason: ${state.gameOverReason}`);
  }
}

runAutoplayTest();
