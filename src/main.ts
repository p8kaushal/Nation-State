import { resolveTurn, getAvailableDecisions } from './simulation';
import { NationState, Decision, DecisionOption, StatDelta } from './types';
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
const macroKpiGrid = document.getElementById('macro-kpi-grid') as HTMLElement;
const statsList = document.getElementById('stats-list') as HTMLElement;
const trustStatsList = document.getElementById('trust-stats-list') as HTMLElement;
const pendingEffectsList = document.getElementById('pending-effects-list') as HTMLElement;

const decisionContainer = document.getElementById('decision-container') as HTMLElement;
const decisionRefBadge = document.getElementById('decision-ref-badge') as HTMLElement;
const decisionTypeBadge = document.getElementById('decision-type-badge') as HTMLElement;
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

const STAT_NAME_MAP: Record<string, string> = {
  approvalRating: 'Approval Rating',
  povertyRate: 'Poverty Rate',
  unemploymentRate: 'Unemployment Rate',
  educationIndex: 'Education Index',
  healthcareIndex: 'Healthcare Index',
  militaryStrength: 'Military Strength',
  corruptionLevel: 'Corruption Level',
  environmentIndex: 'Environment Index',
  crimeRate: 'Crime Rate',
  foreignRelationsIndex: 'Foreign Relations',
  militaryTrust: 'Military Trust',
  businessTrust: 'Business Trust',
  publicTrust: 'Public Trust',
  internationalTrust: 'International Trust',
  treasuryBudget: 'Treasury',
  nationalDebt: 'National Debt',
  gdp: 'GDP',
  gdpGrowthRate: 'GDP Growth',
  population: 'Population',
};

const SHORT_STAT_NAME_MAP: Record<string, string> = {
  approvalRating: 'Approval',
  povertyRate: 'Poverty',
  unemploymentRate: 'Unemployment',
  educationIndex: 'Education',
  healthcareIndex: 'Healthcare',
  militaryStrength: 'Military',
  corruptionLevel: 'Corruption',
  environmentIndex: 'Environment',
  crimeRate: 'Crime',
  foreignRelationsIndex: 'Foreign Rel.',
  militaryTrust: 'Military Trust',
  businessTrust: 'Business Trust',
  publicTrust: 'Public Trust',
  internationalTrust: 'Int\'l Trust',
  treasuryBudget: 'Treasury',
  nationalDebt: 'Debt',
  gdp: 'GDP',
  gdpGrowthRate: 'GDP Growth',
  population: 'Population',
};

const INVERTED_STATS = new Set([
  'povertyRate',
  'unemploymentRate',
  'crimeRate',
  'corruptionLevel',
  'nationalDebt',
]);

interface IndexStatDef {
  key: keyof NationState;
  name: string;
  icon: string;
  inverted?: boolean;
  unit: string;
}

const INDEX_STATS: IndexStatDef[] = [
  { key: 'approvalRating', name: 'Approval Rating', icon: '🏛️', unit: '/ 100' },
  { key: 'povertyRate', name: 'Poverty Rate', icon: '📉', inverted: true, unit: '%' },
  { key: 'unemploymentRate', name: 'Unemployment Rate', icon: '👔', inverted: true, unit: '%' },
  { key: 'educationIndex', name: 'Education Index', icon: '🎓', unit: '/ 100' },
  { key: 'healthcareIndex', name: 'Healthcare Index', icon: '🏥', unit: '/ 100' },
  { key: 'militaryStrength', name: 'Military Strength', icon: '🛡️', unit: '/ 100' },
  { key: 'corruptionLevel', name: 'Corruption Level', icon: '⚖️', inverted: true, unit: '/ 100' },
  { key: 'environmentIndex', name: 'Environment Index', icon: '🌿', unit: '/ 100' },
  { key: 'crimeRate', name: 'Crime Rate', icon: '🚨', inverted: true, unit: '/ 100' },
  { key: 'foreignRelationsIndex', name: 'Foreign Relations', icon: '🌐', unit: '/ 100' },
];

const TRUST_DEFS = [
  { key: 'militaryTrust' as const, name: 'Military Trust', icon: '🎖️', desc: 'Armed forces and defense leadership' },
  { key: 'businessTrust' as const, name: 'Business Trust', icon: '💼', desc: 'Corporate sector and market confidence' },
  { key: 'publicTrust' as const, name: 'Public Trust', icon: '👥', desc: 'Civil society and electorate confidence' },
  { key: 'internationalTrust' as const, name: 'Int\'l Trust', icon: '🌍', desc: 'Foreign allies and credit standing' },
];

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

