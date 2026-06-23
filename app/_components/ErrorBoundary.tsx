'use client'

import { Component, type ReactNode } from 'react'
import { useLang } from '@/lib/LangContext'

interface InnerProps { children: ReactNode; fallback?: ReactNode; msg: string; retry: string }
interface State { hasError: boolean }

class ErrorBoundaryInner extends Component<InnerProps, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--danger-fg)' }}>{this.props.msg}</div>
          <button className="btn" onClick={() => this.setState({ hasError: false })}>
            {this.props.retry}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface Props { children: ReactNode; fallback?: ReactNode }

export function ErrorBoundary({ children, fallback }: Props) {
  const { t } = useLang()
  return (
    <ErrorBoundaryInner msg={t('error.boundary')} retry={t('common.retry')} fallback={fallback}>
      {children}
    </ErrorBoundaryInner>
  )
}
