import { resolveTurn, getAvailableDecisions } from './simulation';
import { NationState, Decision, DecisionOption } from './types';
import decisionsData from './decisions.json';
import { getRandomOption } from './autoplay';
import { scenarios, scenarioMetadata, getScenarioInitialState, ScenarioKey } from './scenarios';

interface RunHistoryItem {
  id: string;
  date: string;
  scenario: string;
  finalTurn: number;
  result: 'win' | 'lose';
  outcomeReason: string;
}

const SAVE_KEY = 'nation_state_save';
const HISTORY_KEY = 'nation_state_history';

let currentScenario: ScenarioKey = 'default';
let state: NationState = getScenarioInitialState('default');
const decisions: Decision[] = decisionsData as Decision[];
let currentDecision: Decision | undefined = undefined;
const turnLogsHistory: string[] = [];
let historyRecorded = false;

// Autoplay state
let isAutoplayRunning = false;
let autoplayTimeoutId: number | null = null;

// Header elements & Scenario selector
const scenarioSelect = document.getElementById('scenario-select') as HTMLSelectElement;
const turnDisplay = document.getElementById('turn-display') as HTMLElement;
const resumeBtn = document.getElementById('resume-btn') as HTMLButtonElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
const deleteSaveBtn = document.getElementById('delete-save-btn') as HTMLButtonElement;

// Main card elements
const statsList = document.getElementById('stats-list') as HTMLUListElement;
const pendingEffectsList = document.getElementById('pending-effects-list') as HTMLUListElement;
const decisionTitle = document.getElementById('decision-title') as HTMLElement;
const decisionDesc = document.getElementById('decision-description') as HTMLElement;
const decisionOptions = document.getElementById('decision-options') as HTMLElement;
const nextTurnBtn = document.getElementById('next-turn-btn') as HTMLButtonElement;
const logPanel = document.getElementById('log-panel') as HTMLElement;

// History elements
const historyTable = document.getElementById('history-table') as HTMLTableElement;
const historyTableBody = document.getElementById('history-table-body') as HTMLTableSectionElement;
const noHistoryMsg = document.getElementById('no-history-msg') as HTMLElement;
const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;

// Autoplay elements
const autoplayBtn = document.getElementById('autoplay-btn') as HTMLButtonElement;
const autoplayDelaySelect = document.getElementById('autoplay-delay') as HTMLSelectElement;

// Game Over Overlay elements
const gameOverOverlay = document.getElementById('game-over-overlay') as HTMLElement;
const gameOverTitle = document.getElementById('game-over-title') as HTMLElement;
const gameOverReason = document.getElementById('game-over-reason') as HTMLElement;
const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
const modalDeleteSaveBtn = document.getElementById('modal-delete-save-btn') as HTMLButtonElement;

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

  const trustMapping = [
    { id: 'stat-militaryTrust', value: `${state.militaryTrust.toFixed(1)}` },
    { id: 'stat-businessTrust', value: `${state.businessTrust.toFixed(1)}` },
    { id: 'stat-publicTrust', value: `${state.publicTrust.toFixed(1)}` },
    { id: 'stat-internationalTrust', value: `${state.internationalTrust.toFixed(1)}` }
  ];

  for (const m of trustMapping) {
    const el = document.getElementById(m.id);
    if (el) {
      el.textContent = m.value;
      if (parseFloat(m.value) < 30) {
        el.style.color = '#dc2626'; // red
        el.style.fontWeight = 'bold';
      } else {
        el.style.color = '';
        el.style.fontWeight = '';
      }
    }
  }

  pendingEffectsList.innerHTML = '';
  if (state.pendingEffects.length === 0) {
    pendingEffectsList.innerHTML = '<li><em>None</em></li>';
  } else {
    state.pendingEffects.forEach(effect => {
      const li = document.createElement('li');
      li.textContent = `Turn ${effect.targetTurn}: ${effect.description}`;
      pendingEffectsList.appendChild(li);
    });
  }
}

