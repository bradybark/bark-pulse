// src/hooks/useDeadReckoning.js
//
// Smoothly "flies" point features between data refreshes by projecting each
// one forward along its heading at its velocity every animation frame
// (dead-reckoning, like real flight trackers). When a fresh snapshot arrives
// the positions reset to the authoritative values.
//
// The MapLibre source is updated imperatively (setData) rather than through
// React state, so animating thousands of aircraft doesn't trigger re-renders.
//
// A layer opts in with `animated: true` and point properties:
//   - heading  : degrees clockwise from north
//   - velocity : ground speed in m/s

import { useEffect, useRef } from 'react'

const EARTH_R = 6_371_000 // metres
const DEG = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const TICK_MS = 120 // ~8 fps — plenty smooth for slow-moving map points

// Pre-build reusable feature objects + flat base arrays for one snapshot so the
// per-frame loop only mutates coordinate numbers (minimal allocation/GC).
function buildState(data) {
  const n = data.features.length
  const bases = new Array(n)
  const features = new Array(n)
  for (let i = 0; i < n; i++) {
    const f = data.features[i]
    const [lon, lat] = f.geometry.coordinates
    const p = f.properties
    bases[i] = { lon, lat, hd: (p.heading ?? 0) * DEG, sp: p.velocity ?? 0, cosLat: Math.cos(lat * DEG) }
    features[i] = { type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [lon, lat] } }
  }
  return { ref: data, bases, work: { type: 'FeatureCollection', features }, baseT: performance.now() }
}

export function useDeadReckoning(getMap, getActiveLayers, getDataById) {
  const states = useRef({}) // layerId -> snapshot animation state

  useEffect(() => {
    let raf
    let last = 0

    const tick = (t) => {
      raf = requestAnimationFrame(tick)
      const map = getMap()
      if (!map || t - last < TICK_MS) return
      last = t

      const now = performance.now()
      const seen = new Set()

      for (const layer of getActiveLayers()) {
        if (!layer.animated) continue
        const data = getDataById()[layer.id]?.data
        const src = map.getSource?.(layer.id)
        if (!data?.features?.length || !src) continue
        seen.add(layer.id)

        let st = states.current[layer.id]
        if (!st || st.ref !== data) {
          st = states.current[layer.id] = buildState(data)
        }

        const dt = (now - st.baseT) / 1000
        const { bases, work } = st
        for (let i = 0; i < bases.length; i++) {
          const b = bases[i]
          const coords = work.features[i].geometry.coordinates
          if (!b.sp) continue // parked / unknown speed: leave at base position
          const dist = b.sp * dt
          coords[1] = b.lat + (dist * Math.cos(b.hd)) / EARTH_R * RAD_TO_DEG
          coords[0] = b.lon + (dist * Math.sin(b.hd)) / (EARTH_R * b.cosLat) * RAD_TO_DEG
        }
        src.setData(work)
      }

      // Drop state for layers that are no longer animating.
      for (const id of Object.keys(states.current)) {
        if (!seen.has(id)) delete states.current[id]
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [getMap, getActiveLayers, getDataById])
}
