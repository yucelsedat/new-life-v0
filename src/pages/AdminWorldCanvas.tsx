import {
  useCallback,
  useEffect,
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
import {
  FiArrowLeft,
  FiBookOpen,
  FiCompass,
  FiCopy,
  FiEdit3,
  FiImage,
  FiLink,
  FiMinus,
  FiPlus,
  FiPlusCircle,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import { LuMagnet } from 'react-icons/lu'
import { useT } from '../i18n'
import { useWorldCanvas } from '../hooks/useWorldCanvas'
import { useUsedImages } from '../hooks/useUsedImages'
import GalleryPickerModal from '../components/admin/GalleryPickerModal'
import StoryPickerModal from '../components/admin/StoryPickerModal'
import AnglePickerModal from '../components/admin/AnglePickerModal'
import LinkMoveMenu from '../components/admin/LinkMoveMenu'
import DeleteConnectionModal, { type ConnectionToDelete } from '../components/admin/DeleteConnectionModal'
import { DialFace, DialHand } from '../components/admin/HeadingDial'
import { clamp } from '../utils/helpers'
import { RING_R, canvasPosition, spotBeyond, type Vec2 } from '../utils/canvasLayout'
import {
  headingHour,
  headingTowards,
  headingVector,
  openingOffset,
  ringHands,
  type RingHand,
} from '../utils/heading'
import { viewKey } from '../types/world'
import type { RandomLinkOutcome, SceneLink, WorldScene } from '../types/world'

const HAND_LENGTH = RING_R - 14
/** Width of the image a hand shows on hover, in screen pixels — it does not shrink with the zoom. */
const PREVIEW_W = 360
/** How close to the edge of the window that image may come, in screen pixels. */
const PREVIEW_MARGIN = 12
/** The clear space kept between a ring's rim and the image, in screen pixels. */
const PREVIEW_GAP = 12
/** The length and half-width of a connection line's arrowhead, in canvas units. */
const ARROW_LENGTH = 13
const ARROW_HALF_WIDTH = 6
/** How far an arrowhead's tip stands from the centre of the ring it points at: just clear of the rim. */
const ARROW_REACH = RING_R + 4
/** A ring's name sits on a pill below it: from this far under the centre to this far, in canvas units. */
const NAME_TOP = RING_R + 8
const NAME_BOTTOM = NAME_TOP + 26
/** How wide a connection line is to the pointer, in screen pixels — the line itself is too thin to hit. */
const EDGE_HIT_WIDTH = 16
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2

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
  selectedOffset,
  canvasPresses,
  onSelect,
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
  /** The view picked on this ring while it is the selected one — 0 is its own image — else null. */
  selectedOffset: number | null
  /** How many times the empty canvas has been pressed; each press closes the hovered image. */
  canvasPresses: number
  /** A click on the ring selects the scene; one on a hand picks that hand's view as well. */
  onSelect: (sceneId: string, offset?: number) => void
  onDragEnd: (sceneId: string, x: number, y: number) => void
  onStartConnect: (sceneId: string) => void
  onCompleteConnect: (sceneId: string) => void
  onHeadingChange: (sceneId: string, angleId: string | null, heading: number) => void
  onMagneticChange: (sceneId: string, angleId: string | null, magnetic: boolean) => void
}) {
  const t = useT()
  const isSelected = selectedOffset !== null
  const draggingRef = useRef(false)
  /** True once a press has dragged the ring or turned a hand — it is then not a click. */
  const movedRef = useRef(false)
  const startRef = useRef({ px: 0, py: 0, wx: 0, wy: 0 })
  const [dragPos, setDragPos] = useState<Vec2 | null>(null)
  const pos = dragPos ?? { x: scene.px, y: scene.py }

  const ringRef = useRef<SVGSVGElement>(null)
  /** Offset of the hand being turned, while the pointer is down on it. */
  const turningRef = useRef<number | null>(null)
  const [turn, setTurn] = useState<{ offset: number; heading: number } | null>(null)
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null)

  // A press on the empty canvas closes the image. The pointer is not on a hand then, so
  // one still open is one whose hand never heard the pointer leave or let go.
  useEffect(() => {
    turningRef.current = null
    setTurn(null)
    setHoveredOffset(null)
  }, [canvasPresses])

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
    if (connecting) {
      if (!isConnectSource) onCompleteConnect(scene.id)
      return
    }
    if (!movedRef.current) onSelect(scene.id)
  }

  function handleHandPointerDown(event: ReactPointerEvent<SVGGElement>, hand: SceneHand) {
    // While connecting, the whole ring is a click target for the scene.
    if (connecting) return
    // Grabbing a hand turns it; it must not drag the ring along.
    event.stopPropagation()
    movedRef.current = false
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
      if (turn.heading !== stored) {
        movedRef.current = true
        onHeadingChange(scene.id, hand.angleId, turn.heading)
      }
    }
    setTurn(null)
  }

  const ringStroke = isSelected || isConnectSource ? 'var(--color-gold-bright)' : 'rgba(255,255,255,0.22)'

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
          strokeWidth={isSelected ? 3 : 2}
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
                // While connecting, a click on a hand is a click on the ring.
                onClick={(event) => {
                  if (connecting) return
                  event.stopPropagation()
                  if (!movedRef.current) onSelect(scene.id, hand.offset)
                }}
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
                  active={hand.offset === activeOffset || hand.offset === selectedOffset}
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

      <span
        className={`pointer-events-none absolute left-1/2 top-full mt-2 max-w-[200px] -translate-x-1/2 truncate rounded-full border bg-black/70 px-3 py-1 font-sans text-caption font-[700] transition ${
          isSelected ? 'border-gold-bright/60 text-gold-bright' : 'border-white/10 text-white/90'
        }`}
      >
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

