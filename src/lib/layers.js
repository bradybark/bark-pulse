// src/lib/layers.js
//
// Central registry of map data layers. Each "live" layer knows how to:
//   1. fetch its GeoJSON (via a serverless proxy under /api)
//   2. render itself as one or more MapLibre style layers (glow + core)
//   3. summarise a clicked feature for the detail modal
//
// Adding a new source (NWS alerts, NASA FIRMS fires, OpenSky flights, ...) is
// just another object in LAYERS — the map, sidebar and legend are all driven
// from this file.

import { Activity, CloudLightning, Flame, Plane } from 'lucide-react'

const MS = { minute: 60_000 }

/**
 * Build the paired MapLibre layer specs (soft glow + crisp core) for a
 * point layer coloured/sized by a numeric property.
 */
function glowingPointLayers({ sourceId, accent, sizeProp, colorSteps, sizeStops }) {
  const radius = [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', sizeProp], 0],
    ...sizeStops.flat(),
  ]

  const color = [
    'step',
    ['coalesce', ['get', sizeProp], 0],
    colorSteps[0].color,
    ...colorSteps.slice(1).flatMap((s) => [s.at, s.color]),
  ]

  return [
    {
      id: `${sourceId}-glow`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': color,
        'circle-radius': ['*', radius, 2.4],
        'circle-blur': 1,
        'circle-opacity': 0.35,
      },
    },
    {
      id: `${sourceId}-core`,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': color,
        'circle-radius': radius,
        'circle-stroke-color': accent,
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.9,
        'circle-opacity': 0.95,
      },
    },
  ]
}

const earthquakes = {
  id: 'earthquakes',
  label: 'Earthquakes',
  blurb: 'USGS seismic events, past 24h',
  source: 'USGS',
  accent: '#22d3ee',
  Icon: Activity,
  endpoint: '/api/earthquakes',
  refreshMs: 5 * MS.minute,
  defaultOn: true,
  // The property used for sizing/colour (earthquake magnitude).
  sizeProp: 'mag',
  buildLayers(sourceId) {
    return glowingPointLayers({
      sourceId,
      accent: this.accent,
      sizeProp: 'mag',
      colorSteps: [
        { color: '#38bdf8' }, // < 2
        { at: 2, color: '#22d3ee' },
        { at: 3, color: '#a78bfa' },
        { at: 4, color: '#fbbf24' },
        { at: 5, color: '#f87171' },
      ],
      // magnitude -> radius (px). Tiny tremors stay small, big quakes bloom.
      sizeStops: [
        [0, 3],
        [2, 6],
        [4, 12],
        [6, 22],
        [8, 34],
      ],
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
      title: p.title || p.place || 'Earthquake',
      accent: this.accent,
      headline: p.mag != null ? `Magnitude ${Number(p.mag).toFixed(1)}` : 'Magnitude —',
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

// Roadmap layers — visible in the sidebar as "coming soon" so the Live USA
// Pulse vision is legible, wired the moment each proxy lands.
const comingSoon = [
  {
    id: 'weather-alerts',
    label: 'Weather Alerts',
    blurb: 'NWS active warnings & watches',
    source: 'weather.gov',
    accent: '#fb923c',
    Icon: CloudLightning,
    comingSoon: true,
  },
  {
    id: 'wildfires',
    label: 'Wildfires',
    blurb: 'NASA FIRMS active fire detections',
    source: 'NASA FIRMS',
    accent: '#f87171',
    Icon: Flame,
    comingSoon: true,
  },
  {
    id: 'flights',
    label: 'Live Flights',
    blurb: 'OpenSky aircraft positions',
    source: 'OpenSky',
    accent: '#a78bfa',
    Icon: Plane,
    comingSoon: true,
  },
]

export const LAYERS = [earthquakes, ...comingSoon]

export const LIVE_LAYERS = LAYERS.filter((l) => !l.comingSoon)

export function getLayer(id) {
  return LAYERS.find((l) => l.id === id)
}
