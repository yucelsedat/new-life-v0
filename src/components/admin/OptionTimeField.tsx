import { useEffect, useRef, useState } from 'react'
import { FiCheck, FiClock } from 'react-icons/fi'
import { useT } from '../../i18n'
import { formatClock, parseClock } from '../../utils/worldClock'

interface OptionTimeFieldProps {
  /** 0 is the scene's own image — its time is when the whole world opens. */
  optionIndex: number
  minuteOfDay: number
  onSave: (minuteOfDay: number) => Promise<boolean>
}

type Status = 'idle' | 'invalid' | 'saving' | 'saved' | 'failed'

/**
 * Sets when this option index takes over. The index is world-wide, so editing it here
 * moves the same option of every other scene with it — that is the point, not a
 * side effect: options are one world at successive moments, not per-scene alternatives.
 */
export default function OptionTimeField({ optionIndex, minuteOfDay, onSave }: OptionTimeFieldProps) {
  const t = useT()
  const [draft, setDraft] = useState(() => formatClock(minuteOfDay))
  const [status, setStatus] = useState<Status>('idle')
  const justSavedRef = useRef<number | null>(null)

  // The stored schedule is the source of truth, so the field follows it when it moves.
  // The one move it must not follow is the save it just made itself: that arrives back
  // as a prop change and would wipe out the confirmation before it could be read.
  useEffect(() => {
    if (justSavedRef.current === minuteOfDay) return
    setDraft(formatClock(minuteOfDay))
    setStatus('idle')
  }, [minuteOfDay])

  // The confirmation has been read by now; fall back to the hint that explains the field.
  useEffect(() => {
    if (status !== 'saved') return
    const timer = setTimeout(() => setStatus('idle'), 2500)
    return () => clearTimeout(timer)
  }, [status])

  async function commit() {
    const parsed = parseClock(draft)
    if (parsed === null) {
      setStatus('invalid')
      return
    }
    // Normalise what was typed ('1230', '12.30') to how the schedule reads it.
    setDraft(formatClock(parsed))
    if (parsed === minuteOfDay) {
      setStatus('idle')
      return
    }

    setStatus('saving')
    justSavedRef.current = parsed
    // A rejected write must not read as a saved one: the typed time stays on screen so
    // it can be retried, and the card underneath keeps showing what is actually stored.
    const saved = await onSave(parsed)
    if (!saved) justSavedRef.current = null
    setStatus(saved ? 'saved' : 'failed')
  }

  const hint =
    optionIndex === 0
      ? t.admin.editor.optionTime.baseHint
      : t.admin.editor.optionTime.optionHint.replace('{n}', String(optionIndex))

  const message =
    status === 'invalid'
      ? t.admin.editor.optionTime.invalid
      : status === 'failed'
        ? t.admin.editor.optionTime.saveError
        : status === 'saving'
          ? t.admin.editor.optionTime.saving
          : status === 'saved'
            ? t.admin.editor.optionTime.saved
            : hint

  const isError = status === 'invalid' || status === 'failed'

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex items-center gap-2 rounded-full border bg-black/55 px-3 py-1.5 backdrop-blur-md transition ${
          isError ? 'border-red-400/70' : status === 'saved' ? 'border-gold-bright' : 'border-white/15'
        }`}
      >
        <FiClock className="h-3.5 w-3.5 text-gold-bright" />
        <span className="font-sans text-micro uppercase tracking-[0.14em] text-white/50">
          {t.admin.editor.optionTime.label}
        </span>
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setStatus('idle')
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          disabled={status === 'saving'}
          placeholder={t.admin.editor.optionTime.placeholder}
          inputMode="numeric"
          maxLength={5}
          className="w-14 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-center font-mono text-caption font-[700] tabular-nums text-white/95 outline-none transition focus:border-gold-bright disabled:opacity-50"
        />
        {status === 'saved' && <FiCheck className="h-3.5 w-3.5 text-gold-bright" />}
      </div>
      {/* The message sits over whatever the scene happens to be, so it carries its own
          ground rather than relying on the artwork behind it being dark. */}
      <span
        className={`rounded-full bg-black/60 px-2.5 py-1 font-sans text-micro backdrop-blur-md ${
          isError ? 'text-red-300' : status === 'saved' ? 'text-gold-bright' : 'text-white/60'
        }`}
      >
        {message}
      </span>
    </div>
  )
}
