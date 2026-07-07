import { memo } from 'react'
import { fmtCentesimalSigned, businessDate } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'

type CorrectionStatus = 'pending' | 'approved' | 'rejected'
interface CompReq { id: string; date: string; hours_requested: number; reason: string; status: CorrectionStatus; reviewer_note: string | null; created_at: string }

interface Props {
  bankLoading: boolean
  bankBalance: number | null
  compLoading: boolean
  compLoaded: boolean
  compList: CompReq[]
  compDate: string
  setCompDate: (v: string) => void
  compHours: string
  setCompHours: (v: string) => void
  compReason: string
  setCompReason: (v: string) => void
  compSubmitting: boolean
  compMsg: { ok: boolean; text: string } | null
  submitCompensation: () => void
}

export const BancoTab = memo(function BancoTab({
  bankLoading, bankBalance,
  compLoading, compLoaded, compList,
  compDate, setCompDate, compHours, setCompHours, compReason, setCompReason,
  compSubmitting, compMsg, submitCompensation,
}: Props) {
  const { t } = useLang()

  return (
    <div className="emp-card">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16 }}>
        {t('bank.title')}
      </div>

      {bankLoading && <div className="alert-inline info">{t('common.loading')}</div>}

      {!bankLoading && bankBalance !== null && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-mono)',
            color: bankBalance >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)',
            letterSpacing: '-0.03em',
          }}>
            {fmtCentesimalSigned(bankBalance)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 8 }}>
            {bankBalance >= 0 ? t('bank.surplus') : t('bank.deficit')}
          </div>
          <div style={{ marginTop: 24, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--fg-muted)', textAlign: 'left' }}>
            {t('bank.explanation')}
          </div>
        </div>
      )}

      {!bankLoading && bankBalance === null && (
        <div className="alert-inline info">{t('bank.load_error')}</div>
      )}

      <div style={{ borderTop: '1px solid var(--divider)', marginTop: 20, paddingTop: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 14 }}>
          {t('comp.title')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comp.date')}</label>
              <input type="date" className="input" value={compDate} onChange={e => setCompDate(e.target.value)} max={businessDate()} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comp.hours')}</label>
              <input type="number" min="0.5" max="24" step="0.5" className="input" value={compHours} onChange={e => setCompHours(e.target.value)} placeholder="ex: 2" />
            </div>
          </div>
          <div className="field">
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comp.reason')} <span style={{ color: 'var(--danger-fg)' }}>*</span></label>
            <input type="text" className="input" value={compReason} onChange={e => setCompReason(e.target.value)} placeholder={t('comp.reason_ph').replace('{date}', compDate || '—')} />
          </div>
          {compMsg && <div className={`alert-inline ${compMsg.ok ? 'ok' : 'err'}`}>{compMsg.text}</div>}
          <button className="btn-emp primary-big" onClick={submitCompensation} disabled={compSubmitting}>
            {compSubmitting ? t('comp.submitting') : t('comp.submit')}
          </button>
        </div>

        {compLoading && <div className="alert-inline info">{t('common.loading')}</div>}

        {compLoaded && compList.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 10 }}>
              {t('comp.my_requests')}
            </div>
            {compList.map(cr => (
              <div key={cr.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{cr.date.split('-').reverse().join('/')} · {cr.hours_requested}h</span>
                  <span className={`chip ${cr.status === 'approved' ? 'success' : cr.status === 'rejected' ? 'danger' : 'warn'}`} style={{ fontSize: 10 }}>
                    {t(`comp.status.${cr.status}` as Parameters<typeof t>[0])}
                  </span>
                </div>
                {cr.reason && <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontStyle: 'italic' }}>&ldquo;{cr.reason}&rdquo;</div>}
                {cr.reviewer_note && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', borderLeft: '2px solid var(--accent)', fontSize: 11, color: 'var(--fg-muted)' }}>
                    {t('comp.reviewer_note')}: {cr.reviewer_note}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
})
