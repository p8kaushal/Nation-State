import { NationState } from './types';

export interface SectorStatus {
  id: string;
  name: string;
  score: number; // 0-100
  stateClass: 'state-healthy' | 'state-neutral' | 'state-critical';
  iconSvg: string;
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function getStateClass(score: number): 'state-healthy' | 'state-neutral' | 'state-critical' {
  if (score >= 70) return 'state-healthy';
  if (score >= 35) return 'state-neutral';
  return 'state-critical';
}

const ICONS = {
  coin: `<svg class="sector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 6v12M15 9.5a3 3 0 0 0-6 0c0 3 6 2 6 5a3 3 0 0 1-6 0"/>
  </svg>`,
  shield: `<svg class="sector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>`,
  heart: `<svg class="sector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>`,
  leaf: `<svg class="sector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 20A7 7 0 0 1 4 13C4 7 11 3 20 3c0 9-4 16-10 17z"/>
    <path d="M4 13c5 0 10-3 13-7"/>
  </svg>`,
  scale: `<svg class="sector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v18M6 8l-4 7h8L6 8zM18 8l-4 7h8l-4-7zM2 8h20"/>
  </svg>`,
  globe: `<svg class="sector-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,
};

/**
 * Calculates sector health metrics (0-100) and renders an executive status board.
 */
export function renderNationView(state: NationState): string {
  // 1. FISCAL: Computed from treasury status, debt ratio, and GDP growth rate
  const debtRatio = state.nationalDebt / Math.max(1, state.gdp);
  const debtScore = clamp(100 - debtRatio * 80);
  const growthScore = clamp(50 + state.gdpGrowthRate * 1000);
  const treasuryScore = state.treasuryBudget >= 0
    ? clamp(50 + (state.treasuryBudget / 50_000_000_000) * 50)
    : clamp(50 + (state.treasuryBudget / 20_000_000_000) * 50);
  let fiscalScore = Math.round(0.4 * debtScore + 0.3 * growthScore + 0.3 * treasuryScore);
  if (state.debtCrisis) {
    fiscalScore = Math.min(fiscalScore, 30);
  }
  fiscalScore = clamp(fiscalScore);

  // 2. SECURITY: Computed from crime rate (inverted) and military strength
  const crimeScore = clamp(100 - state.crimeRate);
  const militaryScore = clamp(state.militaryStrength);
  const securityScore = clamp(Math.round(0.5 * crimeScore + 0.5 * militaryScore));

  // 3. WELFARE: Computed from healthcare, education, and poverty indices
  const povertyScore = clamp(100 - state.povertyRate * 2.5);
  const welfareScore = clamp(Math.round((state.healthcareIndex + state.educationIndex + povertyScore) / 3));

  // 4. ECOLOGY: Computed from environment index
  const ecologyScore = clamp(Math.round(state.environmentIndex));

  // 5. FACTIONS: Average of the 4 Faction Trusts
  const factionsScore = clamp(
    Math.round((state.militaryTrust + state.businessTrust + state.publicTrust + state.internationalTrust) / 4)
  );

  // 6. DIPLOMACY: Computed from foreign relations index
  const diplomacyScore = clamp(Math.round(state.foreignRelationsIndex));

  const sectors: SectorStatus[] = [
    {
      id: 'fiscal',
      name: 'FISCAL',
      score: fiscalScore,
      stateClass: getStateClass(fiscalScore),
      iconSvg: ICONS.coin,
    },
    {
      id: 'security',
      name: 'SECURITY',
      score: securityScore,
      stateClass: getStateClass(securityScore),
      iconSvg: ICONS.shield,
    },
    {
      id: 'welfare',
      name: 'WELFARE',
      score: welfareScore,
      stateClass: getStateClass(welfareScore),
      iconSvg: ICONS.heart,
    },
    {
      id: 'ecology',
      name: 'ECOLOGY',
      score: ecologyScore,
      stateClass: getStateClass(ecologyScore),
      iconSvg: ICONS.leaf,
    },
    {
      id: 'factions',
      name: 'FACTIONS',
      score: factionsScore,
      stateClass: getStateClass(factionsScore),
      iconSvg: ICONS.scale,
    },
    {
      id: 'diplomacy',
      name: 'DIPLOMACY',
      score: diplomacyScore,
      stateClass: getStateClass(diplomacyScore),
      iconSvg: ICONS.globe,
    },
  ];

  return `
    <div class="status-board-grid">
      ${sectors
        .map(
          (sector) => `
        <div class="status-board-item ${sector.stateClass}" data-sector="${sector.id}" title="${sector.name}: ${sector.score}/100">
          <div class="status-icon-wrapper">${sector.iconSvg}</div>
          <span class="status-name">${sector.name}</span>
          <span class="status-score">${sector.score}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}
