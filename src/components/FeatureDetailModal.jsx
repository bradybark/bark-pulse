// src/components/FeatureDetailModal.jsx
import { Modal } from '@bark/ui'
import { ExternalLink } from 'lucide-react'

export default function FeatureDetailModal({ open, onClose, detail }) {
  if (!detail) return null

  return (
    <Modal isOpen={open} onClose={onClose} title={detail.headline} maxWidth="max-w-sm">
      <div className="space-y-5">
        <div>
          <p className="font-display text-base text-white leading-snug">{detail.place}</p>
          {detail.time && <p className="text-xs text-neutral-500 mt-1">{detail.time}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {detail.stats.map((s) => (
            <div
              key={s.label}
              className="rounded-sm border border-neutral-800 bg-neutral-950/60 px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">{s.label}</div>
              <div
                className="font-display text-lg font-bold"
                style={{ color: s.label === 'Magnitude' ? detail.accent : '#f5f5f5' }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {detail.link && (
          <a
            href={detail.link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: detail.accent }}
          >
            {detail.link.label}
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </Modal>
  )
}
