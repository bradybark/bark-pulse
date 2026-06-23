# Bark Pulse — Live USA Map

A live, glowing map of what's happening across the United States right now, inspired by [inframap](https://edu.inframap.org/) but driven by **free, real-time public APIs**. Built on the Bark design system (`@bark/ui`).

![concept](public/map.svg)

## Status

Three live layers wired end-to-end (all keyless):

| Layer | Source | Key needed | Status |
| --- | --- | --- | --- |
| 🌐 Earthquakes | USGS GeoJSON feed | No | ✅ Live |
| ⛈️ Weather Alerts | NWS (weather.gov) | No | ✅ Live |
| ✈️ Live Flights | OpenSky Network | No (anon, rate-limited) | ✅ Live |
| 🔥 Wildfires | NASA FIRMS | Free key | 🔜 Roadmap |

> Flights are **off by default** and fetched only when toggled on, to respect
> OpenSky's anonymous rate limit. Set `OPENSKY_USERNAME`/`OPENSKY_PASSWORD`
> (see `.env.example`) to lift it.

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
  alerts.js                NWS active alerts proxy (polygons only, edge cached)
  flights.js               OpenSky proxy (CONUS bbox, airborne, short cache)
```

## Roadmap

1. NASA FIRMS wildfires (`/api/fires`) — needs `FIRMS_MAP_KEY`.
2. Rotated aircraft icons + smooth position interpolation between refreshes.
3. Time scrubber / "past 7 days" window for quakes.
4. Click-to-zoom + share deep links to a feature.
