import { useEffect, useRef, useState } from 'react'
import { FiMove } from 'react-icons/fi'
import { useT } from '../../i18n'
import type { SceneLink } from '../../types/world'

interface LinkMoveMenuProps {
  /** The links on the view on screen — one, unless the scene predates one-link-per-view. */
  links: SceneLink[]
  /** Every link of the scene, to tell which views are already taken. */
  allLinks: SceneLink[]
  /** The active option's views in turning order, the option image (offset 0) included. */
  views: { offset: number; imageUrl: string }[]
  currentOffset: number
  disabled: boolean
  onMove: (linkId: string, offset: number) => void
}

function offsetLabel(offset: number) {
  return offset > 0 ? `+${offset}` : String(offset)
}

/**
 * Hangs the link on screen onto another angle of the same scene. Views are shown as the
 * option looks from each one, and a view that already holds an exit cannot take another.
 */
export default function LinkMoveMenu({ links, allLinks, views, currentOffset, disabled, onMove }: LinkMoveMenuProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // A click anywhere else is a change of mind.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const hasElsewhere = views.some((view) => view.offset !== currentOffset)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled || !hasElsewhere}
        title={hasElsewhere ? undefined : t.admin.linkMove.noOtherAngle}
        className={`flex items-center gap-2 rounded-full border bg-black/50 px-4 py-2 font-sans text-caption font-[700] backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/80 ${
          open ? 'border-gold-bright text-gold-bright' : 'border-white/15 text-white/80'
        }`}
      >
        <FiMove className="h-3.5 w-3.5" />
        {t.admin.linkMove.button}
      </button>

      {open && (
        <div className="absolute bottom-0 left-full ml-3 flex w-max max-w-[min(32rem,calc(100vw-16rem))] flex-col gap-3 rounded-2xl border border-white/10 bg-black/75 p-3 backdrop-blur-md">
          {links.map((link) => (
            <div key={link.id} className="flex flex-col gap-2">
              <p className="font-sans text-micro font-[800] uppercase tracking-widest text-mist">
                {t.admin.linkMove.title.replace('{label}', link.label)}
              </p>
              <div className="flex flex-wrap gap-2">
                {views.map((view) => {
                  const isHere = view.offset === currentOffset
                  const taken = allLinks.some((other) => other.id !== link.id && other.angleOffset === view.offset)
                  return (
                    <button
                      key={view.offset}
                      type="button"
                      disabled={isHere || taken}
                      title={isHere ? t.admin.linkMove.here : taken ? t.admin.linkMove.taken : undefined}
                      onClick={() => {
                        setOpen(false)
                        onMove(link.id, view.offset)
                      }}
                      className={`relative h-12 w-16 overflow-hidden rounded-lg border-2 transition ${
                        isHere
                          ? 'border-gold-bright'
                          : taken
                            ? 'cursor-not-allowed border-transparent opacity-35'
                            : 'border-transparent hover:border-white/40'
                      }`}
                    >
                      <img src={view.imageUrl} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 py-px text-center font-mono text-micro tabular-nums text-white/85">
                        {view.offset === 0 ? t.admin.angle.baseView : offsetLabel(view.offset)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
