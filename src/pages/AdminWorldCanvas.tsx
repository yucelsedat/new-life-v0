import {
  useCallback,
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
import { useT } from '../i18n'
import { useWorldCanvas } from '../hooks/useWorldCanvas'
import { useUsedImages } from '../hooks/useUsedImages'
import GalleryPickerModal from '../components/admin/GalleryPickerModal'
import { clamp } from '../utils/helpers'
import type { SceneLink, WorldScene } from '../types/world'

const NODE_W = 180
const NODE_H = 130
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

interface PositionedScene extends WorldScene {
  px: number
  py: number
}

function CanvasNode({
  scene,
  zoom,
  connecting,
  isConnectSource,
  onDragEnd,
  onStartConnect,
  onCompleteConnect,
}: {
  scene: PositionedScene
  zoom: number
  connecting: boolean
  isConnectSource: boolean
  onDragEnd: (sceneId: string, x: number, y: number) => void
  onStartConnect: (sceneId: string) => void
  onCompleteConnect: (sceneId: string) => void
}) {
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startRef = useRef({ px: 0, py: 0, wx: 0, wy: 0 })
  const [dragPos, setDragPos] = useState<Vec2 | null>(null)
  const pos = dragPos ?? { x: scene.px, y: scene.py }

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

  return (
    <div
      style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab overflow-hidden rounded-xl border-2 bg-black/40 shadow-lg transition-colors active:cursor-grabbing ${
        isConnectSource
          ? 'border-gold-bright'
          : connecting
            ? 'border-white/30 hover:border-gold-bright'
            : 'border-white/15'
      }`}
    >
      <img src={scene.imageUrl} alt={scene.name} className="h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-x-0 bottom-0 bg-black/75 px-2.5 py-1.5">
        <span className="block truncate font-sans text-caption font-[700] text-white/90">{scene.name}</span>
      </div>

      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onStartConnect(scene.id)
        }}
        className={`absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full transition ${
          isConnectSource ? 'bg-gold-bright text-abyss' : 'bg-black/60 text-white/70 hover:text-gold-bright'
        }`}
      >
        <FiLink className="h-3 w-3" />
      </button>
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
  const { scenes, links, isLoading, createScene, connectScenes, updateScenePosition } = useWorldCanvas(worldId ?? '')
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

  async function handleAddScene(name: string, imageUrl: string) {
    setIsSubmitting(true)
    try {
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
      const cy = rect ? (rect.height / 2 - pan.y) / zoom : 200
      await createScene(name, imageUrl, cx, cy)
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
