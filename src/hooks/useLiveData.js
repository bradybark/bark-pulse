// src/hooks/useLiveData.js
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { LIVE_LAYERS } from '../lib/layers'

const emptyEntry = () => ({ data: null, loading: false, error: null, updatedAt: null })

/**
 * Fetches GeoJSON for the layers that are currently enabled and keeps each one
 * fresh on its own refresh interval. Disabled layers are never fetched — which
 * matters for rate-limited sources like OpenSky. Returns a map of
 * layerId -> { data, loading, error, updatedAt } plus a manual refresh().
 *
 * @param {Set<string>} enabled - ids of layers that should be live
 */
export function useLiveData(enabled) {
  const [state, setState] = useState(() =>
    Object.fromEntries(LIVE_LAYERS.map((l) => [l.id, emptyEntry()])),
  )
  const timers = useRef({})
  // Read latest state inside effects without making them depend on it.
  const stateRef = useRef(state)
  stateRef.current = state

  const fetchLayer = useCallback(async (layer, { silent } = {}) => {
    if (!silent) {
      setState((s) => ({ ...s, [layer.id]: { ...s[layer.id], loading: true, error: null } }))
    }
    try {
      const resp = await fetch(layer.endpoint)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setState((s) => ({
        ...s,
        [layer.id]: { data, loading: false, error: null, updatedAt: Date.now() },
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        [layer.id]: { ...s[layer.id], loading: false, error: String(err) },
      }))
      if (!silent) toast.error(`Couldn't load ${layer.label}`)
    }
  }, [])

  useEffect(() => {
    // Reset all timers, then (re)arm only the enabled layers.
    Object.values(timers.current).forEach(clearInterval)
    timers.current = {}

    LIVE_LAYERS.forEach((layer) => {
      if (!enabled.has(layer.id)) return
      const entry = stateRef.current[layer.id]
      if (!entry?.data && !entry?.loading) fetchLayer(layer)
      if (layer.refreshMs) {
        timers.current[layer.id] = setInterval(
          () => fetchLayer(layer, { silent: true }),
          layer.refreshMs,
        )
      }
    })

    return () => {
      Object.values(timers.current).forEach(clearInterval)
      timers.current = {}
    }
  }, [enabled, fetchLayer])

  const refresh = useCallback(() => {
    LIVE_LAYERS.forEach((layer) => {
      if (enabled.has(layer.id)) fetchLayer(layer)
    })
  }, [enabled, fetchLayer])

  return { state, refresh }
}
