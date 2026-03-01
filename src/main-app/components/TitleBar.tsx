export function TitleBar() {
  const send = (channel: string) => {
    window.electronAPI?.send(channel)
  }

  return (
    <div
      className="flex items-center justify-between h-8 px-3 flex-shrink-0 select-none"
      style={{
        // @ts-expect-error: Electron CSS property for window dragging
        WebkitAppRegion: 'drag',
        background: 'var(--hextech-blue-3)',
        borderBottom: '1px solid rgba(200, 155, 60, 0.15)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="var(--hextech-gold)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className="w-3.5 h-3.5">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
        <span className="text-xs font-display font-bold tracking-wide" style={{ color: 'var(--hextech-gold-light)' }}>
          ma<span style={{ color: 'var(--hextech-gold)' }}>K</span>ro
          <span className="font-sans font-normal opacity-50 ml-1">Compass</span>
        </span>
      </div>

      {/* Window controls */}
      <div
        className="flex items-center gap-0.5"
        style={{
          // @ts-expect-error: Electron CSS property
          WebkitAppRegion: 'no-drag',
        }}
      >
        <button
          onClick={() => send('window:minimize')}
          className="w-7 h-6 flex items-center justify-center rounded-sm transition-colors hover:bg-white/10"
          title="Minimiser"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="var(--hextech-silver)" />
          </svg>
        </button>
        <button
          onClick={() => send('window:maximize')}
          className="w-7 h-6 flex items-center justify-center rounded-sm transition-colors hover:bg-white/10"
          title="Maximiser"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="var(--hextech-silver)" strokeWidth="1.2">
            <rect x="0.5" y="0.5" width="8" height="8" />
          </svg>
        </button>
        <button
          onClick={() => send('window:close')}
          className="w-7 h-6 flex items-center justify-center rounded-sm transition-colors hover:bg-red-500/80"
          title="Fermer"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="var(--hextech-silver)" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  )
}