function renderDecision() {
  const availableDecisions = getAvailableDecisions(state, decisions);
  if (availableDecisions.length === 0) {
    currentDecision = undefined;
    decisionTitle.textContent = 'No active issues';
    decisionDesc.textContent = 'There are no pressing matters requiring your attention this turn.';
    decisionOptions.innerHTML = '';
    return;
  }

  // Preserve existing decision if still valid, otherwise select new
  const dec = (currentDecision && availableDecisions.some(d => d.id === currentDecision?.id))
    ? currentDecision
    : availableDecisions[Math.floor(Math.random() * availableDecisions.length)];

  currentDecision = dec;
  decisionTitle.textContent = dec.title;
  decisionDesc.textContent = dec.description;

  decisionOptions.innerHTML = '';
  dec.options.forEach((option) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';

    let effectsSummary = '';
    if (option.immediateEffects && option.immediateEffects.length > 0) {
      effectsSummary += `[Immediate: ${option.immediateEffects.join(', ')}] `;
    }
    if (option.factionEffects && option.factionEffects.length > 0) {
      effectsSummary += `[Faction: ${option.factionEffects.join(', ')}] `;
    }
    if (option.delayedEffects && option.delayedEffects.effects) {
      effectsSummary += `[In ${option.delayedEffects.delayTurns} turns: ${option.delayedEffects.effects.join(', ')}]`;
    }

    btn.innerHTML = `
      <div>${option.title}</div>
      ${effectsSummary ? `<span class="option-effects">${effectsSummary}</span>` : ''}
    `;

    btn.addEventListener('click', () => handleTurn(option, dec.id));
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
    
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach((btn) => ((btn as HTMLButtonElement).disabled = true));
    nextTurnBtn.disabled = true;

    recordGameOverHistory();
  } else {
    gameOverOverlay.style.display = 'none';
    nextTurnBtn.disabled = false;
  }
}

function recordGameOverHistory() {
  if (historyRecorded || !state.gameOver) return;
  historyRecorded = true;

  const history = getHistory();
  const meta = scenarioMetadata[currentScenario];
  const scenarioName = meta ? meta.name : currentScenario;

  const entry: RunHistoryItem = {
    id: Date.now().toString(),
    date: new Date().toLocaleString(),
    scenario: scenarioName,
    finalTurn: state.turn,
    result: (state.gameResult === 'win' ? 'win' : 'lose'),
    outcomeReason: state.gameOverReason || 'Game ended.'
  };

  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistoryTable();
}

function getHistory(): RunHistoryItem[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('Error parsing run history:', e);
    return [];
  }
}

function renderHistoryTable() {
  const history = getHistory();
  if (history.length === 0) {
    historyTable.style.display = 'none';
    noHistoryMsg.style.display = 'block';
    return;
  }

  historyTable.style.display = 'table';
  noHistoryMsg.style.display = 'none';
  historyTableBody.innerHTML = history.map((item) => {
    const badgeClass = item.result === 'win' ? 'result-badge win' : 'result-badge lose';
    const badgeText = item.result === 'win' ? 'WIN' : 'LOSE';
    return `
      <tr>
        <td>${item.date}</td>
        <td><strong>${item.scenario}</strong></td>
        <td>Turn ${item.finalTurn}</td>
        <td><span class="${badgeClass}">${badgeText}</span></td>
        <td>${item.outcomeReason}</td>
      </tr>
    `;
  }).join('');
}

