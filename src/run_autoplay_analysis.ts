import * as fs from 'fs';
import { setSeed, getAvailableDecisions, seededRandom } from './simulation';
import { Decision } from './types';
import decisionsData from './decisions.json';
import { executeAutoplayStep } from './autoplay';
import { getScenarioInitialState, ScenarioKey } from './scenarios';

function calculateImpact(prevState: any, nextState: any) {
  const keys = ['population', 'gdp', 'povertyRate', 'unemploymentRate', 'educationIndex', 'healthcareIndex', 'approvalRating', 'militaryStrength', 'corruptionLevel', 'environmentIndex', 'treasuryBudget', 'nationalDebt', 'crimeRate', 'foreignRelationsIndex', 'militaryTrust', 'businessTrust', 'publicTrust', 'internationalTrust'];
  let totalDelta = 0;
  for (const key of keys) {
    let diff = Math.abs((nextState[key] as number || 0) - (prevState[key] as number || 0));
    if (key === 'gdp' || key === 'treasuryBudget' || key === 'nationalDebt' || key === 'population') {
      const base = Math.max(1, Math.abs(prevState[key] as number || 1));
      diff = (diff / base) * 100;
    }
    totalDelta += diff;
  }
  return totalDelta;
}

function runScenarios() {
  const scenariosToRun: ScenarioKey[] = ['default', 'post_war', 'petrostate', 'fragile_democracy'];
  const runsPerScenario = 100;
  const decisions = decisionsData as Decision[];
  
  let csvData = `Scenario,Option ID,Decision ID,Times Selected,Win Rate (%),Avg Impact,Avg Delta Approval,Avg Delta GDP (%)\n`;

  for (const scenario of scenariosToRun) {
    let wins = 0;
    const lossReasons: Record<string, number> = {};
    let totalTurns = 0;
    let losses = 0;
    
    const finalLossStatsSum = {
      gdp: 0, approvalRating: 0, nationalDebt: 0, povertyRate: 0, unemploymentRate: 0
    };

    const optionStats: Record<string, {
      id: string,
      decisionId: string,
      selected: number,
      winsWhenSelected: number,
      gamesSelectedIn: Set<number>,
      sumImpact: number,
      sumDeltaApproval: number,
      sumDeltaGDPPercent: number
    }> = {};

    for (const d of decisions) {
      for (const opt of d.options) {
        optionStats[opt.id] = {
          id: opt.id, decisionId: d.id, selected: 0, winsWhenSelected: 0,
          gamesSelectedIn: new Set(), sumImpact: 0, sumDeltaApproval: 0, sumDeltaGDPPercent: 0
        };
      }
    }

    for (let run = 0; run < runsPerScenario; run++) {
      setSeed(run * 17);
      let state = getScenarioInitialState(scenario);
      
      const optionsPickedThisGame = new Set<string>();

      while (!state.gameOver) {
        const availableDecisions = getAvailableDecisions(state, decisions);
        const randomIndex = Math.floor(seededRandom(0, availableDecisions.length));
        const decision = availableDecisions.length > 0 ? availableDecisions[randomIndex] : undefined;
        const prevState = { ...state };
        
        const { nextState, chosenOption } = executeAutoplayStep(state, decision);
        
        if (chosenOption) {
          optionsPickedThisGame.add(chosenOption.id);
          const optTracker = optionStats[chosenOption.id];
          if (optTracker) {
            optTracker.selected++;
            optTracker.gamesSelectedIn.add(run);
            optTracker.sumImpact += calculateImpact(prevState, nextState);
            optTracker.sumDeltaApproval += (nextState.approvalRating - prevState.approvalRating);
            optTracker.sumDeltaGDPPercent += ((nextState.gdp - prevState.gdp) / prevState.gdp) * 100;
          }
        }
        state = nextState;
      }

      totalTurns += state.turn;

      if (state.gameResult === 'win') {
        wins++;
        for (const optId of optionsPickedThisGame) {
          if (optionStats[optId]) optionStats[optId].winsWhenSelected++;
        }
      } else {
        losses++;
        finalLossStatsSum.gdp += state.gdp;
        finalLossStatsSum.approvalRating += state.approvalRating;
        finalLossStatsSum.nationalDebt += state.nationalDebt;
        finalLossStatsSum.povertyRate += state.povertyRate;
        finalLossStatsSum.unemploymentRate += state.unemploymentRate;

        let reasonLabel = 'Unknown Loss';
        if (state.gameOverReason?.includes('capital flight') || state.gameOverReason?.includes('Economic Collapse')) {
          reasonLabel = state.gameOverReason.includes('capital flight') ? 'Faction Coup/Capital Flight' : 'Economic Collapse';
        } else if (state.gameOverReason?.includes('Military Coup')) reasonLabel = 'Coup';
        else if (state.gameOverReason?.includes('Election Defeat')) reasonLabel = 'Election Defeat';
        
        lossReasons[reasonLabel] = (lossReasons[reasonLabel] || 0) + 1;
      }
    }

    const globalWinRate = (wins / runsPerScenario) * 100;
    console.log(`\n======================================================`);
    console.log(`SCENARIO: ${scenario.toUpperCase()} (${runsPerScenario} RUNS)`);
    console.log(`======================================================`);
    console.log(`Wins: ${wins} (${globalWinRate.toFixed(1)}%)`);
    if (globalWinRate < 5) {
      console.log(`*** DEAD MAN WALKING: This scenario is extremely difficult under random play (<5% win rate) ***`);
    }
    
    for (const [reason, count] of Object.entries(lossReasons)) {
      console.log(`Loss - ${reason}: ${count} (${((count / runsPerScenario) * 100).toFixed(1)}%)`);
    }
    console.log(`\nAverage Turns Survived: ${(totalTurns / runsPerScenario).toFixed(1)}`);
    if (losses > 0) {
      console.log(`\nAverage Stats at Moment of Loss:`);
      console.log(`  Avg Final GDP: $${(finalLossStatsSum.gdp / losses / 1000000000).toFixed(2)}B`);
      console.log(`  Avg Final Debt: $${(finalLossStatsSum.nationalDebt / losses / 1000000000).toFixed(2)}B`);
      console.log(`  Avg Final Approval: ${(finalLossStatsSum.approvalRating / losses).toFixed(1)}`);
      console.log(`  Avg Final Poverty: ${(finalLossStatsSum.povertyRate / losses).toFixed(1)}%`);
      console.log(`  Avg Final Unemp: ${(finalLossStatsSum.unemploymentRate / losses).toFixed(1)}%`);
    } else {
      console.log(`\nNo losses occurred in this scenario.`);
    }

    // Option Analysis
    console.log(`\n--- OPTION ANALYSIS (${scenario}) ---`);
    for (const [id, opt] of Object.entries(optionStats)) {
      const totalGames = opt.gamesSelectedIn.size;
      const winRate = totalGames > 0 ? (opt.winsWhenSelected / totalGames) * 100 : 0;
      const avgImpact = opt.selected > 0 ? opt.sumImpact / opt.selected : 0;
      const avgDeltaAppr = opt.selected > 0 ? opt.sumDeltaApproval / opt.selected : 0;
      const avgDeltaGDP = opt.selected > 0 ? opt.sumDeltaGDPPercent / opt.selected : 0;

      let flag = '';
      if (avgImpact < 0.1 && opt.selected > 0) {
        flag = ' [FLAG: Dead Content - Impact < 0.1]';
      } else if (opt.selected > 0 && totalGames > 5) {
        if (winRate < globalWinRate - 15) {
          flag = ' [FLAG: Highly Suboptimal Option]';
        }
      }

      console.log(`${id} (Selected ${opt.selected}x) - WinRate: ${winRate.toFixed(1)}% | AvgImpact: ${avgImpact.toFixed(2)}${flag}`);
      csvData += `${scenario},${opt.id},${opt.decisionId},${opt.selected},${winRate.toFixed(2)},${avgImpact.toFixed(4)},${avgDeltaAppr.toFixed(4)},${avgDeltaGDP.toFixed(4)}\n`;
    }
  }

  fs.writeFileSync('autoplay_report.csv', csvData);
  console.log(`\n[+] Wrote full scenario option statistics to autoplay_report.csv`);
}

runScenarios();
