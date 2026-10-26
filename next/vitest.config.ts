import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url)).replace(/\\/g, '/')

// unit tests (test/); the end-to-end tests are Playwright's (e2e/)
export default defineConfig(() => {
    const src = abs('./src')
    const workerStub = abs('./test/stubs/vault-worker.ts')
    return {
        resolve: {
            alias: [
                // the vault web worker, as Vite imports it
                { find: /^\.\/worker\?worker$/, replacement: workerStub },
                { find: /^core\//, replacement: `${src}/core/` },
                { find: /^assets\//, replacement: `${src}/assets/` },
                { find: /^src\//, replacement: `${src}/` }
            ]
        },
        test: {
            name: 'next',
            include: ['test/**/*.spec.ts'],
            setupFiles: ['test/setup.ts'],
            environment: 'node'
        }
    }
})
