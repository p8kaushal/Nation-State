import { resolveTurn, getAvailableDecisions } from './simulation';
import { NationState, Decision, DecisionOption, StatDelta } from './types';
import decisionsData from './decisions.json';
import { getRandomOption } from './autoplay';
import { scenarios, scenarioMetadata, getScenarioInitialState, ScenarioKey } from './scenarios';
import { getOfficeBgSvg } from './office_scene';
import { renderNationView } from './nation_view';
import { saveGameState, loadSave, recordCompletedRun, fetchRunHistory } from './lib/cloudSave';
import { GameState, RunSummary } from './types/auth';
import { signInWithGoogle, signOut as supabaseSignOut, getCurrentUser, onAuthStateChange } from './lib/auth';

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

// Bottom log strip state
let isLogExpanded = false;

// Header elements & Scenario selector
const scenarioSelect = document.getElementById('scenario-select') as HTMLSelectElement;
const turnDisplay = document.getElementById('turn-display') as HTMLElement;
const resumeBtn = document.getElementById('resume-btn') as HTMLButtonElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
const deleteSaveBtn = document.getElementById('delete-save-btn') as HTMLButtonElement;
const pastRunsBtn = document.getElementById('past-runs-btn') as HTMLButtonElement;

// Mobile Header Actions Drawer elements
const mobileActionsToggleBtn = document.getElementById('mobile-actions-toggle-btn') as HTMLButtonElement | null;
const mobileActionsDrawer = document.getElementById('mobile-actions-drawer') as HTMLElement | null;
const mobileScenarioSelect = document.getElementById('mobile-scenario-select') as HTMLSelectElement | null;
const mobileSaveBtn = document.getElementById('mobile-save-btn') as HTMLButtonElement | null;
const mobileLoadBtn = document.getElementById('mobile-load-btn') as HTMLButtonElement | null;
const mobileDeleteSaveBtn = document.getElementById('mobile-delete-save-btn') as HTMLButtonElement | null;
const mobilePastRunsBtn = document.getElementById('mobile-past-runs-btn') as HTMLButtonElement | null;

// Left panel stat list elements
const economyStatsList = document.getElementById('economy-stats-list') as HTMLElement;
const trustStatsList = document.getElementById('trust-stats-list') as HTMLElement;

// Right panel stat list elements
const societyStatsList = document.getElementById('society-stats-list') as HTMLElement;
const infrastructureStatsList = document.getElementById('infrastructure-stats-list') as HTMLElement;
const pendingEffectsList = document.getElementById('pending-effects-list') as HTMLElement;
const pendingSection = document.getElementById('pending-section') as HTMLElement;

// Center Stage elements
const nationViewContainer = document.getElementById('nation-view-container') as HTMLElement;
const decisionContainer = document.getElementById('decision-container') as HTMLElement;
const decisionRefBadge = document.getElementById('decision-ref-badge') as HTMLElement;
const decisionTypeBadge = document.getElementById('decision-type-badge') as HTMLElement;
const decisionTitle = document.getElementById('decision-title') as HTMLElement;
const decisionDesc = document.getElementById('decision-description') as HTMLElement;
const decisionOptions = document.getElementById('decision-options') as HTMLElement;
const nextTurnBtn = document.getElementById('next-turn-btn') as HTMLButtonElement;

// Bottom Teletype Strip elements
const bottomLogStrip = document.getElementById('bottom-log-strip') as HTMLElement;
const logStripBar = document.getElementById('log-strip-bar') as HTMLElement;
const logPreview = document.getElementById('log-preview') as HTMLElement;
const toggleLogBtn = document.getElementById('toggle-log-btn') as HTMLButtonElement;
const logPanel = document.getElementById('log-panel') as HTMLElement;

// Dynamic Floating Tooltip
const statTooltipFloater = document.getElementById('stat-tooltip-floater') as HTMLElement;

// History Modal elements
const historyModal = document.getElementById('history-modal') as HTMLElement;
const closeHistoryBtn = document.getElementById('close-history-btn') as HTMLButtonElement;
const historyTable = document.getElementById('history-table') as HTMLTableElement;
const historyTableBody = document.getElementById('history-table-body') as HTMLTableSectionElement;
const noHistoryMsg = document.getElementById('no-history-msg') as HTMLElement;
const clearHistoryBtn = document.getElementById('clear-history-btn') as HTMLButtonElement;

// Autoplay elements
const autoplayBtn = document.getElementById('autoplay-btn') as HTMLButtonElement;
const autoplayDelaySelect = document.getElementById('autoplay-delay') as HTMLSelectElement;

// Home Screen Elements
const homeScreen = document.getElementById('home-screen') as HTMLElement;
const homeMainView = document.getElementById('home-main-view') as HTMLElement;
const homeScenarioView = document.getElementById('home-scenario-view') as HTMLElement;
const homeNewGameBtn = document.getElementById('home-new-game-btn') as HTMLButtonElement;
const homeContinueBtn = document.getElementById('home-continue-btn') as HTMLButtonElement;
const homeContinueText = document.getElementById('home-continue-text') as HTMLElement;
const homePastRunsBtn = document.getElementById('home-past-runs-btn') as HTMLButtonElement;
const homeHowToPlayBtn = document.getElementById('home-how-to-play-btn') as HTMLButtonElement;
const homeStartTourBtn = document.getElementById('home-start-tour-btn') as HTMLButtonElement | null;
const homeBackBtn = document.getElementById('home-back-btn') as HTMLButtonElement;
const homeStartPresidencyBtn = document.getElementById('home-start-presidency-btn') as HTMLButtonElement;
const homeScenarioCards = document.querySelectorAll<HTMLElement>('.scenario-card');

// How to Play Modal Elements
const howToPlayModal = document.getElementById('how-to-play-modal') as HTMLElement;
const howToPlayTourBtn = document.getElementById('how-to-play-tour-btn') as HTMLButtonElement | null;
const closeHowToPlayBtn = document.getElementById('close-how-to-play-btn') as HTMLButtonElement;
const closeHowToPlayFooterBtn = document.getElementById('close-how-to-play-footer-btn') as HTMLButtonElement;

// Tutorial Overlay Elements
const tutorialOverlay = document.getElementById('tutorial-overlay') as HTMLElement | null;
const tutorialStepCounter = document.getElementById('tutorial-step-counter') as HTMLElement | null;
const tutorialStepTitle = document.getElementById('tutorial-step-title') as HTMLElement | null;
const tutorialStepDesc = document.getElementById('tutorial-step-desc') as HTMLElement | null;
const tutorialStepTip = document.getElementById('tutorial-step-tip') as HTMLElement | null;
const tutorialSkipBtn = document.getElementById('tutorial-skip-btn') as HTMLButtonElement | null;
const tutorialPrevBtn = document.getElementById('tutorial-prev-btn') as HTMLButtonElement | null;
const tutorialNextBtn = document.getElementById('tutorial-next-btn') as HTMLButtonElement | null;

