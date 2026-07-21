import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(projectRoot, 'dist');
const releasesRoot = resolve(projectRoot, 'releases');
const manifest = JSON.parse(await readFile(resolve(outputRoot, 'manifest.json'), 'utf8'));
const defaultMessages = JSON.parse(await readFile(resolve(outputRoot, '_locales', manifest.default_locale, 'messages.json'), 'utf8'));
const packageName = defaultMessages.extensionName?.message || 'AskInPage';
const filename = `${packageName}-${manifest.version}.zip`;
const webExtCli = resolve(projectRoot, 'node_modules/web-ext/bin/web-ext.js');

await mkdir(releasesRoot, { recursive: true });

execFileSync(process.execPath, [
  webExtCli,
  'build',
  '--source-dir', outputRoot,
  '--artifacts-dir', releasesRoot,
  '--filename', filename,
  '--overwrite-dest',
  '--no-input'
], { stdio: 'inherit' });

const generatedFilename = (await readdir(releasesRoot))
  .find((entry) => entry.toLowerCase() === filename.toLowerCase());

if (!generatedFilename) {
  throw new Error(`Package was not created: ${filename}`);
}

if (generatedFilename !== filename) {
  const temporaryFilename = `.package-${Date.now()}.zip`;
  await rename(
    resolve(releasesRoot, generatedFilename),
    resolve(releasesRoot, temporaryFilename)
  );
  await rename(
    resolve(releasesRoot, temporaryFilename),
    resolve(releasesRoot, filename)
  );
}

console.log(`Packaged extension: ${resolve(releasesRoot, filename)}`);
