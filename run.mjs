
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getInitialState() {
  return {
    turn: 1,
    population: 10000000,
    gdp: 50000000000,
    gdpGrowthRate: 0.015, // slightly off-center
    povertyRate: 18.0, // off-center
    unemploymentRate: 7.5, // off-center
    educationIndex: 48, // off-center
    healthcareIndex: 45, // off-center
    approvalRating: 45, // off-center
    militaryStrength: 38, // off-center
    corruptionLevel: 25, // off-center
    environmentIndex: 68, // off-center
    treasuryBudget: 5000000000, // 5 billion
    nationalDebt: 28000000000, // 28 billion
    crimeRate: 35, // off-center
    foreignRelationsIndex: 55, // off-center
  };
}

function simulateTurn(state) {
  const next = { ...state };
  next.turn += 1;

  // 1. Economic Growth -> Unemployment
  const growthDiff = state.gdpGrowthRate - 0.02;
  next.unemploymentRate -= growthDiff * 50;
  next.unemploymentRate += (6.0 - state.unemploymentRate) * 0.1; // mean reversion
  next.unemploymentRate = clamp(next.unemploymentRate);

  // 2. Unemployment -> Poverty
  const unempDiff = next.unemploymentRate - 6.0;
  const eduMitigation = (state.educationIndex - 50) * 0.02;
  next.povertyRate += unempDiff * 0.2 - eduMitigation;
  next.povertyRate += (15.0 - state.povertyRate) * 0.1; // mean reversion
  next.povertyRate = clamp(next.povertyRate);

  // 3. Poverty & Corruption -> Crime
  const povertyCrimeFactor = (next.povertyRate - 15.0) * 0.05;
  const corruptionCrimeFactor = (state.corruptionLevel - 20.0) * 0.05;
  const militaryMitigation = (state.militaryStrength - 40.0) * 0.05;
  next.crimeRate += povertyCrimeFactor + corruptionCrimeFactor - militaryMitigation;
  
  // Natural Crime drift
  if (next.approvalRating < 40) { // Using approvalRating as stability
    next.crimeRate += 0.1; 
  }
  next.crimeRate += (30.0 - state.crimeRate) * 0.1; // mean reversion
  next.crimeRate = clamp(next.crimeRate);

  // 4. Crime & Corruption -> Foreign Relations
  const crimeFRDrop = (next.crimeRate - 30.0) * 0.05;
  const corruptionFRDrop = (state.corruptionLevel - 20.0) * 0.05;
  next.foreignRelationsIndex -= (crimeFRDrop + corruptionFRDrop);
  next.foreignRelationsIndex += (60.0 - state.foreignRelationsIndex) * 0.1; // mean reversion
  next.foreignRelationsIndex = clamp(next.foreignRelationsIndex);

  // 5. Foreign Relations & Education & Corruption & Debt -> GDP Growth
  const frGrowthFactor = (next.foreignRelationsIndex - 60) * 0.0005;
  const eduGrowthFactor = (state.educationIndex - 50) * 0.0005; 
  const corruptionGrowthDrag = (state.corruptionLevel - 20) * 0.0005;
  const debtToGDP = state.nationalDebt / state.gdp;
  const debtGrowthDrag = Math.max(0, (debtToGDP - 0.5) * 0.02);
  next.gdpGrowthRate = 0.02 + frGrowthFactor + eduGrowthFactor - corruptionGrowthDrag - debtGrowthDrag;
  next.gdpGrowthRate = Math.max(-0.1, Math.min(0.15, next.gdpGrowthRate));

  next.gdp += next.gdp * next.gdpGrowthRate;
  next.gdp = Math.max(0, next.gdp);

  // 6. Population Drifts
  const healthPopFactor = (state.healthcareIndex - 50) * 0.0001;
  const envPopDrag = (70 - state.environmentIndex) * 0.0001;
  const popGrowthRate = 0.008 + healthPopFactor - envPopDrag;
  next.population += next.population * popGrowthRate;
  next.population = Math.max(0, next.population);

  // Passive Index Drifts
  next.educationIndex = clamp(next.educationIndex - 0.2);
  next.healthcareIndex = clamp(next.healthcareIndex - 0.2);
  next.militaryStrength = clamp(next.militaryStrength - 0.3);
  next.corruptionLevel = clamp(next.corruptionLevel + 0.1);
  const envDecay = 0.1 * (next.gdp / 50000000000);
  next.environmentIndex = clamp(next.environmentIndex - envDecay);

  // Budget, Reinvestment, and Debt
  const taxRevenue = next.gdp * 0.20;
  const baseMaintenance = next.gdp * 0.02;
  const militaryCost = next.gdp * (state.militaryStrength / 40) * 0.02;
  const healthCost = next.gdp * (state.healthcareIndex / 50) * 0.03;
  const eduCost = next.gdp * (state.educationIndex / 50) * 0.03;
  const maintenanceExpenses = baseMaintenance + militaryCost + healthCost + eduCost;
  
  const interestOnDebt = state.nationalDebt * 0.04;
  const netIncome = taxRevenue - maintenanceExpenses - interestOnDebt;
  
  const currentDebtToGDP = state.nationalDebt / next.gdp;

  if (netIncome > 0) {
    if (currentDebtToGDP < 0.3) {
      // Reinvestment mode
      const debtPaydown = netIncome * 0.4;
      const surplusInvestment = netIncome * 0.6;
      
      // Pay down debt
      next.nationalDebt -= debtPaydown;
      if (next.nationalDebt < 0) {
        next.treasuryBudget += Math.abs(next.nationalDebt);
        next.nationalDebt = 0;
      }
      
      // Invest surplus
      const investmentPerStat = surplusInvestment / 3;
      const costPerPoint = next.gdp * 0.01; // 1 point costs 1% of GDP
      const pointsGained = investmentPerStat / costPerPoint;
      
      next.educationIndex = clamp(next.educationIndex + pointsGained);
      next.healthcareIndex = clamp(next.healthcareIndex + pointsGained);
      next.militaryStrength = clamp(next.militaryStrength + pointsGained);

    } else {
      // All net income goes to debt
      next.nationalDebt -= netIncome;
      if (next.nationalDebt < 0) {
        next.treasuryBudget += Math.abs(next.nationalDebt);
        next.nationalDebt = 0;
      }
    }
  } else {
    // Deficit
    next.nationalDebt += Math.abs(netIncome);
  }

  // Austerity Penalty
  if (currentDebtToGDP > 0.6) {
    next.educationIndex = clamp(next.educationIndex - 0.5);
    next.healthcareIndex = clamp(next.healthcareIndex - 0.5);
    next.militaryStrength = clamp(next.militaryStrength - 0.5);
  }

  // Cap treasury at 0 if borrowing
  if (next.treasuryBudget < 0) {
    next.nationalDebt += Math.abs(next.treasuryBudget);
    next.treasuryBudget = 0;
  }

  // Approval Rating
  const povertyPenalty = (next.povertyRate - 15) * 0.5;
  const unempPenalty = (next.unemploymentRate - 6) * 0.5;
  const corrPenalty = (state.corruptionLevel - 20) * 0.5;
  const growthBonus = (next.gdpGrowthRate - 0.02) * 500;

  next.approvalRating = 50 - povertyPenalty - unempPenalty - corrPenalty + growthBonus;
  next.approvalRating = clamp(next.approvalRating);

  return next;
}

function runDriftTest() {
  let state = getInitialState();
  const history = [state];

  for (let i = 0; i < 50; i++) {
    state = simulateTurn(state);
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
