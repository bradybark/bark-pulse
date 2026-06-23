// src/hooks/useLiveData.js
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { LIVE_LAYERS } from '../lib/layers'

/**
 * Fetches every live layer's GeoJSON and keeps it fresh on each layer's
 * refresh interval. Returns a map of layerId -> { data, loading, error,
 * updatedAt } plus a manual refresh().
 */
export function useLiveData() {
  const [state, setState] = useState(() =>
    Object.fromEntries(
      LIVE_LAYERS.map((l) => [l.id, { data: null, loading: true, error: null, updatedAt: null }]),
    ),
  )
  const timers = useRef({})

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
    LIVE_LAYERS.forEach((layer) => {
      fetchLayer(layer)
      if (layer.refreshMs) {
        timers.current[layer.id] = setInterval(
          () => fetchLayer(layer, { silent: true }),
          layer.refreshMs,
        )
      }
    })
    const t = timers.current
    return () => Object.values(t).forEach(clearInterval)
  }, [fetchLayer])

  const refresh = useCallback(() => {
    LIVE_LAYERS.forEach((layer) => fetchLayer(layer))
  }, [fetchLayer])

  return { state, refresh }
}
