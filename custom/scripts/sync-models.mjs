import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '../..');
const registryPath = path.join(projectRoot, 'custom/model-registry.json');
const configPath = path.join(projectRoot, 'librechat.yaml');

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function replaceBlock(source, name, content) {
  const start = `# zenmux-${name}:start`;
  const end = `# zenmux-${name}:end`;
  const expression = new RegExp(
    `^([ \\t]*)${start.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[\\s\\S]*?^\\1${end.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`,
    'm',
  );
  const match = source.match(expression);
  if (!match) {
    throw new Error(`Missing generated block: ${name}`);
  }
  const indent = match[1];
  return source.replace(expression, `${indent}${start}\n${content}\n${indent}${end}`);
}

function renderFavorite(model, endpoint) {
  const slug = model.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const endpointSlug = (model.endpoint ?? endpoint)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const lines = [
    `    - name: ${endpointSlug}-${slug}`,
    `      label: ${quote(model.name)}`,
    `      description: ${quote(model.description ?? model.provider)}`,
  ];
  if (model.softDefault === true) {
    lines.push('      softDefault: true');
  }
  lines.push(
    '      showIconInMenu: false',
    '      artifacts: true',
    '      preset:',
    `        endpoint: ${quote(model.endpoint ?? endpoint)}`,
    `        model: ${quote(model.id)}`,
  );
  if (Number.isFinite(model.contextWindow) && model.contextWindow > 0) {
    // Keep 10% for provider output/tool overhead while avoiding LibreChat's
    // conservative fallback for ZenMux model IDs that are not in its built-in map.
    lines.push(`        maxContextTokens: ${Math.floor(model.contextWindow * 0.9)}`);
  }
  if (model.supportsWebSearch === true && model.webSearchParameter !== false) {
    lines.push('        web_search: true');
  }
  return lines.join('\n');
}

function sortCatalog(ids, favoriteIds) {
  const favoriteOrder = new Map(favoriteIds.map((id, index) => [id, index]));
  return [...new Set(ids)].sort((left, right) => {
    const leftFavorite = favoriteOrder.get(left);
    const rightFavorite = favoriteOrder.get(right);
    if (leftFavorite != null || rightFavorite != null) {
      return (leftFavorite ?? Number.MAX_SAFE_INTEGER) - (rightFavorite ?? Number.MAX_SAFE_INTEGER);
    }
    return left.localeCompare(right);
  });
}

async function main() {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const enabled = registry.models.filter((model) => model.enabled !== false);
  const favorites = enabled.filter((model) => model.favorite === true);
  if (favorites.length === 0) {
    throw new Error('The registry must contain at least one enabled favorite model.');
  }

  const response = await fetch(registry.catalogUrl, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`ZenMux model discovery failed with HTTP ${response.status}.`);
  }
  const body = await response.json();
  const discovered = Array.isArray(body.data)
    ? body.data.map((item) => item?.id).filter((id) => typeof id === 'string' && id.includes('/'))
    : [];
  if (discovered.length === 0) {
    throw new Error('ZenMux returned an empty or invalid model catalog.');
  }

  const zenmuxFavorites = favorites.filter(
    (model) => (model.endpoint ?? registry.endpoint) === registry.endpoint,
  );
  const missingFavorites = zenmuxFavorites.filter((model) => !discovered.includes(model.id));
  if (missingFavorites.length > 0) {
    throw new Error(
      `Favorite models missing from ZenMux: ${missingFavorites.map((m) => m.id).join(', ')}`,
    );
  }

  const catalog = sortCatalog(
    discovered,
    zenmuxFavorites.map((model) => model.id),
  );
  const favoriteYaml = favorites
    .map((model) => renderFavorite(model, registry.endpoint))
    .join('\n');
  const catalogYaml = catalog.map((id) => `          - ${quote(id)}`).join('\n');

  let config = await readFile(configPath, 'utf8');
  config = replaceBlock(config, 'favorites', favoriteYaml);
  config = replaceBlock(config, 'catalog', catalogYaml);
  await writeFile(configPath, config);
  process.stdout.write(
    `Updated ${favorites.length} favorites and ${catalog.length} ZenMux models.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
