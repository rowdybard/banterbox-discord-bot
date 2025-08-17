// build-server.js
import esbuild from 'esbuild';
import { resolve } from 'node:path';

try {
  await esbuild.build({
    entryPoints: ['server/index.ts'],
    outdir: 'dist/server',
    platform: 'node',
    target: 'node20',
    bundle: true,
    format: 'esm',                 // ← output ESM so `export` is valid
    loader: { '.ts': 'ts', '.tsx': 'tsx' },

    // IMPORTANT: don't bundle node_modules (avoids @babel/lightningcss issues)
    packages: 'external',

    // Resolve `@shared/...` to your local shared code
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

    // Allow require() in ESM output if a library expects it
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },

    logLevel: 'info',
  });

  console.log('✅ Server built successfully');
} catch (error) {
  console.error('❌ Server build failed:', error);
  process.exit(1);
}