/** How a connection line and its arrowheads are drawn: `idle`, joined to the selected scene, or selected itself. */
const EDGE_STROKE = {
  idle: 'stroke-gold-bright/40 group-hover/edge:stroke-gold-bright/90',
  bright: 'stroke-gold-bright/95',
  selected: 'stroke-red-500',
}
// An arrowhead is all that tells which way a link goes, so it is never as faint as its line.
const EDGE_FILL = {
  idle: 'fill-gold-bright/75 group-hover/edge:fill-gold-bright',
  bright: 'fill-gold-bright',
  selected: 'fill-red-500',
}

/**
 * How far from a ring's centre the tip of an arrowhead stands when its line leaves the
 * ring along the unit vector `ux`, `uy`. A line going down through the name pill would
 * have its arrowhead hidden behind it, so there the tip stands below the pill instead.
 */
function arrowReach(scene: WorldScene, ux: number, uy: number): number {
  if (uy <= 0) return ARROW_REACH
  // The pill hugs the name, up to its 200px limit; this is near enough to tell a hit from a miss.
  const halfWidth = Math.min(200, 24 + scene.name.length * 7) / 2 + ARROW_HALF_WIDTH
  return Math.abs((NAME_TOP * ux) / uy) < halfWidth ? (NAME_BOTTOM + 4) / uy : ARROW_REACH
}

/** The corners of an arrowhead whose tip is at `tip`, pointing along the unit vector `ux`, `uy`. */
function arrowPoints(tip: Vec2, ux: number, uy: number): string {
  const baseX = tip.x - ux * ARROW_LENGTH
  const baseY = tip.y - uy * ARROW_LENGTH
  return [
    `${tip.x},${tip.y}`,
    `${baseX - uy * ARROW_HALF_WIDTH},${baseY + ux * ARROW_HALF_WIDTH}`,
    `${baseX + uy * ARROW_HALF_WIDTH},${baseY - ux * ARROW_HALF_WIDTH}`,
  ].join(' ')
}

/**
 * How a connection waiting for its second scene was started, and so what picking that
 * scene does: `named` asks for a link name and links both ways, `random` links both ways
 * on random free views, `view` links one way from the view it was started on.
 */
type ConnectKind = 'named' | 'random' | 'view'

/** One view of a scene — its option image or an angle slot — with the exits hung on it. */
interface SceneView {
  offset: number
  /** Null for an angle whose direction has not been picked yet. */
  heading: number | null
  links: SceneLink[]
}

/** Which way the view at `offset` looks. A slot is one view in every option; the base option's angle speaks first. */
function viewHeading(scene: WorldScene, offset: number): number | null {
  if (offset === 0) return scene.heading
  const angles = [...(scene.angles?.base ?? []), ...Object.values(scene.angles ?? {}).flat()]
  return angles.find((angle) => angle.offset === offset && angle.heading !== null)?.heading ?? null
}

/** Every view a link can sit on, round the ring from 12 o'clock; views with no direction come last. */
function sceneViews(scene: WorldScene, links: SceneLink[]): SceneView[] {
  const offsets = new Set([0, ...Object.values(scene.angles ?? {}).flatMap((angles) => angles.map((a) => a.offset))])
  return [...offsets]
    .map((offset) => ({
      offset,
      heading: viewHeading(scene, offset),
      links: links.filter((link) => link.fromSceneId === scene.id && link.angleOffset === offset),
    }))
    .sort((a, b) => (a.heading ?? 360) - (b.heading ?? 360) || a.offset - b.offset)
}

/** A line of the panel's report on a connection. `created` tells the links made from the ones left out. */
interface LinkNotice {
  text: string
  created: boolean
}

const ACTION_BUTTON =
  'flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/80 transition hover:border-gold-bright hover:text-gold-bright disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/80'
const ACTION_COUNT = 'rounded-full bg-gold-bright px-2 py-0.5 font-mono text-micro text-abyss'

interface SelectionPanelProps {
  scene: WorldScene
  /** The links leaving this scene. */
  links: SceneLink[]
  /** The view the buttons act on: 0 is the scene's own image, else the slot of a base angle. */
  offset: number
  /** Set while a connection started from this scene is waiting for its second one. */
  connectKind: ConnectKind | null
  canLink: boolean
  isSubmitting: boolean
  notices: LinkNotice[]
  /** The editor, opened on this scene. */
  editorHref: string
  onPickView: (offset: number) => void
  /** Link the view at `offset` to a scene that already exists — the next ring clicked. */
  onAddLink: (offset: number) => void
  onDeleteLink: (link: SceneLink) => void
  onChangeImage: () => void
  onCreateLink: () => void
  onMoveLink: (linkId: string, offset: number) => void
  onMagneticChange: (magnetic: boolean) => void
  onCreateOption: () => void
  onCreateAngle: () => void
  onCreateStory: () => void
  onDeleteAngle: () => void
  onLink: () => void
  onCancelLink: () => void
  onDeselect: () => void
}

/**
 * The selected scene, bottom left: its views with the exit on each, the editor's own
 * buttons for the view picked among them, and the button that links the scene to another.
 * The canvas shows a scene as its base option, so that is the option the buttons work on.
 */
