import { getInitialState, resolveTurn } from './simulation';
import { NationState, Decision, DecisionOption } from './types';
import decisionsData from './decisions.json';
import { getRandomOption } from './autoplay';

let state: NationState = getInitialState();
const decisions: Decision[] = decisionsData as Decision[];
let decisionIndex = 0;
const turnLogsHistory: string[] = [];

// Autoplay state
let isAutoplayRunning = false;
let autoplayTimeoutId: number | null = null;

// Elements
const turnDisplay = document.getElementById('turn-display') as HTMLElement;
const statsList = document.getElementById('stats-list') as HTMLUListElement;
const pendingEffectsList = document.getElementById('pending-effects-list') as HTMLUListElement;
const decisionTitle = document.getElementById('decision-title') as HTMLElement;
const decisionDesc = document.getElementById('decision-description') as HTMLElement;
const decisionOptions = document.getElementById('decision-options') as HTMLElement;
const nextTurnBtn = document.getElementById('next-turn-btn') as HTMLButtonElement;
const logPanel = document.getElementById('log-panel') as HTMLElement;

const autoplayBtn = document.getElementById('autoplay-btn') as HTMLButtonElement;
const autoplayDelaySelect = document.getElementById('autoplay-delay') as HTMLSelectElement;

const gameOverOverlay = document.getElementById('game-over-overlay') as HTMLElement;
const gameOverTitle = document.getElementById('game-over-title') as HTMLElement;
const gameOverReason = document.getElementById('game-over-reason') as HTMLElement;
const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;

function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

function formatStat(label: string, value: string, isAlert = false): string {
  return `
    <li>
      <span class="stat-label">${label}</span>
      <span class="stat-value ${isAlert ? 'alert-debt' : ''}">${value}</span>
    </li>
  `;
}

function renderStats() {
  const debtToGdp = ((state.nationalDebt / state.gdp) * 100).toFixed(1);
  const statsHtml = [
    formatStat('Population', `${(state.population / 1_000_000).toFixed(2)}M`),
    formatStat('GDP', formatCurrency(state.gdp)),
    formatStat('GDP Growth', `${(state.gdpGrowthRate * 100).toFixed(2)}%`),
    formatStat('Treasury', formatCurrency(state.treasuryBudget)),
    formatStat('National Debt', `${formatCurrency(state.nationalDebt)} (${debtToGdp}%)`, state.debtCrisis),
    formatStat('Debt Crisis', state.debtCrisis ? 'ACTIVE' : 'No', state.debtCrisis),
    formatStat('Approval Rating', `${state.approvalRating.toFixed(1)} / 100`),
    formatStat('Poverty Rate', `${state.povertyRate.toFixed(1)}%`),
    formatStat('Unemployment Rate', `${state.unemploymentRate.toFixed(1)}%`),
    formatStat('Education Index', `${state.educationIndex.toFixed(1)} / 100`),
    formatStat('Healthcare Index', `${state.healthcareIndex.toFixed(1)} / 100`),
    formatStat('Military Strength', `${state.militaryStrength.toFixed(1)} / 100`),
    formatStat('Corruption Level', `${state.corruptionLevel.toFixed(1)} / 100`),
    formatStat('Environment Index', `${state.environmentIndex.toFixed(1)} / 100`),
    formatStat('Crime Rate', `${state.crimeRate.toFixed(1)} / 100`),
    formatStat('Foreign Relations', `${state.foreignRelationsIndex.toFixed(1)} / 100`),
  ].join('');

  statsList.innerHTML = statsHtml;

  // Pending effects
  if (state.pendingEffects.length === 0) {
    pendingEffectsList.innerHTML = '<li>None</li>';
  } else {
    pendingEffectsList.innerHTML = state.pendingEffects
      .map(
        (eff) =>
          `<li>Turn ${eff.targetTurn}: ${eff.description} (${eff.effects.join(', ')})</li>`
      )
      .join('');
  }
}

