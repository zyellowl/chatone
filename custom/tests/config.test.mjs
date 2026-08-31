import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, '../..');

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(target) : [target];
    }),
  );
  return nested.flat();
}

test('ZenMux uses the native Anthropic provider and server environment variables', async () => {
  const config = await read('librechat.yaml');
  assert.match(config, /provider:\s+anthropic/);
  assert.match(config, /apiKey:\s+'\$\{ZENMUX_API_KEY\}'/);
  assert.match(config, /baseURL:\s+'\$\{ZENMUX_BASE_URL\}'/);
  assert.match(config, /fetch:\s+false/);
});

test('ZenMux native Anthropic web search is enabled by default without another browser key', async () => {
  const config = await read('librechat.yaml');
  assert.match(config, /key:\s+web_search/);
  assert.match(config, /default:\s+true/);
  assert.match(config, /component:\s+switch/);
  assert.doesNotMatch(config, /(?:serper|tavily|firecrawl)ApiKey:/i);
});

test('the public environment example contains only the requested ZenMux variables', async () => {
  const variables = (await read('.env.example'))
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('=')[0]);
  assert.deepEqual(variables, ['ZENMUX_API_KEY', 'ZENMUX_BASE_URL']);
});

test('favorite registry models exist in the generated catalog', async () => {
  const registry = JSON.parse(await read('custom/model-registry.json'));
  const config = await read('librechat.yaml');
  const favorites = registry.models.filter((model) => model.enabled && model.favorite);
  assert.equal(favorites.length, 7);
  assert.equal(favorites[0].id, 'gpt-5.6-sol');
  favorites.forEach((model) => assert.match(config, new RegExp(model.id.replaceAll('/', '\\/'))));
});

