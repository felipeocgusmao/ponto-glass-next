'use client'

import Link from 'next/link'
import { useEffect } from 'react'

const CSS = `
  .land*{box-sizing:border-box;margin:0;padding:0}
  .land{
    background:#030712;
    color:#f0f4ff;
    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    overflow-x:hidden;
  }

  /* ── Scroll reveal ── */
  [data-reveal]{
    opacity:0;
    transform:translateY(28px);
    transition:opacity .75s cubic-bezier(.16,1,.3,1),transform .75s cubic-bezier(.16,1,.3,1);
  }
  [data-reveal=left]{transform:translateX(-40px)}
  [data-reveal=right]{transform:translateX(40px)}
  [data-reveal=scale]{transform:scale(.92);transform-origin:center top}
  [data-reveal]._vis{opacity:1;transform:none}

  /* ── Keyframes ── */
  @keyframes land-aurora{
    0%,100%{background-position:0% 50%}
    50%{background-position:100% 50%}
  }
  @keyframes land-float{
    0%,100%{transform:translateY(0) rotate(-0.8deg)}
    50%{transform:translateY(-14px) rotate(0.8deg)}
  }
  @keyframes land-float2{
    0%,100%{transform:translateY(0) rotate(0.6deg)}
    50%{transform:translateY(-10px) rotate(-0.6deg)}
  }
  @keyframes land-glow{
    0%,100%{box-shadow:0 0 32px rgba(99,102,241,.35),0 8px 24px rgba(99,102,241,.25)}
    50%{box-shadow:0 0 64px rgba(99,102,241,.6),0 12px 36px rgba(139,92,246,.3)}
  }
  @keyframes land-blink{
    0%,100%{opacity:1}50%{opacity:.2}
  }
  @keyframes land-shimmer{
    from{background-position:200% 0}to{background-position:-200% 0}
  }
  @keyframes land-orbit{
    from{transform:rotate(0deg) translateX(140px) rotate(0deg)}
    to{transform:rotate(360deg) translateX(140px) rotate(-360deg)}
  }

  /* ── NAV ── */
  .l-nav{
    position:fixed;top:0;left:0;right:0;z-index:100;
    display:flex;align-items:center;justify-content:space-between;
    padding:16px 48px;
    background:rgba(3,7,18,.72);
    backdrop-filter:blur(24px);
    -webkit-backdrop-filter:blur(24px);
    border-bottom:1px solid rgba(255,255,255,.055);
  }
  .l-logo{
    font-weight:900;font-size:19px;letter-spacing:-.6px;
    background:linear-gradient(135deg,#818cf8,#c084fc);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  }
  .l-nav-links{display:flex;align-items:center;gap:28px}
  .l-nav-link{
    font-size:13.5px;font-weight:500;color:#64748b;
    text-decoration:none;transition:color .2s;
  }
  .l-nav-link:hover{color:#cbd5e1}
  .l-nav-btn{
    padding:9px 22px;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);
    color:#fff;border-radius:8px;text-decoration:none;
    font-size:13.5px;font-weight:700;
    transition:transform .2s,opacity .2s;
    box-shadow:0 0 24px rgba(99,102,241,.3);
  }
  .l-nav-btn:hover{transform:translateY(-1px);opacity:.88}

  /* ── HERO ── */
  .l-hero{
    position:relative;
    min-height:100dvh;
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    padding:128px 24px 60px;
    text-align:center;overflow:hidden;
  }
  .l-hero-bg{
    position:absolute;inset:0;
    background:
      radial-gradient(ellipse 70% 55% at 12% 12%,rgba(99,102,241,.24) 0%,transparent 65%),
      radial-gradient(ellipse 55% 45% at 88% 88%,rgba(139,92,246,.2) 0%,transparent 65%),
      radial-gradient(ellipse 40% 35% at 65% 28%,rgba(6,182,212,.1) 0%,transparent 70%),
      #030712;
    animation:land-aurora 15s ease infinite;
    background-size:200% 200%;
  }
  .l-hero-grid{
    position:absolute;inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px);
    background-size:56px 56px;
    mask-image:radial-gradient(ellipse 90% 80% at 50% 40%,black 25%,transparent 100%);
    -webkit-mask-image:radial-gradient(ellipse 90% 80% at 50% 40%,black 25%,transparent 100%);
  }
  .l-hero-badge{
    position:relative;z-index:1;
    display:inline-flex;align-items:center;gap:8px;
    padding:7px 18px;
    border:1px solid rgba(99,102,241,.4);
    border-radius:999px;
    font-size:12.5px;font-weight:600;color:#a5b4fc;
    background:rgba(99,102,241,.1);
    backdrop-filter:blur(8px);
    margin-bottom:28px;
  }
  .l-hero-dot{
    width:7px;height:7px;border-radius:50%;
    background:#818cf8;box-shadow:0 0 8px #818cf8;
    animation:land-blink 2.5s ease infinite;
  }
  .l-hero-h1{
    position:relative;z-index:1;
    font-size:clamp(2.7rem,7.5vw,5.4rem);
    font-weight:900;letter-spacing:-2.5px;line-height:1.04;
    margin-bottom:24px;
  }
  .l-hero-h1 .g{
    background:linear-gradient(135deg,#818cf8 0%,#c084fc 45%,#38bdf8 100%);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  }
  .l-hero-sub{
    position:relative;z-index:1;
    font-size:clamp(15.5px,2.2vw,18.5px);
    color:#94a3b8;max-width:540px;
    line-height:1.72;margin-bottom:44px;
  }
  .l-hero-ctas{
    position:relative;z-index:1;
    display:flex;gap:12px;flex-wrap:wrap;
    justify-content:center;margin-bottom:88px;
  }
  .btn-prim{
    padding:15px 34px;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);
    color:#fff;border-radius:10px;text-decoration:none;
    font-size:15px;font-weight:700;
    box-shadow:0 0 0 1px rgba(99,102,241,.3),0 8px 24px rgba(99,102,241,.35);
    transition:transform .2s,box-shadow .2s;
    animation:land-glow 3.5s ease infinite;
  }
  .btn-prim:hover{
    transform:translateY(-2px);
    box-shadow:0 0 0 1px rgba(99,102,241,.5),0 16px 40px rgba(99,102,241,.5);
  }
  .btn-sec{
    padding:15px 34px;
    border:1px solid rgba(255,255,255,.1);
    color:#cbd5e1;border-radius:10px;text-decoration:none;
    font-size:15px;font-weight:600;
    background:rgba(255,255,255,.03);backdrop-filter:blur(8px);
    transition:all .2s;
  }
  .btn-sec:hover{
    border-color:rgba(255,255,255,.22);
    background:rgba(255,255,255,.07);
    transform:translateY(-2px);
  }

  /* ── PREVIEW CARDS ── */
  .l-preview{
    position:relative;z-index:1;
    width:100%;max-width:900px;
    height:270px;
    pointer-events:none;user-select:none;
  }
  .l-pc{
    position:absolute;
    background:rgba(8,15,34,.88);
    border:1px solid rgba(255,255,255,.085);
    border-radius:14px;
    backdrop-filter:blur(24px);
    box-shadow:0 32px 72px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.035);
    overflow:hidden;
  }
  .l-pc-main{
    width:330px;left:50%;transform:translateX(-50%);
    top:0;padding:18px 20px;
    animation:land-float 6s ease-in-out infinite;
  }
  .l-pc-left{
    width:216px;left:1%;top:44px;
    padding:13px 15px;opacity:.82;
    animation:land-float2 7s ease-in-out infinite .9s;
  }
  .l-pc-right{
    width:216px;right:1%;top:54px;
    padding:13px 15px;opacity:.82;
    animation:land-float 7.5s ease-in-out infinite 1.4s;
  }
  .l-pc-hd{
    display:flex;align-items:center;justify-content:space-between;
    margin-bottom:11px;padding-bottom:10px;
    border-bottom:1px solid rgba(255,255,255,.055);
  }
  .l-pc-ttl{font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em}
  .l-pc-live{display:flex;align-items:center;gap:5px;font-size:10px;color:#4ade80;font-weight:600}
  .l-pc-live-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;animation:land-blink 1.5s ease infinite}
  .l-pc-name{font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:10px}
  .l-pc-tr{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}
  .l-pc-t{font-size:10.5px;color:#475569}
  .l-pc-btn{
    padding:5px 11px;border-radius:6px;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);
    font-size:10px;font-weight:700;color:#fff;
  }
  .l-pc-bar-bg{background:rgba(255,255,255,.06);border-radius:4px;height:5px;margin-bottom:9px}
  .l-pc-bar{height:5px;border-radius:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#38bdf8);width:68%}
  .l-pc-meta{display:flex;justify-content:space-between;font-size:10.5px;color:#334155}
  .l-pc-row{
    display:flex;align-items:center;justify-content:space-between;
    padding:5.5px 0;border-bottom:1px solid rgba(255,255,255,.035);
  }
  .l-pc-row:last-child{border-bottom:none}
  .l-pc-emp{font-size:11.5px;font-weight:600;color:#cbd5e1}
  .l-chip-in{
    padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;
    background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.18);
  }
  .l-chip-out{
    padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;
    background:rgba(100,116,139,.08);color:#475569;border:1px solid rgba(100,116,139,.14);
  }
  .l-chip-blue{
    padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;
    background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.2);
  }
  .l-chip-ora{
    padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;
    background:rgba(249,115,22,.1);color:#fb923c;border:1px solid rgba(249,115,22,.18);
  }

  /* ── STATS ── */
  .l-stats{padding:0 24px 80px}
  .l-stats-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
    max-width:880px;margin:0 auto;
    border:1px solid rgba(255,255,255,.055);border-radius:16px;
    overflow:hidden;
    gap:1px;background:rgba(255,255,255,.04);
  }
  .l-stat{background:#06091a;padding:28px 20px;text-align:center;transition:background .25s}
  .l-stat:hover{background:#0c1530}
  .l-stat-n{
    font-size:2.1rem;font-weight:900;letter-spacing:-1px;line-height:1;margin-bottom:5px;
    background:linear-gradient(135deg,#818cf8,#c084fc);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  }
  .l-stat-l{font-size:12px;color:#334155;font-weight:500}

  /* ── SECTION HEADER ── */
  .l-eye{text-align:center;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6366f1;margin-bottom:10px}
  .l-h2{
    text-align:center;
    font-size:clamp(1.9rem,4.5vw,2.8rem);font-weight:900;letter-spacing:-1.2px;
    margin-bottom:12px;color:#f0f4ff;
  }
  .l-h2 .g{
    background:linear-gradient(135deg,#818cf8,#c084fc 50%,#38bdf8);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  }
  .l-sub{
    text-align:center;font-size:15px;color:#334155;
    max-width:480px;margin:0 auto 56px;line-height:1.65;
  }

  /* ── FEATURES ── */
  .l-feat{padding:80px 24px;max-width:1080px;margin:0 auto}
  .l-feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px}
  .l-fc{
    padding:26px 26px 22px;
    background:linear-gradient(145deg,rgba(255,255,255,.032),rgba(255,255,255,.007));
    border:1px solid rgba(255,255,255,.064);
    border-radius:14px;
    transition:border-color .3s,transform .35s;
    position:relative;overflow:hidden;
  }
  .l-fc::after{
    content:'';position:absolute;
    top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,rgba(99,102,241,.5),transparent);
    opacity:0;transition:opacity .3s;
  }
  .l-fc:hover::after{opacity:1}
  .l-fc:hover{border-color:rgba(99,102,241,.22);transform:translateY(-4px)}
  .l-fc-icon{
    width:42px;height:42px;border-radius:9px;
    display:flex;align-items:center;justify-content:center;
    font-size:20px;
    background:rgba(99,102,241,.1);
    border:1px solid rgba(99,102,241,.16);
    margin-bottom:14px;
  }
  .l-fc-title{font-size:15.5px;font-weight:700;margin-bottom:7px;color:#e2e8f0}
  .l-fc-desc{font-size:13px;color:#334155;line-height:1.62}

  /* ── HOW IT WORKS ── */
  .l-how{
    padding:80px 24px;
    background:linear-gradient(180deg,transparent,rgba(99,102,241,.025),transparent);
  }
  .l-how-inner{max-width:860px;margin:0 auto}
  .l-how-steps{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
    gap:0;position:relative;
  }
  .l-how-step{
    padding:0 32px;text-align:center;position:relative;
  }
  .l-how-step+.l-how-step::before{
    content:'';
    position:absolute;left:0;top:26px;
    width:1px;height:40px;
    background:linear-gradient(180deg,transparent,rgba(99,102,241,.35),transparent);
  }
  .l-how-n{
    width:52px;height:52px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;font-weight:900;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;
    margin:0 auto 18px;
    box-shadow:0 0 28px rgba(99,102,241,.38);
  }
  .l-how-t{font-size:16.5px;font-weight:700;margin-bottom:9px;color:#e2e8f0}
  .l-how-d{font-size:13px;color:#334155;line-height:1.62}

  /* ── SECURITY ── */
  .l-sec{
    padding:80px 24px;
    border-top:1px solid rgba(255,255,255,.038);
    border-bottom:1px solid rgba(255,255,255,.038);
    background:rgba(0,0,0,.32);
  }
  .l-sec-pills{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(175px,1fr));
    gap:10px;max-width:880px;margin:0 auto;
  }
  .l-sec-pill{
    display:flex;align-items:center;gap:9px;
    padding:13px 16px;
    background:rgba(255,255,255,.022);
    border:1px solid rgba(255,255,255,.05);
    border-radius:9px;
    font-size:13px;font-weight:500;color:#94a3b8;
    transition:border-color .2s,background .2s;
  }
  .l-sec-pill:hover{border-color:rgba(99,102,241,.28);background:rgba(99,102,241,.04)}
  .l-sdot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 7px rgba(34,197,94,.5);flex-shrink:0}

  /* ── STACK ── */
  .l-stack{padding:80px 24px;text-align:center}
  .l-stack-tags{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:660px;margin:0 auto 40px}
  .l-tag{
    padding:7px 17px;
    border:1px solid rgba(255,255,255,.068);border-radius:999px;
    font-size:12.5px;font-weight:500;color:#475569;
    background:rgba(255,255,255,.022);
    transition:all .2s;
  }
  .l-tag:hover{border-color:rgba(99,102,241,.35);color:#a5b4fc;background:rgba(99,102,241,.06)}

  /* ── CTA BOTTOM ── */
  .l-cta{
    padding:110px 24px;text-align:center;
    position:relative;overflow:hidden;
  }
  .l-cta::before{
    content:'';position:absolute;
    top:50%;left:50%;transform:translate(-50%,-50%);
    width:720px;height:720px;border-radius:50%;
    background:radial-gradient(circle,rgba(99,102,241,.16) 0%,transparent 70%);
    pointer-events:none;
  }
  .l-cta-h2{
    font-size:clamp(2.2rem,6vw,4rem);font-weight:900;letter-spacing:-1.8px;
    margin-bottom:16px;color:#f0f4ff;position:relative;
  }
  .l-cta-sub{font-size:16px;color:#334155;margin-bottom:40px;position:relative;max-width:400px;margin-left:auto;margin-right:auto}

  /* ── FOOTER ── */
  .l-footer{
    padding:22px 48px;
    border-top:1px solid rgba(255,255,255,.038);
    display:flex;align-items:center;justify-content:space-between;
    flex-wrap:wrap;gap:10px;
  }
  .l-footer-copy{font-size:12px;color:#1e293b}
  .l-footer-link{font-size:12px;color:#1e293b;text-decoration:none;transition:color .2s}
  .l-footer-link:hover{color:#818cf8}

  /* ── RESPONSIVE ── */
  @media(max-width:768px){
    .l-nav{padding:14px 20px}
    .l-nav-links .l-nav-link{display:none}
    .l-hero{padding:96px 16px 48px}
    .l-preview{display:none}
    .l-hero-ctas{margin-bottom:0}
    .l-feat{padding:60px 16px}
    .l-how{padding:60px 16px}
    .l-sec{padding:60px 16px}
    .l-stack{padding:60px 16px}
    .l-cta{padding:80px 16px}
    .l-footer{padding:20px}
    .l-stats{padding:0 16px 60px}
    .l-how-step+.l-how-step::before{display:none}
    .l-how-step{padding:0 16px}
  }
`

