// src/components/LayerPanel.jsx
import { Lock, RefreshCw } from 'lucide-react'

function timeAgo(ts) {
  if (!ts) return null
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}

export default function LayerPanel({ layers, enabled, dataById, onToggle, onRefresh }) {
  return (
    <div className="pointer-events-auto w-[300px] max-w-[calc(100vw-2rem)] rounded-sm border border-neutral-800 bg-neutral-950/85 backdrop-blur-md shadow-2xl corner-brackets">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white">
            Live Layers
          </h2>
          <p className="text-[11px] text-neutral-500">United States · real-time</p>
        </div>
        <button
          onClick={onRefresh}
          title="Refresh data"
          className="text-neutral-400 hover:text-white transition-colors p-1.5 rounded-sm hover:bg-neutral-800/60"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="p-2 space-y-1.5 max-h-[60vh] overflow-y-auto">
        {layers.map((layer) => {
          const isOn = enabled.has(layer.id)
          const entry = dataById[layer.id]
          const count = entry?.data?.features?.length
          const Icon = layer.Icon

          return (
            <div
              key={layer.id}
              className={`rounded-sm border transition-all ${
                isOn && !layer.comingSoon
                  ? 'border-neutral-700 bg-neutral-900/70'
                  : 'border-transparent hover:border-neutral-800 hover:bg-neutral-900/40'
              }`}
            >
              <button
                disabled={layer.comingSoon}
                onClick={() => onToggle(layer.id)}
                className="w-full flex items-center gap-3 p-2.5 text-left disabled:cursor-not-allowed"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-sm border"
                  style={{
                    color: layer.accent,
                    borderColor: `${layer.accent}40`,
                    background: `${layer.accent}14`,
                    boxShadow: isOn && !layer.comingSoon ? `0 0 14px ${layer.accent}55` : 'none',
                  }}
                >
                  <Icon size={16} />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-white truncate">
                      {layer.label}
                    </span>
                    {layer.comingSoon && (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-neutral-500">
                        <Lock size={9} /> Soon
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-neutral-500 truncate">
                    {layer.blurb}
                  </span>
                </span>

                {!layer.comingSoon && (
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                      isOn ? 'bg-neutral-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      className="absolute top-0.5 h-4 w-4 rounded-full transition-all"
                      style={{
                        left: isOn ? '18px' : '2px',
                        background: isOn ? layer.accent : '#737373',
                      }}
                    />
                  </span>
                )}
              </button>

              {/* Legend + status for an enabled live layer */}
              {isOn && !layer.comingSoon && (
                <div className="px-3 pb-3 pt-1">
                  {layer.legend && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                      {layer.legend.map((item) => (
                        <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                          />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>
                      {entry?.loading
                        ? 'Loading…'
                        : entry?.error
                          ? 'Error loading'
                          : count != null
                            ? `${count} events`
                            : '—'}
                    </span>
                    <span>{timeAgo(entry?.updatedAt)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-neutral-800 text-[10px] text-neutral-600">
        Data: USGS · NWS · NASA · OpenSky
      </div>
    </div>
  )
}
