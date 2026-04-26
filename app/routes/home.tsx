import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Solana DevTools" },
    {
      name: "description",
      content:
        "Inspect transactions, decode data, explore accounts, and debug smarter—without leaving your browser.",
    },
  ];
}

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Inter', sans-serif;
          background: #05090f;
          color: #fff;
          overflow-x: hidden;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-left  { animation: fadeInUp 0.7s ease both; }
        .hero-right { animation: fadeInUp 0.7s 0.2s ease both; }

        .gradient-text {
          background: linear-gradient(90deg, #4af0b0 0%, #7b6ef6 60%, #5b8dee 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .blob-purple {
          position: absolute;
          width: 520px; height: 420px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(120,80,240,0.22) 0%, transparent 70%);
          top: 60px; left: -80px;
          pointer-events: none;
        }
        .blob-teal {
          position: absolute;
          width: 380px; height: 300px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(40,220,160,0.13) 0%, transparent 70%);
          top: 200px; right: 0;
          pointer-events: none;
        }

        .nav {
          display: flex;
          align-items: center;
          padding: 18px 36px;
          position: relative;
          z-index: 10;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 16px;
          color: #fff;
        }
        .nav-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 12px;
          padding: 4px 12px;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          font-size: 12px;
          color: rgba(255,255,255,0.7);
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 5px 14px;
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 22px;
        }

        .hero-title {
          font-size: 56px;
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -1.5px;
          margin-bottom: 20px;
        }

        .hero-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.5);
          line-height: 1.75;
          max-width: 440px;
          margin-bottom: 32px;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #5b4fcf 0%, #3cb8a0 100%);
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          padding: 11px 22px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          text-decoration: none;
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.85);
          font-weight: 500;
          font-size: 14px;
          padding: 11px 22px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          cursor: pointer;
          text-decoration: none;
        }

        .panel {
          background: #0d1420;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          overflow: hidden;
          font-size: 12px;
        }
        .panel-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .panel-logo {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 700;
          font-size: 13px;
        }
        .panel-network {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 4px 9px;
          font-size: 11px;
          color: rgba(255,255,255,0.7);
        }
        .dot-green { width: 7px; height: 7px; border-radius: 50%; background: #14f195; display:inline-block; }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          padding: 0 12px;
        }
        .panel-tab {
          padding: 8px 10px;
          font-size: 11.5px;
          color: rgba(255,255,255,0.45);
          border-bottom: 2px solid transparent;
          cursor: pointer;
        }
        .panel-tab.active {
          color: #fff;
          border-bottom-color: #9945ff;
        }

        .panel-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .panel-left {
          border-right: 1px solid rgba(255,255,255,0.07);
          padding: 14px;
        }
        .panel-section-title {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .panel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          font-size: 11px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .panel-row-label { color: rgba(255,255,255,0.4); }
        .panel-row-val   { color: rgba(255,255,255,0.85); font-family: monospace; }
        .badge-success {
          background: rgba(20,241,149,0.15);
          color: #14f195;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        .tx-sig {
          font-family: monospace;
          color: rgba(255,255,255,0.8);
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .account-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 10px;
        }
        .account-tab {
          font-size: 11px;
          padding: 2px 10px;
          border-radius: 4px;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
        }
        .account-tab.active {
          background: rgba(153,69,255,0.2);
          color: #9945ff;
        }
        .json-block {
          background: #070d18;
          border-radius: 6px;
          padding: 10px 12px;
          font-family: monospace;
          font-size: 10.5px;
          line-height: 1.7;
          color: #c5cfe0;
        }
        .json-key { color: #9945ff; }
        .json-str { color: #14f195; }
        .json-num { color: #f0a500; }

        .panel-right { padding: 14px; }
        .ix-title {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 10px;
        }
        .ix-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 7px;
          margin-bottom: 6px;
        }
        .ix-num {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: rgba(255,255,255,0.07);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
          color: rgba(255,255,255,0.5);
          flex-shrink: 0;
          margin-right: 8px;
        }
        .ix-name { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.85); }
        .ix-sub  { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 1px; }

        .features-row {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 0;
          margin-top: 40px;
          border-top: 1px solid rgba(255,255,255,0.07);
          border-left: 1px solid rgba(255,255,255,0.07);
        }
        .feature-item {
          padding: 22px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          border-right: 1px solid rgba(255,255,255,0.07);
        }
        .feature-icon { margin-bottom: 10px; }
        .feature-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
        .feature-desc { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.6; white-space: pre-line; }

        .dev-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 12px 18px;
        }
        .code-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg,#9945ff,#14f195);
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
        }
      `}</style>

      <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(140deg,#08101e 0%,#05090f 45%,#060d14 100%)' }}>

        <div className="blob-purple"/>
        <div className="blob-teal"/>

        {/* NAV */}
        <nav className="nav">
          <div className="nav-logo">
            <SolanaIcon size={26}/>
            <span>Solana <span style={{ color: '#7ee8c0' }}>DevTools</span></span>
          </div>
          <div className="nav-badge">
            <ChromeIcon/>
            <span>for Chrome</span>
          </div>
        </nav>

        {/* HERO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 44, padding: '24px 56px 56px', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>

          {/* LEFT */}
          <div className="hero-left" style={{ paddingTop: 16 }}>
            <div className="pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              Built for Solana Builders
            </div>

            <h1 className="hero-title">
              Your Solana<br/>
              Dev Environment,<br/>
              <span className="gradient-text">Right in Chrome.</span>
            </h1>

            <p className="hero-desc">
              Inspect transactions, decode data, explore accounts,
              and debug smarter—without leaving your browser.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <a href="#" className="btn-primary">
                <ChromeIcon color="#fff"/>
                Add to Chrome
              </a>
              <a href="#" className="btn-secondary">
                View on Chrome Web Store
              </a>
            </div>

            {/* 4-up features */}
            <div className="features-row">
              {[
                { icon: <SearchIcon/>,  name: 'Inspect', desc: 'Transactions &\ninstructions' },
                { icon: <DecodeIcon/>,  name: 'Decode',  desc: 'Anchor, SPL &\ncustom data'  },
                { icon: <DBIcon/>,      name: 'Explore', desc: 'Accounts, PDAs\n& programs'  },
                { icon: <FlashIcon/>,   name: 'Debug',   desc: 'Simulate, logs &\nerror tracing' },
              ].map(f => (
                <div className="feature-item" key={f.name}>
                  <div className="feature-icon">{f.icon}</div>
                  <div className="feature-name">{f.name}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT – mock DevTools panel */}
          <div className="hero-right">
            <div className="panel">
              {/* topbar */}
              <div className="panel-topbar">
                <div className="panel-logo">
                  <SolanaIcon size={16}/>
                  <span>Solana <span style={{ color: '#7ee8c0' }}>DevTools</span></span>
                </div>
                <div className="panel-network">
                  <span className="dot-green"/>
                  &nbsp;Mainnet Beta&nbsp;
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>▾</span>
                </div>
                <SettingsIcon/>
              </div>

              {/* tabs */}
              <div className="panel-tabs">
                {['Overview','Transactions','Accounts','Programs','Logs','Settings'].map((t,i) => (
                  <div key={t} className={`panel-tab${i===0?' active':''}`}>{t}</div>
                ))}
              </div>

              {/* body: 2 columns */}
              <div className="panel-body">
                {/* left col */}
                <div className="panel-left">
                  <div className="panel-section-title">
                    Recent Transaction
                    <RefreshIcon/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div className="tx-sig">5KJ3d...m9fR <CopyIcon/></div>
                    <span className="badge-success">Success</span>
                  </div>
                  {[
                    ['Slot','232,456,789'],
                    ['Block Time','2s ago'],
                    ['Fee','0.000005 SOL'],
                    ['Signer','9xQe...Zt1s'],
                  ].map(([k,v]) => (
                    <div className="panel-row" key={k}>
                      <span className="panel-row-label">{k}</span>
                      <span className="panel-row-val">{v}</span>
                    </div>
                  ))}

                  {/* account data */}
                  <div style={{ marginTop: 14 }}>
                    <div className="panel-section-title">Account Data</div>
                    {[
                      ['Account','7Gwa...bqF3'],
                      ['Owner','BPF Loader Upgradeable'],
                      ['Data Size','1.24 KB'],
                    ].map(([k,v]) => (
                      <div className="panel-row" key={k}>
                        <span className="panel-row-label">{k}</span>
                        <span className="panel-row-val" style={{ fontSize: 10 }}>{v}</span>
                      </div>
                    ))}
                    <div className="account-tabs" style={{ marginTop: 10 }}>
                      {['Parsed','Account↑','Raw','Hex'].map((t,i) => (
                        <div key={t} className={`account-tab${i===0?' active':''}`}>{t}</div>
                      ))}
                    </div>
                    <div className="json-block">
                      {'{'}<br/>
                      &nbsp;&nbsp;<span className="json-key">"name"</span>: <span className="json-str">"ExampleAccount"</span>,<br/>
                      &nbsp;&nbsp;<span className="json-key">"authority"</span>: <span className="json-str">"9xQe...Zt1s"</span>,<br/>
                      &nbsp;&nbsp;<span className="json-key">"balance"</span>: <span className="json-str">"1.234 SOL"</span>,<br/>
                      &nbsp;&nbsp;<span className="json-key">"items"</span>: [<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;{'{ '}<span className="json-key">"id"</span>: <span className="json-num">1</span>, <span className="json-key">"value"</span>: <span className="json-num">42</span>{' }'}<br/>
                      &nbsp;&nbsp;]<br/>
                      {'}'}
                    </div>
                  </div>
                </div>

                {/* right col */}
                <div className="panel-right">
                  <div className="ix-title">Instructions (4)</div>
                  {[
                    { n:1, name:'Compute Budget Program', sub:'Set Compute Unit Limit' },
                    { n:2, name:'System Program',         sub:'Transfer' },
                    { n:3, name:'Token Program',          sub:'Transfer' },
                    { n:4, name:'Memo Program',           sub:'Memo' },
                  ].map(ix => (
                    <div className="ix-item" key={ix.n}>
                      <div style={{ display:'flex', alignItems:'center' }}>
                        <div className="ix-num">{ix.n}</div>
                        <div>
                          <div className="ix-name">{ix.name}</div>
                          <div className="ix-sub">{ix.sub}</div>
                        </div>
                      </div>
                      <span style={{ color:'rgba(255,255,255,0.25)', fontSize:14 }}>›</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* below panel row */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20, padding:'0 4px' }}>
              <div className="dev-badge">
                <div className="code-icon">{'</>'}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Built for Developers.</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>On Solana.</div>
                </div>
              </div>
              <div style={{ width:68, height:54 }}>
                <SolanaIconLarge/>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

/* ─── SVG Icons ─── */
function SolanaIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 646 498" fill="none">
      <path d="M108 364h430a18 18 0 0112 31L444 499a18 18 0 01-12 5H2a18 18 0 01-12-31L96 369a18 18 0 0112-5z" fill="url(#sa)"/>
      <path d="M108 5h430a18 18 0 0112 31L444 140a18 18 0 01-12 5H2a18 18 0 01-12-31L96 10A18 18 0 01108 5z" fill="url(#sb)"/>
      <path d="M444 184H14a18 18 0 00-12 31l106 104a18 18 0 0012 5h430a18 18 0 0012-31L446 189a18 18 0 00-12-5z" fill="url(#sc)"/>
      <defs>
        <linearGradient id="sa" x1="0" y1="498" x2="646" y2="364" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="1" stopColor="#14F195"/></linearGradient>
        <linearGradient id="sb" x1="0" y1="140" x2="646" y2="5"   gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="1" stopColor="#14F195"/></linearGradient>
        <linearGradient id="sc" x1="0" y1="289" x2="646" y2="184" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="1" stopColor="#14F195"/></linearGradient>
      </defs>
    </svg>
  );
}

function SolanaIconLarge() {
  return (
    <svg viewBox="0 0 646 498" fill="none" width="68" height="54">
      <path d="M108 364h430a18 18 0 0112 31L444 499a18 18 0 01-12 5H2a18 18 0 01-12-31L96 369a18 18 0 0112-5z" fill="url(#sla)"/>
      <path d="M108 5h430a18 18 0 0112 31L444 140a18 18 0 01-12 5H2a18 18 0 01-12-31L96 10A18 18 0 01108 5z" fill="url(#slb)"/>
      <path d="M444 184H14a18 18 0 00-12 31l106 104a18 18 0 0012 5h430a18 18 0 0012-31L446 189a18 18 0 00-12-5z" fill="url(#slc)"/>
      <defs>
        <linearGradient id="sla" x1="0" y1="498" x2="646" y2="364" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="1" stopColor="#14F195"/></linearGradient>
        <linearGradient id="slb" x1="0" y1="140" x2="646" y2="5"   gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="1" stopColor="#14F195"/></linearGradient>
        <linearGradient id="slc" x1="0" y1="289" x2="646" y2="184" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="1" stopColor="#14F195"/></linearGradient>
      </defs>
    </svg>
  );
}

function ChromeIcon({ color = 'rgba(255,255,255,0.6)' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
      <line x1="21.17" y1="8" x2="12" y2="8"/>
      <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
      <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
    </svg>
  );
}

function SearchIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b9fff" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

function DecodeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9945ff" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
}

function DBIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14d9a0" strokeWidth="2" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
}

function FlashIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}

function SettingsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}

function RefreshIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}

function CopyIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}