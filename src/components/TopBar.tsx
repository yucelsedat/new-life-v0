import type { Profile } from '../types/world'
import Logo from './Logo'
import ProfileCard from './ProfileCard'

interface TopBarProps {
  profile: Profile
}

export default function TopBar({ profile }: TopBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-6 md:p-10">
      <Logo />
      <ProfileCard profile={profile} />
    </div>
  )
}
