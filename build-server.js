import { build } from 'esbuild';
import { readFileSync } from 'fs';
// (optional) outExtension: { '.js': '.mjs' }
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

// Filter out local dependencies that should be bundled
const externalDeps = dependencies.filter(dep => !dep.startsWith('@shared'));

import esbuild from 'esbuild';
import { resolve } from 'node:path';

try {
  await esbuild.build({
    entryPoints: ['server/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',                 // ← key: emit ESM so `export` is valid
    outdir: 'dist/server',
    loader: { '.ts': 'ts', '.tsx': 'tsx' },

    // Resolve `@shared/...` to `./shared/...ts`
    plugins: [{
      name: 'resolve-shared',
      setup(build) {
        build.onResolve({ filter: /^@shared/ }, args => {
          const rel = args.path.replace(/^@shared/, './shared') + '.ts';
          const abs = resolve(process.cwd(), rel);
          return { path: abs };
        });
      }
    }],

    // Allow `require()` inside ESM output when a lib expects it
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },

    logLevel: 'info'
  });

  console.log('✅ Server built successfully');
} catch (error) {
  console.error('❌ Server build failed:', error);
  process.exit(1);
}
