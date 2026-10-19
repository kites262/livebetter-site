// Explicit network step. This script only manages this project's .cache/content checkout.
// CONTENT_REPO configures the importer, not the destination of this downloader.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.cache');
const TARGET = resolve(CACHE, 'content');
const source = JSON.parse(readFileSync(resolve(ROOT, 'content-source.json'), 'utf8'));
if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(source.url) || !/^[a-f0-9]{40}$/.test(source.commit)) {
  throw new Error('content-source.json must contain a GitHub HTTPS URL and a full 40-character commit.');
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function hasCommit(cwd) {
  try { git(cwd, 'cat-file', '-e', `${source.commit}^{commit}`); return true; }
  catch { return false; }
}
function pathExists(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function verifyTarget() {
  if (lstatSync(TARGET).isSymbolicLink() || !lstatSync(TARGET).isDirectory()) throw new Error(`Refusing to replace ${TARGET}: expected a real checkout directory.`);
  const gitDirectory = resolve(TARGET, '.git');
  if (!existsSync(gitDirectory) || !lstatSync(gitDirectory).isDirectory() || lstatSync(gitDirectory).isSymbolicLink()) throw new Error('Refusing to modify an unmanaged content directory or linked worktree.');
  if (realpathSync(git(TARGET, 'rev-parse', '--show-toplevel')) !== realpathSync(TARGET)) throw new Error('Content checkout root does not match the cache destination.');
  const origin = git(TARGET, 'remote', 'get-url', 'origin');
  if (origin !== source.url) throw new Error('Refusing to modify content checkout with a different origin.');
  if (git(TARGET, 'status', '--porcelain')) throw new Error('Content checkout has local changes. Preserve them before fetching the locked source revision.');
}

mkdirSync(CACHE, { recursive: true });
if (lstatSync(CACHE).isSymbolicLink()) throw new Error('Refusing to write through a symlinked .cache directory.');
if (pathExists(TARGET)) {
  verifyTarget();
  if (!hasCommit(TARGET)) git(TARGET, 'fetch', '--depth=1', 'origin', source.commit);
  git(TARGET, 'checkout', '--detach', source.commit);
} else {
  const temporary = resolve(CACHE, `content-clone-${process.pid}`);
  if (pathExists(temporary)) throw new Error(`Temporary directory already exists: ${temporary}`);
  try {
    git(ROOT, 'clone', '--no-checkout', '--single-branch', '--depth=1', source.url, temporary);
    if (!hasCommit(temporary)) git(temporary, 'fetch', '--depth=1', 'origin', source.commit);
    git(temporary, 'checkout', '--detach', source.commit);
    // A concurrent process must never cause an existing checkout to be replaced.
    if (pathExists(TARGET)) throw new Error('Content destination appeared during download; refusing to replace it.');
    renameSync(temporary, TARGET);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
if (git(TARGET, 'rev-parse', 'HEAD') !== source.commit) throw new Error('Downloaded content does not match the locked commit.');
console.log(`Content ready at .cache/content: ${source.commit}. Build with CONTENT_REPO=.cache/content.`);