function renderDecision() {
  if (decisions.length === 0) {
    decisionTitle.textContent = 'No decisions available';
    decisionDesc.textContent = '';
    decisionOptions.innerHTML = '';
    return;
  }

  const currentDecision = decisions[decisionIndex % decisions.length];
  decisionTitle.textContent = currentDecision.title;
  decisionDesc.textContent = currentDecision.description;

  decisionOptions.innerHTML = '';
  currentDecision.options.forEach((option) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';

    let effectsSummary = '';
    if (option.immediateEffects && option.immediateEffects.length > 0) {
      effectsSummary += `[Immediate: ${option.immediateEffects.join(', ')}] `;
    }
    if (option.delayedEffects) {
      effectsSummary += `[In ${option.delayedEffects.delayTurns} turns: ${option.delayedEffects.effects.join(', ')}]`;
    }

    btn.innerHTML = `
      <div>${option.title}</div>
      ${effectsSummary ? `<span class="option-effects">${effectsSummary}</span>` : ''}
    `;

    btn.addEventListener('click', () => handleTurn(option));
    decisionOptions.appendChild(btn);
  });
}

function renderLogs() {
  logPanel.innerHTML = turnLogsHistory
    .slice()
    .reverse()
    .map((log) => `<div class="log-entry">${log}</div>`)
    .join('');
}

function render() {
  turnDisplay.textContent = `Turn ${state.turn}`;
  renderStats();
  renderDecision();
  renderLogs();

  if (state.gameOver) {
    gameOverOverlay.style.display = 'flex';
    gameOverTitle.textContent = state.gameResult === 'win' ? 'YOU WIN!' : 'GAME OVER';
    gameOverTitle.className = `game-over-title ${state.gameResult || ''}`;
    gameOverReason.textContent = state.gameOverReason || '';
    
    // Disable inputs
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn) => ((btn as HTMLButtonElement).disabled = true));
    nextTurnBtn.disabled = true;
  } else {
    gameOverOverlay.style.display = 'none';
    nextTurnBtn.disabled = false;
  }
}

function handleTurn(chosenOption?: DecisionOption) {
  const previousTurn = state.turn;
  state = resolveTurn(state, chosenOption);
  decisionIndex++;

  turnLogsHistory.push(`\n=== Turn ${previousTurn} Resolution ===`);
  if (chosenOption) {
    turnLogsHistory.push(`Action Chosen: ${chosenOption.title}`);
  } else {
    turnLogsHistory.push(`Turn Passed without decision`);
  }

  if (state.recentLogs && state.recentLogs.length > 0) {
    for (const log of state.recentLogs) {
      turnLogsHistory.push(log);
    }
  }

  render();
}

function stopAutoplay() {
  isAutoplayRunning = false;
  autoplayBtn.textContent = 'Start Autoplay';
  autoplayBtn.style.background = '#2563eb';
  if (autoplayTimeoutId !== null) {
    clearTimeout(autoplayTimeoutId);
    autoplayTimeoutId = null;
  }
}

function runAutoplayLoop() {
  if (!isAutoplayRunning || state.gameOver) {
    stopAutoplay();
    return;
  }

  const currentDecision = decisions.length > 0 ? decisions[decisionIndex % decisions.length] : undefined;
  let chosenOption: DecisionOption | undefined = undefined;
  if (currentDecision) {
    chosenOption = getRandomOption(currentDecision);
  }

  handleTurn(chosenOption);

  if (!state.gameOver) {
    const delay = parseInt(autoplayDelaySelect.value, 10);
    autoplayTimeoutId = window.setTimeout(runAutoplayLoop, delay);
  } else {
    stopAutoplay();
  }
}

autoplayBtn.addEventListener('click', () => {
  if (isAutoplayRunning) {
    stopAutoplay();
  } else {
    isAutoplayRunning = true;
    autoplayBtn.textContent = 'Stop Autoplay';
    autoplayBtn.style.background = '#dc2626'; // red
    runAutoplayLoop();
  }
});

// Initial binding and render
nextTurnBtn.addEventListener('click', () => {
  if (isAutoplayRunning) stopAutoplay();
  handleTurn(undefined);
});

restartBtn.addEventListener('click', () => {
  if (isAutoplayRunning) stopAutoplay();
  state = getInitialState();
  decisionIndex = 0;
  turnLogsHistory.length = 0;
  turnLogsHistory.push(`=== Game Restarted ===`);
  render();
  gameOverOverlay.style.display = 'none';
});

turnLogsHistory.push(`=== Game Initialized (Turn 1) ===`);
render();
