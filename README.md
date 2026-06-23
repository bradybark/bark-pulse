# Bark Pulse — Live USA Map

A live, glowing map of what's happening across the United States right now, inspired by [inframap](https://edu.inframap.org/) but driven by **free, real-time public APIs**. Built on the Bark design system (`@bark/ui`).

![concept](public/map.svg)

## Status

**MVP** — one live layer wired end-to-end:

| Layer | Source | Key needed | Status |
| --- | --- | --- | --- |
| 🌐 Earthquakes | USGS GeoJSON feed | No | ✅ Live |
| ⛈️ Weather Alerts | NWS (weather.gov) | No | 🔜 Roadmap |
| 🔥 Wildfires | NASA FIRMS | Free key | 🔜 Roadmap |
| ✈️ Live Flights | OpenSky Network | No (anon) | 🔜 Roadmap |

## Stack

- **Vite + React 19 + Tailwind v4** (same toolchain as `bark-budget`)
- **MapLibre GL** + `react-map-gl` on a free CARTO dark basemap (no Mapbox token)
- **`@bark/ui`** for `Navbar` and `Modal`
- **Vercel serverless functions** (`/api`) proxy + edge-cache the upstream feeds

## Develop

```bash
npm install
npm run dev
```

`npm run dev` runs the `/api` functions via a small Vite dev middleware (see
`vite.config.js`), so you do **not** need the Vercel CLI locally. In production
Vercel runs the functions natively.

## Architecture

Everything is driven by the layer registry in [`src/lib/layers.js`](src/lib/layers.js).
Each live layer declares its API endpoint, how to render itself as MapLibre
style layers (glow + core), a legend, and how to summarise a clicked feature for
the detail modal. **Adding a new data source = adding one object there + one
`/api` proxy.**

```
src/
  lib/layers.js            layer registry (the extensible seam)
  hooks/useLiveData.js     fetch + auto-refresh all live layers
  components/
    MapView.jsx            MapLibre map + GeoJSON sources/layers
    LayerPanel.jsx         toggles, legend, live counts
    FeatureDetailModal.jsx bark-ui Modal feature detail
api/
  earthquakes.js           USGS proxy (US-bbox filtered, edge cached)
```

## Roadmap

1. NWS weather alerts (`/api/alerts`) — polygons, no key.
2. NASA FIRMS wildfires (`/api/fires`) — needs `FIRMS_MAP_KEY`.
3. OpenSky flights (`/api/flights`) — animated aircraft.
4. Time scrubber / "past 7 days" window for quakes.