interface ParsedHint {
  text: string;
  className: string;
}

function formatFormulaDelta(stat: string, num: number, op: string): string {
  const sign = op === '-' ? '-' : '+';
  if (stat === 'treasuryBudget' || stat === 'nationalDebt' || stat === 'gdp') {
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) {
      return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
    }
    if (abs >= 1_000_000) {
      return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    }
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (stat === 'gdpGrowthRate') {
    return `${sign}${(Math.abs(num) * 100).toFixed(1)}%`;
  }
  if (stat === 'povertyRate' || stat === 'unemploymentRate') {
    return `${sign}${Math.abs(num).toFixed(1)}%`;
  }
  if (stat === 'population') {
    const abs = Math.abs(num);
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
    return `${sign}${abs}`;
  }
  return `${sign}${Math.abs(num).toFixed(0)}`;
}

function parseEffectFormula(effectStr: string): ParsedHint | null {
  const match = effectStr.match(/^([a-zA-Z]+)\s*([+\-=])\s*(.+)$/);
  if (!match) return null;
  const stat = match[1];
  const op = match[2];
  const rhsStr = match[3];
  const val = parseFloat(rhsStr);
  const label = SHORT_STAT_NAME_MAP[stat] || stat;

  if (isNaN(val)) {
    return {
      text: `⚡ ${label} (${op}${rhsStr})`,
      className: 'hint-fiscal',
    };
  }

  const formattedDelta = formatFormulaDelta(stat, val, op);
  const isPositiveOp = op === '+';
  const isInverted = INVERTED_STATS.has(stat);
  const isFavorable = isInverted ? !isPositiveOp : isPositiveOp;

  if (stat === 'treasuryBudget' && !isPositiveOp) {
    return {
      text: `🟡 ${formattedDelta} ${label}`,
      className: 'hint-fiscal',
    };
  }

  const arrow = isPositiveOp ? '▲' : '▼';
  const icon = isFavorable ? '🟢' : '🔴';
  const className = isFavorable ? 'hint-positive' : 'hint-negative';

  return {
    text: `${icon} ${formattedDelta} ${label} ${arrow}`,
    className,
  };
}

