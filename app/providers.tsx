'use client'

import { LangProvider } from '@/lib/LangContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>
}
