import { parsePluginRule } from '@/collector';
import { defaultSearchStage } from '@/collector/engine/search-stage';

const SAMPLE_HTML = `
<html><body>
  <ul>
    <li><a href="/detail/1">孤独摇滚</a></li>
    <li><a href="/detail/2">其他番剧</a></li>
  </ul>
</body></html>
`;

describe('SearchStage.parseSearchHtml', () => {
  it('parses search items with xpath rules', () => {
    const rule = parsePluginRule({
      name: 'TEST',
      baseURL: 'https://example.com/',
      searchList: '//ul/li',
      searchName: '//a',
      searchResult: '//a',
    });

    const result = defaultSearchStage.parseSearchHtml(rule, SAMPLE_HTML);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.name).toBe('孤独摇滚');
    expect(result.data[0]?.src).toBe('/detail/1');
  });
});
