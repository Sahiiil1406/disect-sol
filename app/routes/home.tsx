import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DevTools Solana" },
    {
      name: "description",
      content:
        "Inspect Solana transactions with live capture, instruction decoding, and structured error insights.",
    },
  ];
}

export default function Home() {
  return (
    <main className="landing-page">
      <section className="hero-section">
        <div className="hero-shell">
          <p className="hero-badge">DevTools Solana</p>
          <h1>Understand every Solana transaction before it lands on-chain</h1>
          <p className="hero-copy">See the flow. Fix issues faster.</p>
          <div className="hero-cta">
            <a href="#how-it-works" className="cta-primary">
              Watch how it works
            </a>
            <a href="#features" className="cta-secondary">
              View all features
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-section">
        <div className="how-shell">
          <p className="flow-label">How It Works</p>
          <div className="flow-visual" aria-hidden="true">
            <div className="flow-line" />
            <div className="flow-pulse" />
            <div className="flow-step">
              <span>1</span>
              <p>Capture</p>
            </div>
            <div className="flow-step">
              <span>2</span>
              <p>Decode</p>
            </div>
            <div className="flow-step">
              <span>3</span>
              <p>Inspect</p>
            </div>
            <div className="flow-step">
              <span>4</span>
              <p>Resolve</p>
            </div>
          </div>
          <div className="insight-strip">
            <div>
              <strong>Live transaction events</strong>
              <p>Hook wallet/provider requests in real-time.</p>
            </div>
            <div>
              <strong>Human-readable output</strong>
              <p>Readable logs, failures, and account mapping.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="section-head">
          <p>All Features</p>
          <h2>Everything available in one extension panel</h2>
        </div>
        <div className="section-shell">
          <article className="feature-card">
            <h3>Transaction Capture</h3>
            <p>
              Detect wallet/provider transaction requests and inspect raw
              payload instantly.
            </p>
          </article>
          <article className="feature-card">
            <h3>Instruction Decoder</h3>
            <p>
              Decode program name, method name, and parameters with readable
              output.
            </p>
          </article>
          <article className="feature-card">
            <h3>Account Interaction Viewer</h3>
            <p>
              List signer, writable, and program accounts touched per
              instruction.
            </p>
          </article>
          <article className="feature-card">
            <h3>Compute + Fee Breakdown</h3>
            <p>
              Surface compute units consumed and fee paid to quickly spot cost
              spikes.
            </p>
          </article>
          <article className="feature-card">
            <h3>Structured Logs Explorer</h3>
            <p>
              Filter and search logs cleanly without digging through noisy
              terminal output.
            </p>
          </article>
          <article className="feature-card">
            <h3>Error Reason Decoder</h3>
            <p>
              Parse failures and convert cryptic errors into human-readable
              diagnostics.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
