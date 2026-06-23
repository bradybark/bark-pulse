// api/alerts.js
//
// Serverless proxy for active National Weather Service alerts (no API key).
// We keep only alerts that carry inline polygon geometry — many NWS alerts
// reference UGC zones without geometry and would need a second lookup; those
// are skipped for the map MVP. Properties are slimmed to primitives so the
// values survive the trip through MapLibre's feature state on click.
//
// https://www.weather.gov/documentation/services-web-api

const SEV_RANK = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Unknown: 0 }

export default async function handler(req, res) {
  const upstream =
    'https://api.weather.gov/alerts/active?status=actual&message_type=alert'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const resp = await fetch(upstream, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'bark-pulse-map (bradybarker26@gmail.com)',
        Accept: 'application/geo+json',
      },
    })

    if (!resp.ok) {
      res.status(502).json({ error: `NWS upstream responded ${resp.status}` })
      return
    }

    const raw = await resp.json()

    const features = (raw.features || [])
      .filter(
        (f) =>
          f.geometry &&
          (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
      )
      .map((f) => {
        const p = f.properties || {}
        const severity = p.severity || 'Unknown'
        return {
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            id: f.id,
            event: p.event,
            severity,
            sevRank: SEV_RANK[severity] ?? 0,
            certainty: p.certainty,
            urgency: p.urgency,
            headline: p.headline,
            areaDesc: p.areaDesc,
            effective: p.effective,
            expires: p.expires,
            ends: p.ends,
            senderName: p.senderName,
          },
        }
      })

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    res.status(200).json({
      type: 'FeatureCollection',
      metadata: { generated: Date.now(), source: 'NWS', count: features.length },
      features,
    })
  } catch (err) {
    const aborted = err?.name === 'AbortError'
    res
      .status(aborted ? 504 : 500)
      .json({ error: 'Failed to fetch NWS alerts', detail: String(err) })
  } finally {
    clearTimeout(timeout)
  }
}
