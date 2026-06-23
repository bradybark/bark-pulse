// src/App.jsx
import { useCallback, useMemo, useState } from 'react'
import { Navbar } from '@bark/ui'
import { Radio } from 'lucide-react'
import MapView from './components/MapView'
import LayerPanel from './components/LayerPanel'
import FeatureDetailModal from './components/FeatureDetailModal'
import { LAYERS, LIVE_LAYERS, getLayer } from './lib/layers'
import { useLiveData } from './hooks/useLiveData'

const Brand = () => (
  <span className="flex items-center gap-2.5">
    <span className="relative flex h-8 w-8 items-center justify-center rounded-sm border border-neutral-800 bg-black">
      <Radio size={17} className="text-cyan-400" />
      <span className="absolute inset-0 rounded-sm ring-1 ring-cyan-400/30 animate-pulse" />
    </span>
    <span className="font-display text-lg font-bold tracking-tight text-white">
      Bark<span className="text-gradient-purple">Pulse</span>
    </span>
  </span>
)

export default function App() {
  const { state: dataById, refresh } = useLiveData()

  const [enabled, setEnabled] = useState(
    () => new Set(LAYERS.filter((l) => l.defaultOn).map((l) => l.id)),
  )
  const [detail, setDetail] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const toggleLayer = useCallback((id) => {
    const layer = getLayer(id)
    if (!layer || layer.comingSoon) return
    setEnabled((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleFeatureClick = useCallback((layer, props) => {
    setDetail(layer.toDetail(props))
    setModalOpen(true)
  }, [])

  const liveCount = useMemo(
    () =>
      LIVE_LAYERS.filter((l) => enabled.has(l.id)).reduce(
        (acc, l) => acc + (dataById[l.id]?.data?.features?.length || 0),
        0,
      ),
    [enabled, dataById],
  )

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-neutral-950">
      <Navbar
        customBrand={<Brand />}
        showToggle={false}
        containerClass="max-w-none mx-auto px-4"
      >
        <span className="hidden sm:flex items-center gap-2 text-xs text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {liveCount.toLocaleString()} live events
        </span>
      </Navbar>

      <div className="absolute inset-x-0 bottom-0 top-16">
        <MapView
          liveLayers={LIVE_LAYERS}
          enabled={enabled}
          dataById={dataById}
          onFeatureClick={handleFeatureClick}
        />

        <div className="pointer-events-none absolute left-4 top-4 z-10">
          <LayerPanel
            layers={LAYERS}
            enabled={enabled}
            dataById={dataById}
            onToggle={toggleLayer}
            onRefresh={refresh}
          />
        </div>
      </div>

      <FeatureDetailModal open={modalOpen} onClose={() => setModalOpen(false)} detail={detail} />
    </div>
  )
}
