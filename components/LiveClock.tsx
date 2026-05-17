'use client'

import { useEffect, useState } from 'react'

const DAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return (
    <div className="mb-6">
      <div className="clock-time">--:--:--</div>
      <div className="clock-date">Carregando...</div>
    </div>
  )

  return (
    <div className="mb-6">
      <div className="clock-time">{now.toLocaleTimeString('pt-BR')}</div>
      <div className="clock-date">
        {DAYS[now.getDay()]}, {now.getDate()} de {MONTHS[now.getMonth()]} de {now.getFullYear()}
      </div>
    </div>
  )
}
