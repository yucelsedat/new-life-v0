import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '../../i18n'
import { HEADING_STEP, headingHour, headingTowards, headingVector, snapHeading, type RingHand } from '../../utils/heading'

const HOURS = Array.from({ length: 12 }, (_, index) => index * 30)

/** The twelve hour marks of a ring, drawn round the origin. Sits inside an svg centred on 0,0. */
export function DialFace({ radius }: { radius: number }) {
  return (
    <>
      {HOURS.map((heading) => {
        const { x, y } = headingVector(heading)
        const quarter = heading % 90 === 0
        const inner = radius - (quarter ? 9 : 5)
        return (
          <line
            key={heading}
            x1={x * inner}
            y1={y * inner}
            x2={x * radius}
            y2={y * radius}
            stroke="white"
            strokeOpacity={quarter ? 0.55 : 0.25}
            strokeWidth={quarter ? 2 : 1}
            strokeLinecap="round"
          />
        )
      })}
    </>
  )
}

interface DialHandProps {
  heading: number
  length: number
  /** A heading that is only a guess is drawn dashed, with a hollow tip. */
  dashed?: boolean
  dimmed?: boolean
  active?: boolean
  /** A magnetic view is the gold hand; every other one is pale. */
  magnetic?: boolean
}

/** One hand from the origin out to its tip. Sits inside an svg centred on 0,0. */
export function DialHand({ heading, length, dashed, dimmed, active, magnetic }: DialHandProps) {
  const { x, y } = headingVector(heading)
  const color = magnetic ? 'var(--color-gold-bright)' : '#f2f0e8'
  return (
    <g opacity={dimmed ? 0.3 : active || magnetic ? 1 : 0.65}>
      <line
        x1={0}
        y1={0}
        x2={x * length}
        y2={y * length}
        stroke={color}
        strokeWidth={magnetic ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray={dashed ? '2 5' : undefined}
      />
      <circle
        cx={x * length}
        cy={y * length}
        r={active ? 6.5 : 4.5}
        fill={dashed ? 'var(--color-abyss)' : color}
        stroke={color}
        strokeWidth={1.5}
      />
    </g>
  )
}

interface HeadingDialProps {
  /** Null until a direction is picked. */
  value: number | null
  /** Hands already on this ring. Shown for orientation; the mark of a set one cannot be picked again. */
  others?: RingHand[]
  /** Whether the hand being placed is magnetic, so it is drawn as one. */
  magnetic?: boolean
  hint: string
  onChange: (heading: number) => void
}

/** Picks the direction an image looks in by pointing a clock hand at it. */
export default function HeadingDial({
  value,
  others = [],
  magnetic = false,
  hint,
  onChange,
}: HeadingDialProps) {
  const t = useT()
  const dialRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)

  // A guessed hand holds no mark of its own — it gives way to whatever is picked.
  const taken = new Set(others.filter((hand) => hand.isSet).map((hand) => hand.heading))

  function pick(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect) return
    const heading = headingTowards(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
    )
    if (heading !== value && !taken.has(heading)) onChange(heading)
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    pick(event)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (draggingRef.current) pick(event)
  }

  function handleKeyDown(event: ReactKeyboardEvent<SVGSVGElement>) {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0
    if (direction === 0) return
    event.preventDefault()

    // Starting one step short lands the first press on 12; after that, skip taken marks.
    let next = value ?? -direction * HEADING_STEP
    for (let tries = 0; tries < 360 / HEADING_STEP; tries++) {
      next = snapHeading(next + direction * HEADING_STEP)
      if (!taken.has(next)) {
        onChange(next)
        return
      }
    }
  }

  const readout =
    value === null ? t.admin.heading.notPicked : t.admin.heading.hour.replace('{n}', String(headingHour(value)))

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="self-start font-sans text-caption font-[700] text-white/70">{t.admin.heading.label}</span>

      <svg
        ref={dialRef}
        viewBox="-100 -100 200 200"
        role="slider"
        tabIndex={0}
        aria-label={t.admin.heading.label}
        aria-valuemin={1}
        aria-valuemax={12}
        aria-valuenow={value === null ? undefined : headingHour(value)}
        aria-valuetext={readout}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => (draggingRef.current = false)}
        onKeyDown={handleKeyDown}
        className="h-44 w-44 cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold-bright/60"
      >
        <circle r={74} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
        <DialFace radius={74} />

        {HOURS.map((heading) => {
          const { x, y } = headingVector(heading)
          return (
            <text
              key={heading}
              x={x * 89}
              y={y * 89}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white"
              fillOpacity={heading === value ? 1 : taken.has(heading) ? 0.2 : 0.5}
              style={{ font: `${heading === value ? 800 : 400} 11px var(--font-mono)` }}
            >
              {headingHour(heading)}
            </text>
          )
        })}

        {others.map((hand) => (
          <DialHand
            key={hand.offset}
            heading={hand.heading}
            length={58}
            dashed={!hand.isSet}
            magnetic={hand.magnetic}
            dimmed
          />
        ))}
        {value !== null && <DialHand heading={value} length={62} magnetic={magnetic} active />}
        <circle r={4} fill="#f2f0e8" />
      </svg>

      <p
        className={`font-display text-h2 font-[300] ${value === null ? 'text-white/40' : 'text-gold-bright'}`}
      >
        {readout}
      </p>
      <p className="text-center font-sans text-micro text-mist">{hint}</p>
    </div>
  )
}
