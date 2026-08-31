import { randomBytes } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '../..');
const target = path.join(projectRoot, '.env');

function secret(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

async function main() {
  try {
    await access(target);
    process.stdout.write('.env already exists; no changes made.\n');
    return;
  } catch {
    // A missing target is the expected first-run state.
  }

  const example = await readFile(path.join(projectRoot, '.env.example'), 'utf8');
  const content = `${example.trim()}\n
HOST=localhost
PORT=3080
UID=${process.getuid?.() ?? 1000}
GID=${process.getgid?.() ?? 1000}
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_SERVER=http://localhost:3080
APP_TITLE=ChatOne
ALLOW_EMAIL_LOGIN=true
ALLOW_REGISTRATION=true
ALLOW_UNVERIFIED_EMAIL_LOGIN=true
JWT_SECRET=${secret()}
JWT_REFRESH_SECRET=${secret()}
CREDS_KEY=${secret()}
CREDS_IV=${secret(16)}
MEILI_MASTER_KEY=${secret()}
ADMIN_PANEL_SESSION_SECRET=${secret()}
RAG_PORT=8000
`;
  await writeFile(target, content, { mode: 0o600, flag: 'wx' });
  process.stdout.write('Created mode-0600 .env with generated local application secrets.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
