import { useT } from '../../i18n'
import ImageLibrarySection from './ImageLibrarySection'

export default function AdminCharactersPanel() {
  const t = useT()

  return (
    <ImageLibrarySection
      title={t.admin.characters.title}
      subtitle={t.admin.characters.subtitle}
      emptyLabel={t.admin.characters.empty}
      scope={{ worldId: 'global', kind: 'character' }}
    />
  )
}
