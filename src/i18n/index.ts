import { tr, type Strings } from './tr'

const dictionaries = { tr } satisfies Record<string, Strings>

export function useT(locale: keyof typeof dictionaries = 'tr'): Strings {
  return dictionaries[locale]
}
