'use client'

import type { ReactNode } from 'react'
import { LangProvider } from '@/lib/LangContext'

export default function Providers({ children }: { children: ReactNode }) {
  return <LangProvider>{children}</LangProvider>
}
