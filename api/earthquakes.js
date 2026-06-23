// api/earthquakes.js
//
// Serverless proxy for the USGS earthquake feed. Why proxy a public, CORS-
// enabled feed?
//   - One stable, app-shaped contract (slimmed GeoJSON) the client depends on.
//   - Edge caching so we never hammer USGS regardless of how many visitors.
//   - The same shape every future layer proxy (FIRMS, NWS, OpenSky) will use.
//
// USGS summary feeds: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

const FEEDS = {
  hour: 'all_hour',
  day: 'all_day',
  week: 'all_week',
  // magnitude-filtered variants keep the map readable over longer windows
  '2.5_day': '2.5_day',
  '2.5_week': '2.5_week',
  '4.5_week': '4.5_week',
}

// Rough bounding box covering CONUS + Alaska + Hawaii + territories.
function inUSA(lon, lat) {
  // CONUS
  if (lon >= -125 && lon <= -66 && lat >= 24 && lat <= 50) return true
  // Alaska
  if (lon >= -180 && lon <= -129 && lat >= 51 && lat <= 72) return true
  // Hawaii
  if (lon >= -161 && lon <= -154 && lat >= 18 && lat <= 23) return true
  // Puerto Rico / USVI
  if (lon >= -68 && lon <= -64 && lat >= 17 && lat <= 19) return true
  return false
}

export default async function handler(req, res) {
  const feedKey = String(req.query.feed || 'day')
  const feed = FEEDS[feedKey] || FEEDS.day
  const usaOnly = req.query.usa !== '0'

  const upstream = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`

  try {
    const resp = await fetch(upstream, {
      headers: { 'User-Agent': 'bark-pulse-map (bradybarker26@gmail.com)' },
    })

    if (!resp.ok) {
      res.status(502).json({ error: `USGS upstream responded ${resp.status}` })
      return
    }

    const raw = await resp.json()

    const features = (raw.features || [])
      .filter((f) => {
        const c = f.geometry?.coordinates
        if (!c || c.length < 2) return false
        return usaOnly ? inUSA(c[0], c[1]) : true
      })
      .map((f) => {
        const [lon, lat, depth] = f.geometry.coordinates
        const p = f.properties || {}
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            id: f.id,
            mag: p.mag,
            place: p.place,
            title: p.title,
            time: p.time,
            updated: p.updated,
            url: p.url,
            felt: p.felt,
            tsunami: p.tsunami,
            type: p.type,
            depth,
          },
        }
      })

    const body = {
      type: 'FeatureCollection',
      metadata: {
        generated: Date.now(),
        source: 'USGS',
        feed: feedKey,
        count: features.length,
      },
      features,
    }

    // Cache at the edge for 60s, serve stale for another 5min while revalidating.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json(body)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch earthquake feed', detail: String(err) })
  }
}
