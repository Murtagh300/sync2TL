// builds the extension into dist/: the manifest, the popup, icons, and inject.js (connect.js from the
// wallet, then glue.js). Load dist/ unpacked to try it; zip it for the Chrome Web Store or Firefox.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(join(dist, 'icons'), { recursive: true })

const connect = readFileSync(join(here, '../next/public/connect.js'), 'utf8')
const glue = readFileSync(join(here, 'src/glue.js'), 'utf8')
writeFileSync(join(dist, 'inject.js'), `${connect}\n${glue}`)
cpSync(join(here, 'src/manifest.json'), join(dist, 'manifest.json'))
cpSync(join(here, 'src/popup.html'), join(dist, 'popup.html'))
const icons = join(here, '../next/public/icons')
cpSync(join(icons, 'favicon-16x16.png'), join(dist, 'icons/16.png'))
cpSync(join(icons, 'favicon-32x32.png'), join(dist, 'icons/32.png'))
cpSync(join(icons, 'icon-128x128.png'), join(dist, 'icons/128.png'))
console.log('extension built in', dist)