// In-game Top Bar Menu Button
const menuHomeBtn = document.getElementById('menu-home-btn') as HTMLButtonElement | null;

// Auth and Sync status Pill elements
const syncStatusPill = document.getElementById('sync-status-pill') as HTMLElement | null;
const authLoginBtn = document.getElementById('auth-login-btn') as HTMLButtonElement | null;
const authUserMenu = document.getElementById('auth-user-menu') as HTMLElement | null;
const authAvatar = document.getElementById('auth-avatar') as HTMLImageElement | null;
const authDropdown = document.getElementById('auth-dropdown') as HTMLElement | null;
const authUserName = document.getElementById('auth-user-name') as HTMLElement | null;
const authLogoutBtn = document.getElementById('auth-logout-btn') as HTMLButtonElement | null;

const mobileLoginBtn = document.getElementById('mobile-login-btn') as HTMLButtonElement | null;
const mobileUserInfo = document.getElementById('mobile-user-info') as HTMLElement | null;
const mobileAuthAvatar = document.getElementById('mobile-auth-avatar') as HTMLImageElement | null;
const mobileAuthUserName = document.getElementById('mobile-auth-user-name') as HTMLElement | null;
const mobileLogoutBtn = document.getElementById('mobile-logout-btn') as HTMLButtonElement | null;

const homeLoginBtn = document.getElementById('home-login-btn') as HTMLButtonElement | null;
const homeProfileCard = document.getElementById('home-profile-card') as HTMLElement | null;
const homeAvatar = document.getElementById('home-avatar') as HTMLImageElement | null;
const homeUserName = document.getElementById('home-user-name') as HTMLElement | null;
const homeLogoutBtn = document.getElementById('home-logout-btn') as HTMLButtonElement | null;

// Mobile Navigation Tab elements
const mobileTabDesk = document.getElementById('mobile-tab-desk') as HTMLButtonElement | null;
const mobileTabStats = document.getElementById('mobile-tab-stats') as HTMLButtonElement | null;
const mobileTabBriefing = document.getElementById('mobile-tab-briefing') as HTMLButtonElement | null;
const mainWorkspace = document.querySelector('.main-workspace') as HTMLElement | null;

type MobileTab = 'desk' | 'stats' | 'briefing';
let currentMobileTab: MobileTab = 'desk';

function setMobileTab(tab: MobileTab) {
  currentMobileTab = tab;

  if (mobileTabDesk) mobileTabDesk.classList.toggle('active', tab === 'desk');
  if (mobileTabStats) mobileTabStats.classList.toggle('active', tab === 'stats');
  if (mobileTabBriefing) mobileTabBriefing.classList.toggle('active', tab === 'briefing');

  if (mainWorkspace) {
    mainWorkspace.classList.remove('mobile-tab-active-desk', 'mobile-tab-active-stats', 'mobile-tab-active-briefing');
    mainWorkspace.classList.add(`mobile-tab-active-${tab}`);
  }
  document.body.classList.remove('mobile-tab-active-desk', 'mobile-tab-active-stats', 'mobile-tab-active-briefing');
  document.body.classList.add(`mobile-tab-active-${tab}`);

  if (tab === 'briefing') {
    if (!isLogExpanded) {
      isLogExpanded = true;
      if (bottomLogStrip) bottomLogStrip.classList.add('expanded');
      if (toggleLogBtn) toggleLogBtn.textContent = '▼ Collapse Feed';
    }
  }

  if (mobileActionsDrawer) {
    mobileActionsDrawer.classList.remove('open');
  }
}

// Game Over Overlay elements
const gameOverOverlay = document.getElementById('game-over-overlay') as HTMLElement;
const gameOverTitle = document.getElementById('game-over-title') as HTMLElement;
const gameOverReason = document.getElementById('game-over-reason') as HTMLElement;
const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
const modalDeleteSaveBtn = document.getElementById('modal-delete-save-btn') as HTMLButtonElement;

let selectedHomeScenario: ScenarioKey = 'default';

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
  debtCrisis: 'Solvency',
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
  militaryTrust: 'Mil. Trust',
  businessTrust: 'Biz. Trust',
  publicTrust: 'Pub. Trust',
  internationalTrust: "Int'l Trust",
  treasuryBudget: 'Treasury',
  nationalDebt: 'Debt',
  gdp: 'GDP',
  gdpGrowthRate: 'GDP Growth',
  population: 'Population',
  debtCrisis: 'Solvency',
};

const INVERTED_STATS = new Set([
  'povertyRate',
  'unemploymentRate',
  'crimeRate',
  'corruptionLevel',
  'nationalDebt',
]);

interface StatConfig {
  key: string;
  name: string;
  icon: string;
  inverted?: boolean;
  format: (state: NationState) => string;
}

const ECONOMY_STATS: StatConfig[] = [
  {
    key: 'gdp',
    name: 'GDP',
    icon: '📈',
    format: (s) => formatCurrency(s.gdp),
  },
  {
    key: 'gdpGrowthRate',
    name: 'GDP Growth',
    icon: '📊',
    format: (s) => `${s.gdpGrowthRate >= 0 ? '+' : ''}${(s.gdpGrowthRate * 100).toFixed(1)}%/yr`,
  },
  {
    key: 'treasuryBudget',
    name: 'Treasury',
    icon: '💰',
    format: (s) => formatCurrency(s.treasuryBudget),
  },
  {
    key: 'nationalDebt',
    name: 'Debt',
    icon: '💳',
    inverted: true,
    format: (s) => `${formatCurrency(s.nationalDebt)} (${((s.nationalDebt / s.gdp) * 100).toFixed(0)}%)`,
  },
  {
    key: 'debtCrisis',
    name: 'Solvency',
    icon: '⚠️',
    format: (s) => (s.debtCrisis ? 'CRISIS' : 'Solvent'),
  },
];

const FACTION_TRUST_STATS: StatConfig[] = [
  {
    key: 'militaryTrust',
    name: 'Military Trust',
    icon: '🎖️',
    format: (s) => s.militaryTrust.toFixed(1),
  },
  {
    key: 'businessTrust',
    name: 'Business Trust',
    icon: '💼',
    format: (s) => s.businessTrust.toFixed(1),
  },
  {
    key: 'publicTrust',
    name: 'Public Trust',
    icon: '👥',
    format: (s) => s.publicTrust.toFixed(1),
  },
  {
    key: 'internationalTrust',
    name: "Int'l Trust",
    icon: '🌍',
    format: (s) => s.internationalTrust.toFixed(1),
  },
];

