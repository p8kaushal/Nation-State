import { getInitialState, resolveTurn, setSeed } from './simulation';
import { NationState } from './types';

function runDriftTest() {
  setSeed(42);
  let state = getInitialState();
  const history: NationState[] = [state];

  for (let i = 0; i < 50; i++) {
    state = resolveTurn(state);
    history.push(state);
  }

  console.log("Turn\tPop(M)\tGDP(B)\tGrwth%\tDebt%\tAppr\tPov%\tUnemp%\tCrime\tFR\tEdu\tHlth\tMil\tCorr\tEnv");
  
  for (const s of history) {
    if (s.turn === 1 || s.turn % 5 === 0) {
      const popM = (s.population / 1000000).toFixed(2);
      const gdpB = (s.gdp / 1000000000).toFixed(2);
      const growthPct = (s.gdpGrowthRate * 100).toFixed(2);
      const debtPct = ((s.nationalDebt / s.gdp) * 100).toFixed(1);
      const appr = s.approvalRating.toFixed(1);
      const pov = s.povertyRate.toFixed(1);
      const unemp = s.unemploymentRate.toFixed(1);
      const crime = s.crimeRate.toFixed(1);
      const fr = s.foreignRelationsIndex.toFixed(1);
      const edu = s.educationIndex.toFixed(1);
      const hlth = s.healthcareIndex.toFixed(1);
      const mil = s.militaryStrength.toFixed(1);
      const corr = s.corruptionLevel.toFixed(1);
      const env = s.environmentIndex.toFixed(1);

      console.log(`${s.turn}\t${popM}\t${gdpB}\t${growthPct}\t${debtPct}\t${appr}\t${pov}\t${unemp}\t${crime}\t${fr}\t${edu}\t${hlth}\t${mil}\t${corr}\t${env}`);
    }
  }
}

runDriftTest();
