// src/lib/layers.js
//
// Central registry of map data layers. Each "live" layer knows how to:
//   1. fetch its GeoJSON (via a serverless proxy under /api)
//   2. render itself as one or more MapLibre style layers
//   3. summarise a clicked feature for the detail modal
//
// Conventions the map relies on:
//   - every layer exposes a `kind` ('point' | 'area') so the map can draw
//     areas beneath points.
//   - buildLayers() MUST include a layer whose id is `${sourceId}-core`; that
//     is the layer the map registers for clicks.
//
// Adding a new source is just another object here + its /api proxy.

import { Activity, CloudLightning, Flame, Plane } from 'lucide-react'

const MS = { second: 1_000, minute: 60_000 }

/**
 * Paired MapLibre layers (soft glow + crisp core) for a point layer
 * coloured/sized by expressions.
 */
function glowingPointLayers({ sourceId, color, radius, stroke = '#0a0a0a', glowRadius, glowOpacity = 0.32 }) {
  return [
    {
      id: `${sourceId}-glow`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': color,
        'circle-radius': glowRadius,
        'circle-blur': 1,
        'circle-opacity': glowOpacity,
      },
    },
    {
      id: `${sourceId}-core`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': color,
        'circle-radius': radius,
        'circle-stroke-color': stroke,
        'circle-stroke-width': 0.75,
        'circle-opacity': 0.95,
      },
    },
  ]
}

const earthquakes = {
  id: 'earthquakes',
  kind: 'point',
  label: 'Earthquakes',
  blurb: 'USGS seismic events, past 24h',
  source: 'USGS',
  accent: '#22d3ee',
  Icon: Activity,
  endpoint: '/api/earthquakes',
  refreshMs: 5 * MS.minute,
  defaultOn: true,
  buildLayers(sourceId) {
    const color = [
      'step',
      ['coalesce', ['get', 'mag'], 0],
      '#38bdf8',
      2, '#22d3ee',
      3, '#a78bfa',
      4, '#fbbf24',
      5, '#f87171',
    ]
    const radius = [
      'interpolate', ['linear'], ['coalesce', ['get', 'mag'], 0],
      0, 3, 2, 6, 4, 12, 6, 22, 8, 34,
    ]
    return glowingPointLayers({
      sourceId,
      color,
      radius,
      glowRadius: ['*', radius, 2.4],
      glowOpacity: 0.35,
    })
  },
  legend: [
    { color: '#38bdf8', label: 'M < 2' },
    { color: '#22d3ee', label: 'M 2–3' },
    { color: '#a78bfa', label: 'M 3–4' },
    { color: '#fbbf24', label: 'M 4–5' },
    { color: '#f87171', label: 'M 5+' },
  ],
  toDetail(p) {
    return {
      accent: this.accent,
      headline: p.mag != null ? `Magnitude ${Number(p.mag).toFixed(1)}` : 'Earthquake',
      place: p.place || 'Unknown location',
      time: p.time ? new Date(p.time).toLocaleString() : null,
      stats: [
        { label: 'Magnitude', value: p.mag != null ? Number(p.mag).toFixed(1) : '—' },
        { label: 'Depth', value: p.depth != null ? `${Number(p.depth).toFixed(1)} km` : '—' },
        { label: 'Felt reports', value: p.felt != null ? String(p.felt) : '—' },
        { label: 'Tsunami', value: p.tsunami ? 'Yes' : 'No' },
      ],
      link: p.url ? { href: p.url, label: 'View on USGS' } : null,
    }
  },
}

const SEVERITY_COLOR = [
  'match',
  ['get', 'severity'],
  'Extreme', '#f87171',
  'Severe', '#fb923c',
  'Moderate', '#fbbf24',
  'Minor', '#facc15',
  '#94a3b8', // Unknown / other
]

