"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const beats = [
  {
    alert: "₹1,499 COD came back NDR. Nobody has asked the customer yet.",
    reply: "I'm calling them now. If they confirm a day, I'll book the reattempt.",
  },
  {
    alert: "The customer opted out. This shipment never gets a call.",
    reply: "Left unresolved. The phone stays down.",
  },
  {
    alert: "They confirmed Thursday. The reattempt is still only simulated.",
    reply: "Policy passed. The demo carrier accepted it. Nothing real was mutated.",
  },
]

const marks = ["BOLNA", "SARVAM", "SHIPROCKET", "DEMO CARRIER", "BOLNA", "SARVAM", "SHIPROCKET", "DEMO CARRIER"]

const STEP_MS = 5200

const steps = [
  {
    id: "Detect",
    copy: "A carrier event lands in the journal. The worker wakes without a Run click.",
    title: "Carrier event",
    detail: "DEMO1499 is waiting. Nobody has to press Run.",
  },
  {
    id: "Plan",
    copy: "Sarvam may only cite evidence already on the case. The phone number is not in the prompt.",
    title: "What it may decide",
    detail: "Confirm a day, stay silent, or hand the case to a person.",
  },
  {
    id: "Call",
    copy: "Bolna places one call. Cost and transcript come back after the execution completes.",
    title: "One Bolna call",
    detail: "The webhook only says the call finished. The recording comes from the execution.",
  },
]

