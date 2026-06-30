'use client'

import { useEffect } from 'react'

// Liquid-glass reactive highlight (#217): a radial highlight on .kpi surfaces
// that follows the pointer, like light catching the edge of real glass.
//
// Desktop-only — gated on (hover: hover) and (pointer: fine), so it never
// activates on touch (no pointer to follow, and the issue calls out touch as
// low-value here). Respects prefers-reduced-motion (skips entirely).
//
// One delegated document-level pointermove listener, rAF-throttled, updates
// only the currently-hovered element's CSS vars — cheap no matter how many
// .kpi cards are mounted (no per-card listeners, no React state/re-renders).
export function GlassHighlight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let lastEl: HTMLElement | null = null

    function onMove(e: PointerEvent) {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const target = e.target as Element | null
        const el = (target?.closest?.('.kpi') ?? null) as HTMLElement | null
        if (el !== lastEl) {
          lastEl?.style.removeProperty('--mx')
          lastEl?.style.removeProperty('--my')
          lastEl = el
        }
        if (el) {
          const rect = el.getBoundingClientRect()
          el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
          el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`)
        }
      })
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return null
}