function renderStats() {
  // 1. Render Macroeconomic Overview Grid
  if (macroKpiGrid) {
    const debtToGdp = ((state.nationalDebt / state.gdp) * 100).toFixed(1);
    const isDebtDanger = (state.nationalDebt / state.gdp) > 0.8;
    const growthPositive = state.gdpGrowthRate >= 0;

    macroKpiGrid.innerHTML = `
      <div class="macro-tile">
        <span class="macro-label">Population</span>
        <span class="macro-value">${(state.population / 1_000_000).toFixed(2)}M</span>
        <span class="macro-sub">Citizens</span>
      </div>
      <div class="macro-tile">
        <span class="macro-label">GDP</span>
        <span class="macro-value">${formatCurrency(state.gdp)}</span>
        <span class="macro-sub" style="color: ${growthPositive ? 'var(--stability-teal)' : 'var(--cabinet-crimson)'}; font-weight: 700;">
          ${growthPositive ? '▲ +' : '▼ '}${(state.gdpGrowthRate * 100).toFixed(2)}%/yr
        </span>
      </div>
      <div class="macro-tile ${state.treasuryBudget < 0 ? 'alert-active' : ''}">
        <span class="macro-label">Treasury</span>
        <span class="macro-value" style="color: ${state.treasuryBudget < 0 ? 'var(--cabinet-crimson)' : 'var(--federal-navy)'};">
          ${formatCurrency(state.treasuryBudget)}
        </span>
        <span class="macro-sub">Liquid Reserve</span>
      </div>
      <div class="macro-tile ${isDebtDanger ? 'alert-active' : ''}">
        <span class="macro-label">National Debt</span>
        <span class="macro-value" style="color: ${isDebtDanger ? 'var(--cabinet-crimson)' : 'var(--federal-navy)'};">
          ${formatCurrency(state.nationalDebt)}
        </span>
        <span class="macro-sub">${debtToGdp}% of GDP</span>
      </div>
      <div class="macro-tile ${state.debtCrisis ? 'alert-active' : ''}">
        <span class="macro-label">Debt Crisis</span>
        <span class="macro-value" style="color: ${state.debtCrisis ? 'var(--cabinet-crimson)' : 'var(--stability-teal)'};">
          ${state.debtCrisis ? 'ACTIVE CRISIS' : 'Solvent'}
        </span>
        <span class="macro-sub">${state.debtCrisis ? 'Default Warning' : 'Stable Rating'}</span>
      </div>
    `;
  }

  // 2. Render Policy Index Gauges with Trend Indicators and Causal Breakdown
  if (statsList) {
    statsList.innerHTML = INDEX_STATS.map((statDef) => {
      const val = Number(state[statDef.key]) || 0;
      const clampedVal = Math.max(0, Math.min(100, val));
      const deltas = state.recentDeltas.filter((d) => d.stat === statDef.key);
      const netDelta = deltas.reduce((sum, d) => sum + d.delta, 0);

      // Compute Trend Badge
      let badgeText = '● 0.0';
      let badgeCls = 'delta-neutral';
      if (netDelta > 0.04) {
        badgeText = `▲ +${netDelta.toFixed(1)}`;
        badgeCls = statDef.inverted ? 'delta-crimson' : 'delta-teal';
      } else if (netDelta < -0.04) {
        badgeText = `▼ ${netDelta.toFixed(1)}`;
        badgeCls = statDef.inverted ? 'delta-teal' : 'delta-crimson';
      }

      // Compute Progress Bar Fill Color
      let barFillClass = 'bar-fill-teal';
      if (statDef.inverted) {
        if (val < 25) barFillClass = 'bar-fill-teal';
        else if (val > 45) barFillClass = 'bar-fill-crimson';
        else barFillClass = 'bar-fill-amber';
      } else {
        if (val >= 50) barFillClass = 'bar-fill-teal';
        else if (val < 30) barFillClass = 'bar-fill-crimson';
        else barFillClass = 'bar-fill-navy';
      }

      // Compute Causal Breakdown HTML
      let breakdownHtml = '';
      if (deltas.length === 0) {
        breakdownHtml = `<div class="causal-item"><span class="causal-source">● Stable (No net adjustments this turn)</span></div>`;
      } else {
        breakdownHtml = deltas
          .map((d) => {
            const isPos = d.delta > 0;
            const isFavorable = statDef.inverted ? !isPos : isPos;
            const deltaCls = isFavorable ? 'causal-delta-pos' : 'causal-delta-neg';
            const sign = isPos ? '+' : '';
            return `
              <div class="causal-item">
                <span class="${deltaCls}">${sign}${d.delta.toFixed(1)}</span>
                <span class="causal-source">from ${d.source}</span>
              </div>
            `;
          })
          .join('');
      }

      const displayVal = statDef.unit === '%' ? `${val.toFixed(1)}%` : `${val.toFixed(1)} / 100`;

      return `
        <div class="stat-row">
          <div class="stat-main">
            <div class="stat-label-group">
              <span class="stat-icon">${statDef.icon}</span>
              <span class="stat-name">${statDef.name}</span>
            </div>
            <div class="stat-value-group">
              <span class="stat-val-text">${displayVal}</span>
              <span class="delta-badge ${badgeCls}">${badgeText}</span>
            </div>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill ${barFillClass}" style="width: ${clampedVal}%;"></div>
          </div>
          <details class="causal-details">
            <summary class="causal-summary">🔍 Breakdown (${deltas.length} delta${deltas.length === 1 ? '' : 's'})</summary>
            <div class="causal-list">
              ${breakdownHtml}
            </div>
          </details>
        </div>
      `;
    }).join('');
  }

  // 3. Render Faction Trust Meters with Gauges and Tooltip/Causal Details
  if (trustStatsList) {
    trustStatsList.innerHTML = TRUST_DEFS.map((def) => {
      const val = Number(state[def.key]) || 0;
      const clampedVal = Math.max(0, Math.min(100, val));
      const isCritical = val < 30;
      const deltas = state.recentDeltas.filter((d) => d.stat === def.key);
      const netDelta = deltas.reduce((sum, d) => sum + d.delta, 0);

      let badgeText = '● 0.0';
      let badgeCls = 'delta-neutral';
      if (netDelta > 0.04) {
        badgeText = `▲ +${netDelta.toFixed(1)}`;
        badgeCls = 'delta-teal';
      } else if (netDelta < -0.04) {
        badgeText = `▼ ${netDelta.toFixed(1)}`;
        badgeCls = 'delta-crimson';
      }

      let barFillClass = 'bar-fill-teal';
      if (val < 30) barFillClass = 'bar-fill-crimson';
      else if (val < 50) barFillClass = 'bar-fill-amber';

      let breakdownHtml = '';
      if (deltas.length === 0) {
        breakdownHtml = `<div class="causal-item"><span class="causal-source">● Stable (No faction shifts)</span></div>`;
      } else {
        breakdownHtml = deltas
          .map((d) => {
            const isPos = d.delta > 0;
            const deltaCls = isPos ? 'causal-delta-pos' : 'causal-delta-neg';
            const sign = isPos ? '+' : '';
            return `
              <div class="causal-item">
                <span class="${deltaCls}">${sign}${d.delta.toFixed(1)}</span>
                <span class="causal-source">from ${d.source}</span>
              </div>
            `;
          })
          .join('');
      }

      return `
        <div class="trust-card ${isCritical ? 'trust-warning' : ''}" title="${def.desc}">
          <div class="trust-header">
            <div class="trust-name-group">
              <span class="stat-icon">${def.icon}</span>
              <span class="trust-name">${def.name}</span>
            </div>
            <div class="stat-value-group">
              <span class="stat-val-text" style="${isCritical ? 'color: var(--cabinet-crimson); font-weight: bold;' : ''}">${val.toFixed(1)}</span>
              <span class="delta-badge ${badgeCls}">${badgeText}</span>
            </div>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill ${barFillClass}" style="width: ${clampedVal}%;"></div>
          </div>
          <details class="causal-details" style="margin-top: 5px;">
            <summary class="causal-summary">🔍 History (${deltas.length})</summary>
            <div class="causal-list">
              ${breakdownHtml}
            </div>
          </details>
        </div>
      `;
    }).join('');
  }

  // 4. Render Pending Delayed Consequences with Relative Timing and Targeted Stats
  if (pendingEffectsList) {
    pendingEffectsList.innerHTML = '';
    if (state.pendingEffects.length === 0) {
      pendingEffectsList.innerHTML = '<div class="empty-placeholder">No pending consequences scheduled for future turns.</div>';
    } else {
      state.pendingEffects.forEach((effect) => {
        const turnsRemaining = effect.targetTurn - state.turn;
        const timingText =
          turnsRemaining <= 0
            ? 'Resolving this turn'
            : turnsRemaining === 1
            ? `In 1 turn (Turn ${effect.targetTurn})`
            : `In ${turnsRemaining} turns (Turn ${effect.targetTurn})`;

        const modifiedStats: string[] = [];
        for (const eff of effect.effects) {
          const match = eff.match(/^([a-zA-Z]+)/);
          if (match) {
            const mapped = SHORT_STAT_NAME_MAP[match[1]] || match[1];
            if (!modifiedStats.includes(mapped)) {
              modifiedStats.push(mapped);
            }
          }
        }
        if (effect.spawnDecisionId && !modifiedStats.includes('Follow-up Crisis')) {
          modifiedStats.push('Follow-up Crisis');
        }

        const tagText = modifiedStats.length > 0 ? `[Pending: ${modifiedStats.join(', ')}]` : '[Pending Outcome]';

        const itemEl = document.createElement('div');
        itemEl.className = 'pending-item-card';
        itemEl.innerHTML = `
          <div class="pending-item-header">
            <span class="pending-timing-badge">⏱️ ${timingText}</span>
            <span class="pending-stats-tag">${tagText}</span>
          </div>
          <div class="pending-item-desc">${effect.description}</div>
        `;
        pendingEffectsList.appendChild(itemEl);
      });
    }
  }
}

