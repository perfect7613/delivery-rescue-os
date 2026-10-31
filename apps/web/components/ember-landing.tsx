"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const beats = [
  {
    alert: "A ₹1,499 cash-on-delivery parcel did not arrive. No one has called the customer.",
    reply: "I'm calling them now. If another day works, I'll book a second try.",
  },
  {
    alert: "This customer asked us not to call.",
    reply: "Then I won't call. A person can take the case, and the phone stays quiet.",
  },
  {
    alert: "They said Thursday works.",
    reply: "I requested a second attempt for Thursday. A person reviews it if anything is unclear.",
  },
]

const GITHUB = "https://github.com/perfect7613/delivery-rescue-os"

const STEP_MS = 5200

const steps = [
  {
    id: "Detect",
    copy: "A parcel did not arrive. The agent notices by itself. You do not press start.",
    title: "It saw the missed delivery",
    detail: "Order LIVE033368 is waiting. Closing this page does not pause it.",
  },
  {
    id: "Plan",
    copy: "GLM 5.3 decides from the facts already on the case. While it plans, it cannot see the phone number.",
    title: "It picks the next step",
    detail: "Call to find a new day, stay quiet, or hand the case to a person.",
  },
  {
    id: "Call",
    copy: "It places one real phone call with Bolna. When the call ends, it reads what was said and what the call cost.",
    title: "One real phone call",
    detail: "A short notice only says the call finished. The words and the cost come from Bolna after that.",
  },
]

