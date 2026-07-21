import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src');
const manifestPath = resolve(sourceRoot, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertSourceFile(relativePath, label) {
  assert(relativePath, `${label} is missing from manifest.json`);
  const sourceEntryMap = {
    'background/service-worker.js': 'background/service-worker.ts',
    'content/index.js': 'content/index.tsx',
    'popup/index.js': 'popup/index.tsx',
    'options/index.js': 'options/index.tsx'
  };
  const sourcePath = sourceEntryMap[relativePath] || relativePath;
  const absolutePath = resolve(sourceRoot, sourcePath);
  assert(absolutePath.startsWith(`${sourceRoot}/`), `${label} points outside src: ${relativePath}`);
  await access(absolutePath);
}

assert(manifest.manifest_version === 3, 'manifest_version must be 3');
assert(manifest.name === '__MSG_extensionName__', 'Extension name must use chrome.i18n');
assert(manifest.description === '__MSG_extensionDescription__', 'Extension description must use chrome.i18n');
assert(manifest.action?.default_title === '__MSG_actionTitle__', 'Action title must use chrome.i18n');
assert(manifest.default_locale === 'en', 'default_locale must be en');
assert(Array.isArray(manifest.permissions), 'permissions must be an array');

const localeMessages = {};
for (const locale of ['en', 'zh_CN']) {
  const localePath = resolve(sourceRoot, '_locales', locale, 'messages.json');
  localeMessages[locale] = JSON.parse(await readFile(localePath, 'utf8'));
  for (const key of ['extensionName', 'extensionDescription', 'actionTitle']) {
    assert(localeMessages[locale][key]?.message, `${locale} is missing ${key}`);
  }
}
assert(
  JSON.stringify(Object.keys(localeMessages.en).sort()) === JSON.stringify(Object.keys(localeMessages.zh_CN).sort()),
  'en and zh_CN locale keys must match'
);

await assertSourceFile(manifest.background?.service_worker, 'background.service_worker');
await assertSourceFile(manifest.options_ui?.page, 'options_ui.page');
await assertSourceFile(manifest.action?.default_popup, 'action.default_popup');

for (const [index, contentScript] of (manifest.content_scripts || []).entries()) {
  for (const file of contentScript.js || []) {
    await assertSourceFile(file, `content_scripts[${index}].js`);
  }
  for (const file of contentScript.css || []) {
    await assertSourceFile(file, `content_scripts[${index}].css`);
  }
}

console.log('AskInPage Manifest V3 structure is valid.');
