// api/fires.js
//
// Serverless proxy for NASA FIRMS active-fire detections over the US.
// FIRMS' area API returns CSV and requires a free MAP_KEY:
//   https://firms.modaps.eosdis.nasa.gov/api/area/   (get a key in ~30s)
// Set FIRMS_MAP_KEY in the environment (Vercel env, or .env for local dev).
//
// We parse the CSV by header name so VIIRS and MODIS feeds both work, and emit
// slim GeoJSON points keyed on fire radiative power (FRP) for colour/size.

// FIRMS area bbox is west,south,east,north (CONUS).
const BBOX = '-125,24,-66,50'
const SOURCE = 'VIIRS_SNPP_NRT' // 375 m near-real-time
const DAY_RANGE = 1

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim())
  const idx = (name) => header.indexOf(name)

  const iLat = idx('latitude')
  const iLon = idx('longitude')
  const iFrp = idx('frp')
  const iConf = idx('confidence')
  const iDate = idx('acq_date')
  const iTime = idx('acq_time')
  const iSat = idx('satellite')
  const iDay = idx('daynight')
  const iBright = idx('bright_ti4') !== -1 ? idx('bright_ti4') : idx('brightness')

  const num = (v) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }

  return lines.slice(1).reduce((acc, line) => {
    const c = line.split(',')
    const lat = num(c[iLat])
    const lon = num(c[iLon])
    if (lat == null || lon == null) return acc
    acc.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        frp: iFrp !== -1 ? num(c[iFrp]) : null,
        confidence: iConf !== -1 ? (c[iConf] || '').trim() : null,
        bright: iBright !== -1 ? num(c[iBright]) : null,
        acq_date: iDate !== -1 ? c[iDate] : null,
        acq_time: iTime !== -1 ? (c[iTime] || '').trim() : null,
        satellite: iSat !== -1 ? c[iSat] : null,
        daynight: iDay !== -1 ? (c[iDay] || '').trim() : null,
      },
    })
    return acc
  }, [])
}

export default async function handler(req, res) {
  const key = process.env.FIRMS_MAP_KEY
  if (!key) {
    res.status(503).json({
      error: 'FIRMS_MAP_KEY not configured',
      detail: 'Get a free key at https://firms.modaps.eosdis.nasa.gov/api/ and set FIRMS_MAP_KEY.',
    })
    return
  }

  const upstream = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${SOURCE}/${BBOX}/${DAY_RANGE}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const resp = await fetch(upstream, {
      signal: controller.signal,
      headers: { 'User-Agent': 'bark-pulse-map (bradybarker26@gmail.com)' },
    })

    const text = await resp.text()

    if (!resp.ok) {
      res.status(502).json({ error: `FIRMS upstream responded ${resp.status}`, detail: text.slice(0, 200) })
      return
    }
    // FIRMS returns plain-text errors (e.g. invalid key) with a 200 status.
    if (!text.includes('latitude')) {
      res.status(502).json({ error: 'FIRMS returned no data', detail: text.slice(0, 200) })
      return
    }

    const features = parseCsv(text)

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    res.status(200).json({
      type: 'FeatureCollection',
      metadata: { generated: Date.now(), source: 'NASA FIRMS', sensor: SOURCE, count: features.length },
      features,
    })
  } catch (err) {
    const aborted = err?.name === 'AbortError'
    res
      .status(aborted ? 504 : 500)
      .json({ error: 'Failed to fetch FIRMS fires', detail: String(err) })
  } finally {
    clearTimeout(timeout)
  }
}
