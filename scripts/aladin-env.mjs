import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')

function loadEnvFile(name) {
  const file = path.join(PROJECT_ROOT, name)
  if (!fs.existsSync(file)) return

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

export function getAladinTtbKey() {
  const key = process.env.ALADIN_TTB_KEY
  if (!key) {
    throw new Error('Missing ALADIN_TTB_KEY. Add it to .env.local or pass it as an environment variable.')
  }
  return key
}
