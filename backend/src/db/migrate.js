import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { config } from '../config/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, 'migrations')

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)
}

async function run() {
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true })
  try {
    await ensureMigrationsTable(conn)
    const [rows] = await conn.query('SELECT filename FROM schema_migrations')
    const applied = new Set(rows.map((r) => r.filename))

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip (already applied): ${file}`)
        continue
      }
      const sql = await readFile(path.join(migrationsDir, file), 'utf8')
      console.log(`applying: ${file}`)
      await conn.query(sql)
      await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file])
      console.log(`applied: ${file}`)
    }
    console.log('migrate: done')
  } finally {
    await conn.end()
  }
}

run().catch((err) => {
  console.error('migrate failed:', err.message)
  process.exit(1)
})
