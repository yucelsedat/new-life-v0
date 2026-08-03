import type { Profile } from '../types/world'
import Logo from './Logo'
import ProfileCard from './ProfileCard'

interface TopBarProps {
  profile: Profile
}

export default function TopBar({ profile }: TopBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-3 items-start gap-4 p-6 md:p-10">
      <div />
      <div className="flex justify-center">
        <Logo />
      </div>
      <div className="flex justify-end">
        <ProfileCard profile={profile} />
      </div>
    </div>
  )
}
