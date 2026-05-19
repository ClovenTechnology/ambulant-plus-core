import type { GovernedRuleWeight } from '../contracts/governance';

export interface RuleWeightMap {
  [key: string]: number;
}

export class RuleWeightResolver {
  constructor(
    private readonly defaults: RuleWeightMap,
    private readonly overrides?: RuleWeightMap,
  ) {}

  get(key: string): number {
    if (this.overrides && typeof this.overrides[key] === 'number') {
      return this.overrides[key];
    }
    return this.defaults[key] ?? 0;
  }

  explain(key: string): GovernedRuleWeight {
    const overridden = this.overrides && typeof this.overrides[key] === 'number';
    return {
      key,
      value: this.get(key),
      updatedAt: new Date().toISOString(),
      source: overridden ? 'org_override' : 'default',
    };
  }

  explainMany(keys: string[]): GovernedRuleWeight[] {
    return keys.map((k) => this.explain(k));
  }
}