import './reset-view.css'

/** The way back to a head-on view of the whole wall, after a drag has turned
 *  it and a click has walked into a pile. */
export function ResetView({ sidebarOpen, onReset }: { sidebarOpen: boolean; onReset: () => void }) {
  return (
    <button
      type="button"
      className="reset-view"
      data-sidebar={sidebarOpen ? '' : undefined}
      aria-label="Reset view"
      title="Reset view"
      onClick={onReset}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4" />
        <rect x="5.5" y="5.5" width="5" height="5" />
      </svg>
    </button>
  )
}
