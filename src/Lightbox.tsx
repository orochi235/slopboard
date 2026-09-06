import { useEffect, useState } from 'react'
import { metaOf } from '@/lightbox-meta.ts'
import type { WallItem } from '@shared/protocol.ts'
import './lightbox.css'

/**
 * A DOM overlay, not a GL quad: full resolution costs the texture budget
 * nothing here, and right-click-save, copy and drag-to-Finder keep working.
 */
export function Lightbox({
  item,
  now,
  onClose,
}: {
  item: WallItem
  now: number
  onClose: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  // The id changes when the viewer moves between images without closing.
  useEffect(() => setLoaded(false), [item.id])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Full resolution image"
      onClick={onClose}
    >
      {/* Above the image, where the caption cannot go: what this is and how
          long it has left is context for the picture, not part of it. */}
      <div className="lightbox__meta" onClick={(e) => e.stopPropagation()}>
        {metaOf(item, now).map((part) => (
          <span className="lightbox__metaPart" key={part}>
            {part}
          </span>
        ))}
      </div>
      <img
        className={`lightbox__img ${loaded ? 'lightbox__img--in' : ''}`}
        src={`/orig/${item.id}`}
        alt=""
        onLoad={() => setLoaded(true)}
        onClick={(e) => e.stopPropagation()}
      />
      {item.name && (
        <figcaption className="lightbox__caption" onClick={(e) => e.stopPropagation()}>
          {item.name}
        </figcaption>
      )}
    </div>
  )
}
