'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import type { Tab } from '../_lib/types'
import {
  IconClock, IconDashboard, IconStatus, IconList, IconUsers,
  IconBank, IconCalendar, IconBar, IconAudit, IconEdit,
  IconDownload, IconUserPlus, SunIcon, MoonIcon, IconSearch,
  IconBuilding, IconBell, IconSettings,
} from './icons'

type CmdItem = {
  id: string
  label: string
  group: string
  icon: React.ReactNode
  kind: 'nav' | 'action'
  tabId?: Tab
}

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  meu_ponto:    <IconClock size={15} />,
  dashboard:    <IconDashboard size={15} />,
  status:       <IconStatus size={15} />,
  registros:    <IconList size={15} />,
  correcoes:    <IconEdit size={15} />,
  funcionarios: <IconUsers size={15} />,
  banco:        <IconBank size={15} />,
  ausencias:    <IconUsers size={15} />,
  feriados:     <IconCalendar size={15} />,
  relatorios:   <IconBar size={15} />,
  auditoria:    <IconAudit size={15} />,
  empresas:     <IconBuilding size={15} />,
  alertas:      <IconBell size={15} />,
  integracoes:  <IconSettings size={15} />,
}

export default function CommandPalette({
  open,
  onClose,
  tabs,
  onNavigate,
  onAction,
  theme,
}: {
  open: boolean
  onClose: () => void
  tabs: { id: Tab; label: string }[]
  onNavigate: (tab: Tab) => void
  onAction: (id: string) => void
  theme: string
}) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const navGroup = t('tab.dashboard') === 'Dashboard' ? 'Navegar' : 'Navigate'
  const actGroup = 'Ações'

  const items: CmdItem[] = [
    ...tabs.map(tab => ({
      id: `nav_${tab.id}`,
      label: t(`tab.${tab.id}` as Parameters<typeof t>[0]),
      group: navGroup,
      icon: TAB_ICONS[tab.id],
      kind: 'nav' as const,
      tabId: tab.id,
    })),
    {
      id: 'new_employee',
      label: t('tab.funcionarios') === 'Equipa' || t('tab.funcionarios') === 'Equipe' ? 'Cadastrar funcionário' : 'Add employee',
      group: actGroup,
      icon: <IconUserPlus size={15} />,
      kind: 'action',
    },
    {
      id: 'export_csv',
      label: t('common.export') + ' CSV',
      group: actGroup,
      icon: <IconDownload size={15} />,
      kind: 'action',
    },
    {
      id: 'toggle_theme',
      label: theme === 'dark' ? 'Tema claro' : 'Tema escuro',
      group: 'Aparência',
      icon: theme === 'dark' ? <SunIcon /> : <MoonIcon />,
      kind: 'action',
    },
  ]

  const filtered = query
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : items

  const groups: Record<string, CmdItem[]> = {}
  filtered.forEach(item => {
    if (!groups[item.group]) groups[item.group] = []
    groups[item.group].push(item)
  })

  const flatFiltered = filtered

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, flatFiltered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatFiltered[sel]
        if (!item) return
        if (item.kind === 'nav' && item.tabId) onNavigate(item.tabId)
        else onAction(item.id)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, sel, flatFiltered, onClose, onNavigate, onAction])

  if (!open) return null

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          <IconSearch size={14} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Pesquisar…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSel(0) }}
            style={{ paddingLeft: 0, flex: 1 }}
          />
        </div>
        <div className="cmdk-list">
          {Object.entries(groups).map(([groupName, groupItems]) => (
            <div key={groupName}>
              <div className="cmdk-section">{groupName}</div>
              {groupItems.map(item => {
                const flatIdx = flatFiltered.indexOf(item)
                return (
                  <div
                    key={item.id}
                    className={`cmdk-item${flatIdx === sel ? ' sel' : ''}`}
                    onMouseEnter={() => setSel(flatIdx)}
                    onClick={() => {
                      if (item.kind === 'nav' && item.tabId) onNavigate(item.tabId)
                      else onAction(item.id)
                      onClose()
                    }}
                  >
                    <span className="ic">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
          {flatFiltered.length === 0 && (
            <div className="empty">
              <div className="title">Sem resultados</div>
              <div className="desc">Tente outra busca.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
