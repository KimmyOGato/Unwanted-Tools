const net = require('net')
const os = require('os')
const path = require('path')
const fs = require('fs')

// Ensure common temp directories exist — `slsk-client` may attempt to mkdir '/tmp/slsk'
// which can fail on Windows. Create both '/tmp/slsk' and a platform temp subfolder.
try {
  try { fs.mkdirSync('/tmp/slsk', { recursive: true }) } catch (e) { /* ignore */ }
  const localTmp = path.join(os.tmpdir(), 'slsk')
  try { fs.mkdirSync(localTmp, { recursive: true }) } catch (e) { /* ignore */ }
  // Point common env vars to our temp folder so libraries pick it up on Windows
  process.env.TMPDIR = localTmp
  process.env.TEMP = localTmp
  process.env.TMP = localTmp
} catch (e) {
  // Non-fatal — continue and let connect fail with a meaningful error
}

/**
 * Lightweight wrapper that attempts to use an optional Soulseek client library if installed.
 * If no library is present, it will provide a minimal connectivity check and friendly errors.
 */
let clientLib = null
try {
  // try common package names
  clientLib = require('slsk-client') || require('node-slsk') || require('slsk')
} catch (e) {
  clientLib = null
}

async function checkServer(host = 'server.slsknet.org', port = 2242, timeout = 5000) {
  return new Promise((resolve) => {
    const s = new net.Socket()
    let done = false
    s.setTimeout(timeout)
    s.once('connect', () => {
      done = true
      s.destroy()
      resolve({ ok: true })
    })
    s.once('error', (err) => {
      if (done) return
      done = true
      resolve({ ok: false, error: String(err) })
    })
    s.once('timeout', () => {
      if (done) return
      done = true
      s.destroy()
      resolve({ ok: false, error: 'timeout' })
    })
    s.connect(port, host)
  })
}

async function createClient(opts = {}) {
  if (!clientLib) throw new Error('missing-soulseek-lib')

  // slsk-client exports an object with connect(opts, cb)
  if (clientLib && typeof clientLib.connect === 'function') {
    return new Promise((resolve, reject) => {
      try {
        clientLib.connect({ user: opts.username || opts.user, pass: opts.password || opts.pass, host: opts.host, port: opts.port, incomingPort: opts.incomingPort }, (err, client) => {
          if (err) return reject(err)
          resolve(client)
        })
      } catch (e) { reject(e) }
    })
  }

  // Some libraries export a constructor/factory
  if (typeof clientLib === 'function') {
    return clientLib(opts)
  }
  if (clientLib && clientLib.createClient) return clientLib.createClient(opts)
  throw new Error('unsupported-soulseek-lib')
}

module.exports = {
  checkServer,
  createClient,
  hasClient: !!clientLib
}

// Does the installed client library support creating/registering accounts?
function canRegister() {
  if (!clientLib) return false
  const candidates = ['register', 'createAccount', 'createUser', 'signup', 'registerUser']
  for (const k of candidates) {
    if (typeof clientLib[k] === 'function') return true
  }
  return false
}

// Try to register a user using one of the supported method names on the client library.
// Returns object { ok: true } on success or { error: 'msg' } on failure.
async function registerAccount(opts = {}) {
  if (!clientLib) return { error: 'missing-soulseek-lib' }
  const username = opts.username || opts.user
  const password = opts.password || opts.pass
  if (!username || !password) return { error: 'username_password_required' }

  const tryNames = ['register', 'createAccount', 'createUser', 'signup', 'registerUser']
  for (const name of tryNames) {
    const fn = clientLib[name]
    if (typeof fn === 'function') {
      try {
        // Attempt to call; support sync/async and nodeback (err, res)
        const res = await new Promise((resolve, reject) => {
          try {
            const rv = fn.call(clientLib, { user: username, pass: password, username, password }, (err, data) => {
              if (err) return reject(err)
              resolve(data || { ok: true })
            })
            // If function returns a promise
            if (rv && typeof rv.then === 'function') {
              rv.then(d => resolve(d)).catch(reject)
            }
            // Some functions may return synchronously
            if (rv === undefined) {
              // rely on callback
            } else if (rv && typeof rv === 'object' && rv.ok) {
              resolve(rv)
            }
          } catch (e) {
            reject(e)
          }
        })
        return { ok: true, result: res }
      } catch (e) {
        return { error: String(e) }
      }
    }
  }
  return { error: 'registration_not_supported' }
}

module.exports.canRegister = canRegister
module.exports.registerAccount = registerAccount

// Check whether a username appears available using client library helpers if present.
async function checkUsernameAvailable(opts = {}) {
  if (!clientLib) return { error: 'missing-soulseek-lib' }
  const username = opts.username || opts.user
  if (!username) return { error: 'username_required' }

  const tryNames = ['checkUsername', 'usernameAvailable', 'available', 'isAvailable', 'check']
  for (const name of tryNames) {
    const fn = clientLib[name]
    if (typeof fn === 'function') {
      try {
        const res = await new Promise((resolve, reject) => {
          try {
            const rv = fn.call(clientLib, username, (err, data) => {
              if (err) return reject(err)
              resolve(data)
            })
            if (rv && typeof rv.then === 'function') {
              rv.then(d => resolve(d)).catch(reject)
            }
            if (rv !== undefined) {
              resolve(rv)
            }
          } catch (e) { reject(e) }
        })
        // Interpret common truthy/falsey responses
        if (typeof res === 'boolean') return { ok: true, available: !!res }
        if (res && typeof res.available !== 'undefined') return { ok: true, available: !!res.available }
        return { ok: true, result: res }
      } catch (e) {
        return { error: String(e) }
      }
    }
  }
  return { error: 'check_not_supported' }
}

module.exports.checkUsernameAvailable = checkUsernameAvailable