const SOCIETY_STATS: StatConfig[] = [
  {
    key: 'approvalRating',
    name: 'Approval',
    icon: '🏛️',
    format: (s) => `${s.approvalRating.toFixed(1)}%`,
  },
  {
    key: 'povertyRate',
    name: 'Poverty',
    icon: '📉',
    inverted: true,
    format: (s) => `${s.povertyRate.toFixed(1)}%`,
  },
  {
    key: 'unemploymentRate',
    name: 'Unemployment',
    icon: '👔',
    inverted: true,
    format: (s) => `${s.unemploymentRate.toFixed(1)}%`,
  },
  {
    key: 'crimeRate',
    name: 'Crime',
    icon: '🚨',
    inverted: true,
    format: (s) => `${s.crimeRate.toFixed(1)}`,
  },
  {
    key: 'corruptionLevel',
    name: 'Corruption',
    icon: '⚖️',
    inverted: true,
    format: (s) => `${s.corruptionLevel.toFixed(1)}`,
  },
];

const INFRASTRUCTURE_STATS: StatConfig[] = [
  {
    key: 'educationIndex',
    name: 'Education',
    icon: '🎓',
    format: (s) => s.educationIndex.toFixed(1),
  },
  {
    key: 'healthcareIndex',
    name: 'Healthcare',
    icon: '🏥',
    format: (s) => s.healthcareIndex.toFixed(1),
  },
  {
    key: 'militaryStrength',
    name: 'Military',
    icon: '🛡️',
    format: (s) => s.militaryStrength.toFixed(1),
  },
  {
    key: 'environmentIndex',
    name: 'Environment',
    icon: '🌿',
    format: (s) => s.environmentIndex.toFixed(1),
  },
  {
    key: 'foreignRelationsIndex',
    name: 'Foreign Rel.',
    icon: '🌐',
    format: (s) => s.foreignRelationsIndex.toFixed(1),
  },
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

function getDeltaBadgeInfo(statKey: string, isInverted: boolean = false): { badgeText: string; badgeCls: string; deltas: StatDelta[] } {
  const deltas = state.recentDeltas.filter((d) => d.stat === statKey);
  const netDelta = deltas.reduce((sum, d) => sum + d.delta, 0);

  let badgeText = '● 0.0';
  let badgeCls = 'delta-neutral';

  if (statKey === 'debtCrisis') {
    if (state.debtCrisis) {
      badgeText = 'CRISIS';
      badgeCls = 'delta-crimson';
    } else {
      badgeText = 'STABLE';
      badgeCls = 'delta-teal';
    }
  } else if (statKey === 'gdp' || statKey === 'treasuryBudget' || statKey === 'nationalDebt') {
    if (Math.abs(netDelta) >= 100_000) {
      const isPos = netDelta > 0;
      const isFav = isInverted ? !isPos : isPos;
      const abs = Math.abs(netDelta);
      const sign = isPos ? '+' : '-';
      let valStr = `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs < 1_000_000_000) valStr = `${sign}$${(abs / 1_000_000).toFixed(0)}M`;
      badgeText = isPos ? `▲ ${valStr}` : `▼ ${valStr}`;
      badgeCls = isFav ? 'delta-teal' : 'delta-crimson';
    }
  } else if (statKey === 'gdpGrowthRate') {
    const rateDiff = netDelta * 100;
    if (Math.abs(rateDiff) >= 0.04) {
      const isPos = rateDiff > 0;
      const isFav = rateDiff > 0;
      const sign = isPos ? '+' : '';
      badgeText = isPos ? `▲ ${sign}${rateDiff.toFixed(1)}%` : `▼ ${rateDiff.toFixed(1)}%`;
      badgeCls = isFav ? 'delta-teal' : 'delta-crimson';
    }
  } else {
    if (netDelta > 0.04) {
      badgeText = `▲ +${netDelta.toFixed(1)}`;
      badgeCls = isInverted ? 'delta-crimson' : 'delta-teal';
    } else if (netDelta < -0.04) {
      badgeText = `▼ ${netDelta.toFixed(1)}`;
      badgeCls = isInverted ? 'delta-teal' : 'delta-crimson';
    }
  }

  return { badgeText, badgeCls, deltas };
}

function renderStatRows(container: HTMLElement, statConfigs: StatConfig[], isPanelLeft: boolean) {
  if (!container) return;

  container.innerHTML = statConfigs
    .map((cfg) => {
      const valText = cfg.format(state);
      const { badgeText, badgeCls } = getDeltaBadgeInfo(cfg.key, cfg.inverted);
      const isAlert =
        (cfg.key === 'debtCrisis' && state.debtCrisis) ||
        (cfg.key === 'treasuryBudget' && state.treasuryBudget < 0) ||
        (cfg.key === 'nationalDebt' && state.nationalDebt / state.gdp > 0.8) ||
        (cfg.key.includes('Trust') && Number(state[cfg.key as keyof NationState]) < 30);

      return `
        <div class="stat-compact-row ${isAlert ? 'alert-active' : ''}" data-stat-key="${cfg.key}" data-panel="${isPanelLeft ? 'left' : 'right'}">
          <div class="stat-compact-left">
            <span class="stat-compact-icon">${cfg.icon}</span>
            <span class="stat-compact-name">${cfg.name}</span>
          </div>
          <div class="stat-compact-right">
            <span class="stat-compact-val" style="${isAlert ? 'color: var(--cabinet-crimson); font-weight: bold;' : ''}">${valText}</span>
            <span class="delta-badge ${badgeCls}">${badgeText}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function showCausalTooltip(targetEl: HTMLElement) {
  const statKey = targetEl.getAttribute('data-stat-key');
  if (!statKey || !statTooltipFloater) return;

  const statName = STAT_NAME_MAP[statKey] || statKey;
  const isInverted = INVERTED_STATS.has(statKey);
  const { deltas } = getDeltaBadgeInfo(statKey, isInverted);

  let currentValText = '';
  if (statKey in state) {
    const rawVal = state[statKey as keyof NationState];
    if (typeof rawVal === 'number') {
      if (statKey === 'gdp' || statKey === 'treasuryBudget' || statKey === 'nationalDebt') {
        currentValText = formatCurrency(rawVal);
      } else if (statKey === 'gdpGrowthRate') {
        currentValText = `${rawVal >= 0 ? '+' : ''}${(rawVal * 100).toFixed(2)}%/yr`;
      } else if (statKey === 'approvalRating' || statKey === 'povertyRate' || statKey === 'unemploymentRate') {
        currentValText = `${rawVal.toFixed(1)}%`;
      } else {
        currentValText = rawVal.toFixed(1);
      }
    } else if (typeof rawVal === 'boolean') {
      currentValText = rawVal ? 'Active Crisis' : 'Solvent';
    }
  }

  let causalHtml = '';
  if (deltas.length === 0) {
    causalHtml = `<div class="floater-causal-item"><span class="causal-source">● Stable (No recent adjustments)</span></div>`;
  } else {
    causalHtml = deltas
      .map((d) => {
        const isPos = d.delta > 0;
        const isFavorable = isInverted ? !isPos : isPos;
        const deltaCls = isFavorable ? 'causal-delta-pos' : 'causal-delta-neg';
        const sign = isPos ? '+' : '';
        let deltaFormatted = `${sign}${d.delta.toFixed(1)}`;
        if (statKey === 'gdp' || statKey === 'treasuryBudget' || statKey === 'nationalDebt') {
          deltaFormatted = `${sign}${formatCurrency(Math.abs(d.delta))}`;
        } else if (statKey === 'gdpGrowthRate') {
          deltaFormatted = `${sign}${(Math.abs(d.delta) * 100).toFixed(1)}%`;
        }
        return `
          <div class="floater-causal-item">
            <span class="${deltaCls}">${deltaFormatted}</span>
            <span class="causal-source">from ${d.source}</span>
          </div>
        `;
      })
      .join('');
  }

  statTooltipFloater.innerHTML = `
    <div class="floater-header">
      <span>${statName}</span>
      <span>${currentValText}</span>
    </div>
    <div class="floater-causal-list">
      ${causalHtml}
    </div>
  `;

  const rect = targetEl.getBoundingClientRect();
  const panelType = targetEl.getAttribute('data-panel');
  const floaterWidth = 240;
  const floaterHeight = statTooltipFloater.offsetHeight || 100;

  let x = 0;
  if (panelType === 'left') {
    x = rect.right + 10;
  } else {
    x = rect.left - floaterWidth - 10;
  }

  let y = rect.top + rect.height / 2 - floaterHeight / 2;
  const maxY = window.innerHeight - floaterHeight - 16;
  if (y < 12) y = 12;
  if (y > maxY) y = maxY;

  statTooltipFloater.style.left = `${Math.max(10, x)}px`;
  statTooltipFloater.style.top = `${y}px`;
  statTooltipFloater.classList.add('visible');
}

function hideCausalTooltip() {
  if (statTooltipFloater) {
    statTooltipFloater.classList.remove('visible');
  }
}

function attachTooltipEventListeners() {
  const rows = document.querySelectorAll('.stat-compact-row');
  rows.forEach((row) => {
    row.addEventListener('mouseenter', () => showCausalTooltip(row as HTMLElement));
    row.addEventListener('mouseleave', hideCausalTooltip);
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      showCausalTooltip(row as HTMLElement);
    });
  });
}

function renderStats() {
  // 1. Left Panel: Economy & Faction Trust
  renderStatRows(economyStatsList, ECONOMY_STATS, true);
  renderStatRows(trustStatsList, FACTION_TRUST_STATS, true);

  // 2. Right Panel: Society & Infrastructure
  renderStatRows(societyStatsList, SOCIETY_STATS, false);
  renderStatRows(infrastructureStatsList, INFRASTRUCTURE_STATS, false);

  // 3. Right Panel: Pending Delayed Consequences
  if (pendingEffectsList) {
    pendingEffectsList.innerHTML = '';
    if (state.pendingEffects.length === 0) {
      pendingEffectsList.innerHTML = '<div class="empty-placeholder">No consequences scheduled for future turns.</div>';
    } else {
      state.pendingEffects.forEach((effect) => {
        const turnsRemaining = effect.targetTurn - state.turn;
        const timingText =
          turnsRemaining <= 0
            ? 'Resolving this turn'
            : turnsRemaining === 1
            ? `In 1 turn (T${effect.targetTurn})`
            : `In ${turnsRemaining} turns (T${effect.targetTurn})`;

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

        const tagText = modifiedStats.length > 0 ? `[${modifiedStats.join(', ')}]` : '[Pending Outcome]';

        const itemEl = document.createElement('div');
        itemEl.className = 'pending-compact-card';
        itemEl.innerHTML = `
          <div class="pending-compact-header">
            <span>⏱️ ${timingText}</span>
            <span style="font-family: var(--font-mono); font-size: 10px;">${tagText}</span>
          </div>
          <div class="pending-compact-desc">${effect.description}</div>
        `;
        pendingEffectsList.appendChild(itemEl);
      });
    }
  }

  // Attach hover and click listeners for the causal tooltips
  attachTooltipEventListeners();
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

  const dec = (currentDecision && availableDecisions.some((d) => d.id === currentDecision?.id))
    ? currentDecision
    : availableDecisions[Math.floor(Math.random() * availableDecisions.length)];

  currentDecision = dec;
  decisionTitle.textContent = dec.title;
  decisionDesc.textContent = dec.description;

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

    // Condense to top 2-3 significant effects, adding a [+] hover tooltip indicator for other effects
    let hintBadgesHtml = '';
    const MAX_VISIBLE_HINTS = 2;

    if (hints.length > 0) {
      if (hints.length <= MAX_VISIBLE_HINTS + 1) {
        hintBadgesHtml = `<div class="option-hints-row">${hints.map((h) => `<span class="hint-badge ${h.className}">${h.text}</span>`).join('')}</div>`;
      } else {
        const visibleHints = hints.slice(0, MAX_VISIBLE_HINTS);
        const overflowHints = hints.slice(MAX_VISIBLE_HINTS);

        const visibleHtml = visibleHints.map((h) => `<span class="hint-badge ${h.className}">${h.text}</span>`).join('');
        const overflowBadges = overflowHints.map((h) => `<span class="hint-badge ${h.className}">${h.text}</span>`).join('');

        const overflowHtml = `
          <div class="hint-more-wrapper">
            <span class="hint-badge hint-more-badge">[+${overflowHints.length} more]</span>
            <div class="hint-more-tooltip">
              ${overflowBadges}
            </div>
          </div>
        `;

        hintBadgesHtml = `<div class="option-hints-row">${visibleHtml}${overflowHtml}</div>`;
      }
    }

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

function formatLogStatValue(stat: string, val: number): string {
  if (stat === 'treasuryBudget' || stat === 'nationalDebt' || stat === 'gdp') {
    return formatCurrency(val);
  }
  if (stat === 'gdpGrowthRate') {
    return `${(val * 100).toFixed(1)}%`;
  }
  if (stat === 'povertyRate' || stat === 'unemploymentRate' || stat === 'approvalRating') {
    return `${val.toFixed(1)}%`;
  }
  if (stat === 'population') {
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
    return `${val.toFixed(0)}`;
  }
  return val.toFixed(1);
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
  if (trimmed.startsWith('[Engine]')) {
    const engineContent = trimmed.replace(/^\[Engine\]\s*/, '');
    const match = engineContent.match(/^([a-zA-Z]+) changed from ([\d.-]+) to ([\d.-]+)$/);
    if (match) {
      const stat = match[1];
      const fromVal = parseFloat(match[2]);
      const toVal = parseFloat(match[3]);
      const name = SHORT_STAT_NAME_MAP[stat] || STAT_NAME_MAP[stat] || stat;
      const formattedFrom = formatLogStatValue(stat, fromVal);
      const formattedTo = formatLogStatValue(stat, toVal);
      return { category: 'DRIFT', text: `${name} changed from ${formattedFrom} to ${formattedTo}` };
    }
    return { category: 'DRIFT', text: engineContent };
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
    if (logPreview) logPreview.innerHTML = '<span style="color: #94A3B8; font-style: italic;">No briefing dispatches recorded yet.</span>';
    if (logPanel) logPanel.innerHTML = '<div class="empty-placeholder" style="color: #94A3B8; padding: 12px 0;">No briefing dispatches recorded yet.</div>';
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

  // 1. Render Preview bar (1-2 most recent entries)
  if (logPreview) {
    const allEntries: { category: 'DECISION' | 'EVENT' | 'PENDING' | 'DRIFT' | 'SYSTEM'; text: string }[] = [];
    for (const g of groups) {
      allEntries.push(...g.entries);
    }
    const recent = allEntries.slice(-2).reverse();
    if (recent.length === 0) {
      logPreview.innerHTML = '<span style="color: #94A3B8; font-style: italic;">No briefing dispatches recorded yet.</span>';
    } else {
      logPreview.innerHTML = recent
        .map((entry) => {
          let flagCls = 'flag-system';
          if (entry.category === 'DECISION') flagCls = 'flag-decision';
          else if (entry.category === 'EVENT') flagCls = 'flag-event';
          else if (entry.category === 'PENDING') flagCls = 'flag-pending';
          else if (entry.category === 'DRIFT') flagCls = 'flag-drift';

          return `<span style="display: inline-flex; align-items: center; gap: 5px; margin-right: 12px;"><span class="log-flag ${flagCls}">${entry.category}</span> ${entry.text}</span>`;
        })
        .join(' ');
    }
  }

  // 2. Render Full scrollable chronological list in logPanel (newest turn at top)
  if (logPanel) {
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
}

function toggleLogPanel() {
  isLogExpanded = !isLogExpanded;
  if (bottomLogStrip) {
    bottomLogStrip.classList.toggle('expanded', isLogExpanded);
  }
  if (toggleLogBtn) {
    toggleLogBtn.textContent = isLogExpanded ? '▼ Collapse Feed' : '▲ Expand Feed';
  }
}

function render() {
  turnDisplay.textContent = `Turn ${state.turn}`;
  if (nationViewContainer) {
    nationViewContainer.innerHTML = renderNationView(state);
  }
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

async function recordGameOverHistory() {
  if (historyRecorded || !state.gameOver) return;
  historyRecorded = true;

  const summary: RunSummary = {
    scenario_id: currentScenario,
    turns_survived: state.turn,
    result: state.gameResult === 'win' ? 'win' : 'loss',
    loss_reason: state.gameOverReason || 'Administration concluded.',
  };

  try {
    await recordCompletedRun(summary);
  } catch (err) {
    console.error('Failed to record completed run:', err);
  }

  await renderHistoryTable();
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

async function renderHistoryTable() {
  let history: RunSummary[] = [];
  try {
    history = await fetchRunHistory();
  } catch (err) {
    console.error('Failed to fetch run history:', err);
    const raw = localStorage.getItem('nationstate_past_runs');
    if (raw) {
      try {
        history = JSON.parse(raw);
      } catch (e) {
        console.error('Failed parsing local run summaries:', e);
      }
    }
  }

  if (history.length === 0) {
    historyTable.style.display = 'none';
    noHistoryMsg.style.display = 'block';
    return;
  }

  historyTable.style.display = 'table';
  noHistoryMsg.style.display = 'none';
  historyTableBody.innerHTML = history
    .map((item) => {
      const isWin = item.result === 'win';
      const badgeClass = isWin ? 'result-badge win' : 'result-badge lose';
      const badgeText = isWin ? 'WIN' : 'LOSE';
      const meta = scenarioMetadata[item.scenario_id as ScenarioKey];
      const scenarioName = meta ? meta.name : item.scenario_id;
      const dateStr = item.ended_at ? new Date(item.ended_at).toLocaleString() : 'N/A';
      return `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${scenarioName}</strong></td>
          <td>Turn ${item.turns_survived}</td>
          <td><span class="${badgeClass}">${badgeText}</span></td>
          <td style="font-size: 11.5px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.loss_reason || ''}">
            ${item.loss_reason || 'N/A'}
          </td>
        </tr>
      `;
    })
    .join('');
}

function updateSyncStatusPill(status: 'local' | 'synced' | 'syncing') {
  if (!syncStatusPill) return;
  syncStatusPill.className = `sync-status-pill ${status}`;
  if (status === 'local') {
    syncStatusPill.textContent = 'Saved Locally';
  } else if (status === 'synced') {
    syncStatusPill.textContent = 'Cloud Synced';
  } else {
    syncStatusPill.textContent = 'Syncing...';
  }
}

async function saveGame() {
  const decisionIndex = currentDecision ? decisions.findIndex((d) => d.id === currentDecision?.id) : -1;
  const saveData: GameState = {
    scenarioId: currentScenario,
    state,
    decisionIndex,
    turnLogsHistory,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  
  updateSyncStatusPill('syncing');
  try {
    const res = await saveGameState(saveData);
    if (res && res.cloudSynced) {
      updateSyncStatusPill('synced');
    } else {
      updateSyncStatusPill('local');
    }
  } catch (err) {
    console.error('Failed to sync save state to cloud:', err);
    updateSyncStatusPill('local');
  }
  updateSaveControls();
}

async function loadGame(): Promise<boolean> {
  let saveData: GameState | null = null;
  updateSyncStatusPill('syncing');
  try {
    saveData = await loadSave(currentScenario);
  } catch (err) {
    console.error('Cloud load failed, trying local cache fallback:', err);
  }

  if (!saveData) {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        saveData = JSON.parse(raw);
      } catch (e) {
        console.error('Failed parsing legacy save:', e);
      }
    }
  }

  if (!saveData || !saveData.state) {
    updateSyncStatusPill('local');
    return false;
  }

  try {
    state = saveData.state;
    turnLogsHistory.length = 0;
    if (Array.isArray(saveData.turnLogsHistory)) {
      turnLogsHistory.push(...saveData.turnLogsHistory);
    }
    
    const scId = saveData.scenarioId || (saveData as any).scenario;
    if (scId && scenarios[scId as ScenarioKey]) {
      currentScenario = scId as ScenarioKey;
      scenarioSelect.value = currentScenario;
      if (mobileScenarioSelect) mobileScenarioSelect.value = currentScenario;
    }

    if (typeof saveData.decisionIndex === 'number' && saveData.decisionIndex >= 0 && decisions[saveData.decisionIndex]) {
      currentDecision = decisions[saveData.decisionIndex];
    } else {
      currentDecision = undefined;
    }

    const user = await getCurrentUser();
    updateSyncStatusPill(user ? 'synced' : 'local');

    historyRecorded = !!state.gameOver;
    render();
    updateSaveControls();
    return true;
  } catch (e) {
    console.error('Failed to load save state:', e);
    updateSyncStatusPill('local');
    return false;
  }
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(`nationstate_active_save_${currentScenario}`);
  updateSaveControls();
}

function updateHomeContinueButton() {
  let hasSave = localStorage.getItem(SAVE_KEY) !== null;
  let activeSaveKey = SAVE_KEY;

  if (!hasSave) {
    for (const key of Object.keys(scenarios)) {
      const k = `nationstate_active_save_${key}`;
      if (localStorage.getItem(k) !== null) {
        hasSave = true;
        activeSaveKey = k;
        break;
      }
    }
  }

  const raw = localStorage.getItem(activeSaveKey);
  if (!raw) {
    homeContinueBtn.disabled = true;
    if (homeContinueText) homeContinueText.textContent = 'Continue Game (No Active Save)';
    return;
  }
  try {
    const saveData = JSON.parse(raw);
    const sKey = (saveData.scenarioId as ScenarioKey) || (saveData.scenario as ScenarioKey) || 'default';
    const sName = scenarioMetadata[sKey] ? scenarioMetadata[sKey].name : 'Golden Era';
    const turn = saveData.state?.turn || 1;
    homeContinueBtn.disabled = false;
    if (homeContinueText) homeContinueText.textContent = `Continue Game (Turn ${turn} - ${sName})`;
  } catch (e) {
    homeContinueBtn.disabled = true;
    if (homeContinueText) homeContinueText.textContent = 'Continue Game (Corrupted Save)';
  }
}

function showHomeScreen() {
  if (isAutoplayRunning) stopAutoplay();
  homeScreen.style.display = 'flex';
  homeMainView.style.display = 'flex';
  homeScenarioView.style.display = 'none';
  updateHomeContinueButton();
  updateSaveControls();
}

function hideHomeScreen() {
  homeScreen.style.display = 'none';
}

function selectHomeScenario(scenarioKey: ScenarioKey) {
  selectedHomeScenario = scenarioKey;
  homeScenarioCards.forEach((card) => {
    if (card.getAttribute('data-scenario') === scenarioKey) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

function updateSaveControls() {
  const localKey = `nationstate_active_save_${currentScenario}`;
  const hasSave = localStorage.getItem(localKey) !== null || localStorage.getItem(SAVE_KEY) !== null;
  resumeBtn.style.display = hasSave ? 'inline-flex' : 'none';
  loadBtn.disabled = !hasSave;
  deleteSaveBtn.disabled = !hasSave;
  if (mobileLoadBtn) mobileLoadBtn.disabled = !hasSave;
  if (mobileDeleteSaveBtn) mobileDeleteSaveBtn.disabled = !hasSave;
  updateHomeContinueButton();
}

function handleTurn(chosenOption?: DecisionOption, decisionId?: string) {
  const previousTurn = state.turn;
  state = resolveTurn(state, chosenOption, decisionId);
  currentDecision = undefined;

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

  hideCausalTooltip();
  render();
  saveGame();
}

function resetGameToScenario(scenarioKey: ScenarioKey) {
  if (isAutoplayRunning) stopAutoplay();
  currentScenario = scenarioKey;
  scenarioSelect.value = scenarioKey;
  if (mobileScenarioSelect) mobileScenarioSelect.value = scenarioKey;
  state = getScenarioInitialState(scenarioKey);
  currentDecision = undefined;
  historyRecorded = false;
  turnLogsHistory.length = 0;

  const meta = scenarioMetadata[currentScenario];
  const scenarioName = meta ? meta.name : currentScenario;
  turnLogsHistory.push(`=== Scenario Selected: ${scenarioName} ===`);
  turnLogsHistory.push(`Turn 1 Initialized.`);

  hideCausalTooltip();
  setMobileTab('desk');
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

// Event Listeners
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
  if (mobileScenarioSelect) mobileScenarioSelect.value = selected;
  resetGameToScenario(selected);
});

// Mobile Actions Toggle & Dropdown Drawer
if (mobileActionsToggleBtn && mobileActionsDrawer) {
  mobileActionsToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = mobileActionsDrawer.classList.toggle('open');
    if (isOpen && mobileScenarioSelect) {
      mobileScenarioSelect.value = currentScenario;
    }
  });

  document.addEventListener('click', (e) => {
    if (mobileActionsDrawer.classList.contains('open')) {
      const target = e.target as HTMLElement;
      if (!mobileActionsDrawer.contains(target) && target !== mobileActionsToggleBtn && !mobileActionsToggleBtn.contains(target)) {
        mobileActionsDrawer.classList.remove('open');
      }
    }
  });
}

if (mobileScenarioSelect) {
  mobileScenarioSelect.addEventListener('change', () => {
    const selected = mobileScenarioSelect.value as ScenarioKey;
    scenarioSelect.value = selected;
    resetGameToScenario(selected);
    if (mobileActionsDrawer) mobileActionsDrawer.classList.remove('open');
  });
}

if (mobileSaveBtn) {
  mobileSaveBtn.addEventListener('click', () => {
    saveGame();
    turnLogsHistory.push('[Save/Load] Game saved successfully.');
    renderLogs();
    updateSaveControls();
    if (mobileActionsDrawer) mobileActionsDrawer.classList.remove('open');
  });
}

if (mobileLoadBtn) {
  mobileLoadBtn.addEventListener('click', async () => {
    if (isAutoplayRunning) stopAutoplay();
    if (await loadGame()) {
      turnLogsHistory.push('[Save/Load] Game loaded successfully.');
      renderLogs();
      updateSaveControls();
    }
    if (mobileActionsDrawer) mobileActionsDrawer.classList.remove('open');
  });
}

if (mobileDeleteSaveBtn) {
  mobileDeleteSaveBtn.addEventListener('click', () => {
    deleteSave();
    turnLogsHistory.push('[Save/Load] Saved game data removed.');
    renderLogs();
    updateSaveControls();
    if (mobileActionsDrawer) mobileActionsDrawer.classList.remove('open');
  });
}

if (mobilePastRunsBtn) {
  mobilePastRunsBtn.addEventListener('click', () => {
    renderHistoryTable();
    historyModal.style.display = 'flex';
    if (mobileActionsDrawer) mobileActionsDrawer.classList.remove('open');
  });
}

// Save / Load Controls
resumeBtn.addEventListener('click', async () => {
  if (isAutoplayRunning) stopAutoplay();
  if (await loadGame()) {
    turnLogsHistory.push('[Save/Load] Resumed saved game.');
    renderLogs();
  }
});

saveBtn.addEventListener('click', () => {
  saveGame();
  turnLogsHistory.push('[Save/Load] Game saved successfully.');
  renderLogs();
});

loadBtn.addEventListener('click', async () => {
  if (isAutoplayRunning) stopAutoplay();
  if (await loadGame()) {
    turnLogsHistory.push('[Save/Load] Game loaded successfully.');
    renderLogs();
  }
});

deleteSaveBtn.addEventListener('click', () => {
  deleteSave();
  turnLogsHistory.push('[Save/Load] Saved game data removed.');
  renderLogs();
});

// Past Runs Modal
pastRunsBtn.addEventListener('click', () => {
  renderHistoryTable();
  historyModal.style.display = 'flex';
});

closeHistoryBtn.addEventListener('click', () => {
  historyModal.style.display = 'none';
});

historyModal.addEventListener('click', (e) => {
  if (e.target === historyModal) {
    historyModal.style.display = 'none';
  }
});

// How to Play Modal
closeHowToPlayBtn.addEventListener('click', () => {
  howToPlayModal.style.display = 'none';
});

closeHowToPlayFooterBtn.addEventListener('click', () => {
  howToPlayModal.style.display = 'none';
});

howToPlayModal.addEventListener('click', (e) => {
  if (e.target === howToPlayModal) {
    howToPlayModal.style.display = 'none';
  }
});

// Home Screen Event Listeners
homeNewGameBtn.addEventListener('click', () => {
  homeMainView.style.display = 'none';
  homeScenarioView.style.display = 'flex';
  selectHomeScenario(selectedHomeScenario);
});

homeBackBtn.addEventListener('click', () => {
  homeScenarioView.style.display = 'none';
  homeMainView.style.display = 'flex';
});

homeScenarioCards.forEach((card) => {
  card.addEventListener('click', () => {
    const key = card.getAttribute('data-scenario') as ScenarioKey;
    if (key) {
      selectHomeScenario(key);
    }
  });
});

homeStartPresidencyBtn.addEventListener('click', () => {
  resetGameToScenario(selectedHomeScenario);
  hideHomeScreen();
});

homeContinueBtn.addEventListener('click', async () => {
  if (await loadGame()) {
    hideHomeScreen();
    turnLogsHistory.push('[Save/Load] Resumed saved game from Title Screen.');
    renderLogs();
  }
});

homePastRunsBtn.addEventListener('click', () => {
  renderHistoryTable();
  historyModal.style.display = 'flex';
});

homeHowToPlayBtn.addEventListener('click', () => {
  howToPlayModal.style.display = 'flex';
});

// ========================================================
// Tutorial / Executive Walkthrough Flow Controller
// ========================================================
interface TutorialStep {
  title: string;
  stepNumber: number;
  totalSteps: number;
  highlightSelectors: string[];
  description: string;
  tip?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Executive Memorandum (Immediate & Delayed Effects)',
    stepNumber: 1,
    totalSteps: 3,
    highlightSelectors: ['#decision-container'],
    description:
      'Each turn, an Executive Memorandum dispatch arrives on your desk presenting a national issue. Every directive lists immediate metric adjustments via color-coded badges, as well as delayed systemic consequences marked with clock tags (⏱️) that incubate across 1–3 future turns before taking effect.',
    tip: '💡 Strategy: Always review the clock tags on options; delayed fallout often impacts treasury or public trust turns after enactment.',
  },
  {
    title: 'Faction Trust Blocs & Coup Thresholds',
    stepNumber: 2,
    totalSteps: 3,
    highlightSelectors: ['#trust-stats-list'],
    description:
      'Beyond headline economic indicators, your administration rests upon four critical faction pillars: Military, Business, Public, and International Trust. Faction confidence serves as a critical survival threshold—if any faction trust metric falls below 20%, existential crises (military coup d\'état, capital flight, general strikes, or sovereign sanctions) can trigger instantly regardless of GDP.',
    tip: '⚠️ Warning: Neglecting any single faction to boost headline numbers can swiftly end your presidency in a coup.',
  },
  {
    title: 'Dynamic Cabinet Dockets & Gated Crises',
    stepNumber: 3,
    totalSteps: 3,
    highlightSelectors: ['.side-panel'],
    description:
      'Your cabinet docket is dynamic and reacts directly to national conditions. Gated cards (such as hyperinflation, debt defaults, and corruption scandals) unlock dynamically when national metrics cross critical danger zones. Resolving one-time crises permanently removes them from rotation, while standard policy memorandums recur as circumstances evolve.',
    tip: '🏆 Mandate: Maintain solvency and coalition stability across 20 turns to establish an enduring legacy in the Past Runs archive.',
  },
];

let currentTutorialStep = 0;
let isTutorialActive = false;

function clearSpotlightHighlights() {
  document.querySelectorAll('.spotlight-highlight').forEach((el) => {
    el.classList.remove('spotlight-highlight');
  });
}

function showTutorialStep(stepIndex: number) {
  if (stepIndex < 0 || stepIndex >= TUTORIAL_STEPS.length) {
    endTutorial();
    return;
  }

  if (window.innerWidth <= 768) {
    if (stepIndex === 0) {
      setMobileTab('desk');
    } else if (stepIndex === 1 || stepIndex === 2) {
      setMobileTab('stats');
    }
  }

  currentTutorialStep = stepIndex;
  const step = TUTORIAL_STEPS[stepIndex];

  clearSpotlightHighlights();
  step.highlightSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.classList.add('spotlight-highlight');
    });
  });

  if (tutorialStepCounter) tutorialStepCounter.textContent = `Step ${step.stepNumber} of ${step.totalSteps}`;
  if (tutorialStepTitle) tutorialStepTitle.textContent = step.title;
  if (tutorialStepDesc) tutorialStepDesc.textContent = step.description;
  if (tutorialStepTip) {
    tutorialStepTip.textContent = step.tip || '';
    tutorialStepTip.style.display = step.tip ? 'block' : 'none';
  }

  if (tutorialPrevBtn) {
    tutorialPrevBtn.style.display = stepIndex > 0 ? 'inline-flex' : 'none';
  }
  if (tutorialNextBtn) {
    tutorialNextBtn.textContent = stepIndex === step.totalSteps - 1 ? 'Finish Tour ✓' : 'Next →';
  }

  if (tutorialOverlay) {
    tutorialOverlay.style.display = 'flex';
  }
}

function startTutorial() {
  hideHomeScreen();
  if (howToPlayModal) howToPlayModal.style.display = 'none';
  if (historyModal) historyModal.style.display = 'none';

  isTutorialActive = true;
  showTutorialStep(0);
  turnLogsHistory.push('[Briefing] Executive tutorial handbook initiated.');
  renderLogs();
}

function endTutorial() {
  isTutorialActive = false;
  currentTutorialStep = 0;
  clearSpotlightHighlights();
  if (tutorialOverlay) {
    tutorialOverlay.style.display = 'none';
  }
}

// Tutorial Tour Listeners
if (homeStartTourBtn) {
  homeStartTourBtn.addEventListener('click', () => {
    startTutorial();
  });
}

if (howToPlayTourBtn) {
  howToPlayTourBtn.addEventListener('click', () => {
    startTutorial();
  });
}

if (tutorialSkipBtn) {
  tutorialSkipBtn.addEventListener('click', () => {
    endTutorial();
  });
}

if (tutorialNextBtn) {
  tutorialNextBtn.addEventListener('click', () => {
    if (currentTutorialStep < TUTORIAL_STEPS.length - 1) {
      showTutorialStep(currentTutorialStep + 1);
    } else {
      endTutorial();
    }
  });
}

if (tutorialPrevBtn) {
  tutorialPrevBtn.addEventListener('click', () => {
    if (currentTutorialStep > 0) {
      showTutorialStep(currentTutorialStep - 1);
    }
  });
}

if (menuHomeBtn) {
  menuHomeBtn.addEventListener('click', () => {
    showHomeScreen();
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (isTutorialActive) {
      endTutorial();
    }
    historyModal.style.display = 'none';
    howToPlayModal.style.display = 'none';
    hideCausalTooltip();
  }
});

document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.stat-compact-row')) {
    hideCausalTooltip();
  }
});

clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistoryTable();
});

// Bottom Teletype Strip toggle
logStripBar.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).tagName !== 'BUTTON') {
    toggleLogPanel();
  }
});
toggleLogBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleLogPanel();
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
  gameOverOverlay.style.display = 'none';
  showHomeScreen();
});

// Mobile Bottom Navigation Tab event listeners
if (mobileTabDesk) {
  mobileTabDesk.addEventListener('click', () => {
    setMobileTab('desk');
  });
}

if (mobileTabStats) {
  mobileTabStats.addEventListener('click', () => {
    setMobileTab('stats');
  });
}

if (mobileTabBriefing) {
  mobileTabBriefing.addEventListener('click', () => {
    setMobileTab('briefing');
  });
}

window.addEventListener('resize', () => {
  setMobileTab(currentMobileTab);
});

// Startup Initialization
const officeBg = document.getElementById('office-bg-container');
if (officeBg) {
  officeBg.innerHTML = getOfficeBgSvg();
}

setMobileTab('desk');
updateSaveControls();
renderHistoryTable();
updateHomeContinueButton();

turnLogsHistory.push(`=== Game Initialized (Scenario: ${scenarioMetadata[currentScenario].name}) ===`);
render();

// ========================================================
// Supabase Authentication & Real-Time Cloud Sync UI Wiring
// ========================================================