function renderDecision() {
  const availableDecisions = getAvailableDecisions(state, decisions);
  if (availableDecisions.length === 0) {
    currentDecision = undefined;
    decisionTitle.textContent = 'No Active Legislative Matters';
    decisionDesc.textContent = 'The executive docket is currently clear. No urgent directives or policy determinations require presidential action this turn.';
    decisionOptions.innerHTML = '';
    if (decisionRefBadge) decisionRefBadge.textContent = 'REF: #NO-ACTION-REQUIRED';
    if (decisionTypeBadge) {
      decisionTypeBadge.textContent = '📋 DOCKET CLEAR';
      decisionTypeBadge.className = 'issue-type-badge badge-recurring';
    }
    return;
  }

  // Preserve existing decision if still valid, otherwise select new
  const dec = (currentDecision && availableDecisions.some((d) => d.id === currentDecision?.id))
    ? currentDecision
    : availableDecisions[Math.floor(Math.random() * availableDecisions.length)];

  currentDecision = dec;
  decisionTitle.textContent = dec.title;
  decisionDesc.textContent = dec.description;

  // Header badges: Dispatch reference & Crisis vs Recurring badge
  if (decisionRefBadge) {
    decisionRefBadge.textContent = `REF: #DEC-${dec.id.slice(0, 10).toUpperCase()}`;
  }

  if (decisionTypeBadge) {
    const isCrisis =
      dec.oneTime ||
      state.activeSpawnedDecisionId === dec.id ||
      dec.id.includes('crisis') ||
      dec.id.includes('scandal') ||
      dec.title.toLowerCase().includes('crisis') ||
      dec.title.toLowerCase().includes('emergency') ||
      dec.title.toLowerCase().includes('scandal');

    if (isCrisis) {
      decisionTypeBadge.textContent = '⚡ SPECIAL CRISIS';
      decisionTypeBadge.className = 'issue-type-badge badge-crisis';
    } else {
      decisionTypeBadge.textContent = '📋 RECURRING ISSUE';
      decisionTypeBadge.className = 'issue-type-badge badge-recurring';
    }
  }

  decisionOptions.innerHTML = '';
  dec.options.forEach((option) => {
    const btn = document.createElement('button');
    btn.className = 'executive-option-btn';

    // Parse directional hint badges
    const hints: ParsedHint[] = [];

    if (option.immediateEffects) {
      for (const eff of option.immediateEffects) {
        const hint = parseEffectFormula(eff);
        if (hint) hints.push(hint);
      }
    }

    if (option.factionEffects) {
      for (const eff of option.factionEffects) {
        const hint = parseEffectFormula(eff);
        if (hint) hints.push(hint);
      }
    }

    if (option.delayedEffects) {
      const delay = option.delayedEffects.delayTurns;
      if (option.delayedEffects.effects) {
        for (const eff of option.delayedEffects.effects) {
          const hint = parseEffectFormula(eff);
          if (hint) {
            const cleanText = hint.text.replace(/^[🟢🔴🟡⚡]\s*/, '');
            hints.push({
              text: `⏰ In ${delay}t: ${cleanText}`,
              className: 'hint-delayed',
            });
          }
        }
      }
      if (option.delayedEffects.spawnDecisionId) {
        hints.push({
          text: `⏰ In ${delay}t: Follow-up Investigation`,
          className: 'hint-delayed',
        });
      }
    }

    const hintBadgesHtml =
      hints.length > 0
        ? `<div class="option-hints-row">${hints.map((h) => `<span class="hint-badge ${h.className}">${h.text}</span>`).join('')}</div>`
        : '';

    btn.innerHTML = `
      <div class="option-title-row">
        <span class="option-bullet">§</span>
        <span class="option-title-text">${option.title}</span>
      </div>
      ${hintBadgesHtml}
    `;

    btn.addEventListener('click', () => handleTurn(option, dec.id));
    decisionOptions.appendChild(btn);
  });
}

