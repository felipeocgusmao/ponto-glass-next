import { businessDate } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'

type CorrectionStatus = 'pending' | 'approved' | 'rejected'
interface CorrReq { id: string; req_type: string; req_timestamp: string; req_date: string; reason: string | null; status: CorrectionStatus; reviewer_note: string | null; created_at: string }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  corrLoading: boolean
  corrLoaded: boolean
  corrList: CorrReq[]
  corrDate: string
  setCorrDate: (v: string) => void
  corrTime: string
  setCorrTime: (v: string) => void
  corrType: string
  setCorrType: (v: string) => void
  corrReason: string
  setCorrReason: (v: string) => void
  corrSubmitting: boolean
  corrMsg: { ok: boolean; text: string } | null
  submitCorrection: () => void
}

export function CorrecoesTab({
  corrLoading, corrLoaded, corrList,
  corrDate, setCorrDate, corrTime, setCorrTime,
  corrType, setCorrType, corrReason, setCorrReason,
  corrSubmitting, corrMsg, submitCorrection,
}: Props) {
  const { t } = useLang()

  return (
    <div className="emp-card">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16 }}>
        {t('corr.request_title')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div className="field">
          <label htmlFor="corr-date" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('corr.date')}</label>
          <input id="corr-date" type="date" className="input" value={corrDate} onChange={e => setCorrDate(e.target.value)} max={businessDate()} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="corr-type" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('corr.type')}</label>
            <select id="corr-type" className="input" value={corrType} onChange={e => setCorrType(e.target.value)}>
              <option value="entrada">{t('punch.entrada')}</option>
              <option value="saída">{t('punch.saída')}</option>
              <option value="inicio_almoco">{t('punch.inicio_almoco')}</option>
              <option value="fim_almoco">{t('punch.fim_almoco')}</option>
              <option value="pausa_cafe">{t('punch.pausa_cafe')}</option>
              <option value="retorno_cafe">{t('punch.retorno_cafe')}</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="corr-time" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('corr.time')}</label>
            <input id="corr-time" type="time" className="input" value={corrTime} onChange={e => setCorrTime(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="corr-reason" style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('corr.reason')}</label>
          <input id="corr-reason" type="text" className="input" value={corrReason} onChange={e => setCorrReason(e.target.value)} placeholder={t('corr.reason_placeholder')} />
        </div>

        {corrMsg && (
          <div className={`alert-inline ${corrMsg.ok ? 'ok' : 'err'}`}>{corrMsg.text}</div>
        )}

        <button className="btn-emp primary-big" onClick={submitCorrection} disabled={corrSubmitting}>
          {corrSubmitting ? t('corr.submitting') : t('corr.submit')}
        </button>
      </div>

      {corrLoading && <div className="alert-inline info">{t('common.loading')}</div>}

      {corrLoaded && corrList.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('corr.my_requests')}
          </div>
          {corrList.map(cr => {
            const d = new Date(cr.req_timestamp)
            const dateStr = cr.req_date.split('-').reverse().join('/')
            const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={cr.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{t(`punch.${cr.req_type}` as Parameters<typeof t>[0]) || cr.req_type} · {dateStr} {timeStr}</span>
                  <span className={`chip ${cr.status === 'approved' ? 'success' : cr.status === 'rejected' ? 'danger' : 'warn'}`} style={{ fontSize: 10 }}>
                    {cr.status === 'approved' ? t('corr.status.approved') : cr.status === 'rejected' ? t('corr.status.rejected') : t('corr.status.pending')}
                  </span>
                </div>
                {cr.reason && <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontStyle: 'italic' }}>&ldquo;{cr.reason}&rdquo;</div>}
                {cr.reviewer_note && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: cr.status === 'rejected' ? 'rgba(239,68,68,0.08)' : 'var(--surface-2)', borderRadius: 'var(--r-sm)', borderLeft: `2px solid ${cr.status === 'rejected' ? 'var(--danger-fg)' : 'var(--accent)'}`, fontSize: 11, color: cr.status === 'rejected' ? 'var(--danger-fg)' : 'var(--fg-muted)' }}>
                    {t('corr.reviewer_note')}: {cr.reviewer_note}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
