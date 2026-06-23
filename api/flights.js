// api/flights.js
//
// Serverless proxy for live aircraft positions over the US from the OpenSky
// Network (https://openskynetwork.github.io/opensky-api/rest.html).
//
// OpenSky must be proxied (no CORS) and its ANONYMOUS tier is heavily rate-
// limited — a cold poll often returns 429. Two things keep the layer usable:
//   1. A module-level cache: once any request succeeds, throttled follow-ups
//      reuse the last good positions instead of erroring (the map stays alive).
//   2. Optional OAuth2 client credentials (OPENSKY_CLIENT_ID / _SECRET) lift
//      the limit. Register at https://opensky-network.org/ → "API Clients".

// CONUS bounding box (anonymous calls cost more "credits" for larger areas).
const BBOX = { lamin: 24, lomin: -125, lamax: 49, lomax: -66 }

// OpenSky state-vector array indices we care about.
const I = { icao: 0, callsign: 1, country: 2, lon: 5, lat: 6, baroAlt: 7, onGround: 8, vel: 9, track: 10, vrate: 11, geoAlt: 13 }

const FRESH_MS = 8_000 // dedupe bursts of requests
const STALE_OK_MS = 5 * 60_000 // serve cached positions this long when throttled

// Persist across warm invocations / the dev server lifetime.
let dataCache = { at: 0, body: null }
let tokenCache = { token: null, exp: 0 }

async function getAccessToken() {
  const id = process.env.OPENSKY_CLIENT_ID
  const secret = process.env.OPENSKY_CLIENT_SECRET
  if (!id || !secret) return null

  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token

  const resp = await fetch(
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
      }),
    },
  )
  if (!resp.ok) return null
  const json = await resp.json()
  tokenCache = {
    token: json.access_token,
    exp: Date.now() + (json.expires_in - 30) * 1000,
  }
  return tokenCache.token
}

function parseStates(raw) {
  return (raw.states || [])
    .filter((s) => s[I.lon] != null && s[I.lat] != null && !s[I.onGround])
    .map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s[I.lon], s[I.lat]] },
      properties: {
        id: s[I.icao],
        callsign: (s[I.callsign] || '').trim() || null,
        country: s[I.country],
        altitude: s[I.geoAlt] ?? s[I.baroAlt],
        velocity: s[I.vel],
        heading: s[I.track] ?? 0,
        verticalRate: s[I.vrate],
      },
    }))
}

function send(res, body, cacheState) {
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20')
  res.setHeader('X-Cache', cacheState)
  res.status(200).json(body)
}

export default async function handler(req, res) {
  const now = Date.now()

  // 1. Fresh cache hit — skip OpenSky entirely.
  if (dataCache.body && now - dataCache.at < FRESH_MS) {
    send(res, dataCache.body, 'fresh')
    return
  }

  const { lamin, lomin, lamax, lomax } = BBOX
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  const serveStaleOrError = (status, error) => {
    if (dataCache.body && now - dataCache.at < STALE_OK_MS) {
      send(res, dataCache.body, 'stale')
    } else {
      res.status(status).json({ error })
    }
  }

  try {
    const token = await getAccessToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const resp = await fetch(url, { headers, signal: controller.signal })

    if (resp.status === 429) {
      serveStaleOrError(429, 'OpenSky rate limit reached — try again shortly')
      return
    }
    if (!resp.ok) {
      serveStaleOrError(502, `OpenSky upstream responded ${resp.status}`)
      return
    }

    const raw = await resp.json()
    const body = {
      type: 'FeatureCollection',
      metadata: { generated: now, source: 'OpenSky', authed: !!token, count: 0 },
      features: parseStates(raw),
    }
    body.metadata.count = body.features.length

    dataCache = { at: now, body }
    send(res, body, 'live')
  } catch (err) {
    const aborted = err?.name === 'AbortError'
    serveStaleOrError(aborted ? 504 : 500, `Failed to fetch flights: ${String(err)}`)
  } finally {
    clearTimeout(timeout)
  }
}
