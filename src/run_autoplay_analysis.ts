import * as fs from 'fs';
import { getInitialState, setSeed, getAvailableDecisions, seededRandom } from './simulation';
import { Decision } from './types';
import decisionsData from './decisions.json';
import { executeAutoplayStep } from './autoplay';

function calculateImpact(prevState: any, nextState: any) {
  const keys = ['population', 'gdp', 'povertyRate', 'unemploymentRate', 'educationIndex', 'healthcareIndex', 'approvalRating', 'militaryStrength', 'corruptionLevel', 'environmentIndex', 'treasuryBudget', 'nationalDebt', 'crimeRate', 'foreignRelationsIndex'];
  let totalDelta = 0;
  for (const key of keys) {
    // Normalizing massive numbers like GDP or budget isn't strictly requested, but we'll sum absolute changes of smaller indices and percent changes of big ones to keep it sensible.
    let diff = Math.abs((nextState[key] as number) - (prevState[key] as number));
    if (key === 'gdp' || key === 'treasuryBudget' || key === 'nationalDebt' || key === 'population') {
      const base = Math.max(1, Math.abs(prevState[key] as number));
      diff = (diff / base) * 100; // Treat as percent change for large numbers
    }
    totalDelta += diff;
  }
  return totalDelta;
}

function runAnalysis(runs = 100) {
  const decisions = decisionsData as Decision[];
  
  let wins = 0;
  const lossReasons: Record<string, number> = {};
  let totalTurns = 0;
  
  const finalStatsSum = {
    gdp: 0, approvalRating: 0, nationalDebt: 0, povertyRate: 0, unemploymentRate: 0
  };

  // Option Tracking
  // key: option.id -> stats
  const optionStats: Record<string, {
    id: string,
    decisionId: string,
    selected: number,
    winsWhenSelected: number,
    gamesSelectedIn: Set<number>, // track which games it was picked in to compute win rate accurately
    sumImpact: number,
    sumDeltaApproval: number,
    sumDeltaGDPPercent: number
  }> = {};

  for (const d of decisions) {
    for (const opt of d.options) {
      optionStats[opt.id] = {
        id: opt.id,
        decisionId: d.id,
        selected: 0,
        winsWhenSelected: 0,
        gamesSelectedIn: new Set(),
        sumImpact: 0,
        sumDeltaApproval: 0,
        sumDeltaGDPPercent: 0
      };
    }
  }

  for (let run = 0; run < runs; run++) {
    setSeed(run * 17);
    let state = getInitialState();
    
    // Which options were picked this game
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
        optTracker.selected++;
        optTracker.gamesSelectedIn.add(run);
        
        optTracker.sumImpact += calculateImpact(prevState, nextState);
        optTracker.sumDeltaApproval += (nextState.approvalRating - prevState.approvalRating);
        optTracker.sumDeltaGDPPercent += ((nextState.gdp - prevState.gdp) / prevState.gdp) * 100;
      }
      
      state = nextState;
    }

    totalTurns += state.turn;
    finalStatsSum.gdp += state.gdp;
    finalStatsSum.approvalRating += state.approvalRating;
    finalStatsSum.nationalDebt += state.nationalDebt;
    finalStatsSum.povertyRate += state.povertyRate;
    finalStatsSum.unemploymentRate += state.unemploymentRate;

    if (state.gameResult === 'win') {
      wins++;
      for (const optId of optionsPickedThisGame) {
        optionStats[optId].winsWhenSelected++;
      }
    } else {
      let reasonLabel = 'Unknown Loss';
      if (state.gameOverReason?.includes('Economic Collapse')) reasonLabel = 'Economic Collapse';
      else if (state.gameOverReason?.includes('Military Coup')) reasonLabel = 'Military Coup';
      else if (state.gameOverReason?.includes('Election Defeat')) reasonLabel = 'Election Defeat';
      
      lossReasons[reasonLabel] = (lossReasons[reasonLabel] || 0) + 1;
    }
  }

  console.log(`\n=== AUTOPLAY ANALYSIS (${runs} RUNS) ===\n`);
  console.log(`Wins: ${wins} (${((wins / runs) * 100).toFixed(1)}%)`);
  for (const [reason, count] of Object.entries(lossReasons)) {
    console.log(`Loss - ${reason}: ${count} (${((count / runs) * 100).toFixed(1)}%)`);
  }
  console.log(`\nAverage Turns Survived: ${(totalTurns / runs).toFixed(1)}`);
  console.log(`Avg Final GDP: $${(finalStatsSum.gdp / runs / 1000000000).toFixed(2)}B`);
  console.log(`Avg Final Debt: $${(finalStatsSum.nationalDebt / runs / 1000000000).toFixed(2)}B`);
  console.log(`Avg Final Approval: ${(finalStatsSum.approvalRating / runs).toFixed(1)}`);
  console.log(`Avg Final Poverty: ${(finalStatsSum.povertyRate / runs).toFixed(1)}%`);
  console.log(`Avg Final Unemp: ${(finalStatsSum.unemploymentRate / runs).toFixed(1)}%`);

  // Option Analysis
  console.log(`\n=== OPTION ANALYSIS ===\n`);
  
  let csvData = `Option ID,Decision ID,Times Selected,Win Rate (%),Avg Impact,Avg Delta Approval,Avg Delta GDP (%)\n`;

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
      // Very basic suboptimal flag if win rate < global win rate - 15%
      const globalWinRate = (wins / runs) * 100;
      if (winRate < globalWinRate - 15) {
        flag = ' [FLAG: Highly Suboptimal Option]';
      }
    }

    console.log(`${id} (Selected ${opt.selected}x) - WinRate: ${winRate.toFixed(1)}% | AvgImpact: ${avgImpact.toFixed(2)}${flag}`);

    csvData += `${opt.id},${opt.decisionId},${opt.selected},${winRate.toFixed(2)},${avgImpact.toFixed(4)},${avgDeltaAppr.toFixed(4)},${avgDeltaGDP.toFixed(4)}\n`;
  }

  fs.writeFileSync('autoplay_report.csv', csvData);
  console.log(`\n[+] Wrote full option statistics to autoplay_report.csv`);
}

runAnalysis(100);
