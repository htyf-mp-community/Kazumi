import {
  DEFAULT_RULE_URL,
  normalizeRuleUrl,
} from '@/collector/plugins/fetch-plugin-rule';

describe('normalizeRuleUrl', () => {
  it('unwraps gh-proxy github blob url to raw', () => {
    expect(normalizeRuleUrl(DEFAULT_RULE_URL)).toBe(
      'https://raw.githubusercontent.com/Predidit/KazumiRules/main/AGE.json',
    );
  });

  it('converts direct github blob url', () => {
    expect(
      normalizeRuleUrl(
        'https://github.com/Predidit/KazumiRules/blob/main/AGE.json',
      ),
    ).toBe('https://raw.githubusercontent.com/Predidit/KazumiRules/main/AGE.json');
  });
});
