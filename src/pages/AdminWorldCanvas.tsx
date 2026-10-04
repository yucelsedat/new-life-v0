import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiArrowLeft, FiImage, FiLink, FiMinus, FiPlus, FiX } from 'react-icons/fi'
import { LuMagnet } from 'react-icons/lu'
import { useT } from '../i18n'
import { useWorldCanvas } from '../hooks/useWorldCanvas'
import { useUsedImages } from '../hooks/useUsedImages'
import GalleryPickerModal from '../components/admin/GalleryPickerModal'
import { DialFace, DialHand } from '../components/admin/HeadingDial'
import { clamp } from '../utils/helpers'
import { headingHour, headingTowards, headingVector, ringHands, type RingHand } from '../utils/heading'
import type { SceneLink, WorldScene } from '../types/world'

/** Radius of a scene's angle ring, in canvas units. */
const RING_R = 68
const HAND_LENGTH = RING_R - 14
/** Width of the image a hand shows on hover, in screen pixels — it does not shrink with the zoom. */
const PREVIEW_W = 360
/** How close to the edge of the window that image may come, in screen pixels. */
const PREVIEW_MARGIN = 12
/** The clear space kept between a ring's rim and the image, in screen pixels. */
const PREVIEW_GAP = 12
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2

interface Vec2 {
  x: number
  y: number
}

function fallbackPosition(index: number): Vec2 {
  const col = index % 4
  const row = Math.floor(index / 4)
  return { x: 140 + col * 260, y: 140 + row * 220 }
}

/**
 * Where the centre of a `width` × `height` box sits, relative to a ring's centre, when it
 * lies along `heading` and the box just clears a circle of `radius` — the image at the
 * tip of a hand, touching the ring but never over it, whichever way the hand points.
 */
function besideRing(heading: number, width: number, height: number, radius: number): Vec2 {
  const { x, y } = headingVector(heading)
  // How far the box stands from the ring's centre with its own centre `distance` out.
  const reach = (distance: number) =>
    Math.hypot(
      Math.max(Math.abs(x * distance) - width / 2, 0),
      Math.max(Math.abs(y * distance) - height / 2, 0),
    )

  // Far enough out to clear the circle whatever the heading; then close in on the rim.
  let near = 0
  let far = radius + Math.hypot(width, height) / 2
  for (let pass = 0; pass < 24; pass++) {
    const middle = (near + far) / 2
    if (reach(middle) < radius) near = middle
    else far = middle
  }
  return { x: x * far, y: y * far }
}

/** How far a box overruns the window, margins included. Zero when it fits. */
function overrun(left: number, top: number, width: number, height: number): number {
  return (
    Math.max(PREVIEW_MARGIN - left, 0) +
    Math.max(left + width - (window.innerWidth - PREVIEW_MARGIN), 0) +
    Math.max(PREVIEW_MARGIN - top, 0) +
    Math.max(top + height - (window.innerHeight - PREVIEW_MARGIN), 0)
  )
}

interface PositionedScene extends WorldScene {
  px: number
  py: number
}

/** A ring hand together with the image it stands for. `angleId` null is the scene's own image. */
interface SceneHand extends RingHand {
  angleId: string | null
  imageUrl: string
}

/**
 * A scene on the canvas: a clock-like ring with one hand per image the scene can be seen
 * from — its own, and each angle of its base option. A hand points the way that image
 * looks; hovering it shows the image at its tip, dragging it turns it.
 */