export function EmberLanding() {
  const [open, setOpen] = useState(false)
  const [beat, setBeat] = useState(0)
  const [step, setStep] = useState(0)
  const [spin, setSpin] = useState(0)

  useEffect(() => {
    const beatTimer = setInterval(() => setBeat((value) => (value + 1) % beats.length), 4200)
    return () => clearInterval(beatTimer)
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
          <a className="ember-pill ghost" href={GITHUB} target="_blank" rel="noreferrer">
            GitHub
          </a>
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
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      ) : null}

      <section className="ember-hero">
        <h1 className="ember-serif">
          Rescue is an always-on agent
          <br />
          for failed deliveries.
        </h1>
        <p>
          When a cash-on-delivery parcel cannot be handed over, Rescue phones the customer with a Bolna voice agent, asks
          which day they will be home, and requests a second attempt once they clearly say yes.
        </p>
        <p>It starts on its own and keeps running after you close the tab. Customers who asked not to be called are never dialled.</p>
        <div className="ember-hero-actions">
          <Link className="ember-pill" href="/desk">
            Open the desk
          </Link>
          <a className="ember-pill ghost" href={GITHUB} target="_blank" rel="noreferrer">
            Read the code
          </a>
        </div>
        <div className="ember-stage" aria-hidden="true">
          <div className="ember-ridge" />
          <p className="ember-live">
            <span className="ember-dot" />
            still on
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

      <section className="ember-section">
        <p className="ember-kicker">The problem</p>
        <h2 className="ember-serif" style={{ maxWidth: "17ch" }}>A failed delivery usually turns into a return.</h2>
        <div className="ember-problem">
          <div className="ember-label-wrap" aria-hidden="true">
            <div className="ember-label">
              <div className="ember-label-top">
                <div>
                  <div className="ember-barcode" />
                  <p className="ember-mono" style={{ marginTop: 8 }}>AWB 7712 0448 3368</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="ember-mono">PAYMENT</p>
                  <b>COD</b>
                </div>
              </div>
              <div className="ember-label-row">
                <span className="ember-mono">COLLECT ON DELIVERY</span>
                <strong>₹1,499</strong>
              </div>
              <span className="ember-stamp">DELIVERY FAILED</span>
            </div>
          </div>
          <div>
            <ol className="ember-days">
              <li>
                <small>Day 1</small>
                <div>
                  <b>The courier marks it undelivered</b>
                  <span>Nobody was home, or the customer could not pay in cash at that moment.</span>
                </div>
              </li>
              <li>
                <small>The next days</small>
                <div>
                  <b>Nobody calls the customer in time</b>
                  <span>The order waits in a failed-delivery queue while the reattempt window closes.</span>
                </div>
              </li>
              <li className="is-loss">
                <small>About a week later</small>
                <div>
                  <b>The parcel goes back to the seller</b>
                  <span>The seller pays shipping both ways and the sale is lost.</span>
                </div>
              </li>
            </ol>
            <p className="ember-fix">Many of these customers still want the parcel. A phone call on the first day gives them a chance to pick a day that works, before the return starts.</p>
          </div>
        </div>
      </section>

      <section className="ember-section">
        <p className="ember-kicker">What happens next</p>
        <h2 className="ember-serif">It notices, decides, then calls.</h2>
      </section>

      <section className="ember-section" style={{ paddingTop: 0 }}>
        <div className="ember-canvas">
          <div>
            <p className="ember-canvas-name">
              <span className="ember-orb" aria-hidden="true" />
              A missed delivery
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
                    <span>LIVE033368</span>
                    <span>Not delivered</span>
                    <span>₹1,499 cash on delivery</span>
                  </div>
                ) : null}
                {step === 1 ? (
                  <ul className="ember-rules">
                    <li>Use only the facts already on the case</li>
                    <li>Plan without seeing the phone number</li>
                    <li>Ask a person if the answer is unclear</li>
                  </ul>
                ) : null}
                {step === 2 ? (
                  <div className="ember-dial">
                    <span />
                    <span />
                    <span />
                    <span />
                    <p>Calling, then waiting to hear how it went</p>
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
                <small>Cash on delivery · Rescue called after a failed attempt</small>
              </div>
            </div>
            <div className="ember-line">
              <b>PRIYA</b>
              <p>Hello?</p>
            </div>
            <div className="ember-line">
              <b>RESCUE</b>
              <p>Hi, I&apos;m Asha, an AI assistant from Rescue, calling about a delivery that couldn&apos;t be completed. Would you still like to receive the parcel?</p>
            </div>
            <div className="ember-line">
              <b>PRIYA</b>
              <p>Yes. Thursday works, I&apos;ll be home after four.</p>
            </div>
            <div className="ember-line">
              <b>RESCUE</b>
              <p>So you can receive it on Thursday, is that right?</p>
            </div>
            <div className="ember-line">
              <b>PRIYA</b>
              <p>Yes.</p>
            </div>
          </div>
          <aside className="ember-side">
            <div>
              <small>MEMORY</small>
              <strong>Cash on delivery, ₹1,499</strong>
              <p>This customer is fine with a phone call</p>
            </div>
            <div>
              <small>WHAT THEY SAID</small>
              <strong>Thursday, after four</strong>
              <p>Confirmed after the read-back. The time is a preference, not a promise.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="ember-section">
        <p className="ember-kicker">You do not start it</p>
        <h2 className="ember-serif">The missed delivery is enough.</h2>
        <div className="ember-stats" style={{ marginTop: 36 }}>
          <div className="ember-stat">
            <small>Buttons you press</small>
            <b>0</b>
            <span>The failed delivery starts the agent.</span>
          </div>
          <div className="ember-stat">
            <small>Agents running</small>
            <b>1</b>
            <span>One agent, many parcels, still on if you close the page.</span>
          </div>
          <div className="ember-stat">
            <small>Calls to opted-out customers</small>
            <b>0</b>
            <span>Consent is checked before every dial.</span>
          </div>
          <div className="ember-stat">
            <small>Phone calls first</small>
            <b>1</b>
            <span>The customer confirms a day before any reattempt is requested.</span>
          </div>
        </div>
      </section>

      <section className="ember-section" style={{ paddingTop: 0 }}>
        <div className="ember-quote">
          <q>Close the page if you want. The agent keeps the parcel until it is delivered, or until a person has to take over.</q>
          <p>Every call keeps its transcript, recording, summary and cost on the case.</p>
        </div>
      </section>

      <section className="ember-section ember-cta">
        <div className="ember-cta-card">
          <p className="ember-kicker">See a live case</p>
          <h2 className="ember-serif">Open the desk.</h2>
          <Link className="ember-pill" href="/desk" style={{ marginTop: 22 }}>
            Open the desk
          </Link>
          <div className="ember-hero-actions" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <a className="ember-pill ghost" href={GITHUB} target="_blank" rel="noreferrer">
              Read the code on GitHub
            </a>
          </div>
          <div className="ember-badges">
            <span>REAL PHONE CALLS VIA BOLNA</span>
            <span>GLM 5.3 PLANNING</span>
            <span>STAYS ON IF YOU LEAVE</span>
          </div>
        </div>
      </section>

      <footer className="ember-foot">
        <div>
          <p className="ember-mark">
            <Cairn /> Rescue
          </p>
          <p>An always-on agent for cash-on-delivery parcels that did not arrive. It calls the customer, confirms a new day, and keeps a record of every step.</p>
        </div>
        <div>
          <h3>Product</h3>
          <Link href="/desk">Desk</Link>
          <Link href="/queue">Queue</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/agent">Agent</Link>
        </div>
        <div>
          <h3>Review</h3>
          <Link href="/approvals">Approvals</Link>
          <Link href="/analytics">Outcomes</Link>
          <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div>
          <h3>Status</h3>
          <p>The agent stays on after you close this page.</p>
        </div>
      </footer>
      <div className="ember-legal">
        <span>© 2026 Delivery Rescue</span>
        <span>For the parcel that did not arrive.</span>
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
