'use client'

export function CopyButton({ value }: { value: string }) {
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(value)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--fg-muted)', padding: '2px 6px', borderRadius: 4,
        fontSize: 11, fontFamily: 'inherit',
      }}
      title="Copiar"
      type="button"
    >
      📋
    </button>
  )
}
