import { motion } from 'framer-motion'
import { fadeUp } from '../utils/animations'
import { useT } from '../i18n'
import type { SystemStatus } from '../types/world'

interface StatusBarProps {
  fps: number
  status: SystemStatus
}

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{
        background: active ? '#2fbf9f' : '#c2405f',
        boxShadow: active ? '0 0 6px rgba(47,191,159,0.8)' : '0 0 6px rgba(194,64,95,0.8)',
      }}
    />
  )
}

export default function StatusBar({ fps, status }: StatusBarProps) {
  const t = useT()

  return (
    <motion.div
      variants={fadeUp}
      className="pointer-events-none flex items-center gap-5 font-mono text-micro tracking-wide text-white/50"
    >
      <span>{t.status.version}</span>
      <span className={fps < 45 ? 'text-[#e0a34a]' : 'text-white/50'}>{fps} {t.status.fps}</span>
      <span className="flex items-center gap-1.5">
        <Dot active={status.sqliteConnected} />
        {t.status.sqlite}
      </span>
      <span className="flex items-center gap-1.5">
        <Dot active={status.aiConnected} />
        {t.status.ai}
      </span>
    </motion.div>
  )
}
