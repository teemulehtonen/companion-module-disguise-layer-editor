'use strict'

// Designer HTTP contract. Keep version-specific paths and response envelopes
// here; native Python object access is isolated in designer-script.js.
const paths = Object.freeze({
  execute: '/api/session/python/execute',
  transports: '/api/session/transport/activetransport',
  allTransports: '/api/session/transport/transports',
  annotations: (uid) => '/api/session/transport/annotations?uid=' + encodeURIComponent(uid),
  liveUpdate: '/api/session/liveupdate',
  thumbnail: (uid) => `/api/v1/thumbnail/${uid}?width=160&height=90`,
  transport: (operation) => {
    if (!['play','playsection','playloopsection','stop','gotonextsection','gotoprevsection','gotonexttrack','gotoprevtrack'].includes(operation)) throw new Error('Invalid transport operation')
    return '/api/session/transport/' + operation
  },
  playback: (playing) => `/api/session/transport/${playing ? 'stop' : 'playsection'}`,
  transportLevel: (kind) => {
    if (!['brightness','volume'].includes(kind)) throw new Error('Invalid transport level')
    return '/api/session/transport/' + kind
  },
})

function requireSuccess(body, fallback = 'Invalid Designer API response') {
  if (!body?.status || body.status.code !== 0) throw new Error(body?.status?.message || fallback)
  return body
}

function decodeExecution(body) {
  requireSuccess(body)
  try {
    return typeof body.returnValue === 'string' ? JSON.parse(body.returnValue) : body.returnValue
  } catch {
    throw new Error('Designer returned invalid JSON')
  }
}

module.exports = { paths, requireSuccess, decodeExecution }