function CanvasNode({
  scene,
  zoom,
  connecting,
  isConnectSource,
  onDragEnd,
  onStartConnect,
  onCompleteConnect,
  onHeadingChange,
  onMagneticChange,
}: {
  scene: PositionedScene
  zoom: number
  connecting: boolean
  isConnectSource: boolean
  onDragEnd: (sceneId: string, x: number, y: number) => void
  onStartConnect: (sceneId: string) => void
  onCompleteConnect: (sceneId: string) => void
  onHeadingChange: (sceneId: string, angleId: string | null, heading: number) => void
  onMagneticChange: (sceneId: string, angleId: string | null, magnetic: boolean) => void
}) {
  const t = useT()
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startRef = useRef({ px: 0, py: 0, wx: 0, wy: 0 })
  const [dragPos, setDragPos] = useState<Vec2 | null>(null)
  const pos = dragPos ?? { x: scene.px, y: scene.py }

  const ringRef = useRef<SVGSVGElement>(null)
  /** Offset of the hand being turned, while the pointer is down on it. */
  const turningRef = useRef<number | null>(null)
  const [turn, setTurn] = useState<{ offset: number; heading: number } | null>(null)
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)

  // The canvas has no option on screen, so the ring is the scene as it opens: the base option.
  const baseAngles = scene.angles?.base ?? []
  const hands: SceneHand[] = ringHands(scene.heading, baseAngles, scene.magnetic).map((hand) => {
    const angle = baseAngles.find((item) => item.offset === hand.offset)
    return {
      ...hand,
      heading: turn?.offset === hand.offset ? turn.heading : hand.heading,
      angleId: angle?.id ?? null,
      imageUrl: angle?.imageUrl ?? scene.imageUrl,
    }
  })
  const activeOffset = turn?.offset ?? hoveredOffset
  const activeHand = hands.find((hand) => hand.offset === activeOffset)

  const previewRef = useRef<HTMLDivElement>(null)

  /**
   * Puts the hovered image at the tip of its hand, outside the ring. Next to an edge of
   * the window there may be no room there; the image then slides round the ring to the
   * nearest side that has some, and never back over the ring itself. Worked out in
   * screen pixels, which is what the preview is laid out in — it is scaled back against
   * the zoom.
   */
  function placePreview() {
    const preview = previewRef.current
    const ring = ringRef.current?.getBoundingClientRect()
    if (!preview || !ring || !activeHand) return

    const width = preview.offsetWidth
    const height = preview.offsetHeight
    const centre = { x: ring.left + ring.width / 2, y: ring.top + ring.height / 2 }
    const radius = ring.width / 2 + PREVIEW_GAP

    // Swinging further from the hand each time: 0°, ±15°, ±30° … round to the far side.
    const swings = [0]
    for (let swing = 15; swing < 180; swing += 15) swings.push(swing, -swing)
    swings.push(180)

    let best = besideRing(activeHand.heading, width, height, radius)
    let leastOverrun = Infinity
    for (const swing of swings) {
      const spot = besideRing(activeHand.heading + swing, width, height, radius)
      const over = overrun(centre.x + spot.x - width / 2, centre.y + spot.y - height / 2, width, height)
      if (over < leastOverrun) {
        best = spot
        leastOverrun = over
      }
      if (over === 0) break
    }
    preview.style.translate = `${best.x - width / 2}px ${best.y - height / 2}px`
  }

  // Every render: panning, zooming, dragging the ring and turning the hand all move it.
  useLayoutEffect(placePreview)

  /**
   * The marks a hand cannot be turned onto. The scene's own image fronts every option,
   * so it keeps clear of all their angles; an angle only of the hands on its own ring.
   */
  function takenHeadings(hand: SceneHand): Set<number> {
    if (hand.angleId === null) {
      const everyAngle = Object.values(scene.angles ?? {}).flat()
      return new Set(everyAngle.flatMap((angle) => (angle.heading === null ? [] : [angle.heading])))
    }
    return new Set(
      hands.filter((other) => other.offset !== hand.offset && other.isSet).map((other) => other.heading),
    )
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (connecting) return
    draggingRef.current = true
    movedRef.current = false
    startRef.current = { px: event.clientX, py: event.clientY, wx: scene.px, wy: scene.py }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = (event.clientX - startRef.current.px) / zoom
    const dy = (event.clientY - startRef.current.py) / zoom
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true
    setDragPos({ x: startRef.current.wx + dx, y: startRef.current.wy + dy })
  }

  function handlePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (movedRef.current && dragPos) {
      onDragEnd(scene.id, dragPos.x, dragPos.y)
    }
    setDragPos(null)
  }

  function handleClick(event: ReactMouseEvent) {
    event.stopPropagation()
    if (connecting && !isConnectSource) onCompleteConnect(scene.id)
  }

  function handleHandPointerDown(event: ReactPointerEvent<SVGGElement>, hand: SceneHand) {
    // While connecting, the whole ring is a click target for the scene.
    if (connecting) return
    // Grabbing a hand turns it; it must not drag the ring along.
    event.stopPropagation()
    turningRef.current = hand.offset
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleHandPointerMove(event: ReactPointerEvent<SVGGElement>, hand: SceneHand) {
    if (turningRef.current !== hand.offset) return
    const rect = ringRef.current?.getBoundingClientRect()
    if (!rect) return
    const heading = headingTowards(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
    )
    // A taken mark is skipped rather than refused: the hand waits on its last free one.
    if (!takenHeadings(hand).has(heading)) setTurn({ offset: hand.offset, heading })
  }

  function handleHandPointerUp(hand: SceneHand) {
    if (turningRef.current !== hand.offset) return
    turningRef.current = null
    if (turn) {
      const stored = hand.angleId === null ? scene.heading : baseAngles.find((a) => a.id === hand.angleId)?.heading
      // Letting go of a guessed hand where it already stands still settles it there.
      if (turn.heading !== stored) onHeadingChange(scene.id, hand.angleId, turn.heading)
    }
    setTurn(null)
  }

  const ringStroke = isConnectSource ? 'var(--color-gold-bright)' : 'rgba(255,255,255,0.22)'

  return (
    <div
      style={{ left: pos.x, top: pos.y, width: RING_R * 2, height: RING_R * 2, zIndex: activeHand ? 30 : undefined }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      className={`group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full active:cursor-grabbing ${
        connecting && !isConnectSource ? 'cursor-pointer' : ''
      }`}
    >
      <svg
        ref={ringRef}
        viewBox={`${-RING_R} ${-RING_R} ${RING_R * 2} ${RING_R * 2}`}
        className="h-full w-full touch-none select-none overflow-visible"
      >
        {/* Filled, so the link lines running to the centre stop at the rim. */}
        <circle
          r={RING_R - 1}
          fill="var(--color-abyss)"
          stroke={ringStroke}
          strokeWidth={2}
          className={connecting && !isConnectSource ? 'transition group-hover:stroke-gold-bright' : 'transition'}
        />
        <DialFace radius={RING_R - 5} />

        {/* The hand under the cursor is drawn last, on top of any it crosses. */}
        {[...hands]
          .sort((a, b) => Number(a.offset === activeOffset) - Number(b.offset === activeOffset))
          .map((hand) => {
            const { x, y } = headingVector(hand.heading)
            return (
              <g
                key={hand.offset}
                className={connecting ? undefined : 'cursor-grab active:cursor-grabbing'}
                onPointerEnter={() => setHoveredOffset(hand.offset)}
                onPointerLeave={() => setHoveredOffset((prev) => (prev === hand.offset ? null : prev))}
                onPointerDown={(event) => handleHandPointerDown(event, hand)}
                onPointerMove={(event) => handleHandPointerMove(event, hand)}
                onPointerUp={() => handleHandPointerUp(hand)}
                // A hand with no heading on record has nowhere on the ring to pull towards.
                onDoubleClick={() =>
                  !connecting && hand.isSet && onMagneticChange(scene.id, hand.angleId, !hand.magnetic)
                }
              >
                <DialHand
                  heading={hand.heading}
                  length={HAND_LENGTH}
                  dashed={!hand.isSet}
                  magnetic={hand.magnetic}
                  active={hand.offset === activeOffset}
                />
                {/* A generous hit area, kept off the hub where every hand meets. */}
                <line
                  x1={x * 12}
                  y1={y * 12}
                  x2={x * (HAND_LENGTH + 8)}
                  y2={y * (HAND_LENGTH + 8)}
                  stroke="transparent"
                  strokeWidth={16}
                  strokeLinecap="round"
                />
              </g>
            )
          })}
        <circle r={4} fill="#f2f0e8" className="pointer-events-none" />
      </svg>

      <span className="pointer-events-none absolute left-1/2 top-full mt-2 max-w-[200px] -translate-x-1/2 truncate rounded-full border border-white/10 bg-black/70 px-3 py-1 font-sans text-caption font-[700] text-white/90">
        {scene.name}
      </span>

      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onStartConnect(scene.id)
        }}
        className={`absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full transition ${
          isConnectSource ? 'bg-gold-bright text-abyss' : 'bg-black/60 text-white/70 hover:text-gold-bright'
        }`}
      >
        <FiLink className="h-3 w-3" />
      </button>

      {activeHand && (
        // Laid out from the ring's centre and scaled back against the zoom, so the image
        // is as large on a zoomed-out canvas as on a close one. placePreview moves it out
        // past the rim.
        <div
          className="pointer-events-none absolute"
          style={{ left: RING_R, top: RING_R, transform: `scale(${1 / zoom})`, transformOrigin: '0 0' }}
        >
          <div ref={previewRef} className="absolute left-0 top-0" style={{ width: PREVIEW_W }}>
            <motion.div
              key={activeHand.offset}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className={`overflow-hidden rounded-2xl border-2 bg-abyss shadow-[0_24px_60px_rgba(0,0,0,0.65)] ${
                activeHand.magnetic ? 'border-gold-bright' : 'border-white/40'
              }`}
            >
              <img
                src={activeHand.imageUrl}
                alt={scene.name}
                className="block w-full"
                draggable={false}
                // The box only gets its height once the image has arrived.
                onLoad={placePreview}
              />
              <div className="flex items-baseline justify-between gap-3 px-3.5 py-2">
                <span className="flex min-w-0 items-center gap-2 font-sans text-caption font-[700] text-white/90">
                  <span className="truncate">{t.admin.heading.angleHand}</span>
                  {activeHand.magnetic && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold-bright px-2 py-0.5 font-mono text-micro font-[400] text-abyss">
                      <LuMagnet className="h-3 w-3" />
                      {t.admin.magnet.badge}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-micro text-gold-bright">
                  {activeHand.isSet || turn
                    ? t.admin.heading.hour.replace('{n}', String(headingHour(activeHand.heading)))
                    : t.admin.heading.unset}
                </span>
              </div>
              <p className="border-t border-white/10 px-3.5 py-1.5 font-sans text-micro text-mist">
                {t.admin.magnet.canvasHint}
              </p>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ConnectModalProps {
  open: boolean
  isSubmitting: boolean
  onConfirm: (label: string) => void
  onCancel: () => void
}

function ConnectModal({ open, isSubmitting, onConfirm, onCancel }: ConnectModalProps) {
  const t = useT()
  const [label, setLabel] = useState('')

  function handleClose() {
    setLabel('')
    onCancel()
  }

  function handleConfirm() {
    if (!label.trim()) return
    onConfirm(label.trim())
    setLabel('')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-abyss p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-h2 font-[300] text-white/95">{t.admin.canvas.connectModalTitle}</h3>
              <button type="button" onClick={handleClose} className="text-white/50 transition hover:text-white">
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-caption font-[700] text-white/70">{t.admin.canvas.linkNameLabel}</span>
              <input
                autoFocus
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t.admin.editor.modal.namePlaceholder}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-sans text-body text-white/90 outline-none transition focus:border-gold-bright"
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-white/15 px-5 py-3 font-sans text-body text-white/70 transition hover:border-white/30"
              >
                {t.admin.canvas.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!label.trim() || isSubmitting}
                className="rounded-xl bg-gradient-to-r from-gold to-gold-bright px-5 py-3 font-sans text-body font-[700] text-abyss transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? t.admin.editor.creating : t.admin.canvas.confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function AdminWorldCanvas() {
  const t = useT()
  const { worldId } = useParams<{ worldId: string }>()
  const { scenes, links, isLoading, createScene, connectScenes, updateScenePosition, updateHeading, updateMagnetic } =
    useWorldCanvas(worldId ?? '')
  const { usedUrls, refetchUsed } = useUsedImages(worldId ?? '')

  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState<Vec2>({ x: 80, y: 80 })
  const [zoom, setZoom] = useState(1)
  const panStateRef = useRef({ panning: false, startClient: { x: 0, y: 0 }, startPan: { x: 0, y: 0 } })

  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addSceneOpen, setAddSceneOpen] = useState(false)

  const positionedScenes = useMemo<PositionedScene[]>(
    () =>
      scenes.map((scene, index) => {
        const fallback = fallbackPosition(index)
        return {
          ...scene,
          px: scene.canvasX ?? fallback.x,
          py: scene.canvasY ?? fallback.y,
        }
      }),
    [scenes],
  )

  const positionById = useMemo(() => {
    const map = new Map<string, PositionedScene>()
    for (const scene of positionedScenes) map.set(scene.id, scene)
    return map
  }, [positionedScenes])

  const uniqueEdges = useMemo(() => {
    const seen = new Map<string, { forward: SceneLink; backward?: SceneLink }>()
    for (const link of links) {
      const key = [link.fromSceneId, link.toSceneId].sort().join('|')
      const existing = seen.get(key)
      if (existing) existing.backward = link
      else seen.set(key, { forward: link })
    }
    return Array.from(seen.values())
  }, [links])

  function handleBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (connectSourceId) {
      setConnectSourceId(null)
      return
    }
    panStateRef.current = {
      panning: true,
      startClient: { x: event.clientX, y: event.clientY },
      startPan: { ...pan },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleBackgroundPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panStateRef.current.panning) return
    const dx = event.clientX - panStateRef.current.startClient.x
    const dy = event.clientY - panStateRef.current.startClient.y
    setPan({ x: panStateRef.current.startPan.x + dx, y: panStateRef.current.startPan.y + dy })
  }

  function handleBackgroundPointerUp() {
    panStateRef.current.panning = false
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top
    const worldX = (cursorX - pan.x) / zoom
    const worldY = (cursorY - pan.y) / zoom
    const nextZoom = clamp(zoom * (1 - event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM)
    setZoom(nextZoom)
    setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom })
  }

  function applyZoom(factor: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    const cursorX = rect ? rect.width / 2 : 0
    const cursorY = rect ? rect.height / 2 : 0
    const worldX = (cursorX - pan.x) / zoom
    const worldY = (cursorY - pan.y) / zoom
    const nextZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM)
    setZoom(nextZoom)
    setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom })
  }

  const handleStartConnect = useCallback((sceneId: string) => {
    setConnectSourceId((prev) => (prev === sceneId ? null : sceneId))
  }, [])

  const handleCompleteConnect = useCallback((targetId: string) => {
    setPendingTargetId(targetId)
  }, [])

  async function handleConnectConfirm(label: string) {
    if (!connectSourceId || !pendingTargetId) return
    setIsSubmitting(true)
    try {
      await connectScenes(connectSourceId, pendingTargetId, label)
    } finally {
      setIsSubmitting(false)
      setConnectSourceId(null)
      setPendingTargetId(null)
    }
  }

  async function handleAddScene(name: string, imageUrl: string, heading: number, magnetic: boolean) {
    setIsSubmitting(true)
    try {
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
      const cy = rect ? (rect.height / 2 - pan.y) / zoom : 200
      await createScene(name, imageUrl, cx, cy, heading, magnetic)
      await refetchUsed()
    } finally {
      setIsSubmitting(false)
      setAddSceneOpen(false)
    }
  }

  const hasNoScenes = !isLoading && scenes.length === 0

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-6 py-5">
        <Link
          to={`/admin/worlds/${worldId}`}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 font-sans text-caption text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
        >
          <FiArrowLeft className="h-3.5 w-3.5" />
          {t.admin.canvas.backToEditor}
        </Link>

        <div className="pointer-events-auto flex items-center gap-2">
          {connectSourceId && (
            <span className="rounded-full border border-gold-bright/40 bg-black/50 px-4 py-2 font-sans text-caption text-gold-bright backdrop-blur-md">
              {t.admin.canvas.connectHint}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAddSceneOpen(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-4 py-2 font-sans text-caption font-[700] text-abyss transition hover:brightness-105"
          >
            <FiImage className="h-3.5 w-3.5" />
            {t.admin.canvas.addScene}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handleBackgroundPointerMove}
        onPointerUp={handleBackgroundPointerUp}
        onWheel={handleWheel}
        className="h-full w-full cursor-grab bg-[radial-gradient(circle,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px] active:cursor-grabbing"
      >
        <div
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
          className="absolute inset-0"
        >
          <svg
            className="pointer-events-none absolute left-0 top-0"
            style={{ width: 4000, height: 4000, overflow: 'visible' }}
          >
            {uniqueEdges.map(({ forward, backward }) => {
              const from = positionById.get(forward.fromSceneId)
              const to = positionById.get(forward.toSceneId)
              if (!from || !to) return null
              const midX = (from.px + to.px) / 2
              const midY = (from.py + to.py) / 2
              return (
                <g key={forward.id}>
                  <line
                    x1={from.px}
                    y1={from.py}
                    x2={to.px}
                    y2={to.py}
                    stroke="rgba(232,199,102,0.4)"
                    strokeWidth={2}
                  />
                  <text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    className="fill-gold-bright"
                    style={{ font: '600 11px var(--font-mono)' }}
                  >
                    {backward ? `${forward.label} ⇄ ${backward.label}` : forward.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {positionedScenes.map((scene) => (
            <CanvasNode
              key={scene.id}
              scene={scene}
              zoom={zoom}
              connecting={connectSourceId !== null}
              isConnectSource={connectSourceId === scene.id}
              onDragEnd={updateScenePosition}
              onStartConnect={handleStartConnect}
              onCompleteConnect={handleCompleteConnect}
              onHeadingChange={updateHeading}
              onMagneticChange={updateMagnetic}
            />
          ))}
        </div>
      </div>

      {hasNoScenes && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setAddSceneOpen(true)}
            className="group pointer-events-auto flex flex-col items-center gap-4"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition group-hover:border-gold-bright group-hover:text-gold-bright">
              <FiImage className="h-8 w-8" />
            </span>
            <span className="font-display text-h2 font-[300] text-white/90 transition group-hover:text-gold-bright">
              {t.admin.editor.firstScenePrompt}
            </span>
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => applyZoom(1.2)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
        >
          <FiPlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => applyZoom(1 / 1.2)}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur-md transition hover:border-gold-bright hover:text-gold-bright"
        >
          <FiMinus className="h-4 w-4" />
        </button>
      </div>

      <GalleryPickerModal
        scope={{ worldId, kind: 'scene' }}
        hiddenUrls={usedUrls}
        open={addSceneOpen}
        withHeading
        nameLabel={t.admin.editor.modal.sceneNameLabel}
        isSubmitting={isSubmitting}
        onConfirm={handleAddScene}
        onCancel={() => setAddSceneOpen(false)}
      />

      <ConnectModal
        open={pendingTargetId !== null}
        isSubmitting={isSubmitting}
        onConfirm={handleConnectConfirm}
        onCancel={() => {
          setPendingTargetId(null)
          setConnectSourceId(null)
        }}
      />
    </div>
  )
}
