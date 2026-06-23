// api/flights.js
//
// Serverless proxy for live aircraft positions over the US from the OpenSky
// Network (https://openskynetwork.github.io/opensky-api/rest.html).
//
// OpenSky must be proxied: it doesn't send CORS headers, and anonymous access
// is heavily rate-limited — so the edge cache below is doing real work, sharing
// one upstream call across all visitors. Optionally set OPENSKY_USERNAME /
// OPENSKY_PASSWORD to lift the limits (Basic auth).

// CONUS bounding box (anonymous calls cost more "credits" for larger areas).
const BBOX = { lamin: 24, lomin: -125, lamax: 49, lomax: -66 }

// OpenSky state vector array indices we care about.
const I = { icao: 0, callsign: 1, country: 2, lon: 5, lat: 6, baroAlt: 7, onGround: 8, vel: 9, track: 10, vrate: 11, geoAlt: 13 }

export default async function handler(req, res) {
  const { lamin, lomin, lamax, lomax } = BBOX
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`

  const headers = {}
  if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
    const token = Buffer.from(
      `${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`,
    ).toString('base64')
    headers.Authorization = `Basic ${token}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const resp = await fetch(url, { headers, signal: controller.signal })

    if (resp.status === 429) {
      res.status(429).json({ error: 'OpenSky rate limit reached — try again shortly' })
      return
    }
    if (!resp.ok) {
      res.status(502).json({ error: `OpenSky upstream responded ${resp.status}` })
      return
    }

    const raw = await resp.json()

    const features = (raw.states || [])
      .filter((s) => s[I.lon] != null && s[I.lat] != null && !s[I.onGround])
      .map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s[I.lon], s[I.lat]] },
        properties: {
          id: s[I.icao],
          callsign: (s[I.callsign] || '').trim() || null,
          country: s[I.country],
          altitude: s[I.geoAlt] ?? s[I.baroAlt], // metres
          velocity: s[I.vel], // m/s
          heading: s[I.track] ?? 0, // deg from north
          verticalRate: s[I.vrate], // m/s
        },
      }))

    // Short edge cache keeps the map "live" while protecting the rate limit.
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20')
    res.status(200).json({
      type: 'FeatureCollection',
      metadata: { generated: Date.now(), source: 'OpenSky', count: features.length },
      features,
    })
  } catch (err) {
    const aborted = err?.name === 'AbortError'
    res
      .status(aborted ? 504 : 500)
      .json({ error: 'Failed to fetch flights', detail: String(err) })
  } finally {
    clearTimeout(timeout)
  }
}
