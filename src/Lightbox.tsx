import { useEffect, useState } from 'react'
import './lightbox.css'

/**
 * A DOM overlay, not a GL quad: full resolution costs the texture budget
 * nothing here, and right-click-save, copy and drag-to-Finder keep working.
 */
export function Lightbox({ id, onClose }: { id: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false)

  // The id changes when the viewer moves between images without closing.
  useEffect(() => setLoaded(false), [id])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Full resolution image"
      onClick={onClose}
    >
      <img
        className={`lightbox__img ${loaded ? 'lightbox__img--in' : ''}`}
        src={`/orig/${id}`}
        alt=""
        onLoad={() => setLoaded(true)}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
