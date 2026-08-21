import { GameState, RunSummary } from '../types/auth';
import { masterAchievements } from '../lib/achievements';
import { ScenarioKey, scenarioMetadata } from '../scenarios';

/**
 * Helper to clamp values between 0 and 100.
 */
function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Formats large budget/currency values.
 */
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toLocaleString()}`;
}

/**
 * Evaluates performance metrics, grades, archetypes, and compiles the post-game card HTML markup defensively.
 * Supports both live active gameplay and historical read-only runs inspection.
 */
export function renderReportCardModal(
  gameState: GameState | undefined | null,
  isWin: boolean,
  unlockedBadgeIds: string[] | undefined | null,
  historicalRun?: RunSummary | null
): string {
  const isArchive = !!historicalRun;
  const state = isArchive ? historicalRun?.finalStats : gameState?.state;
  const badgeIds = isArchive ? (historicalRun?.badgesEarned || []) : (unlockedBadgeIds || []);
  const winState = isArchive ? (historicalRun?.result === 'win') : isWin;

  // 1. Calculate the 6 Composite Health Scores (matching nation_view.ts logic defensively)
  const gdpVal = state?.gdp ?? 1;
  const debtVal = state?.nationalDebt ?? 0;
  const growthRate = state?.gdpGrowthRate ?? 0;
  const treasuryVal = state?.treasuryBudget ?? 0;

  const debtRatio = debtVal / Math.max(1, gdpVal);
  const debtScore = clamp(100 - debtRatio * 80);
  const growthScore = clamp(50 + growthRate * 1000);
  
  const treasuryScore = treasuryVal >= 0
    ? clamp(50 + (treasuryVal / 50_000_000_000) * 50)
    : clamp(50 + (treasuryVal / 20_000_000_000) * 50);
  
  let fiscalScore = Math.round(0.4 * debtScore + 0.3 * growthScore + 0.3 * treasuryScore);
  if (state?.debtCrisis) {
    fiscalScore = Math.min(fiscalScore, 30);
  }
  fiscalScore = clamp(fiscalScore);

  const crimeVal = state?.crimeRate ?? 0;
  const militaryStr = state?.militaryStrength ?? 0;
  const crimeScore = clamp(100 - crimeVal);
  const securityScore = clamp(Math.round(0.5 * crimeScore + 0.5 * militaryStr));

  const povertyVal = state?.povertyRate ?? 0;
  const healthIdx = state?.healthcareIndex ?? 0;
  const eduIdx = state?.educationIndex ?? 0;
  const povertyScore = clamp(100 - povertyVal * 2.5);
  const welfareScore = clamp(Math.round((healthIdx + eduIdx + povertyScore) / 3));

  const ecologyScore = clamp(Math.round(state?.environmentIndex ?? 0));

  const milTrust = state?.militaryTrust ?? 0;
  const bizTrust = state?.businessTrust ?? 0;
  const pubTrust = state?.publicTrust ?? 0;
  const intlTrust = state?.internationalTrust ?? 0;
  const factionsScore = clamp(Math.round((milTrust + bizTrust + pubTrust + intlTrust) / 4));

  const diplomacyScore = clamp(Math.round(state?.foreignRelationsIndex ?? 0));

  const avgScore = (fiscalScore + securityScore + welfareScore + ecologyScore + factionsScore + diplomacyScore) / 6;

  // 2. Adjust grade by survival turns (survival penalizes early collapse)
  const turnsSurvived = state?.turn ?? 1;
  const survivalRatio = Math.min(1.0, turnsSurvived / 20.0);
  const finalGradeScore = avgScore * (0.4 + 0.6 * survivalRatio);

  // Determine Letter Grade
  let letterGrade: string = isArchive ? (historicalRun?.grade || 'F') : 'F';
  if (!isArchive) {
    let computedLetter: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (finalGradeScore >= 85) computedLetter = 'S';
    else if (finalGradeScore >= 70) computedLetter = 'A';
    else if (finalGradeScore >= 55) computedLetter = 'B';
    else if (finalGradeScore >= 40) computedLetter = 'C';
    else if (finalGradeScore >= 25) computedLetter = 'D';
    letterGrade = computedLetter;
  }

  // 3. Determine Governance Archetype Title
  let archetypeTitle = isArchive ? (historicalRun?.performanceTitle || 'Deposed Statesman') : 'Deposed Statesman';
  if (!isArchive) {
    const environmentIdx = state?.environmentIndex ?? 0;
    if (winState) {
      if (gdpVal >= 110_000_000_000 || treasuryVal >= 40_000_000_000) {
        archetypeTitle = 'Technocratic Capitalist';
      } else if (environmentIdx >= 70 && welfareScore >= 70) {
        archetypeTitle = 'Eco-Social Reformer';
      } else if (pubTrust < 35 && militaryStr >= 70) {
        archetypeTitle = 'Authoritarian Regent';
      } else {
        archetypeTitle = 'Centrist Pragmatist';
      }
    } else {
      // Loss fallback archetypes
      const overReason = state?.gameOverReason ?? '';
      if (overReason.includes('Coup')) {
        archetypeTitle = 'Deposed Statesman';
      } else if (overReason.includes('Economic')) {
        archetypeTitle = 'Bankrupt Regulator';
      } else {
        archetypeTitle = 'Failed Executive';
      }
    }
  }

  // 4. Generate Badge List
  const matchingBadges = masterAchievements.filter((ach) => badgeIds.includes(ach.id));
  const badgesHtml = matchingBadges.length > 0
    ? matchingBadges
        .map(
          (ach) => `
        <div class="report-badge-item" title="${ach.description ?? ''}">
          <span class="report-badge-icon">${ach.icon ?? ''}</span>
          <div class="report-badge-info">
            <span class="report-badge-title">${ach.title ?? ''}</span>
            <span class="report-badge-cat">${(ach.category ?? '').toUpperCase()}</span>
          </div>
        </div>
      `
        )
        .join('')
    : `
      <div style="grid-column: 1/-1; text-align: center; font-size: 12px; color: var(--bureaucracy-dark); padding: 12px 0;">
        No new badges unlocked during this administration.
      </div>
    `;

  const scenarioId = isArchive ? (historicalRun?.scenario_id ?? 'default') : (gameState?.scenarioId ?? 'default');
  const scenarioMeta = scenarioMetadata[scenarioId as ScenarioKey];
  const scenarioName = scenarioMeta ? scenarioMeta.name : scenarioId;

  const gameOverReason = isArchive ? (historicalRun?.loss_reason || 'Administration concluded.') : (state?.gameOverReason || 'Administration concluded.');

  return `
    <div class="report-card-card">
      <div class="report-card-seal">★ REPUBLIC OF NATION STATE ★</div>
      
      <div class="report-card-header">
        <h2 class="report-card-outcome ${winState ? 'win' : 'lose'}">
          ${winState ? 'Mandate Fulfilled' : 'Regime Collapse'}
        </h2>
        <p class="report-card-reason">${gameOverReason}</p>
      </div>

      <div class="report-card-divider">❖</div>

      <!-- Grade & Archetype section -->
      <div class="report-grade-section">
        <div class="report-grade-circle" data-grade="${letterGrade}">
          <span class="report-grade-lbl">GRADE</span>
          <span class="report-grade-val">${letterGrade}</span>
        </div>
        <div class="report-archetype-info">
          <span class="report-archetype-lbl">Governance Archetype</span>
          <h3 class="report-archetype-val">${archetypeTitle}</h3>
          <p class="report-archetype-desc">Survives Turn ${turnsSurvived} | Scenario: ${scenarioName}</p>
        </div>
      </div>

      <!-- Stat Breakdown Grid -->
      <div class="report-stats-grid">
        <div class="report-stat-box">
          <span class="stat-box-lbl">Turns Survived</span>
          <span class="stat-box-val">${turnsSurvived} / 20</span>
        </div>
        <div class="report-stat-box">
          <span class="stat-box-lbl">Final GDP</span>
          <span class="stat-box-val">${formatCurrency(gdpVal)}</span>
        </div>
        <div class="report-stat-box">
          <span class="stat-box-lbl">Debt-to-GDP</span>
          <span class="stat-box-val">${((debtVal / Math.max(1, gdpVal)) * 100).toFixed(1)}%</span>
        </div>
        <div class="report-stat-box">
          <span class="stat-box-lbl">Public Approval</span>
          <span class="stat-box-val">${(state?.approvalRating ?? 0).toFixed(1)}%</span>
        </div>
      </div>

      <!-- Composite Health Grades -->
      <div class="report-composites-section">
        <h4 class="report-section-title">Composite Health Metrics</h4>
        <div class="report-composites-grid">
          <div class="composite-score-row">
            <span>FISCAL</span>
            <div class="composite-score-bar"><div class="fill" style="width: ${fiscalScore}%; background-color: var(--stability-teal);"></div></div>
            <span class="score-num">${fiscalScore}</span>
          </div>
          <div class="composite-score-row">
            <span>SECURITY</span>
            <div class="composite-score-bar"><div class="fill" style="width: ${securityScore}%; background-color: var(--stability-teal);"></div></div>
            <span class="score-num">${securityScore}</span>
          </div>
          <div class="composite-score-row">
            <span>WELFARE</span>
            <div class="composite-score-bar"><div class="fill" style="width: ${welfareScore}%; background-color: var(--stability-teal);"></div></div>
            <span class="score-num">${welfareScore}</span>
          </div>
          <div class="composite-score-row">
            <span>ECOLOGY</span>
            <div class="composite-score-bar"><div class="fill" style="width: ${ecologyScore}%; background-color: var(--stability-teal);"></div></div>
            <span class="score-num">${ecologyScore}</span>
          </div>
          <div class="composite-score-row">
            <span>FACTIONS</span>
            <div class="composite-score-bar"><div class="fill" style="width: ${factionsScore}%; background-color: var(--stability-teal);"></div></div>
            <span class="score-num">${factionsScore}</span>
          </div>
          <div class="composite-score-row">
            <span>DIPLOMACY</span>
            <div class="composite-score-bar"><div class="fill" style="width: ${diplomacyScore}%; background-color: var(--stability-teal);"></div></div>
            <span class="score-num">${diplomacyScore}</span>
          </div>
        </div>
      </div>

      <!-- Badges unlocked section -->
      <div class="report-badges-section">
        <h4 class="report-section-title">Badges & Unlocks Earned</h4>
        <div class="report-badges-grid">
          ${badgesHtml}
        </div>
      </div>

      <!-- Actions footer -->
      <div class="report-card-actions">
        ${isArchive 
          ? `<button id="report-card-archive-back-btn" class="ctrl-btn btn-primary" style="width: 100%;">← Back to Past Runs</button>`
          : `<button id="report-card-menu-btn" class="ctrl-btn btn-primary">Title Menu</button>
             <button id="report-card-runs-btn" class="ctrl-btn btn-secondary">Past Runs</button>
             <button id="report-card-close-btn" class="ctrl-btn btn-danger">Close</button>`
        }
      </div>
    </div>
  `;
}
