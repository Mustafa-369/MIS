import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { foundationRouter } from './modules/foundation/foundation.routes.js'
import { workforceRouter } from './modules/workforce/workforce.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const app = express()

app.use(express.json())

app.use('/api/foundation', foundationRouter)
app.use('/api/workforce', workforceRouter)
app.use('/api/auth', authRouter)

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist')
app.use(express.static(frontendDist))

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'))
})
