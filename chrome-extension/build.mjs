/**
 * Bundles each extension entry point separately — the service worker, the content
 * scripts and each UI page all load in different contexts and cannot share a chunk.
 * Static files (manifest, HTML, icons) are copied verbatim.
 */
import * as esbuild from 'esbuild';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const src = 'src';
const out = 'dist';

const entryPoints = [
  'background/orchestrator.ts',
  'content/detect.ts',
  'content/inject.ts',
  'manual/manual.ts',
  'options/options.ts',
  'popup/popup.ts',
].filter((f) => existsSync(path.join(src, f)));

/** Copy manifest, HTML and icons into dist alongside the bundles. */
async function copyStatic() {
  await cp(path.join(src, 'manifest.json'), path.join(out, 'manifest.json'));
  for (const dir of ['manual', 'options', 'popup', 'icons']) {
    const from = path.join(src, dir);
    if (!existsSync(from)) continue;
    const files = await readdir(from);
    for (const file of files) {
      if (file.endsWith('.ts')) continue;
      await mkdir(path.join(out, dir), { recursive: true });
      await cp(path.join(from, file), path.join(out, dir, file));
    }
  }
}

const options = {
  entryPoints: entryPoints.map((f) => path.join(src, f)),
  outdir: out,
  outbase: src,
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

if (entryPoints.length === 0) {
  console.log('No entry points yet — copying static files only.');
  await copyStatic();
} else if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [
      {
        name: 'copy-static',
        setup: (build) => build.onEnd(copyStatic),
      },
    ],
  });
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(options);
  await copyStatic();
}