function SelectionPanel({
  scene,
  links,
  offset,
  connectKind,
  canLink,
  isSubmitting,
  notices,
  editorHref,
  onPickView,
  onAddLink,
  onDeleteLink,
  onChangeImage,
  onCreateLink,
  onMoveLink,
  onMagneticChange,
  onCreateOption,
  onCreateAngle,
  onCreateStory,
  onDeleteAngle,
  onLink,
  onCancelLink,
  onDeselect,
}: SelectionPanelProps) {
  const t = useT()
  const hourLabel = (heading: number) => t.admin.heading.hour.replace('{n}', String(headingHour(heading)))
  const connecting = connectKind !== null

  const views = sceneViews(scene, links)
  const freeCount = views.filter((view) => view.links.length === 0).length
  const baseAngles = scene.angles?.base ?? []
  const hands = ringHands(scene.heading, baseAngles, scene.magnetic)
  const activeHand = hands.find((hand) => hand.offset === offset)
  const viewLinks = links.filter((link) => link.angleOffset === offset)
  const storyFrames = scene.stories?.[viewKey('base', offset)] ?? []
  const variantCount = scene.variants?.length ?? 0
  // Where a link can be moved to: the views in turning order, each named by its hour.
  const moveTargets = [...hands]
    .sort((a, b) => a.heading - b.heading)
    .flatMap((hand) => {
      const imageUrl =
        hand.offset === 0 ? scene.imageUrl : baseAngles.find((angle) => angle.offset === hand.offset)?.imageUrl
      if (!imageUrl) return []
      return [{ offset: hand.offset, imageUrl, label: hand.isSet ? hourLabel(hand.heading) : '?' }]
    })

  const hint = isSubmitting
    ? t.admin.canvas.linking
    : connectKind !== null
      ? {
          named: t.admin.canvas.connectHint,
          random: t.admin.canvas.linkPickSecond,
          view: t.admin.canvas.linkPickTarget,
        }[connectKind]
      : canLink
        ? t.admin.canvas.linkHint
        : t.admin.canvas.linkNeedsTwo

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-6 left-6 z-20 flex w-96 flex-col gap-4 rounded-2xl border border-gold-bright/40 bg-abyss/90 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-micro uppercase tracking-[0.14em] text-gold-bright">
            {t.admin.canvas.selectedLabel}
          </span>
          <h3 className="truncate font-display text-h2 font-[300] text-white/95">{scene.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to={editorHref}
            title={t.admin.canvas.openInEditorTitle}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 font-sans text-caption font-[700] text-white/80 transition hover:border-gold-bright hover:text-gold-bright"
          >
            <FiEdit3 className="h-3.5 w-3.5" />
            {t.admin.canvas.openInEditor}
          </Link>
          <button
            type="button"
            onClick={onDeselect}
            aria-label={t.admin.canvas.deselect}
            title={t.admin.canvas.deselect}
            className="text-white/50 transition hover:text-white"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-sans text-caption font-[700] text-white/70">{t.admin.canvas.viewsTitle}</span>
          <span className="shrink-0 font-mono text-micro text-mist">
            {t.admin.canvas.freeCount.replace('{free}', String(freeCount)).replace('{total}', String(views.length))}
          </span>
        </div>
        <ul className="scrollbar-none -mx-2 flex max-h-36 flex-col overflow-y-auto">
          {views.map((view) => {
            const hand = view.heading === null ? null : headingVector(view.heading)
            const picked = view.offset === offset
            // A slot only another option has an angle for is not on this ring to pick.
            const onRing = hands.some((item) => item.offset === view.offset)
            return (
              <li
                key={view.offset}
                className={`flex items-center gap-1 rounded-lg pr-1 transition ${
                  picked ? 'bg-gold-bright/15' : 'hover:bg-white/5'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={picked}
                  disabled={!onRing}
                  title={onRing ? t.admin.canvas.viewPick : undefined}
                  onClick={() => onPickView(view.offset)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
                >
                  <svg
                    viewBox="-8 -8 16 16"
                    className={`h-4 w-4 shrink-0 ${picked ? 'text-gold-bright' : 'text-white/80'}`}
                  >
                    <circle r={7} fill="none" stroke="currentColor" strokeOpacity={0.35} />
                    {hand && (
                      <line x2={hand.x * 5} y2={hand.y * 5} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                    )}
                  </svg>
                  <span className={`shrink-0 font-mono text-micro ${picked ? 'text-gold-bright' : 'text-white/80'}`}>
                    {view.heading === null ? t.admin.canvas.viewNoHeading : hourLabel(view.heading)}
                  </span>
                </button>

                {/* The exit on this view is itself the button that removes it; a view
                    without one offers to link it to a scene already on the canvas. */}
                {view.links.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    title={t.admin.canvas.linkDeleteTitle}
                    disabled={isSubmitting || connecting}
                    onClick={() => onDeleteLink(link)}
                    className="group/link flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 font-sans text-caption font-[700] text-gold-bright transition enabled:hover:bg-red-500/15 enabled:hover:text-red-300 disabled:opacity-60"
                  >
                    <span className="truncate">→ {link.label}</span>
                    <FiX className="h-3 w-3 shrink-0 opacity-50 transition group-hover/link:opacity-100" />
                  </button>
                ))}
                {view.links.length === 0 && (
                  <button
                    type="button"
                    title={canLink ? t.admin.canvas.linkAddTitle : t.admin.canvas.linkNeedsTwo}
                    disabled={!canLink || isSubmitting || connecting}
                    onClick={() => onAddLink(view.offset)}
                    className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-sans text-caption text-white/45 transition enabled:hover:bg-gold-bright/15 enabled:hover:text-gold-bright disabled:opacity-60"
                  >
                    <FiPlus className="h-3 w-3" />
                    {t.admin.canvas.linkAdd}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-micro uppercase tracking-[0.14em] text-mist">
          {activeHand?.isSet
            ? t.admin.canvas.viewActions.replace('{view}', hourLabel(activeHand.heading))
            : t.admin.canvas.viewNoHeading}
        </span>
        <div className="flex flex-wrap items-start gap-1.5">
          <button type="button" onClick={onChangeImage} disabled={isSubmitting} className={ACTION_BUTTON}>
            <FiRefreshCw className="h-3.5 w-3.5" />
            {t.admin.editor.changeSceneButton}
          </button>

          {/* Each view holds one link: an empty view offers to create it, a taken one
              to move it onto another angle. */}
          {viewLinks.length === 0 ? (
            <button
              type="button"
              onClick={onCreateLink}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-gold-bright px-4 py-2 font-sans text-caption font-[700] text-abyss transition hover:brightness-105 disabled:opacity-40"
            >
              <FiPlusCircle className="h-3.5 w-3.5" />
              {t.admin.editor.createLinkButton}
            </button>
          ) : (
            <LinkMoveMenu
              links={viewLinks}
              allLinks={links}
              views={moveTargets}
              currentOffset={offset}
              disabled={isSubmitting}
              onMove={onMoveLink}
            />
          )}

          {/* A view with no heading on record has nowhere on the ring to pull towards. */}
          <button
            type="button"
            role="switch"
            aria-checked={activeHand?.magnetic ?? false}
            disabled={!activeHand?.isSet}
            title={activeHand?.isSet ? t.admin.magnet.hint : t.admin.magnet.needsHeading}
            onClick={() => onMagneticChange(!activeHand?.magnetic)}
            className={`flex items-center gap-2 rounded-full border bg-black/50 px-4 py-2 font-sans text-caption font-[700] transition hover:border-gold-bright hover:text-gold-bright disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/80 ${
              activeHand?.magnetic ? 'border-gold-bright text-gold-bright' : 'border-white/15 text-white/80'
            }`}
          >
            <LuMagnet className="h-3.5 w-3.5" />
            {t.admin.magnet.label}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-micro ${
                activeHand?.magnetic ? 'bg-gold-bright text-abyss' : 'bg-white/10 text-white/60'
              }`}
            >
              {activeHand?.magnetic ? t.admin.magnet.on : t.admin.magnet.off}
            </span>
          </button>

          {/* Options belong to the scene as a whole, so they are only offered from its
              own image, not from an angle. */}
          {offset === 0 && (
            <button type="button" onClick={onCreateOption} disabled={isSubmitting} className={ACTION_BUTTON}>
              <FiCopy className="h-3.5 w-3.5" />
              {t.admin.editor.createOptionButton}
              {variantCount > 0 && <span className={ACTION_COUNT}>{variantCount}</span>}
            </button>
          )}

          <button type="button" onClick={onCreateAngle} disabled={isSubmitting} className={ACTION_BUTTON}>
            <FiCompass className="h-3.5 w-3.5" />
            {t.admin.editor.createAngleButton}
            {baseAngles.length > 0 && <span className={ACTION_COUNT}>{baseAngles.length}</span>}
          </button>

          <button type="button" onClick={onCreateStory} disabled={isSubmitting} className={ACTION_BUTTON}>
            <FiBookOpen className="h-3.5 w-3.5" />
            {t.admin.editor.createStoryButton}
            {storyFrames.length > 0 && <span className={ACTION_COUNT}>{storyFrames.length}</span>}
          </button>

          {offset !== 0 && (
            <button
              type="button"
              onClick={onDeleteAngle}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 font-sans text-caption font-[700] text-white/60 transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-40"
            >
              <FiTrash2 className="h-3.5 w-3.5" />
              {t.admin.angle.deleteButton}
            </button>
          )}
        </div>
      </div>

      {connecting ? (
        <button
          type="button"
          onClick={onCancelLink}
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 rounded-xl border border-gold-bright/50 px-4 py-2.5 font-sans text-body font-[700] text-gold-bright transition hover:border-gold-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiX className="h-4 w-4" />
          {t.admin.canvas.connectCancel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onLink}
          disabled={!canLink || isSubmitting}
          className="flex items-center justify-center gap-2 rounded-xl border border-gold-bright/50 px-4 py-2.5 font-sans text-body font-[700] text-gold-bright transition hover:border-gold-bright hover:bg-gold-bright/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiLink className="h-4 w-4" />
          {t.admin.canvas.linkButton}
        </button>
      )}

      {notices.length > 0 && !connecting ? (
        <ul className="flex flex-col gap-1" aria-live="polite">
          {notices.map((notice) => (
            <li
              key={notice.text}
              className={`font-sans text-micro ${notice.created ? 'text-gold-bright' : 'text-mist'}`}
            >
              {notice.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`font-sans text-micro ${connecting ? 'animate-pulse-slow text-gold-bright' : 'text-mist'}`}>
          {hint}
        </p>
      )}
    </motion.div>
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

/** What the image picker is open for, as in the editor. */
type PickerMode = 'first-scene' | 'create-link' | 'create-variant' | 'change-image' | null

export default function AdminWorldCanvas() {
  const t = useT()
  const { worldId } = useParams<{ worldId: string }>()
  const {
    scenes,
    links,
    isLoading,
    createScene,
    connectScenes,
    connectScenesAtRandom,
    linkView,
    deleteLink,
    disconnectScenes,
    createLinkedScene,
    createVariant,
    createAngle,
    deleteAngle,
    saveStory,
    changeViewImage,
    moveLink,
    updateScenePosition,
    updateHeading,
    updateMagnetic,
  } = useWorldCanvas(worldId ?? '')
  const { usedUrls, refetchUsed } = useUsedImages(worldId ?? '')

  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState<Vec2>({ x: 80, y: 80 })
  const [zoom, setZoom] = useState(1)
  const panStateRef = useRef({ panning: false, moved: false, startClient: { x: 0, y: 0 }, startPan: { x: 0, y: 0 } })

  /** The selected scene, and the view on its ring that the panel's buttons act on. */
  const [selection, setSelection] = useState<{ sceneId: string; offset: number } | null>(null)
  const selectedId = selection?.sceneId ?? null
  /** A connection waiting for its second scene. `offset` is the view a `view` one starts from. */
  const [connect, setConnect] = useState<{ sourceId: string; kind: ConnectKind; offset: number } | null>(null)
  const connectSourceId = connect?.sourceId ?? null
  /** The connection line that was clicked, by its pair key. It shows the button that deletes it. */
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null)
  /** What the delete dialog is open for: the selected connection, or one link picked in the panel. */
  const [pendingDelete, setPendingDelete] = useState<'edge' | { linkId: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  /** How the last random connection came out, shown in the selection panel. */
  const [notices, setNotices] = useState<LinkNotice[]>([])
  const [canvasPresses, setCanvasPresses] = useState(0)
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pickerMode, setPickerMode] = useState<PickerMode>(null)
  const [angleModalOpen, setAngleModalOpen] = useState(false)
  const [storyModalOpen, setStoryModalOpen] = useState(false)
  const modalOpen = pickerMode !== null || angleModalOpen || storyModalOpen

  const positionedScenes = useMemo<PositionedScene[]>(
    () =>
      scenes.map((scene, index) => {
        const { x, y } = canvasPosition(scene, index)
        return { ...scene, px: x, py: y }
      }),
    [scenes],
  )

  const positionById = useMemo(() => {
    const map = new Map<string, PositionedScene>()
    for (const scene of positionedScenes) map.set(scene.id, scene)
    return map
  }, [positionedScenes])

  // One line per pair of scenes, whichever way their links go. `forward` is the first link
  // found and gives the line its direction; `backward` is the first one going the other way.
  const uniqueEdges = useMemo(() => {
    const seen = new Map<string, { key: string; forward: SceneLink; backward?: SceneLink; links: SceneLink[] }>()
    for (const link of links) {
      const key = [link.fromSceneId, link.toSceneId].sort().join('|')
      const existing = seen.get(key)
      if (existing) {
        existing.links.push(link)
        if (link.fromSceneId !== existing.forward.fromSceneId) existing.backward ??= link
      } else {
        seen.set(key, { key, forward: link, links: [link] })
      }
    }
    return Array.from(seen.values())
  }, [links])

  // Gone from the graph, a selected connection is simply no longer selected.
  const selectedEdge = uniqueEdges.find((edge) => edge.key === selectedEdgeKey)
  const selectedEdgeEnds = selectedEdge
    ? { from: positionById.get(selectedEdge.forward.fromSceneId), to: positionById.get(selectedEdge.forward.toSceneId) }
    : null

  /** The links the open delete dialog would remove. */
  const doomedLinks =
    pendingDelete === null
      ? []
      : pendingDelete === 'edge'
        ? (selectedEdge?.links ?? [])
        : links.filter((link) => link.id === pendingDelete.linkId)

  /** That deletion as the dialog words it. */
  function describeDeletion(): ConnectionToDelete | null {
    const from = positionById.get(doomedLinks[0]?.fromSceneId)
    const to = positionById.get(doomedLinks[0]?.toSceneId)
    if (!from || !to) return null

    const single = pendingDelete !== 'edge'
    const fill = (text: string) => text.replace('{a}', from.name).replace('{b}', to.name)
    const going = new Set(doomedLinks.map((link) => link.id))
    const staying = links.filter((link) => !going.has(link.id))
    const keepsWayBack = single && staying.some((link) => link.fromSceneId === to.id && link.toSceneId === from.id)
    const stranded = [from, to].filter(
      (scene) => !staying.some((link) => link.fromSceneId === scene.id || link.toSceneId === scene.id),
    )
    return {
      title: single ? t.admin.disconnect.linkTitle : t.admin.disconnect.title,
      question: fill(single ? t.admin.disconnect.linkQuestion : t.admin.disconnect.question),
      links: doomedLinks.map((link) => ({
        id: link.id,
        from: positionById.get(link.fromSceneId)?.name ?? '',
        to: positionById.get(link.toSceneId)?.name ?? '',
        label: link.label,
      })),
      // Two scenes can share a name, and with it a note.
      notes: [
        ...new Set([
          ...(keepsWayBack ? [fill(t.admin.disconnect.linkKeepsBack)] : []),
          ...stranded.map((scene) => t.admin.disconnect.stranded.replace('{name}', scene.name)),
        ]),
      ],
    }
  }

  const selectedScene = selectedId ? positionById.get(selectedId) : undefined
  const selectedLinks = useMemo(() => links.filter((link) => link.fromSceneId === selectedId), [links, selectedId])
  const selectedHands = selectedScene
    ? ringHands(selectedScene.heading, selectedScene.angles?.base ?? [], selectedScene.magnetic)
    : []
  // A picked view whose angle has since gone falls back to the scene's own image.
  const selectedAngle = selectedScene?.angles?.base?.find((angle) => angle.offset === selection?.offset)
  const selectedOffset = selectedAngle?.offset ?? 0
  const selectedStory = selectedScene?.stories?.[viewKey('base', selectedOffset)] ?? []

  // Escape backs out one step: the delete dialog, a connection waiting for its second
  // scene, a selected connection line, then the selected scene.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || modalOpen || isSubmitting) return
      if (pendingDelete) {
        setPendingDelete(null)
      } else if (connect) {
        setConnect(null)
        setPendingTargetId(null)
      } else if (selectedEdgeKey) {
        setSelectedEdgeKey(null)
      } else {
        setSelection(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [connect, modalOpen, isSubmitting, pendingDelete, selectedEdgeKey])

  function handleBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    setCanvasPresses((count) => count + 1)
    panStateRef.current = {
      panning: true,
      moved: false,
      startClient: { x: event.clientX, y: event.clientY },
      startPan: { ...pan },
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleBackgroundPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panStateRef.current.panning) return
    const dx = event.clientX - panStateRef.current.startClient.x
    const dy = event.clientY - panStateRef.current.startClient.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panStateRef.current.moved = true
    setPan({ x: panStateRef.current.startPan.x + dx, y: panStateRef.current.startPan.y + dy })
  }

  function handleBackgroundPointerUp() {
    // A press on the empty canvas that went nowhere is a click. It calls off a connection
    // waiting for its second scene — dragging does not, so that scene can be panned into
    // reach — and otherwise lets go of the selection.
    if (panStateRef.current.panning && !panStateRef.current.moved) {
      if (connect) {
        if (!isSubmitting) setConnect(null)
      } else {
        setSelection(null)
        setSelectedEdgeKey(null)
      }
    }
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

  // Without a view of its own, a click keeps the one already picked on that ring.
  const handleSelect = useCallback((sceneId: string, offset?: number) => {
    setSelectedEdgeKey(null)
    setSelection((prev) => ({ sceneId, offset: offset ?? (prev?.sceneId === sceneId ? prev.offset : 0) }))
    setNotices([])
  }, [])

  // The scene a connection starts from is the selected one, so the panel can show and cancel it.
  const handleStartConnect = useCallback((sceneId: string) => {
    setSelectedEdgeKey(null)
    setSelection((prev) => (prev?.sceneId === sceneId ? prev : { sceneId, offset: 0 }))
    setNotices([])
    setConnect((prev) => (prev?.sourceId === sceneId ? null : { sourceId: sceneId, kind: 'named', offset: 0 }))
  }, [])

  /** One end of a random connection, as a line for the panel. */
  function describeOutcome(outcome: RandomLinkOutcome, from: WorldScene, to: WorldScene): LinkNotice {
    const heading = outcome.link ? viewHeading(from, outcome.link.angleOffset) : null
    const view =
      heading === null ? t.admin.canvas.viewNoHeading : t.admin.heading.hour.replace('{n}', String(headingHour(heading)))
    const text = {
      created: t.admin.canvas.linkCreated,
      linked: t.admin.canvas.linkExists,
      full: t.admin.canvas.linkFull,
    }[outcome.status]
    return {
      text: text.replace('{from}', from.name).replace('{to}', to.name).replace('{view}', view),
      created: outcome.status === 'created',
    }
  }

  async function handleRandomConnect(sourceId: string, targetId: string) {
    const source = positionById.get(sourceId)
    const target = positionById.get(targetId)
    if (!source || !target) return
    setIsSubmitting(true)
    try {
      const connection = await connectScenesAtRandom(sourceId, targetId)
      setNotices(
        connection
          ? [describeOutcome(connection.forward, source, target), describeOutcome(connection.backward, target, source)]
          : [{ text: t.admin.canvas.linkError, created: false }],
      )
    } finally {
      setIsSubmitting(false)
      setConnect(null)
    }
  }

  /** Links one view of the source to the target, one way; the panel then tells how it went. */
  async function handleViewLink(sourceId: string, offset: number, targetId: string) {
    const source = positionById.get(sourceId)
    const target = positionById.get(targetId)
    if (!source || !target) return
    setIsSubmitting(true)
    try {
      const link = await linkView(sourceId, offset, targetId)
      setNotices([
        link
          ? describeOutcome({ status: 'created', link }, source, target)
          : { text: t.admin.canvas.linkError, created: false },
      ])
    } finally {
      setIsSubmitting(false)
      setConnect(null)
    }
  }

  function handleCompleteConnect(targetId: string) {
    if (!connect || isSubmitting) return
    if (connect.kind === 'random') handleRandomConnect(connect.sourceId, targetId)
    else if (connect.kind === 'view') handleViewLink(connect.sourceId, connect.offset, targetId)
    else setPendingTargetId(targetId)
  }

  async function handleConnectConfirm(label: string) {
    if (!connectSourceId || !pendingTargetId) return
    setIsSubmitting(true)
    try {
      await connectScenes(connectSourceId, pendingTargetId, label)
    } finally {
      setIsSubmitting(false)
      setConnect(null)
      setPendingTargetId(null)
    }
  }

  // One thing is selected at a time: a connection line takes over from a scene, and a
  // second click on the same line lets go of it.
  function handleEdgeClick(key: string) {
    setSelection(null)
    setNotices([])
    setSelectedEdgeKey((prev) => (prev === key ? null : key))
  }

  function closeDelete() {
    if (isSubmitting) return
    setPendingDelete(null)
    setDeleteError(null)
  }

  async function handleDeleteConfirm() {
    const [first] = doomedLinks
    if (!first) return
    setIsSubmitting(true)
    setDeleteError(null)
    try {
      const removed =
        pendingDelete === 'edge'
          ? await disconnectScenes(first.fromSceneId, first.toSceneId)
          : await deleteLink(first.id)
      if (removed) {
        setPendingDelete(null)
        setSelectedEdgeKey(null)
        setNotices([])
      } else {
        setDeleteError(t.admin.disconnect.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Runs one change with the buttons held, then recounts the images the world has in use. */
  async function submit<T>(action: () => Promise<T>): Promise<T> {
    setIsSubmitting(true)
    try {
      const result = await action()
      await refetchUsed()
      return result
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePickerConfirm(name: string, imageUrl: string, heading: number, magnetic: boolean) {
    await submit(async () => {
      if (pickerMode === 'first-scene') {
        const rect = containerRef.current?.getBoundingClientRect()
        const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
        const cy = rect ? (rect.height / 2 - pan.y) / zoom : 200
        await createScene(name, imageUrl, cx, cy, heading, magnetic)
      } else if (!selectedScene) {
        return
      } else if (pickerMode === 'create-link') {
        const spot = spotBeyond(
          { x: selectedScene.px, y: selectedScene.py },
          heading,
          positionedScenes.map((scene) => ({ x: scene.px, y: scene.py })),
        )
        await createLinkedScene(selectedScene.id, selectedOffset, {
          name,
          imageUrl,
          heading,
          magnetic,
          canvasX: spot.x,
          canvasY: spot.y,
        })
      } else if (pickerMode === 'create-variant') {
        await createVariant(selectedScene.id, imageUrl)
      } else if (pickerMode === 'change-image') {
        await changeViewImage(selectedScene.id, selectedAngle?.id ?? null, imageUrl)
      }
    })
    setPickerMode(null)
  }

  async function handleAngleConfirm(imageUrl: string, heading: number, magnetic: boolean, keepOpen: boolean) {
    if (!selectedScene) return false
    const added = await submit(async () => {
      const angle = await createAngle(selectedScene.id, imageUrl, heading, magnetic)
      // Pick the angle that was just created, so it can be furnished right away.
      if (angle) setSelection({ sceneId: selectedScene.id, offset: angle.offset })
      return angle !== null
    })
    // A refused angle leaves the modal up with what was picked, to try again.
    if (added && !keepOpen) setAngleModalOpen(false)
    return added
  }

  async function handleStoryConfirm(imageUrls: string[]) {
    if (!selectedScene) return
    await submit(() => saveStory(selectedScene.id, selectedOffset, imageUrls))
    setStoryModalOpen(false)
  }

  async function handleAngleDelete() {
    if (!selectedScene || !selectedAngle) return
    await submit(() => deleteAngle(selectedScene.id, selectedAngle.id))
    setSelection({ sceneId: selectedScene.id, offset: 0 })
  }

  async function handleLinkMove(linkId: string, offset: number) {
    if (!selectedScene) return
    await submit(() => moveLink(linkId, offset))
    // Follow the link to its new angle, as the editor does.
    setSelection({ sceneId: selectedScene.id, offset })
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

        {connectSourceId && (
          <span className="pointer-events-auto rounded-full border border-gold-bright/40 bg-black/50 px-4 py-2 font-sans text-caption text-gold-bright backdrop-blur-md">
            {t.admin.canvas.connectHint}
          </span>
        )}
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
            {uniqueEdges.map(({ key, forward, backward }) => {
              const from = positionById.get(forward.fromSceneId)
              const to = positionById.get(forward.toSceneId)
              if (!from || !to) return null
              const midX = (from.px + to.px) / 2
              const midY = (from.py + to.py) / 2
              const touchesSelected = from.id === selectedId || to.id === selectedId
              const isSelectedEdge = key === selectedEdgeKey
              const tone = isSelectedEdge ? 'selected' : touchesSelected ? 'bright' : 'idle'

              // An arrowhead at each end a link leads to: both for a way there and back,
              // one for a link nothing answers. Rings too close to fit them go without.
              const length = Math.hypot(to.px - from.px, to.py - from.py)
              const ux = length === 0 ? 0 : (to.px - from.px) / length
              const uy = length === 0 ? 0 : (to.py - from.py) / length
              const reachTo = arrowReach(to, -ux, -uy)
              const reachFrom = arrowReach(from, ux, uy)
              const fits = length > reachTo + reachFrom + 2 * ARROW_LENGTH
              const tipAtTo = fits ? { x: to.px - ux * reachTo, y: to.py - uy * reachTo } : null
              const tipAtFrom = fits && backward ? { x: from.px + ux * reachFrom, y: from.py + uy * reachFrom } : null
              // The line stops at the back of an arrowhead, so the two never show through each other.
              const start = tipAtFrom
                ? { x: tipAtFrom.x + ux * ARROW_LENGTH, y: tipAtFrom.y + uy * ARROW_LENGTH }
                : { x: from.px, y: from.py }
              const end = tipAtTo
                ? { x: tipAtTo.x - ux * ARROW_LENGTH, y: tipAtTo.y - uy * ARROW_LENGTH }
                : { x: to.px, y: to.py }
              return (
                <g key={key} className="group/edge">
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    strokeWidth={isSelectedEdge ? 3 : 2}
                    className={`transition-[stroke] ${EDGE_STROKE[tone]}`}
                  />
                  {tipAtTo && (
                    <polygon points={arrowPoints(tipAtTo, ux, uy)} className={`transition-[fill] ${EDGE_FILL[tone]}`} />
                  )}
                  {tipAtFrom && (
                    <polygon
                      points={arrowPoints(tipAtFrom, -ux, -uy)}
                      className={`transition-[fill] ${EDGE_FILL[tone]}`}
                    />
                  )}
                  <text
                    x={midX}
                    // Lifted clear of the delete button, which sits on the line's middle.
                    y={midY - (isSelectedEdge ? 24 / zoom : 6)}
                    textAnchor="middle"
                    className={isSelectedEdge ? 'fill-red-400' : 'fill-gold-bright'}
                    style={{ font: '600 11px var(--font-mono)' }}
                  >
                    {backward ? `${forward.label} ⇄ ${backward.label}` : `→ ${forward.label}`}
                  </text>
                  {/* The line as the pointer finds it. While a connection waits for its
                      second scene the canvas only listens to rings. */}
                  {!connectSourceId && (
                    <line
                      x1={from.px}
                      y1={from.py}
                      x2={to.px}
                      y2={to.py}
                      stroke="transparent"
                      strokeWidth={EDGE_HIT_WIDTH / zoom}
                      className="pointer-events-auto cursor-pointer"
                      // A press on a line is not one on the empty canvas: it must not pan.
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => handleEdgeClick(key)}
                    />
                  )}
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
              selectedOffset={selectedId === scene.id ? selectedOffset : null}
              canvasPresses={canvasPresses}
              onSelect={handleSelect}
              onDragEnd={updateScenePosition}
              onStartConnect={handleStartConnect}
              onCompleteConnect={handleCompleteConnect}
              onHeadingChange={updateHeading}
              onMagneticChange={updateMagnetic}
            />
          ))}

          {selectedEdgeEnds?.from && selectedEdgeEnds.to && (
            // On the middle of the line, above the rings, and as large on a zoomed-out canvas as on a close one.
            <button
              type="button"
              aria-label={t.admin.canvas.disconnectButton}
              title={t.admin.canvas.disconnectButton}
              style={{
                left: (selectedEdgeEnds.from.px + selectedEdgeEnds.to.px) / 2,
                top: (selectedEdgeEnds.from.py + selectedEdgeEnds.to.py) / 2,
                transform: `translate(-50%, -50%) scale(${1 / zoom})`,
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setPendingDelete('edge')}
              className="absolute z-40 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.25),0_8px_20px_rgba(0,0,0,0.5)] transition hover:bg-red-400"
            >
              <FiX className="h-4 w-4" strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {hasNoScenes && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPickerMode('first-scene')}
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

      <AnimatePresence>
        {selectedScene && (
          <SelectionPanel
            scene={selectedScene}
            links={selectedLinks}
            offset={selectedOffset}
            connectKind={connect?.sourceId === selectedScene.id ? connect.kind : null}
            canLink={scenes.length > 1}
            isSubmitting={isSubmitting}
            notices={notices}
            editorHref={`/admin/worlds/${worldId}?scene=${selectedScene.id}&angle=${openingOffset(selectedOffset, selectedHands)}`}
            onLink={() => {
              setNotices([])
              setConnect({ sourceId: selectedScene.id, kind: 'random', offset: 0 })
            }}
            onPickView={(offset) => handleSelect(selectedScene.id, offset)}
            onAddLink={(offset) => {
              handleSelect(selectedScene.id, offset)
              setConnect({ sourceId: selectedScene.id, kind: 'view', offset })
            }}
            onDeleteLink={(link) => setPendingDelete({ linkId: link.id })}
            onChangeImage={() => setPickerMode('change-image')}
            onCreateLink={() => setPickerMode('create-link')}
            onMoveLink={handleLinkMove}
            onMagneticChange={(magnetic) => updateMagnetic(selectedScene.id, selectedAngle?.id ?? null, magnetic)}
            onCreateOption={() => setPickerMode('create-variant')}
            onCreateAngle={() => setAngleModalOpen(true)}
            onCreateStory={() => setStoryModalOpen(true)}
            onDeleteAngle={handleAngleDelete}
            onCancelLink={() => setConnect(null)}
            onDeselect={() => setSelection(null)}
          />
        )}
      </AnimatePresence>

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

      <AnglePickerModal
        open={angleModalOpen}
        isSubmitting={isSubmitting}
        scope={{ worldId, kind: 'scene' }}
        hiddenUrls={usedUrls}
        hands={selectedHands}
        onConfirm={handleAngleConfirm}
        onCancel={() => setAngleModalOpen(false)}
      />

      <StoryPickerModal
        open={storyModalOpen}
        isSubmitting={isSubmitting}
        scope={{ worldId, kind: 'scene' }}
        initialUrls={selectedStory.map((frame) => frame.imageUrl)}
        hiddenUrls={usedUrls}
        onConfirm={handleStoryConfirm}
        onCancel={() => setStoryModalOpen(false)}
      />

      <GalleryPickerModal
        scope={{ worldId, kind: 'scene' }}
        hiddenUrls={usedUrls}
        open={pickerMode !== null}
        nameLabel={
          pickerMode === 'create-variant' || pickerMode === 'change-image'
            ? null
            : pickerMode === 'first-scene'
              ? t.admin.editor.modal.sceneNameLabel
              : t.admin.editor.modal.linkNameLabel
        }
        // Both of these make a new scene, and a scene's image needs its direction.
        withHeading={pickerMode === 'first-scene' || pickerMode === 'create-link'}
        isSubmitting={isSubmitting}
        onConfirm={handlePickerConfirm}
        onCancel={() => setPickerMode(null)}
      />

      <DeleteConnectionModal
        connection={pendingDelete ? describeDeletion() : null}
        isDeleting={isSubmitting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={closeDelete}
      />

      <ConnectModal
        open={pendingTargetId !== null}
        isSubmitting={isSubmitting}
        onConfirm={handleConnectConfirm}
        onCancel={() => {
          setPendingTargetId(null)
          setConnect(null)
        }}
      />
    </div>
  )
}
