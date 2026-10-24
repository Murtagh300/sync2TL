import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url)).replace(/\\/g, '/')

// `vitest run` tests next/src; `vitest run --mode legacy` runs the very same
// tests against the current app in ../src, to prove both behave identically.
export default defineConfig(({ mode }) => {
    const src = mode === 'legacy' ? abs('../src') : abs('./src')
    const workerStub = abs('./test/stubs/vault-worker.ts')
    return {
        resolve: {
            alias: [
                // the vault web worker, as imported by the legacy (webpack) and new (vite) code
                { find: /^worker-loader!\.\/worker$/, replacement: workerStub },
                { find: /^\.\/worker\?worker$/, replacement: workerStub },
                { find: /^core\//, replacement: `${src}/core/` },
                { find: /^assets\//, replacement: `${src}/assets/` },
                { find: /^src\//, replacement: `${src}/` }
            ]
        },
        test: {
            name: mode === 'legacy' ? 'legacy' : 'next',
            // the services depend on Vue 2 / webpack in the legacy app, so only core is shared
            include: mode === 'legacy' ? ['test/core/**/*.spec.ts'] : ['test/**/*.spec.ts'],
            setupFiles: ['test/setup.ts'],
            environment: 'node'
        }
    }
})