const weatherAlerts = {
  id: 'weather-alerts',
  kind: 'area',
  label: 'Weather Alerts',
  blurb: 'NWS active warnings & watches',
  source: 'weather.gov',
  accent: '#fb923c',
  Icon: CloudLightning,
  endpoint: '/api/alerts',
  refreshMs: 2 * MS.minute,
  defaultOn: true,
  buildLayers(sourceId) {
    return [
      {
        id: `${sourceId}-core`,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': SEVERITY_COLOR,
          'fill-opacity': [
            'interpolate', ['linear'], ['coalesce', ['get', 'sevRank'], 0],
            0, 0.1, 4, 0.28,
          ],
        },
      },
      {
        id: `${sourceId}-outline`,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': SEVERITY_COLOR,
          'line-width': 1.4,
          'line-opacity': 0.85,
        },
      },
    ]
  },
  legend: [
    { color: '#f87171', label: 'Extreme' },
    { color: '#fb923c', label: 'Severe' },
    { color: '#fbbf24', label: 'Moderate' },
    { color: '#facc15', label: 'Minor' },
  ],
  toDetail(p) {
    return {
      accent: this.accent,
      headline: p.event || 'Weather Alert',
      place: p.areaDesc || 'Affected area',
      time: p.headline || (p.expires ? `Until ${new Date(p.expires).toLocaleString()}` : null),
      stats: [
        { label: 'Severity', value: p.severity || '—' },
        { label: 'Certainty', value: p.certainty || '—' },
        { label: 'Urgency', value: p.urgency || '—' },
        { label: 'Expires', value: p.expires ? new Date(p.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
      ],
      link: null,
    }
  },
}

// Aircraft altitude (metres) -> colour band.
const ALT_COLOR = [
  'step',
  ['coalesce', ['get', 'altitude'], 0],
  '#fca5a5',
  1500, '#fbbf24',
  4000, '#34d399',
  8000, '#22d3ee',
  11000, '#a78bfa',
]

// Build a small plane glyph (nose pointing "north") as ImageData so MapLibre
// can rotate it per-feature by heading. Drawn once and registered on the map.
function makeAircraftIcon(size = 40) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.translate(size / 2, size / 2)
  ctx.beginPath()
  ctx.moveTo(0, -size * 0.42) // nose
  ctx.lineTo(size * 0.3, size * 0.3) // right tail
  ctx.lineTo(0, size * 0.14) // tail notch
  ctx.lineTo(-size * 0.3, size * 0.3) // left tail
  ctx.closePath()
  ctx.fillStyle = '#f1f5f9'
  ctx.strokeStyle = 'rgba(10,10,12,0.9)'
  ctx.lineWidth = size * 0.045
  ctx.lineJoin = 'round'
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

const flights = {
  id: 'flights',
  kind: 'point',
  label: 'Live Flights',
  blurb: 'OpenSky aircraft over the US',
  source: 'OpenSky',
  accent: '#a78bfa',
  Icon: Plane,
  endpoint: '/api/flights',
  refreshMs: 45 * MS.second,
  defaultOn: false, // opt-in: respects OpenSky's anonymous rate limit
  animated: true, // dead-reckon positions between refreshes (see useDeadReckoning)
  // Registered on map load so the symbol layer's icon exists before it renders.
  registerImages(map) {
    if (!map.hasImage('aircraft')) {
      map.addImage('aircraft', makeAircraftIcon(), { pixelRatio: 2 })
    }
  },
  buildLayers(sourceId) {
    return [
      {
        id: `${sourceId}-glow`,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-color': ALT_COLOR,
          'circle-radius': 7,
          'circle-blur': 1,
          'circle-opacity': 0.28,
        },
      },
      {
        // `-core` is the clickable layer; a plane icon rotated by heading.
        id: `${sourceId}-core`,
        type: 'symbol',
        source: sourceId,
        layout: {
          'icon-image': 'aircraft',
          'icon-rotate': ['coalesce', ['get', 'heading'], 0],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 6, 0.85],
        },
      },
    ]
  },
  legend: [
    { color: '#fbbf24', label: 'Low' },
    { color: '#34d399', label: 'Mid' },
    { color: '#22d3ee', label: 'High' },
    { color: '#a78bfa', label: 'Cruise' },
  ],
  toDetail(p) {
    const ft = (m) => (m != null ? `${Math.round(m * 3.281).toLocaleString()} ft` : '—')
    return {
      accent: this.accent,
      headline: p.callsign ? `Flight ${p.callsign}` : `Aircraft ${p.id}`,
      place: p.country ? `Origin: ${p.country}` : 'Unknown origin',
      time: null,
      stats: [
        { label: 'Altitude', value: ft(p.altitude) },
        { label: 'Speed', value: p.velocity != null ? `${Math.round(p.velocity * 1.944)} kt` : '—' },
        { label: 'Heading', value: p.heading != null ? `${Math.round(p.heading)}°` : '—' },
        { label: 'Climb', value: p.verticalRate != null ? `${Math.round(p.verticalRate * 196.85).toLocaleString()} fpm` : '—' },
      ],
      link: p.callsign
        ? { href: `https://www.flightaware.com/live/flight/${encodeURIComponent(p.callsign)}`, label: 'Track on FlightAware' }
        : null,
    }
  },
}

