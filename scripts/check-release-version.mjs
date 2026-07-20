import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const expectedVersion = String(process.argv[2] || '').replace(/^v/, '');

if (!/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
  throw new Error('Expected a version such as 1.0.0 or a tag such as v1.0.0');
}

const files = [
  ['package.json', 'version'],
  ['package-lock.json', 'version'],
  ['src/manifest.json', 'version']
];

for (const [relativePath, key] of files) {
  const data = JSON.parse(await readFile(resolve(projectRoot, relativePath), 'utf8'));
  if (data[key] !== expectedVersion) {
    throw new Error(`${relativePath} contains ${data[key]}, expected ${expectedVersion}`);
  }
}

const packageLock = JSON.parse(
  await readFile(resolve(projectRoot, 'package-lock.json'), 'utf8')
);

if (packageLock.packages?.['']?.version !== expectedVersion) {
  throw new Error(
    `package-lock.json root package contains ${packageLock.packages?.['']?.version}, expected ${expectedVersion}`
  );
}

console.log(`Release version is consistent: ${expectedVersion}`);
