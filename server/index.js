import express from 'express'
import mysql from 'mysql2/promise'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = process.env.PORT || 3000

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

const app = express()

app.get('/api/health', async (req, res) => {
  try {
    const [messageRows] = await pool.query('SELECT message FROM health_check LIMIT 1')
    const [timeRows] = await pool.query('SELECT NOW() AS dbTime')
    res.json({
      ok: true,
      message: messageRows[0]?.message ?? null,
      dbTime: timeRows[0].dbTime,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

const clientDist = path.join(__dirname, '..', 'client', 'dist')
app.use(express.static(clientDist))

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`AOP server listening on port ${PORT}`)
})
