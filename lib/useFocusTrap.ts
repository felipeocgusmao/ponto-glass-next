import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Traps keyboard focus inside a dialog/drawer while it's open, and restores
 * focus to whatever was focused before it opened once it closes.
 *
 * - On mount: moves focus to the first focusable element (or the container).
 * - Tab / Shift+Tab wrap around inside the container instead of escaping to the
 *   page behind the modal.
 * - On unmount: returns focus to the previously-focused element.
 *
 * Attach the returned ref to the dialog panel and give that panel
 * `tabIndex={-1}` so the container itself can hold focus when it has no
 * focusable children yet.
 */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
        // Skip elements that are hidden (display:none makes offsetParent null).
        .filter(el => el.offsetParent !== null || el === document.activeElement)

    // Move focus into the dialog. Wait a tick so animated panels are mounted.
    const focusFirst = () => {
      const items = getFocusable()
      ;(items[0] ?? node).focus?.()
    }
    focusFirst()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) {
        e.preventDefault()
        node.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === first || !node.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else if (activeEl === last || !node.contains(activeEl)) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      // Restore focus only if it's still inside the (closing) dialog, so we
      // don't yank focus away from wherever the user legitimately moved it.
      if (node.contains(document.activeElement)) previouslyFocused?.focus?.()
    }
  }, [active])

  return ref
}