interface LogEntryGroup {
  title: string;
  entries: {
    category: 'DECISION' | 'EVENT' | 'PENDING' | 'DRIFT' | 'SYSTEM';
    text: string;
  }[];
}

function parseLogLine(line: string): { category: 'DECISION' | 'EVENT' | 'PENDING' | 'DRIFT' | 'SYSTEM'; text: string } {
  const trimmed = line.trim();
  if (trimmed.startsWith('Action Chosen:') || trimmed.startsWith('Decision chosen:')) {
    return { category: 'DECISION', text: trimmed.replace(/^(Action Chosen:|Decision chosen:)\s*/, 'Directive Executed: ') };
  }
  if (trimmed.startsWith('Turn Passed without decision')) {
    return { category: 'DECISION', text: 'Turn Passed without executive action.' };
  }
  if (trimmed.startsWith('Random Event:') || trimmed.startsWith('Escalation Triggered:')) {
    return { category: 'EVENT', text: trimmed.replace(/^(Random Event:|Escalation Triggered:)\s*/, 'Situation Alert: ') };
  }
  if (trimmed.startsWith('Resolving pending effect:')) {
    return { category: 'PENDING', text: trimmed.replace(/^Resolving pending effect:\s*/, 'Delayed Resolution: ') };
  }
  if (trimmed.startsWith('[Engine]') || trimmed.startsWith('    [Engine]')) {
    return { category: 'DRIFT', text: trimmed.replace(/^\s*\[Engine\]\s*/, '') };
  }
  if (trimmed.startsWith('[Save/Load]')) {
    return { category: 'SYSTEM', text: trimmed.replace(/^\[Save\/Load\]\s*/, 'Archive System: ') };
  }
  if (trimmed.startsWith('Election won!')) {
    return { category: 'SYSTEM', text: `🏆 ${trimmed}` };
  }
  return { category: 'SYSTEM', text: trimmed };
}