export default function LandingPage() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const obs = new IntersectionObserver(
      entries =>
        entries.forEach(e => {
          if (!e.isIntersecting) return
          const el = e.target as HTMLElement
          const delay = Number(el.dataset.delay ?? 0)
          setTimeout(() => el.classList.add('_vis'), delay)
          obs.unobserve(el)
        }),
      { threshold: 0.08 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="land">

        {/* ── NAV ── */}
        <nav className="l-nav">
          <span className="l-logo">PontoGlass</span>
          <div className="l-nav-links">
            <Link href="#features" className="l-nav-link">Funcionalidades</Link>
            <Link href="#security" className="l-nav-link">Segurança</Link>
            <Link href="https://github.com/felipeocgusmao/ponto-glass-next" target="_blank" rel="noopener noreferrer" className="l-nav-link">GitHub</Link>
          </div>
          <Link href="/login" className="l-nav-btn">Entrar →</Link>
        </nav>

        {/* ── HERO ── */}
        <section className="l-hero">
          <div className="l-hero-bg" />
          <div className="l-hero-grid" />

          <div className="l-hero-badge" data-reveal>
            <span className="l-hero-dot" />
            Sistema de ponto para empresas modernas
          </div>

          <h1 className="l-hero-h1" data-reveal data-delay="80">
            O ponto que a sua<br />equipa <span className="g">merece</span>.
          </h1>

          <p className="l-hero-sub" data-reveal data-delay="160">
            Leve, seguro e bonito — sem instalação, sem servidor próprio.
            Um link, uma senha. O admin vê tudo, em tempo real.
          </p>

          <div className="l-hero-ctas" data-reveal data-delay="240">
            <Link href="/login" className="btn-prim">Aceder ao sistema →</Link>
            <Link href="/demo" className="btn-sec">Demo ao vivo</Link>
            <a href="https://github.com/felipeocgusmao/ponto-glass-next" target="_blank" rel="noopener noreferrer" className="btn-sec">GitHub</a>
          </div>

          {/* Mock preview cards */}
          <div className="l-preview" data-reveal data-delay="360">
            {/* Left — admin dashboard */}
            <div className="l-pc l-pc-left">
              <div className="l-pc-hd">
                <span className="l-pc-ttl">Dashboard</span>
                <span className="l-pc-live"><span className="l-pc-live-dot" />Ao vivo</span>
              </div>
              <div className="l-pc-row"><span className="l-pc-emp">João Silva</span><span className="l-chip-in">Dentro</span></div>
              <div className="l-pc-row"><span className="l-pc-emp">Ana Costa</span><span className="l-chip-in">Dentro</span></div>
              <div className="l-pc-row"><span className="l-pc-emp">Pedro Lopes</span><span className="l-chip-out">Saída</span></div>
            </div>

            {/* Center — punch card */}
            <div className="l-pc l-pc-main">
              <div className="l-pc-hd">
                <span className="l-pc-ttl">Meu Ponto</span>
                <span className="l-pc-live"><span className="l-pc-live-dot" />Em curso</span>
              </div>
              <div className="l-pc-name">João Silva</div>
              <div className="l-pc-tr">
                <span className="l-pc-t">Entrada 09:02 · Meta 17:00</span>
                <span className="l-pc-btn">Saída</span>
              </div>
              <div className="l-pc-bar-bg"><div className="l-pc-bar" /></div>
              <div className="l-pc-meta"><span>6h 22m de 8h</span><span>€ 12,80 ganhos</span></div>
            </div>

            {/* Right — report */}
            <div className="l-pc l-pc-right">
              <div className="l-pc-hd">
                <span className="l-pc-ttl">Relatório</span>
                <span className="l-pc-live" style={{ color: '#a5b4fc' }}>Jun 2026</span>
              </div>
              <div className="l-pc-row"><span className="l-pc-emp">Total trabalhado</span><span className="l-chip-blue">168h</span></div>
              <div className="l-pc-row"><span className="l-pc-emp">Horas extra</span><span className="l-chip-ora">+6h</span></div>
              <div className="l-pc-row"><span className="l-pc-emp">Ganhos totais</span><span className="l-chip-in">€ 2.240</span></div>
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <section className="l-stats">
          <div className="l-stats-grid">
            {([
              { n: '147', l: 'testes automatizados' },
              { n: '2FA', l: 'autenticação TOTP' },
              { n: '5', l: 'roles e permissões' },
              { n: '∞', l: 'empresas em multi-tenancy' },
            ] as { n: string; l: string }[]).map((s, i) => (
              <div className="l-stat" key={s.l} data-reveal data-delay={String(i * 70)}>
                <div className="l-stat-n">{s.n}</div>
                <div className="l-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="l-feat" id="features">
          <div data-reveal><p className="l-eye">Funcionalidades</p></div>
          <h2 className="l-h2" data-reveal data-delay="60">
            Tudo o que precisas,<br />nada do que <span className="g">não</span>.
          </h2>
          <p className="l-sub" data-reveal data-delay="120">
            Do registo de ponto ao relatório em PDF, passando por geofencing e notificações push.
          </p>
          <div className="l-feat-grid">
            {([
              { icon: '⏱', title: 'Tempo real', desc: 'Horas trabalhadas, ganhos e estado de cada funcionário, atualizados ao segundo.' },
              { icon: '📊', title: 'Relatórios', desc: 'CSV e PDF profissionais por período. Horas extra, banco de horas e ganhos em €.' },
              { icon: '🔒', title: 'Segurança máxima', desc: 'JWT httpOnly, bcrypt, 2FA TOTP, rate limit distribuído, RLS Supabase e RBAC por role.' },
              { icon: '📱', title: 'PWA nativa', desc: 'Instala no celular como app nativa. Push notifications via VAPID. Sem loja.' },
              { icon: '🌍', title: 'Multi-idioma', desc: 'PT-PT, PT-BR, EN e ES. Fuso horário e locale configuráveis por empresa.' },
              { icon: '⚙️', title: 'Admin completo', desc: 'Command Palette ⌘K, geofencing, modo quiosque, audit log e multi-tenancy.' },
            ] as { icon: string; title: string; desc: string }[]).map((f, i) => (
              <div className="l-fc" key={f.title} data-reveal data-delay={String(i * 55)}>
                <div className="l-fc-icon">{f.icon}</div>
                <div className="l-fc-title">{f.title}</div>
                <div className="l-fc-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="l-how">
          <div className="l-how-inner">
            <div data-reveal><p className="l-eye">Como funciona</p></div>
            <h2 className="l-h2" data-reveal data-delay="60">Pronto em <span className="g">3 passos</span>.</h2>
            <p className="l-sub" data-reveal data-delay="120">Sem instalação, sem servidores próprios, sem complicação.</p>
            <div className="l-how-steps">
              {([
                { n: '1', t: 'Cria a empresa', d: 'O super-admin cria o tenant, define o fuso horário, idioma e regras de trabalho.' },
                { n: '2', t: 'Adiciona funcionários', d: 'Via formulário ou importação CSV. Cada pessoa recebe credenciais para o seu ponto.' },
                { n: '3', t: 'Ponto em tempo real', d: 'O funcionário bate o ponto no telemóvel ou quiosque. O admin vê tudo ao segundo.' },
              ] as { n: string; t: string; d: string }[]).map((s, i) => (
                <div className="l-how-step" key={s.n} data-reveal data-delay={String(i * 100)}>
                  <div className="l-how-n">{s.n}</div>
                  <div className="l-how-t">{s.t}</div>
                  <div className="l-how-d">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECURITY ── */}
        <section className="l-sec" id="security">
          <div data-reveal><p className="l-eye">Segurança</p></div>
          <h2 className="l-h2" data-reveal data-delay="60">
            Seguro <span className="g">por omissão</span>.
          </h2>
          <p className="l-sub" data-reveal data-delay="120">
            Cada funcionalidade foi desenhada com segurança em mente, não como afterthought.
          </p>
          <div className="l-sec-pills">
            {[
              'JWT httpOnly · 8h',
              'bcrypt 10 rounds',
              '2FA TOTP opt-in',
              'Rate limit distribuído',
              'Row-Level Security',
              'RBAC multi-role',
              'Revogação de sessões',
              'Audit log completo',
              'VAPID push seguro',
            ].map((p, i) => (
              <div className="l-sec-pill" key={p} data-reveal data-delay={String(i * 38)}>
                <span className="l-sdot" />
                {p}
              </div>
            ))}
          </div>
        </section>

        {/* ── STACK ── */}
        <section className="l-stack">
          <div data-reveal><p className="l-eye">Tech stack</p></div>
          <h2 className="l-h2" data-reveal data-delay="60">Construído com o <span className="g">melhor</span>.</h2>
          <div className="l-stack-tags" data-reveal data-delay="120">
            {[
              'Next.js 14', 'TypeScript', 'Supabase', 'PostgreSQL',
              'JWT (jose)', 'bcryptjs', 'otplib', 'Vitest',
              'Playwright', 'Sentry', 'Vercel', 'PWA', 'VAPID',
            ].map(t => (
              <span className="l-tag" key={t}>{t}</span>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="l-cta">
          <h2 className="l-cta-h2" data-reveal>
            Começa <span className="g">hoje</span>.
          </h2>
          <p className="l-cta-sub" data-reveal data-delay="80">
            Grátis. Open source. Sem cartão de crédito.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }} data-reveal data-delay="160">
            <Link href="/login" className="btn-prim">Aceder ao sistema →</Link>
            <a href="https://github.com/felipeocgusmao/ponto-glass-next" target="_blank" rel="noopener noreferrer" className="btn-sec">Ver no GitHub</a>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="l-footer">
          <span className="l-footer-copy">© 2026 PontoGlass · MIT License · Feito com ♥</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="https://github.com/felipeocgusmao/ponto-glass-next" target="_blank" rel="noopener noreferrer" className="l-footer-link">GitHub</a>
            <Link href="/login" className="l-footer-link">Login</Link>
          </div>
        </footer>

      </div>
    </>
  )
}
