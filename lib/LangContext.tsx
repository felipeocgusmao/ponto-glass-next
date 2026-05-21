'use client'

import { type ReactNode, createContext, useContext, useEffect, useState } from 'react'
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

  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('pg.lang', l)
  }

  const t = (key: TranslationKey) => translate(lang, key)

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useLang() { return useContext(Ctx) }