const CONFIDENCE_LABEL = { l: 'Low', n: 'Nominal', h: 'High' }

const wildfires = {
  id: 'wildfires',
  kind: 'point',
  label: 'Wildfires',
  blurb: 'NASA FIRMS active fire detections, 24h',
  source: 'NASA FIRMS',
  accent: '#f97316',
  Icon: Flame,
  endpoint: '/api/fires',
  refreshMs: 10 * MS.minute,
  defaultOn: false, // requires FIRMS_MAP_KEY
  buildLayers(sourceId) {
    // Colour & size by fire radiative power (MW).
    const color = [
      'step',
      ['coalesce', ['get', 'frp'], 0],
      '#fbbf24',
      10, '#fb923c',
      50, '#f97316',
      100, '#ef4444',
      300, '#b91c1c',
    ]
    const radius = [
      'interpolate', ['linear'], ['coalesce', ['get', 'frp'], 0],
      0, 2.5, 50, 6, 200, 11, 500, 17,
    ]
    return glowingPointLayers({
      sourceId,
      color,
      radius,
      glowRadius: ['*', radius, 2.6],
      glowOpacity: 0.4,
    })
  },
  legend: [
    { color: '#fbbf24', label: 'Low' },
    { color: '#f97316', label: 'High' },
    { color: '#ef4444', label: 'Intense' },
    { color: '#b91c1c', label: 'Extreme' },
  ],
  toDetail(p) {
    const conf =
      p.confidence == null
        ? '—'
        : CONFIDENCE_LABEL[p.confidence?.toLowerCase()] ||
          (Number.isFinite(+p.confidence) ? `${p.confidence}%` : p.confidence)
    const time =
      p.acq_time && p.acq_time.length === 4
        ? `${p.acq_time.slice(0, 2)}:${p.acq_time.slice(2)}`
        : p.acq_time
    return {
      accent: this.accent,
      headline: 'Active Fire Detection',
      place: p.acq_date ? `Detected ${p.acq_date}${time ? ` at ${time} UTC` : ''}` : 'Active fire',
      time: p.satellite ? `Satellite ${p.satellite}` : null,
      stats: [
        { label: 'Fire power', value: p.frp != null ? `${p.frp} MW` : '—' },
        { label: 'Confidence', value: conf },
        { label: 'Brightness', value: p.bright != null ? `${p.bright} K` : '—' },
        { label: 'Pass', value: p.daynight === 'D' ? 'Daytime' : p.daynight === 'N' ? 'Nighttime' : '—' },
      ],
      link: null,
    }
  },
}

export const LAYERS = [earthquakes, weatherAlerts, flights, wildfires]

export const LIVE_LAYERS = LAYERS.filter((l) => !l.comingSoon)

export function getLayer(id) {
  return LAYERS.find((l) => l.id === id)
}
