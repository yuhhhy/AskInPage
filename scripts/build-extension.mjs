import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { context } from 'esbuild';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(projectRoot, 'dist');
const temporaryOutputRoot = resolve(projectRoot, '.dist-tmp');
const watchMode = process.argv.includes('--watch');

const entries = [
  { input: 'src/content/index.tsx', output: 'content/index.js', format: 'iife' },
  { input: 'src/popup/index.tsx', output: 'popup/index.js', format: 'iife' },
  { input: 'src/options/index.tsx', output: 'options/index.js', format: 'iife' },
  { input: 'src/background/service-worker.ts', output: 'background/service-worker.js', format: 'esm' }
];

async function prepareOutput(root) {
  await rm(root, { recursive: true, force: true });
  await mkdir(resolve(root, 'content'), { recursive: true });
  await mkdir(resolve(root, 'options'), { recursive: true });
  await mkdir(resolve(root, 'popup'), { recursive: true });
  await mkdir(resolve(root, 'background'), { recursive: true });
  await cp(resolve(projectRoot, 'src/manifest.json'), resolve(root, 'manifest.json'));
  await cp(resolve(projectRoot, 'src/content/styles.css'), resolve(root, 'content/styles.css'));
  await cp(resolve(projectRoot, 'src/options/styles.css'), resolve(root, 'options/styles.css'));
  await cp(resolve(projectRoot, 'src/options/index.html'), resolve(root, 'options/index.html'));
  await cp(resolve(projectRoot, 'src/popup/styles.css'), resolve(root, 'popup/styles.css'));
  await cp(resolve(projectRoot, 'src/popup/index.html'), resolve(root, 'popup/index.html'));
  await cp(resolve(projectRoot, 'src/popup/github-mark.svg'), resolve(root, 'popup/github-mark.svg'));
}

function createBuildContext(entry, outRoot) {
  return context({
    absWorkingDir: projectRoot,
    entryPoints: [entry.input],
    outfile: resolve(outRoot, entry.output),
    bundle: true,
    format: entry.format,
    platform: 'browser',
    target: ['chrome120'],
    jsx: 'automatic',
    minify: !watchMode,
    sourcemap: watchMode ? 'inline' : false,
    logLevel: 'info'
  });
}

if (watchMode) {
  await prepareOutput(outputRoot);
  const contexts = await Promise.all(entries.map((entry) => createBuildContext(entry, outputRoot)));
  await Promise.all(contexts.map((buildContext) => buildContext.watch()));
  console.log('Watching React + TypeScript extension sources. Press Ctrl+C to stop.');
} else {
  await prepareOutput(temporaryOutputRoot);
  const contexts = await Promise.all(entries.map((entry) => createBuildContext(entry, temporaryOutputRoot)));
  try {
    await Promise.all(contexts.map((buildContext) => buildContext.rebuild()));
  } finally {
    await Promise.all(contexts.map((buildContext) => buildContext.dispose()));
  }
  await rm(outputRoot, { recursive: true, force: true });
  await rename(temporaryOutputRoot, outputRoot);
  console.log(`Built React + TypeScript extension: ${outputRoot}`);
}
