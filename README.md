# Bark Pulse — Live USA Map

A live, glowing map of what's happening across the United States right now, inspired by [inframap](https://edu.inframap.org/) but driven by **free, real-time public APIs**. Built on the Bark design system (`@bark/ui`).

![concept](public/map.svg)

## Status

Four live layers wired end-to-end:

| Layer | Source | Key needed | Status |
| --- | --- | --- | --- |
| 🌐 Earthquakes | USGS GeoJSON feed | No | ✅ Live |
| ⛈️ Weather Alerts | NWS (weather.gov) | No | ✅ Live |
| ✈️ Live Flights | OpenSky Network | No (anon, rate-limited) | ✅ Live |
| 🔥 Wildfires | NASA FIRMS | Free key required | ✅ Live |

> **Flights** are off by default and fetched only when toggled on. Aircraft are
> drawn as plane icons rotated by heading and coloured by altitude. OpenSky's
> anonymous tier returns frequent 429s — the proxy caches the last good
> positions so the map stays alive, and `OPENSKY_CLIENT_ID`/`_SECRET`
> (see `.env.example`) lift the limit.
>
> **Wildfires** need a free `FIRMS_MAP_KEY` — without it the layer reports that
> clearly. Get one in ~30s at <https://firms.modaps.eosdis.nasa.gov/api/>.

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
  hooks/useLiveData.js     fetch + auto-refresh enabled live layers
  hooks/useDeadReckoning.js  glides animated point layers between refreshes
  components/
    MapView.jsx            MapLibre map + GeoJSON sources/layers
    LayerPanel.jsx         toggles, legend, live counts
    FeatureDetailModal.jsx bark-ui Modal feature detail
api/
  earthquakes.js           USGS proxy (US-bbox filtered, edge cached)
  alerts.js                NWS active alerts proxy (polygons only, edge cached)
  flights.js               OpenSky proxy (CONUS, airborne; OAuth + stale cache)
  fires.js                 NASA FIRMS proxy (CSV->GeoJSON, needs FIRMS_MAP_KEY)
```

## Roadmap

1. Time scrubber / "past 7 days" window for quakes.
2. Click-to-zoom + share deep links to a feature.
