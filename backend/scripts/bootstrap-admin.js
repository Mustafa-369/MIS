// One-time, guarded, interactive bootstrap for the first admin user.
// Run manually on the VPS by the owner, after deploy: npm --prefix backend run bootstrap
//
// Refuses to run if any app_user already exists — it is genuinely one-time
// and cannot be used to inject a second admin later. The password is typed
// interactively and hashed immediately; it is never written anywhere but the
// password_hash column, never logged, never echoed.
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load backend/.env ourselves — do not rely on the shell (or an --env-file
// flag) having sourced it, so this works when run directly.
process.loadEnvFile(path.join(__dirname, '..', '.env'))

const BCRYPT_COST = 12
const MIN_PASSWORD_LENGTH = 8
const BOOTSTRAP_POSITION_CODES = ['BOARD', 'GM', 'SYSADMIN']
const PRIMARY_POSITION_CODE = 'GM'

const KEY_ENTER = new Set(['\n', '\r'])
const KEY_EOF = '\u0004' // Ctrl-D
const KEY_INTERRUPT = '\u0003' // Ctrl-C
const KEY_BACKSPACE = new Set(['\u007f', '\b'])

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      reject(new Error('bootstrap must be run interactively (no TTY detected)'))
      return
    }
    process.stdout.write(question)
    let input = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const onData = (char) => {
      if (KEY_ENTER.has(char) || char === KEY_EOF) {
        stdin.setRawMode(false)
        stdin.pause()
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(input)
        return
      }
      if (char === KEY_INTERRUPT) {
        process.stdout.write('\n')
        process.exit(1)
      }
      if (KEY_BACKSPACE.has(char)) {
        if (input.length > 0) {
          input = input.slice(0, -1)
          process.stdout.write('\b \b')
        }
        return
      }
      input += char
      process.stdout.write('*')
    }
    stdin.on('data', onData)
  })
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })

  try {
    const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM app_user')
    if (Number(count) > 0) {
      fail('An admin already exists; bootstrap is one-time.')
    }

    const fullName = await prompt('Full name: ')
    if (!fullName) fail('Full name is required.')

    const email = await prompt('Email: ')
    if (!email || !email.includes('@')) fail('A valid email is required.')

    const username = await prompt('Username: ')
    if (!username) fail('Username is required.')

    const password = await promptHidden('Password: ')
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    const confirm = await promptHidden('Confirm password: ')
    if (password !== confirm) {
      fail('Passwords do not match.')
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    const employeeCode = username.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 30) || 'ADMIN'

    const [positions] = await conn.query(
      `SELECT id, code FROM job_position WHERE code IN (?, ?, ?)`,
      BOOTSTRAP_POSITION_CODES,
    )
    const missing = BOOTSTRAP_POSITION_CODES.filter(
      (code) => !positions.some((p) => p.code === code),
    )
    if (missing.length) {
      fail(`Cannot bootstrap: missing job_position row(s) for ${missing.join(', ')}.`)
    }

    await conn.beginTransaction()
    try {
      const [employeeResult] = await conn.query(
        'INSERT INTO employee (code, full_name) VALUES (?, ?)',
        [employeeCode, fullName],
      )
      const employeeId = employeeResult.insertId

      await conn.query(
        `INSERT INTO app_user (employee_id, username, email, password_hash, must_change_password)
         VALUES (?, ?, ?, ?, 1)`,
        [employeeId, username, email, passwordHash],
      )

      for (const position of positions) {
        const isPrimary = position.code === PRIMARY_POSITION_CODE ? 1 : 0
        await conn.query(
          'INSERT INTO employee_position (employee_id, job_position_id, is_primary) VALUES (?, ?, ?)',
          [employeeId, position.id, isPrimary],
        )
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    }

    console.log(`Bootstrap admin created: ${username} <${email}> (BOARD, GM, SYSADMIN).`)
    console.log('They must set their real password on first login.')
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('bootstrap failed:', err.message)
  process.exit(1)
})
