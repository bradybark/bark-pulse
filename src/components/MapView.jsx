// src/components/MapView.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre'
import { useDeadReckoning } from '../hooks/useDeadReckoning'

// Free, token-less dark vector basemap from CARTO — matches the bark aesthetic.
const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -98.5,
  latitude: 39.5,
  zoom: 3.6,
}

export default function MapView({ liveLayers, enabled, dataById, onFeatureClick }) {
  const [cursor, setCursor] = useState('grab')
  const mapRef = useRef(null)

  // Register any custom icons (e.g. the rotatable aircraft) once the style is
  // ready, and re-add them if MapLibre reports the image missing at draw time.
  const registerImages = useCallback(
    (map) => liveLayers.forEach((l) => l.registerImages?.(map)),
    [liveLayers],
  )

  const handleLoad = useCallback(
    (e) => {
      const map = e.target
      mapRef.current = map
      registerImages(map)
      map.on('styleimagemissing', () => registerImages(map))
    },
    [registerImages],
  )

  // Only render layers that are both live and toggled on. Areas are drawn
  // first so point layers (quakes, flights) sit on top of alert polygons.
  const visible = useMemo(
    () =>
      liveLayers
        .filter((l) => enabled.has(l.id) && dataById[l.id]?.data)
        .sort((a, b) => (a.kind === 'area' ? 0 : 1) - (b.kind === 'area' ? 0 : 1)),
    [liveLayers, enabled, dataById],
  )

  // Stable getters so the dead-reckoning animation loop reads live values
  // without restarting. The loop glides `animated` layers (flights) between
  // snapshots by projecting each point along its heading/velocity.
  const visibleRef = useRef(visible)
  const dataRef = useRef(dataById)
  useEffect(() => {
    visibleRef.current = visible
    dataRef.current = dataById
  }, [visible, dataById])
  const getMap = useCallback(() => mapRef.current, [])
  const getActiveLayers = useCallback(() => visibleRef.current, [])
  const getDataById = useCallback(() => dataRef.current, [])
  useDeadReckoning(getMap, getActiveLayers, getDataById)

  const interactiveLayerIds = useMemo(
    () => visible.map((l) => `${l.id}-core`),
    [visible],
  )

  const handleClick = useCallback(
    (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const sourceId = feature.layer.source
      const layer = visible.find((l) => l.id === sourceId)
      if (layer) onFeatureClick(layer, feature.properties, e.lngLat)
    },
    [visible, onFeatureClick],
  )

  return (
    <Map
      initialViewState={INITIAL_VIEW}
      mapStyle={BASEMAP}
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={interactiveLayerIds}
      cursor={cursor}
      onLoad={handleLoad}
      onClick={handleClick}
      onMouseEnter={() => setCursor('pointer')}
      onMouseLeave={() => setCursor('grab')}
      attributionControl={{ compact: true }}
      maxBounds={[
        [-180, 15],
        [-50, 73],
      ]}
    >
      <NavigationControl position="bottom-right" showCompass={false} />

      {visible.map((layer) => (
        <Source key={layer.id} id={layer.id} type="geojson" data={dataById[layer.id].data}>
          {layer.buildLayers(layer.id).map((spec) => (
            <Layer key={spec.id} {...spec} />
          ))}
        </Source>
      ))}
    </Map>
  )
}