test('GPT uses the local ChatGPT subscription endpoint and exposes every available model', async () => {
  const config = await read('librechat.yaml');
  const bridge = await read('custom/codex-bridge/server.mjs');
  assert.match(config, /endpoint:\s+'ChatGPT Subscription'[\s\S]{0,100}model:\s+'gpt-5\.6-sol'/);
  assert.match(config, /softDefault:\s+true/);
  assert.match(config, /modelSpecs:\s*\n\s+enforce:\s+true/);
  assert.match(config, /baseURL:\s+'http:\/\/host\.docker\.internal:4317\/v1'/);
  assert.match(config, /fetch:\s+true/);
  assert.match(bridge, /models\.getAvailable\(providerId\)/);
  assert.match(bridge, /available\.map\(\(model\)/);
});

test('subscription presets advertise bridge-side web search without enabling LibreChat paid search', async () => {
  const registry = JSON.parse(await read('custom/model-registry.json'));
  const config = await read('librechat.yaml');
  const bridge = await read('custom/codex-bridge/server.mjs');
  const compose = await read('docker-compose.override.yaml');
  const favorites = registry.models.filter((model) => model.enabled && model.favorite);
  favorites.forEach((model) => {
    assert.equal(model.supportsWebSearch, true, `${model.id} must expose web search support`);
    assert.equal(model.webSearchParameter, false, `${model.id} must use bridge-side search`);
    const modelIndex = config.indexOf(`model: '${model.id}'`);
    assert.notEqual(modelIndex, -1, `${model.id} must be rendered into librechat.yaml`);
    assert.doesNotMatch(config.slice(modelIndex, modelIndex + 160), /web_search:\s+true/);
  });
  assert.match(bridge, /decideWebSearch/);
  assert.match(bridge, /searchRouterConversation/);
  assert.match(bridge, /contextual-model-router/);
  assert.match(bridge, /executeWebSearchQueries/);
  assert.match(bridge, /executeBingRssSearch/);
  assert.match(bridge, /fetchPublicSearchPage/);
  assert.match(bridge, /assertPublicWebURL/);
  assert.match(bridge, /isPrivateNetworkAddress/);
  assert.match(bridge, /isClashFakeIPAddress/);
  assert.match(bridge, /searchRouting:\s*'contextual-model'/);
  assert.doesNotMatch(bridge, /if\s*\(enableWebSearch\s*&&\s*fallbackShouldPrefetchWebSearch/);
  assert.match(bridge, /name:\s*'web_search'/);
  assert.match(bridge, /executeWebSearch/);
  assert.match(bridge, /executeChinaMarketLookup/);
  assert.match(bridge, /Tencent Finance and Eastmoney/);
  assert.match(bridge, /twoMarketTurnoverYuan/);
  assert.match(bridge, /advancing:\s*sum/);
  assert.match(bridge, /declining:\s*sum/);
  assert.match(compose, /searxng\/searxng:latest/);
  assert.match(compose, /127\.0\.0\.1:8088:8080/);
  assert.doesNotMatch(compose, /healthcheck:[\s\S]{0,200}\/search\?q=health/);
});

test('favorite subscription model presets avoid LibreChat context fallback', async () => {
  const registry = JSON.parse(await read('custom/model-registry.json'));
  const config = await read('librechat.yaml');
  const favorites = registry.models.filter((model) => model.enabled && model.favorite);
  favorites.forEach((model) => {
    assert.ok(model.contextWindow >= 100_000, `${model.id} must declare its context window`);
    const expectedBudget = Math.floor(model.contextWindow * 0.9);
    const modelIndex = config.indexOf(`model: '${model.id}'`);
    assert.match(
      config.slice(modelIndex, modelIndex + 140),
      new RegExp(`maxContextTokens:\\s+${expectedBudget}`),
    );
  });
});

test('the browser source never references the server ZenMux key', async () => {
  const files = await listFiles(path.join(projectRoot, 'client/src'));
  const matches = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8').catch(() => '');
    if (content.includes('ZENMUX_API_KEY')) {
      matches.push(path.relative(projectRoot, file));
    }
  }
  assert.deepEqual(matches, []);
});

test('custom UI stays isolated behind one stylesheet import', async () => {
  const entry = await read('client/src/main.jsx');
  const composer = await read('client/src/components/Chat/Input/ChatForm.tsx');
  const landing = await read('client/src/components/Chat/Landing.tsx');
  const styles = await read('client/src/custom/zenmux.css');
  assert.match(entry, /custom\/zenmux\.css/);
  assert.match(composer, /data-testid="chat-composer"/);
  assert.match(landing, /<h1/);
  assert.doesNotMatch(landing, /<SplitText/);
  assert.match(styles, /--pa-canvas:/);
  assert.match(styles, /--pa-font-display:/);
  assert.match(styles, /nav\[aria-keyshortcuts='Shift\+Alt\+M'\]/);
});

test('the Claude-like navigation keeps conversation search enabled', async () => {
  const shell = await read('client/src/custom/claude/ClaudeSidebarShell.tsx');
  const conversations = await read('client/src/components/UnifiedSidebar/ConversationsSection.tsx');
  const searchBar = await read('client/src/components/Nav/SearchBar.tsx');
  const composeOverride = await read('docker-compose.override.yaml');
  assert.match(shell, /data-testid="nav-search-input"/);
  assert.match(shell, /\/assets\/chatone-troll\.png/);
  assert.doesNotMatch(shell, /<Sparkles/);
  assert.match(conversations, /search\.isSearching \|\| search\.query/);
  assert.match(searchBar, /chatone-search-field/);
  assert.match(composeOverride, /SEARCH: 'true'/);
});

test('the ChatOne composer omits advanced tool and artifact controls', async () => {
  const badgeRow = await read('client/src/components/Chat/Input/BadgeRow.tsx');
  assert.doesNotMatch(badgeRow, /<ToolsDropdown\s*\/>/);
  assert.doesNotMatch(badgeRow, /<Artifacts\s*\/>/);
});

test('macOS startup cannot hang forever on Docker or a throttled bridge', async () => {
  const launcher = await read('custom/macos/Sources/main.swift');
  const macBuild = await read('custom/macos/build.sh');
  const agent = await read('custom/codex-bridge/app.chatone.subscription-bridge.plist');
  const installer = await read('custom/codex-bridge/install-launch-agent.sh');
  assert.match(launcher, /arguments: \["info"\], timeout: 8/);
  assert.match(launcher, /Command timed out after/);
  assert.match(launcher, /kill\(process\.processIdentifier, SIGKILL\)/);
  assert.match(launcher, /reloadIgnoringLocalAndRemoteCacheData/);
  assert.match(launcher, /chatone_refresh/);
  assert.match(macBuild, /AppIcon-troll\.png/);
  assert.match(agent, /<key>WorkingDirectory<\/key>/);
  assert.doesNotMatch(agent, /<key>ProcessType<\/key>/);
  assert.match(installer, /Set :WorkingDirectory \$RUNTIME_DIR/);
});

test('artifact preview uses the upstream isolated Sandpack renderer', async () => {
  const preview = await read('client/src/components/Artifacts/ArtifactPreview.tsx');
  assert.match(preview, /SandpackPreview/);
  assert.doesNotMatch(preview, /dangerouslySetInnerHTML/);
});
