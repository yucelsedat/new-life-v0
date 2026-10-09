import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { FiCopy, FiMoreVertical, FiTrash2 } from 'react-icons/fi'
import { useT } from '../../i18n'

interface WorldActionsMenuProps {
  onDuplicate: () => void
  onDelete: () => void
}

const MENU_GAP = 6
/** Room the menu needs below its button before it opens upwards instead. */
const MENU_HEIGHT = 96

const ITEM = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-sans text-caption font-[700] transition'

/**
 * The rarer, heavier actions of a world row, tucked behind one button. The list lives in
 * a scrolling table, which would clip a menu drawn inside it — so the menu is portalled
 * to the body and pinned to where its button sits on screen.
 */
export default function WorldActionsMenu({ onDuplicate, onDelete }: WorldActionsMenuProps) {
  const t = useT()
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const open = position !== null

  function toggle() {
    if (open || !buttonRef.current) {
      setPosition(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const right = window.innerWidth - rect.right
    setPosition(
      rect.bottom + MENU_GAP + MENU_HEIGHT > window.innerHeight
        ? { right, bottom: window.innerHeight - rect.top + MENU_GAP }
        : { right, top: rect.bottom + MENU_GAP },
    )
  }

  // A click anywhere else is a change of mind — and once the page moves, the menu no
  // longer sits under its button, so it goes too.
  useEffect(() => {
    if (!open) return
    function close() {
      setPosition(null)
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      close()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function choose(action: () => void) {
    setPosition(null)
    action()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        title={t.admin.worlds.optionsButton}
        aria-label={t.admin.worlds.optionsButton}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:border-gold-bright hover:text-gold-bright ${
          open ? 'border-gold-bright text-gold-bright' : 'border-white/15 text-white/70'
        }`}
      >
        <FiMoreVertical className="h-3.5 w-3.5" />
      </button>

      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={position}
            className="fixed z-40 flex min-w-[10rem] flex-col gap-0.5 rounded-xl border border-white/10 bg-abyss/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-md"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(onDuplicate)}
              className={`${ITEM} text-white/80 hover:bg-white/10 hover:text-gold-bright`}
            >
              <FiCopy className="h-3.5 w-3.5" />
              {t.admin.worlds.duplicateButton}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(onDelete)}
              className={`${ITEM} text-white/80 hover:bg-[#e0798f]/15 hover:text-[#e0798f]`}
            >
              <FiTrash2 className="h-3.5 w-3.5" />
              {t.admin.worlds.deleteButton}
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