function saveGame() {
  const decisionIndex = currentDecision ? decisions.findIndex(d => d.id === currentDecision?.id) : -1;
  const saveData = {
    state,
    decisionIndex,
    turnLogsHistory,
    scenario: currentScenario
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  updateSaveControls();
}

function loadGame(): boolean {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const saveData = JSON.parse(raw);
    if (!saveData.state) return false;

    state = saveData.state;
    turnLogsHistory.length = 0;
    if (Array.isArray(saveData.turnLogsHistory)) {
      turnLogsHistory.push(...saveData.turnLogsHistory);
    }
    if (saveData.scenario && scenarios[saveData.scenario as ScenarioKey]) {
      currentScenario = saveData.scenario as ScenarioKey;
      scenarioSelect.value = currentScenario;
    }
    if (typeof saveData.decisionIndex === 'number' && saveData.decisionIndex >= 0 && decisions[saveData.decisionIndex]) {
      currentDecision = decisions[saveData.decisionIndex];
    } else {
      currentDecision = undefined;
    }

    historyRecorded = !!state.gameOver;
    render();
    updateSaveControls();
    return true;
  } catch (e) {
    console.error('Failed to load save state:', e);
    return false;
  }
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
  updateSaveControls();
}

function updateSaveControls() {
  const hasSave = localStorage.getItem(SAVE_KEY) !== null;
  resumeBtn.style.display = hasSave ? 'inline-flex' : 'none';
  loadBtn.disabled = !hasSave;
  deleteSaveBtn.disabled = !hasSave;
}

function handleTurn(chosenOption?: DecisionOption, decisionId?: string) {
  const previousTurn = state.turn;
  state = resolveTurn(state, chosenOption, decisionId);
  currentDecision = undefined; // Trigger new decision selection for next turn

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

  // Auto-save state at the end of every resolved turn
  saveGame();
}

function resetGameToScenario(scenarioKey: ScenarioKey) {
  if (isAutoplayRunning) stopAutoplay();
  currentScenario = scenarioKey;
  scenarioSelect.value = scenarioKey;
  state = getScenarioInitialState(scenarioKey);
  currentDecision = undefined;
  historyRecorded = false;
  turnLogsHistory.length = 0;

  const meta = scenarioMetadata[currentScenario];
  const scenarioName = meta ? meta.name : currentScenario;
  turnLogsHistory.push(`=== Scenario Selected: ${scenarioName} ===`);
  turnLogsHistory.push(`Turn 1 Initialized.`);

  render();
  saveGame();
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

  const availableDecisions = getAvailableDecisions(state, decisions);
  const decisionToPlay = availableDecisions.length > 0 ? availableDecisions[Math.floor(Math.random() * availableDecisions.length)] : undefined;
  
  let chosenOption: DecisionOption | undefined = undefined;
  if (decisionToPlay) {
    chosenOption = getRandomOption(decisionToPlay);
  }

  handleTurn(chosenOption, decisionToPlay?.id);

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

// Scenario Selector
scenarioSelect.addEventListener('change', () => {
  const selected = scenarioSelect.value as ScenarioKey;
  resetGameToScenario(selected);
});

// Save / Load Controls
resumeBtn.addEventListener('click', () => {
  if (isAutoplayRunning) stopAutoplay();
  if (loadGame()) {
    turnLogsHistory.push('[Save/Load] Resumed saved game.');
    renderLogs();
  }
});

saveBtn.addEventListener('click', () => {
  saveGame();
  turnLogsHistory.push('[Save/Load] Game saved successfully.');
  renderLogs();
});

loadBtn.addEventListener('click', () => {
  if (isAutoplayRunning) stopAutoplay();
  if (loadGame()) {
    turnLogsHistory.push('[Save/Load] Game loaded successfully.');
    renderLogs();
  }
});

deleteSaveBtn.addEventListener('click', () => {
  deleteSave();
  turnLogsHistory.push('[Save/Load] Saved game data removed.');
  renderLogs();
});

// Next turn & restart handlers
nextTurnBtn.addEventListener('click', () => {
  if (isAutoplayRunning) stopAutoplay();
  handleTurn(undefined);
});

restartBtn.addEventListener('click', () => {
  resetGameToScenario(currentScenario);
});

modalDeleteSaveBtn.addEventListener('click', () => {
  deleteSave();
  resetGameToScenario(currentScenario);
});

clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistoryTable();
});

// Startup Initialization
updateSaveControls();
renderHistoryTable();

turnLogsHistory.push(`=== Game Initialized (Scenario: ${scenarioMetadata[currentScenario].name}) ===`);
render();
