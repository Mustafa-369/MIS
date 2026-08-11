import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { foundationRouter } from './modules/foundation/foundation.routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const app = express()

app.use('/api/foundation', foundationRouter)

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist')
app.use(express.static(frontendDist))

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})
