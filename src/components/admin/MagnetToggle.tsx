import { LuMagnet } from 'react-icons/lu'
import { useT } from '../../i18n'

interface MagnetToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** The switch that makes a view magnetic, with what that means spelled out under it. */
export default function MagnetToggle({ checked, onChange }: MagnetToggleProps) {
  const t = useT()
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
          checked
            ? 'border-gold-bright bg-gold-bright/10 text-gold-bright'
            : 'border-white/15 text-white/70 hover:border-white/30'
        }`}
      >
        <LuMagnet className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left font-sans text-caption font-[700]">{t.admin.magnet.label}</span>
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-gold-bright' : 'bg-white/15'}`}>
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
              checked ? 'left-[18px] bg-abyss' : 'left-0.5 bg-white/70'
            }`}
          />
        </span>
      </button>
      <p className="font-sans text-micro text-mist">{t.admin.magnet.hint}</p>
    </div>
  )
}
