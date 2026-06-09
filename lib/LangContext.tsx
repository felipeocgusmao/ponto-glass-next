'use client'

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type Lang, type TranslationKey, translate, detectLang, LANG_LABELS } from './i18n'
export type { Lang }
export { LANG_LABELS }

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const Ctx = createContext<LangCtx>({ lang: 'pt-PT', setLang: () => {}, t: k => k })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('pt-PT')

  useEffect(() => { setLangState(detectLang()) }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('pg.lang', l)
  }, [])

  // Stable identity (changes only with lang) so consumers can safely list `t`
  // in effect dependencies without re-running on every provider render.
  const t = useCallback((key: TranslationKey) => translate(lang, key), [lang])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLang() { return useContext(Ctx) }
