import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { config } from '../config/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedsDir = path.join(__dirname, 'seeds')

async function ensureSeedsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_seeds (
      filename    VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)
}

async function run() {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true })
  try {
    await ensureSeedsTable(conn)
    const [rows] = await conn.query('SELECT filename FROM schema_seeds')
    const applied = new Set(rows.map((r) => r.filename))

    const files = (await readdir(seedsDir)).filter((f) => f.endsWith('.sql')).sort()

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip (already applied): ${file}`)
        continue
      }
      const sql = await readFile(path.join(seedsDir, file), 'utf8')
      console.log(`seeding: ${file}`)
      await conn.query(sql)
      await conn.query('INSERT INTO schema_seeds (filename) VALUES (?)', [file])
      console.log(`seeded: ${file}`)
    }
    console.log('seed: done')
  } finally {
    await conn.end()
  }
}

run().catch((err) => {
  console.error('seed failed:', err.message)
  process.exit(1)
})