// Toggle user dropdown on desktop
if (authUserMenu && authDropdown) {
  authUserMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    authDropdown.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (authUserMenu && !authUserMenu.contains(target)) {
      authDropdown.classList.remove('open');
    }
  });
}

// Google Sign-In Actions
if (authLoginBtn) {
  authLoginBtn.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  });
}
if (mobileLoginBtn) {
  mobileLoginBtn.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Mobile Sign-in failed:', err);
    }
  });
}
if (homeLoginBtn) {
  homeLoginBtn.addEventListener('click', async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Home Sign-in failed:', err);
    }
  });
}

// Sign-Out Actions
if (authLogoutBtn) {
  authLogoutBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await supabaseSignOut();
      authDropdown?.classList.remove('open');
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  });
}
if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener('click', async () => {
    try {
      await supabaseSignOut();
      if (mobileActionsDrawer) mobileActionsDrawer.classList.remove('open');
    } catch (err) {
      console.error('Mobile Sign-out failed:', err);
    }
  });
}
if (homeLogoutBtn) {
  homeLogoutBtn.addEventListener('click', async () => {
    try {
      await supabaseSignOut();
    } catch (err) {
      console.error('Home Sign-out failed:', err);
    }
  });
}

// Auth State Shift Listener
onAuthStateChange(async (user) => {
  if (user) {
    // 1. Update Desktop Header UI
    if (authLoginBtn) authLoginBtn.style.display = 'none';
    if (authUserMenu) authUserMenu.style.display = 'flex';
    if (authAvatar) {
      authAvatar.src = user.user_metadata.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    }
    if (authUserName) {
      authUserName.textContent = user.user_metadata.full_name || user.email || 'User';
    }

    // 2. Update Mobile Drawer UI
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
    if (mobileUserInfo) mobileUserInfo.style.display = 'flex';
    if (mobileAuthAvatar) {
      mobileAuthAvatar.src = user.user_metadata.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    }
    if (mobileAuthUserName) {
      mobileAuthUserName.textContent = user.user_metadata.full_name || user.email || 'User';
    }

    // 3. Update Home Screen UI
    if (homeLoginBtn) homeLoginBtn.style.display = 'none';
    if (homeProfileCard) homeProfileCard.style.display = 'flex';
    if (homeAvatar) {
      homeAvatar.src = user.user_metadata.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    }
    if (homeUserName) {
      homeUserName.textContent = user.user_metadata.full_name || user.email || 'User';
    }

    updateSyncStatusPill('synced');
    
    // 4. Attempt to fetch active cloud save to sync state
    try {
      const cloudSaveState = await loadSave(currentScenario);
      if (cloudSaveState) {
        state = cloudSaveState.state;
        turnLogsHistory.length = 0;
        if (Array.isArray(cloudSaveState.turnLogsHistory)) {
          turnLogsHistory.push(...cloudSaveState.turnLogsHistory);
        }
        render();
      }
    } catch (e) {
      console.error('Failed to sync cloud state on auth change:', e);
    }
  } else {
    // 1. Reset Desktop Header UI
    if (authLoginBtn) authLoginBtn.style.display = 'inline-flex';
    if (authUserMenu) authUserMenu.style.display = 'none';
    if (authAvatar) authAvatar.src = '';
    if (authUserName) authUserName.textContent = 'User';

    // 2. Reset Mobile Drawer UI
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
    if (mobileUserInfo) mobileUserInfo.style.display = 'none';
    if (mobileAuthAvatar) mobileAuthAvatar.src = '';
    if (mobileAuthUserName) mobileAuthUserName.textContent = 'User';

    // 3. Reset Home Screen UI
    if (homeLoginBtn) homeLoginBtn.style.display = 'block';
    if (homeProfileCard) homeProfileCard.style.display = 'none';
    if (homeAvatar) homeAvatar.src = '';
    if (homeUserName) homeUserName.textContent = 'User';

    updateSyncStatusPill('local');
  }

  // Refresh controls & table elements dynamically
  updateSaveControls();
  renderHistoryTable();
});
