import { app } from './app.js'
import { config } from './config/index.js'

app.listen(config.port, () => {
  console.log(`AOP backend listening on port ${config.port}`)
})