export function EmberLanding() {
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState(486)
  const [beat, setBeat] = useState(0)
  const [step, setStep] = useState(0)
  const [spin, setSpin] = useState(0)

  useEffect(() => {
    const liveTimer = setInterval(() => setLive((value) => value + (Math.random() > 0.5 ? 1 : -1)), 1600)
    const beatTimer = setInterval(() => setBeat((value) => (value + 1) % beats.length), 4200)
    return () => {
      clearInterval(liveTimer)
      clearInterval(beatTimer)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setTimeout(() => setStep((value) => (value + 1) % steps.length), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [step, spin])

  const chooseStep = (index: number) => {
    setStep(index)
    setSpin((value) => value + 1)
  }

  const scene = beats[beat] ?? beats[0]
  const active = steps[step] ?? steps[0]

  return (
    <div className="ember">
      <header className="ember-nav">
        <Link href="/" className="ember-mark" aria-label="Delivery Rescue home">
          <Cairn />
          Rescue
        </Link>
        <div className="ember-actions">
          <Link className="ember-pill" href="/desk">
            Open the desk
          </Link>
          <button className="ember-icon" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            <MenuIcon />
          </button>
        </div>
      </header>

      {open ? (
        <nav className="ember-menu">
          <button className="ember-icon" type="button" aria-label="Close menu" onClick={() => setOpen(false)}>
            ×
          </button>
          <Link href="/desk" onClick={() => setOpen(false)}>Desk</Link>
          <Link href="/queue" onClick={() => setOpen(false)}>Queue</Link>
          <Link href="/integrations" onClick={() => setOpen(false)}>Integrations</Link>
          <Link href="/agent" onClick={() => setOpen(false)}>Agent</Link>
        </nav>
      ) : null}

      <section className="ember-hero">
        <p className="ember-chip">
          <span className="ember-dot" />
          NEW: FAILURES WAKE THE OPERATOR
        </p>
        <h1 className="ember-serif">
          Every failed delivery,
          <br />
          recovered.
        </h1>
        <p>
          An always-on operator for non-delivery reports: it plans, calls the customer, and only then books the
          reattempt. Closing this page does not stop it.
        </p>
        <Link className="ember-pill" href="/desk">
          Open the desk
        </Link>
        <div className="ember-stage" aria-hidden="true">
          <div className="ember-ridge" />
          <p className="ember-live">
            <span className="ember-dot" />
            <b>{live}</b>
            calls live
          </p>
          <p className="ember-bubble dark">
            <span />
            {scene?.alert}
          </p>
          <p className="ember-bubble light">
            <span />
            {scene?.reply}
          </p>
        </div>
      </section>

      <section className="ember-logos">
        <p>One merchant on the desk. The worker does not sleep.</p>
        <div className="ember-marquee">
          {marks.map((mark, index) => (
            <span key={`${mark}-${index}`}>{mark}</span>
          ))}
        </div>
      </section>

      <section className="ember-section">
        <p className="ember-kicker">The operator</p>
        <h2 className="ember-serif">Built for the delivery that did not land.</h2>
      </section>

      <section className="ember-section" style={{ paddingTop: 0 }}>
        <div className="ember-canvas">
          <div>
            <p className="ember-canvas-name">
              <span className="ember-orb" aria-hidden="true" />
              Open a case
            </p>
            <ol className="ember-steps">
              {steps.map((item, index) => {
                const on = index === step
                return (
                  <li key={item.id} className={on ? "is-on" : undefined}>
                    <span className="ember-step-bar" aria-hidden="true">
                      {on ? <i key={`${item.id}-${spin}`} /> : null}
                    </span>
                    <button type="button" aria-expanded={on} onClick={() => chooseStep(index)}>
                      <span className="ember-step-num">{String(index + 1).padStart(2, "0")}</span>
                      {item.id}
                    </button>
                    <div className="ember-step-body">
                      <div>
                        <p>{item.copy}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
          <div className="ember-vista">
            <div className="ember-vista-drift" />
            <div className="ember-app" style={{ ["--ember-i" as string]: step }}>
              <div className="ember-app-head">
                <span className="ember-orb is-sm" aria-hidden="true" />
                <b key={active?.id} className="ember-app-title">{active?.id}</b>
                <span className="ember-app-step">{step + 1}/3</span>
              </div>
              <div className="ember-seg" role="tablist" aria-label="Recovery stages">
                {steps.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === step}
                    onClick={() => chooseStep(index)}
                  >
                    {item.id}
                  </button>
                ))}
              </div>
              <div key={`${active?.id}-${spin}`} className="ember-panel">
                <b>{active?.title}</b>
                <span>{active?.detail}</span>
                {step === 0 ? (
                  <div className="ember-chip-row">
                    <span>DEMO1499</span>
                    <span>NDR</span>
                    <span>₹1,499 COD</span>
                  </div>
                ) : null}
                {step === 1 ? (
                  <ul className="ember-rules">
                    <li>Cite the NDR evidence</li>
                    <li>Leave the phone out of the prompt</li>
                    <li>Hand off if the answer is unclear</li>
                  </ul>
                ) : null}
                {step === 2 ? (
                  <div className="ember-dial">
                    <span />
                    <span />
                    <span />
                    <span />
                    <p>Calling · waiting for the execution</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ember-section" id="call" style={{ paddingTop: 0 }}>
        <div className="ember-call">
          <div className="ember-thread">
            <div className="ember-person">
              <div className="ember-avatar">PS</div>
              <div>
                <b>Priya Shah</b>
                <small>COD line · inbound · with Rescue</small>
              </div>
            </div>
            <div className="ember-line">
              <b>PRIYA</b>
              <p>Hello? The parcel was supposed to come yesterday and nobody knocked.</p>
            </div>
            <div className="ember-line">
              <b>RESCUE</b>
              <p>I can see the failed attempt on DEMO1499. Thursday is open. Should we try again then?</p>
            </div>
            <div className="ember-line">
              <b>PRIYA</b>
              <p>Thursday is fine. I&apos;ll be home after four.</p>
            </div>
            <div className="ember-line">
              <b>RESCUE</b>
              <p>Booked. This reattempt stays on the demo carrier. It does not touch a real shipment.</p>
            </div>
          </div>
          <aside className="ember-side">
            <div>
              <small>MEMORY</small>
              <strong>COD ₹1,499</strong>
              <p>Contact policy: ok to call</p>
            </div>
            <div>
              <small>SENTIMENT</small>
              <strong>Confirmed</strong>
              <p>Reattempt window: today through three days</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="ember-section">
        <p className="ember-kicker">No extra click</p>
        <h2 className="ember-serif">The queue, already moving.</h2>
        <div className="ember-stats" style={{ marginTop: 36 }}>
          <div className="ember-stat">
            <small>To start a case</small>
            <b>0</b>
            <span>Run buttons. The event is enough.</span>
          </div>
          <div className="ember-stat">
            <small>Workers on the lease</small>
            <b>1</b>
            <span>Many cases, one resident process.</span>
          </div>
          <div className="ember-stat">
            <small>Real carrier writes</small>
            <b>0</b>
            <span>Shiprocket stays read-only.</span>
          </div>
          <div className="ember-stat">
            <small>Call before action</small>
            <b>1</b>
            <span>Bolna finishes, then the reattempt.</span>
          </div>
        </div>
      </section>

      <section className="ember-section" style={{ paddingTop: 0 }}>
        <div className="ember-quote">
          <q>The desk can close. The case stays with the worker until the delivery is verified or a person has to take it.</q>
          <p>Demo Merchant · the journal</p>
        </div>
      </section>

      <section className="ember-section ember-cta">
        <div className="ember-cta-card">
          <p className="ember-kicker">Rather watch it run?</p>
          <h2 className="ember-serif">Open the desk.</h2>
          <Link className="ember-pill" href="/desk" style={{ marginTop: 22 }}>
            Open the desk
          </Link>
          <div className="ember-badges">
            <span>REAL BOLNA CALL</span>
            <span>SIMULATED CARRIER</span>
            <span>NO SHOPIFY</span>
          </div>
        </div>
      </section>

      <footer className="ember-foot">
        <div>
          <p className="ember-mark">
            <Cairn /> Rescue
          </p>
          <p>Always-on recovery for failed deliveries. Every call is a real Bolna execution. Every reattempt in the demo is labeled synthetic.</p>
        </div>
        <div>
          <h3>Product</h3>
          <Link href="/desk">Desk</Link>
          <Link href="/queue">Queue</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/agent">Agent</Link>
        </div>
        <div>
          <h3>Ledger</h3>
          <Link href="/approvals">Approvals</Link>
          <Link href="/analytics">ROI</Link>
        </div>
        <div>
          <h3>Status</h3>
          <p>Worker stays up when this page closes.</p>
        </div>
      </footer>
      <div className="ember-legal">
        <span>© 2026 Delivery Rescue</span>
        <span>Made for the parcel that did not arrive.</span>
      </div>
    </div>
  )
}

function Cairn() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <ellipse cx="11" cy="17.5" rx="6.2" ry="2.4" fill="#111" />
      <ellipse cx="11" cy="12.2" rx="4.6" ry="2.1" fill="#111" />
      <ellipse cx="11" cy="7.6" rx="3" ry="1.8" fill="#111" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