function renderLogs() {
  if (turnLogsHistory.length === 0) {
    logPanel.innerHTML = '<div class="empty-placeholder" style="color: #94A3B8;">No briefing dispatches recorded yet.</div>';
    return;
  }

  const groups: LogEntryGroup[] = [];
  let currentGroup: LogEntryGroup = {
    title: 'Initial Dispatch Feed',
    entries: [],
  };

  for (const line of turnLogsHistory) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('=== Turn') && trimmed.includes('Resolution')) {
      if (currentGroup.entries.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        title: trimmed.replace(/^===\s*/, '').replace(/\s*===$/, ''),
        entries: [],
      };
    } else if (trimmed.startsWith('=== Scenario') || trimmed.startsWith('=== Game Initialized')) {
      if (currentGroup.entries.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = {
        title: trimmed.replace(/^===\s*/, '').replace(/\s*===$/, ''),
        entries: [],
      };
    } else {
      currentGroup.entries.push(parseLogLine(trimmed));
    }
  }
  if (currentGroup.entries.length > 0) {
    groups.push(currentGroup);
  }

  // Render newest turn first
  logPanel.innerHTML = groups
    .slice()
    .reverse()
    .map((group) => {
      const entriesHtml = group.entries
        .map((entry) => {
          let flagCls = 'flag-system';
          if (entry.category === 'DECISION') flagCls = 'flag-decision';
          else if (entry.category === 'EVENT') flagCls = 'flag-event';
          else if (entry.category === 'PENDING') flagCls = 'flag-pending';
          else if (entry.category === 'DRIFT') flagCls = 'flag-drift';

          return `
            <div class="log-entry-row">
              <span class="log-flag ${flagCls}">${entry.category}</span>
              <span class="log-text">${entry.text}</span>
            </div>
          `;
        })
        .join('');

      return `
        <div class="log-timeline-turn">
          <div class="log-turn-header">⚡ ${group.title}</div>
          ${entriesHtml}
        </div>
      `;
    })
    .join('');
}

function render() {
  turnDisplay.textContent = `Turn ${state.turn}`;
  renderStats();
  renderDecision();
  renderLogs();

  if (state.gameOver) {
    gameOverOverlay.style.display = 'flex';
    gameOverTitle.textContent = state.gameResult === 'win' ? 'PRESIDENCY COMPLETE' : 'ADMINISTRATION OVER';
    gameOverTitle.className = `game-over-title ${state.gameResult || ''}`;
    gameOverReason.textContent = state.gameOverReason || '';

    const btns = document.querySelectorAll('.executive-option-btn');
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
    result: state.gameResult === 'win' ? 'win' : 'lose',
    outcomeReason: state.gameOverReason || 'Administration concluded.',
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
  historyTableBody.innerHTML = history
    .map((item) => {
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
    })
    .join('');
}

function saveGame() {
  const decisionIndex = currentDecision ? decisions.findIndex((d) => d.id === currentDecision?.id) : -1;
  const saveData = {
    state,
    decisionIndex,
    turnLogsHistory,
    scenario: currentScenario,
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
  autoplayBtn.className = 'ctrl-btn btn-primary';
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
  const decisionToPlay =
    availableDecisions.length > 0
      ? availableDecisions[Math.floor(Math.random() * availableDecisions.length)]
      : undefined;

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
    autoplayBtn.className = 'ctrl-btn btn-danger';
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
