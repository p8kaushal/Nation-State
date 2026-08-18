const fs = require('fs');

const path = 'src/decisions.json';
const decisions = JSON.parse(fs.readFileSync(path, 'utf8'));

for (const d of decisions) {
  for (const opt of d.options) {
    if (opt.id === 'tax_cut_pass') opt.factionEffects = ["businessTrust + 15", "publicTrust - 10"];
    if (opt.id === 'tax_cut_reject') opt.factionEffects = ["businessTrust - 10", "publicTrust + 5"];
    
    if (opt.id === 'edu_fund_full') opt.factionEffects = ["publicTrust + 10", "businessTrust - 5"];
    if (opt.id === 'edu_fund_vocational') opt.factionEffects = ["publicTrust + 5"];
    
    if (opt.id === 'mil_expand_full') opt.factionEffects = ["militaryTrust + 15", "businessTrust - 10"];
    if (opt.id === 'mil_expand_moderate') opt.factionEffects = ["militaryTrust + 5", "businessTrust - 5"];
    if (opt.id === 'mil_deny') opt.factionEffects = ["militaryTrust - 10", "publicTrust + 5"];

    if (opt.id === 'scandal_publish') opt.factionEffects = ["publicTrust + 10", "internationalTrust + 5", "militaryTrust - 5"];
    if (opt.id === 'scandal_bury') opt.factionEffects = ["publicTrust - 15", "businessTrust + 5"];
  }
}

fs.writeFileSync(path, JSON.stringify(decisions, null, 2));
