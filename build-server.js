import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// (optional) outExtension: { '.js': '.mjs' }
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

// Filter out local dependencies that should be bundled
const externalDeps = dependencies.filter(dep => !dep.startsWith('@shared'));

try {
  esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',              // ← this is the key
  outdir: 'dist/server',
  loader: { '.ts': 'ts', '.tsx': 'tsx' }
}),
    // Use esbuild's path mapping to resolve @shared imports
    plugins: [{
      name: 'resolve-shared',
      setup(build) {
        build.onResolve({ filter: /^@shared/ }, args => {
          const relativePath = args.path.replace('@shared', './shared') + '.ts';
          const absolutePath = resolve(process.cwd(), relativePath);
          return { path: absolutePath, external: false };
        });
      }
    }],
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
    },
  });
  console.log('✅ Server built successfully');
} catch (error) {
  console.error('❌ Server build failed:', error);
  process.exit(1);
}
