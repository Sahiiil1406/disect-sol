export function meta() {
  return [
    { title: "sol-trace" },
    {
      name: "description",
      content:
        "sol-trace helps you inspect RPC calls, decode instructions, and replay transactions.",
    },
  ];
}

export default function Welcome() {
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

        /* ─── ANIMATIONS ─── */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(153,69,255,0.3); }
          50%       { border-color: rgba(153,69,255,0.7); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-left  { animation: fadeInUp 0.7s ease both; }
        .hero-right { animation: fadeInUp 0.7s 0.2s ease both; }

        .section-appear {
          animation: fadeInUp 0.6s ease both;
        }

        .gradient-text {
          background: linear-gradient(90deg, #4af0b0 0%, #7b6ef6 60%, #5b8dee 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-text-alt {
          background: linear-gradient(90deg, #9945ff 0%, #14f195 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* blobs */
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

        /* ─── NAV ─── */
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
        .nav-links {
          display: flex;
          align-items: center;
          gap: 28px;
          margin-left: auto;
          margin-right: 20px;
        }
        .nav-link {
          font-size: 13px;
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover { color: rgba(255,255,255,0.9); }

        /* ─── PILLS + BADGES ─── */
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
        .section-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(153,69,255,0.35);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 11px;
          color: rgba(153,69,255,0.9);
          margin-bottom: 16px;
          background: rgba(153,69,255,0.08);
        }

        /* ─── HERO ─── */
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

        /* ─── BUTTONS ─── */
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
          transition: opacity 0.2s, transform 0.15s;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

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
          transition: background 0.2s, transform 0.15s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); transform: translateY(-1px); }

        .btn-download {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #9945ff 0%, #14f195 100%);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          padding: 14px 28px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 32px rgba(153,69,255,0.25);
        }
        .btn-download:hover {
          opacity: 0.95;
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(153,69,255,0.4);
        }

        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: rgba(255,255,255,0.6);
          font-weight: 500;
          font-size: 13px;
          padding: 10px 20px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
          text-decoration: none;
          transition: border-color 0.2s, color 0.2s;
        }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.9); }

        /* ─── MOCK PANEL ─── */
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
        .dot-green {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #14f195;
          display: inline-block;
          animation: pulse-dot 2s ease-in-out infinite;
        }

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

        /* ─── FEATURES ROW ─── */
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
          transition: background 0.2s;
        }
        .feature-item:hover { background: rgba(255,255,255,0.02); }
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

        /* ─── PROBLEM SECTION ─── */
        .section-wrapper {
          padding: 80px 56px;
          position: relative;
        }
        .section-title {
          font-size: 38px;
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1.1;
          margin-bottom: 14px;
        }
        .section-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.45);
          line-height: 1.75;
          max-width: 520px;
        }

        .problem-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 48px;
        }
        .problem-card {
          background: #0a1020;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s, transform 0.25s;
          animation: fadeInUp 0.6s ease both;
        }
        .problem-card:hover {
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-2px);
        }
        .problem-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(153,69,255,0.5), transparent);
          opacity: 0;
          transition: opacity 0.25s;
        }
        .problem-card:hover::before { opacity: 1; }

        .problem-num {
          font-size: 11px;
          font-weight: 700;
          color: rgba(153,69,255,0.6);
          letter-spacing: 0.06em;
          margin-bottom: 14px;
        }
        .problem-q {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          margin-bottom: 10px;
          line-height: 1.45;
        }
        .problem-a {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          line-height: 1.65;
        }

        /* ─── CAPABILITIES SECTION ─── */
        .cap-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 48px;
        }
        .cap-card {
          background: #0a1020;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 28px;
          transition: border-color 0.25s, transform 0.2s;
          animation: fadeInUp 0.6s ease both;
        }
        .cap-card:hover {
          border-color: rgba(255,255,255,0.14);
          transform: translateY(-2px);
        }
        .cap-card-wide {
          grid-column: span 2;
        }
        .cap-icon-wrap {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .cap-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .cap-desc {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          line-height: 1.7;
        }
        .cap-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 14px;
        }
        .cap-tag {
          font-size: 10.5px;
          padding: 3px 10px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
        }

        /* ─── HOW IT WORKS ─── */
        .how-steps {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0;
          margin-top: 56px;
          position: relative;
        }
        .how-step {
          padding: 0 16px;
          position: relative;
          animation: fadeInUp 0.6s ease both;
        }
        .how-step-num {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: rgba(153,69,255,0.15);
          border: 1px solid rgba(153,69,255,0.35);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #9945ff;
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }
        .how-connector {
          position: absolute;
          top: 18px;
          left: calc(50% + 18px);
          right: calc(-50% + 18px);
          height: 1px;
          background: linear-gradient(90deg, rgba(153,69,255,0.4), rgba(20,241,149,0.2));
        }
        .how-step:last-child .how-connector { display: none; }
        .how-step-title { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .how-step-desc  { font-size: 11.5px; color: rgba(255,255,255,0.35); line-height: 1.6; }

        /* ─── STATS / SOCIAL PROOF ─── */
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          overflow: hidden;
          margin: 0 56px;
        }
        .stat-item {
          padding: 32px 28px;
          border-right: 1px solid rgba(255,255,255,0.07);
          animation: countUp 0.7s ease both;
        }
        .stat-item:last-child { border-right: none; }
        .stat-num {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 6px;
        }
        .stat-label { font-size: 12px; color: rgba(255,255,255,0.4); }

        /* ─── DOWNLOAD CTA ─── */
        .cta-section {
          margin: 80px 56px;
          background: linear-gradient(135deg, rgba(153,69,255,0.12) 0%, rgba(20,241,149,0.06) 100%);
          border: 1px solid rgba(153,69,255,0.25);
          border-radius: 20px;
          padding: 60px;
          text-align: center;
          position: relative;
          overflow: hidden;
          animation: borderPulse 4s ease-in-out infinite;
        }
        .cta-section::before {
          content: '';
          position: absolute;
          top: -80px; left: 50%;
          transform: translateX(-50%);
          width: 400px; height: 200px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(153,69,255,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .cta-title {
          font-size: 42px;
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1.1;
          margin-bottom: 16px;
        }
        .cta-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.45);
          max-width: 480px;
          margin: 0 auto 36px;
          line-height: 1.7;
        }
        .cta-meta {
          margin-top: 20px;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .cta-meta-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .check-icon { color: #14f195; }

        /* ─── FOOTER ─── */
        .footer {
          padding: 40px 56px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .footer-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          margin-top: 4px;
        }
        .footer-links {
          display: flex;
          gap: 24px;
        }
        .footer-link {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover { color: rgba(255,255,255,0.7); }

        /* ─── DIVIDER ─── */
        .section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
          margin: 0 56px;
        }

        /* shimmer on download button */
        .shimmer-btn {
          position: relative;
          overflow: hidden;
        }
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite;
        }

        /* floating animation on panel */
        .float-panel { animation: float 6s ease-in-out infinite; }
      `}</style>

      <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(140deg,#08101e 0%,#05090f 45%,#060d14 100%)' }}>

        <div className="blob-purple"/>
        <div className="blob-teal"/>

        {/* ─── NAV ─── */}
        <nav className="nav">
          <div className="nav-logo">
            <SolanaIcon size={26}/>
            <span>Solana <span style={{ color: '#7ee8c0' }}>DevTools</span></span>
          </div>
          <div className="nav-badge">
            <ChromeIcon/>
            <span>for Chrome</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how" className="nav-link">How it works</a>
            <a href="#download" className="nav-link">Download</a>
            <a href="https://github.com/Sahiiil1406/disect-sol" className="nav-link" style={{ display:'flex', alignItems:'center', gap:5 }}>
              GitHub
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
          <a href="#download" className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
            <DownloadIcon size={13}/> Add to Chrome
          </a>
        </nav>

        {/* ─── HERO ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 44, padding: '24px 56px 56px', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
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
              <a href="#download" className="btn-primary">
                <ChromeIcon color="#fff"/>
                Add to Chrome
              </a>
              <a href="https://github.com/Sahiiil1406/disect-sol" className="btn-secondary">
                View on GitHub
              </a>
            </div>

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

          <div className="hero-right float-panel">
            <div className="panel">
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

              <div className="panel-tabs">
                {['Overview','Transactions','Accounts','Programs','Logs','Settings'].map((t,i) => (
                  <div key={t} className={`panel-tab${i===0?' active':''}`}>{t}</div>
                ))}
              </div>

              <div className="panel-body">
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

        {/* ─── STATS BAR ─── */}
        <div className="stats-bar" style={{ animationDelay: '0.3s' }}>
          {[
            { num: '< 2ms',  label: 'Capture latency', color: '#14f195' },
            { num: '10+',    label: 'Decoded programs', color: '#9945ff' },
            { num: '100%',   label: 'In-browser. No backend', color: '#5b8dee' },
            { num: 'Free',   label: 'Open source on GitHub', color: '#f0a500' },
          ].map(s => (
            <div className="stat-item" key={s.label}>
              <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ─── PROBLEM SECTION ─── */}
        <div className="section-wrapper" id="features" style={{ paddingBottom: 40 }}>
          <div className="section-pill">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            The Problem
          </div>
          <h2 className="section-title">
            Debugging Solana is<br/>
            <span className="gradient-text-alt">fragmented by default.</span>
          </h2>
          <p className="section-desc">
            Every failed transaction sends you on a tour — wallet popup, RPC payload, explorer tab, raw logs.
            ChronoTrace collapses that into a single deterministic view.
          </p>

          <div className="problem-grid">
            {[
              { q: 'What exactly was sent from the dApp?',                   a: 'Wallet payloads vanish after confirmation. No native way to inspect what actually left the browser.' },
              { q: 'Which accounts were touched, and how?',                  a: 'Explorer shows addresses. Not roles, not lamport deltas, not whether an account was writable.' },
              { q: 'Where did execution fail?',                              a: 'Solana logs emit program IDs and error codes. Correlating them to your instruction tree is manual work.' },
              { q: 'Was it params, account state, or compute budget?',       a: 'Three completely different failure modes. You get one cryptic error string to diagnose all three.' },
              { q: 'How much compute and fee did this consume?',             a: 'The CU budget and actual usage live in different places. Neither tells you what to set next time.' },
              { q: 'Did the simulation match the real execution path?',      a: 'Mock and real simulation flows look identical from outside. ChronoTrace differentiates them by source.' },
            ].map((p, i) => (
              <div className="problem-card" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="problem-num">{'0' + (i + 1)}</div>
                <div className="problem-q">{p.q}</div>
                <div className="problem-a">{p.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-divider"/>

        {/* ─── CAPABILITIES ─── */}
        <div className="section-wrapper" id="capabilities">
          <div className="section-pill">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Core Capabilities
          </div>
          <h2 className="section-title">
            Everything you need,<br/>
            <span className="gradient-text">nothing you don't.</span>
          </h2>

          <div className="cap-grid">
            {[
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9945ff" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
                bg: 'rgba(153,69,255,0.12)',
                title: 'Live transaction interception',
                desc: 'Hooks wallet, provider, and connection calls at runtime. Captures request and response payloads the moment they happen — before anything reaches the chain.',
                tags: ['send', 'sign', 'signMessage', 'simulate', 'RPC'],
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14d9a0" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
                bg: 'rgba(20,217,160,0.1)',
                title: 'Instruction & parameter decoding',
                desc: 'Decodes System, SPL Token, Token-2022, ATA, Compute Budget, Memo, and Anchor programs. Shows method-level intent alongside raw bytes.',
                tags: ['Anchor', 'SPL Token', 'Token-2022', 'System', 'Memo'],
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b8dee" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
                bg: 'rgba(91,141,238,0.12)',
                title: 'CPI instruction tree',
                desc: 'Reconstructs the full nested instruction hierarchy from program logs. Shows parent-child relationships so you can pinpoint failures deep in CPI chains.',
                tags: ['CPI depth', 'invoke stack', 'inner instructions'],
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0a500" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                bg: 'rgba(240,165,0,0.1)',
                title: 'Compute & fee analysis',
                desc: 'Shows compute units consumed vs budget set. Recommends a tighter setComputeUnitLimit automatically — floor(consumed × 1.1) + 1000 — so you stop overpaying.',
                tags: ['CU budget', 'fee optimization', 'priority fees'],
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e05aff" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
                bg: 'rgba(224,90,255,0.1)',
                title: 'Account storage inspection',
                desc: 'Fetches account data in batches. Applies binary heuristics to reveal field structure beyond base64 blobs. Distinguishes programs, data holders, and PDAs.',
                tags: ['lamports', 'owner', 'executable', 'rent epoch', 'data size'],
                wide: true,
              },
            ].map((c, i) => (
              <div
                className={`cap-card${c.wide ? ' cap-card-wide' : ''}`}
                key={i}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="cap-icon-wrap" style={{ background: c.bg }}>{c.icon}</div>
                <div className="cap-title">{c.title}</div>
                <div className="cap-desc">{c.desc}</div>
                <div className="cap-tags">
                  {c.tags.map(t => <span className="cap-tag" key={t}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-divider"/>

        {/* ─── HOW IT WORKS ─── */}
        <div className="section-wrapper" id="how">
          <div className="section-pill">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            How it works
          </div>
          <h2 className="section-title">
            One deterministic flow.<br/>
            <span className="gradient-text">Request to root cause.</span>
          </h2>
          <p className="section-desc">
            Five stages, zero context-switching. Everything that happens between your dApp and the chain becomes observable.
          </p>

          <div className="how-steps">
            {[
              { n: '01', title: 'Intercept',  desc: 'In-page hooks capture every wallet and RPC call with a unique ID the moment your dApp triggers it.' },
              { n: '02', title: 'Bridge',     desc: 'Events flow from page context → content script → background worker and are persisted immediately.' },
              { n: '03', title: 'Build Trace',desc: 'BEFORE/AFTER/INFO events are grouped into one transaction story, aligned by call ID and timing.' },
              { n: '04', title: 'Decode',     desc: 'Instruction bytes are decoded. RPC enrichment pulls status, logs, fee, compute, and account data.' },
              { n: '05', title: 'Explain',    desc: 'The UI presents the full flow: request → chain → outcome. Root cause without jumping tabs.' },
            ].map((s, i) => (
              <div className="how-step" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <div style={{ position: 'relative' }}>
                  <div className="how-step-num">{s.n}</div>
                  {i < 4 && <div className="how-connector"/>}
                </div>
                <div className="how-step-title">{s.title}</div>
                <div className="how-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-divider"/>

        {/* ─── DOWNLOAD / CTA ─── */}
        <div id="download" className="cta-section">
          <div className="section-pill" style={{ margin: '0 auto 20px', display: 'inline-flex' }}>
            <DownloadIcon size={10}/> Free Chrome Extension
          </div>
          <h2 className="cta-title">
            Stop guessing.<br/>
            <span className="gradient-text">Start shipping faster.</span>
          </h2>
          <p className="cta-desc">
            Install ChronoTrace Solana in one click. No account, no backend, no data leaving your browser.
            Pure DevTools-native observability for every transaction you touch.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <a
              href="https://github.com/Sahiiil1406/disect-sol/tree/main/dist-extension"
              className="btn-download shimmer-btn"
            >
              <ChromeIcon color="#fff"/>
              Add to Chrome — Free
            </a>
            <a href="https://github.com/Sahiiil1406/disect-sol" className="btn-ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              View Source
            </a>
          </div>

          <div className="cta-meta">
            {['No account required', 'No data leaves your browser', 'MIT Licensed'].map(t => (
              <span className="cta-meta-item" key={t}>
                <span className="check-icon">✓</span> {t}
              </span>
            ))}
          </div>
        </div>

        {/* ─── FOOTER ─── */}
        <footer className="footer">
          <div className="footer-left">
            <SolanaIcon size={20}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Solana <span style={{ color: '#7ee8c0' }}>DevTools</span>
              </div>
              <div className="footer-desc">ChronoTrace — observability for Solana dApps</div>
            </div>
          </div>
          <div className="footer-links">
            <a href="https://github.com/Sahiiil1406/disect-sol" className="footer-link">GitHub</a>
            <a href="https://github.com/Sahiiil1406/disect-sol/blob/main/README.md" className="footer-link">Docs</a>
            <a href="https://github.com/Sahiiil1406/disect-sol/issues" className="footer-link">Issues</a>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ─── ICONS ─── */
function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

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