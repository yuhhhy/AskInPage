import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'src');
const outputRoot = resolve(projectRoot, 'dist');
const temporaryOutputRoot = resolve(projectRoot, '.dist-tmp');
const watchMode = process.argv.includes('--watch');

async function build() {
  await rm(temporaryOutputRoot, { recursive: true, force: true });
  await mkdir(temporaryOutputRoot, { recursive: true });
  await cp(sourceRoot, temporaryOutputRoot, { recursive: true });
  await mkdir(resolve(temporaryOutputRoot, 'assets'), { recursive: true });
  await rm(outputRoot, { recursive: true, force: true });
  await rename(temporaryOutputRoot, outputRoot);
  console.log(`Built unpacked extension: ${outputRoot}`);
}

await build();

if (watchMode) {
  let timer;
  let buildInProgress = false;
  let rebuildRequested = false;

  async function rebuild() {
    if (buildInProgress) {
      rebuildRequested = true;
      return;
    }

    buildInProgress = true;
    try {
      await build();
    } catch (error) {
      console.error('Build failed:', error);
    } finally {
      buildInProgress = false;
      if (rebuildRequested) {
        rebuildRequested = false;
        await rebuild();
      }
    }
  }

  watch(sourceRoot, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  });

  console.log('Watching src for changes. Press Ctrl+C to stop.');
}
