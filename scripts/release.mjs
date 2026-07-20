import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const requestedVersion = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const dryRun = process.argv.includes('--dry-run');
const packageJsonPath = resolve(projectRoot, 'package.json');
const currentPackage = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const currentParts = currentPackage.version.split('.').map(Number);

if (!requestedVersion) {
  console.error('Usage: npm run release -- <major|minor|patch|1.0.0> [--dry-run]');
  process.exit(1);
}

let version = requestedVersion;
if (['major', 'minor', 'patch'].includes(requestedVersion)) {
  const [major, minor, patch] = currentParts;
  version = requestedVersion === 'major'
    ? `${major + 1}.0.0`
    : requestedVersion === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Version must be major, minor, patch, or an explicit value such as 1.0.0');
}

const versionParts = version.split('.').map(Number);
if (versionParts.some((part) => part > 65535)) {
  throw new Error('Each version component must be between 0 and 65535');
}

const firstChangedPart = versionParts.findIndex(
  (part, index) => part !== currentParts[index]
);
const isNewerVersion = firstChangedPart !== -1
  && versionParts[firstChangedPart] > currentParts[firstChangedPart];

if (!isNewerVersion) {
  throw new Error(`Version ${version} must be newer than ${currentPackage.version}`);
}

const tag = `v${version}`;

function git(...args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  }).trim();
}

if (dryRun) {
  console.log(`Would release ${tag}: update versions, validate, commit, tag, and push atomically.`);
  process.exit(0);
}

if (git('status', '--porcelain')) {
  throw new Error('Working tree is not clean. Commit or stash existing changes before releasing.');
}

if (git('branch', '--show-current') !== 'main') {
  throw new Error('Releases must be created from the main branch.');
}

try {
  git('show-ref', '--verify', '--quiet', `refs/tags/${tag}`);
  throw new Error(`Tag already exists locally: ${tag}`);
} catch (error) {
  if (error.message?.startsWith('Tag already exists')) throw error;
}

const jsonFiles = ['package.json', 'package-lock.json', 'src/manifest.json'];

for (const relativePath of jsonFiles) {
  const absolutePath = resolve(projectRoot, relativePath);
  const data = JSON.parse(await readFile(absolutePath, 'utf8'));
  data.version = version;
  if (relativePath === 'package-lock.json' && data.packages?.['']) {
    data.packages[''].version = version;
  }
  await writeFile(absolutePath, `${JSON.stringify(data, null, 2)}\n`);
}

execFileSync(process.execPath, [
  resolve(projectRoot, 'scripts/check-release-version.mjs'),
  version
], { cwd: projectRoot, stdio: 'inherit' });

execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'inherit' });
git('add', ...jsonFiles);
git('commit', '-m', `chore(release): ${tag}`);
git('tag', '-a', tag, '-m', `AskInPage ${tag}`);
git('push', '--atomic', 'origin', 'HEAD', `refs/tags/${tag}`);

console.log(`Pushed ${tag}. GitHub Actions will create the Release and upload its ZIP asset.`);
