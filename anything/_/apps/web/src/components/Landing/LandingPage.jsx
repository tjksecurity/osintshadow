"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, Check, Menu, X, Search, Network, FileText, Shield, Fingerprint, Globe } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { installScrollExperience } from './scrollExperience';
import './shadowtrace.css';

const plans = [
  { name: 'Starter', price: 49, description: 'Perfect for individual investigators', features: ['10 investigations per month', 'Basic OSINT collection', 'AI risk analysis', 'PDF reports'] },
  { name: 'Pro', price: 99, description: 'For professional investigators', features: ['50 investigations per month', 'Advanced OSINT collection', 'Enhanced AI analysis', 'PDF & HTML reports', 'Map visualization'] },
  { name: 'Agency', price: 249, description: 'For teams and agencies', features: ['200 investigations per month', 'Premium OSINT sources', 'Advanced AI correlation', 'Custom report branding', 'API access'] },
];

const questions = [
  ['What can I investigate?', 'Start with a known identifier such as an email, username, domain or phone number. Select the sources relevant to your authorized research. Availability depends on the source, configuration and your plan.'],
  ['Does a matching profile confirm someone’s identity?', 'No. A shared name, username or other identifier can point to different people. Treat matches as candidates, review the original sources and corroborate before drawing conclusions.'],
  ['Are every source and API included?', 'Source coverage varies. Optional providers can require separate credentials, permissions or credits. Your ShadowTrace investigation allowance does not make third-party provider requests unlimited.'],
  ['Can I review and export the findings?', 'Investigations keep collected results and report views together. Review source context, gaps and uncertainty before using or sharing a report. The plan options below retain their existing report features.'],
];

function EvidenceGraphic() {
  return (
    <figure className="st-evidence" aria-label="Illustrative diagram of public sources connected to an investigation">
      <div className="st-graphic-top"><span>THE EVIDENCE LAYER</span><span>01 / 03</span></div>
      <svg viewBox="0 0 640 500" className="st-network" aria-hidden="true">
        <defs>
          <pattern id="st-grid" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#a4c1d1" opacity=".16" /></pattern>
          <radialGradient id="st-halo"><stop offset="0" stopColor="#86dfff" stopOpacity=".16" /><stop offset="1" stopColor="#86dfff" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="640" height="500" fill="url(#st-grid)" />
        <circle cx="320" cy="245" r="225" fill="url(#st-halo)" />
        <g fill="none" stroke="#20313c"><circle cx="320" cy="245" r="170" /><circle cx="320" cy="245" r="118" /><path d="M0 245H640M320 0V500" /></g>
        <g className="st-signal-lines" fill="none" stroke="#78d7fa" strokeWidth="1.3">
          <path d="M110 125H205L286 216" /><path d="M495 106H440L354 216" /><path d="M118 370H210L286 275" /><path d="M524 355H440L354 275" />
        </g>
        <g fill="#86dfff"><circle cx="110" cy="125" r="4" /><circle cx="495" cy="106" r="4" /><circle cx="118" cy="370" r="4" /><circle cx="524" cy="355" r="4" /></g>
        <g className="st-core"><path d="M320 185L372 215V275L320 305L268 275V215Z" fill="#101e26" stroke="#86dfff" strokeWidth="1.5" /><path d="M320 207L353 226V264L320 283L287 264V226Z" fill="none" stroke="#86dfff" opacity=".4" /><circle cx="320" cy="245" r="11" fill="#86dfff" /></g>
      </svg>
      <div className="st-source-tag st-source-one"><Fingerprint size={16} aria-hidden="true" /><span>Public profile<small>Account reference</small></span></div>
      <div className="st-source-tag st-source-two"><Globe size={16} aria-hidden="true" /><span>Open web<small>Original source</small></span></div>
      <div className="st-source-tag st-source-three"><FileText size={16} aria-hidden="true" /><span>Research record<small>Professional context</small></span></div>
      <div className="st-source-tag st-source-four"><Network size={16} aria-hidden="true" /><span>Corroboration<small>Review required</small></span></div>
      <figcaption><span className="st-caption-dot" />Illustrative workflow · not live investigation data</figcaption>
    </figure>
  );
}

export default function LandingPage() {
  const root = useRef(null);
  const menuButton = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => installScrollExperience(root.current), []);
  useEffect(() => {
    const close = event => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); }
    };
    if (menuOpen) window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div ref={root} className="st-site">
      <a href="#main-content" className="st-skip">Skip to content</a>
      <div data-scroll-progress className="st-scroll-progress" aria-hidden="true" />
      <header className="st-header">
        <div className="st-container st-nav-row">
          <a href="/" className="st-brand" aria-label="ShadowTrace home"><BrandLogo className="st-logo" /></a>
          <nav aria-label="Main navigation" className="st-desktop-nav">
            <a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#pricing">Pricing</a>
          </nav>
          <div className="st-nav-actions"><a href="/account/signin" className="st-signin">Sign in</a><a href="/account/signup" className="st-button st-button-small">Get started <ArrowUpRight size={15} aria-hidden="true" /></a></div>
          <button ref={menuButton} type="button" className="st-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="st-mobile-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
        <nav id="st-mobile-navigation" aria-label="Mobile navigation" className="st-mobile-nav" hidden={!menuOpen}>
          <a href="#platform" onClick={closeMenu}>Platform</a><a href="#workflow" onClick={closeMenu}>How it works</a><a href="#pricing" onClick={closeMenu}>Pricing</a><a href="/account/signin">Sign in</a><a href="/account/signup">Get started <ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>
      </header>

      <main id="main-content">
        <section className="st-container st-hero" aria-labelledby="st-hero-title">
          <div className="st-hero-copy" data-reveal>
            <div className="st-eyebrow"><span className="st-crosshair">+</span> OPEN-SOURCE INTELLIGENCE, IN FOCUS</div>
            <h1 id="st-hero-title">Find the signal.<br /><span>Follow the evidence.</span></h1>
            <p className="st-hero-description">A focused workspace for public-source research. Connect the fragments, examine the sources, and turn your investigation into a clearer picture.</p>
            <div className="st-hero-actions"><a href="/account/signup" className="st-button">Start your investigation <ArrowUpRight size={18} aria-hidden="true" /></a><a href="#workflow" className="st-text-link">Explore the workflow <ArrowRight size={16} aria-hidden="true" /></a></div>
            <p className="st-hero-footnote"><Shield size={15} aria-hidden="true" />Source-led research. Human judgment.</p>
          </div>
          <div className="st-hero-visual" data-reveal><EvidenceGraphic /></div>
          <a className="st-scroll-cue" href="#platform">SCROLL TO EXPLORE <ChevronDown size={16} aria-hidden="true" /></a>
        </section>

        <div className="st-principles-strip"><div className="st-container"><span>Built around the investigation</span><p>COLLECT <i>/</i> CONNECT <i>/</i> REVIEW <i>/</i> REPORT</p></div></div>

        <section id="platform" className="st-container st-section" aria-labelledby="st-platform-title">
          <div className="st-section-heading" data-reveal><div><p className="st-eyebrow">01 / THE PLATFORM</p><h2 id="st-platform-title">Less scattered data.<br /><span>More perspective.</span></h2></div><p>Your work deserves more than a wall of search results. Keep the research, its context and the next question in one place.</p></div>
          <div className="st-feature-grid">
            <article className="st-feature st-feature-wide" data-reveal>
              <div className="st-feature-top"><Search size={24} aria-hidden="true" /><span>COLLECTION</span></div>
              <h3>Start with a lead.<br />Build the context.</h3>
              <p>Bring together available public-source findings around the identifiers you already know. See where information came from and where the trail needs more work.</p>
              <div className="st-identifier-list" aria-label="Investigation inputs"><span>@ Username</span><span>↗ Domain</span><span>+ Phone</span><span>✉ Email</span></div>
            </article>
            <article className="st-feature" data-reveal>
              <div className="st-feature-top"><Network size={24} aria-hidden="true" /><span>CONTEXT</span></div>
              <div className="st-mini-network" aria-hidden="true"><span /><i /><span /><i /><span /></div>
              <h3>Connections worth<br />a closer look.</h3><p>Compare candidate findings without confusing a matching name with a confirmed identity.</p>
            </article>
            <article className="st-feature" data-reveal>
              <div className="st-feature-top"><FileText size={24} aria-hidden="true" /><span>REPORTING</span></div>
              <h3>Keep the evidence.<br />Show your reasoning.</h3><p>Move from collected results to an organized report. Keep source context and uncertainty part of the story.</p>
              <div className="st-report-lines" aria-hidden="true"><i /><i /><i /><i /></div>
            </article>
          </div>
        </section>

        <section id="workflow" className="st-workflow-section" aria-labelledby="st-workflow-title">
          <div className="st-container st-workflow-layout">
            <div className="st-workflow-intro" data-reveal><p className="st-eyebrow">02 / FROM LEAD TO CLARITY</p><h2 id="st-workflow-title">A deliberate<br /><span>line of inquiry.</span></h2><p>Stay in control of what you search, what you trust and what you conclude.</p><a href="/account/signup" className="st-text-link">Open your workspace <ArrowUpRight size={17} aria-hidden="true" /></a><div className="st-workflow-symbol" aria-hidden="true"><Fingerprint size={108} strokeWidth={.6} /></div></div>
            <div className="st-workflow-steps">
              {[
                ['01', 'Define the question.', 'Choose an identifier and the research options relevant to your investigation. Begin with a lawful purpose and a clear scope.', 'INPUT / SCOPE / SOURCES'],
                ['02', 'Examine the evidence.', 'Review available findings, compare source context and separate useful signals from ambiguous matches.', 'SOURCE / CONTEXT / CORROBORATION'],
                ['03', 'Make the work legible.', 'Bring the investigation into a report. Preserve the trail, state the limitations and make the next step clear.', 'REVIEW / DOCUMENT / REPORT'],
              ].map(([number, title, body, label]) => <article className="st-workflow-step" data-reveal key={number}><span className="st-step-number">{number}</span><div><h3>{title}</h3><p>{body}</p><span className="st-step-label">{label}</span></div></article>)}
            </div>
          </div>
        </section>

        <section id="pricing" className="st-container st-section" aria-labelledby="st-pricing-title">
          <div className="st-section-heading" data-reveal><div><p className="st-eyebrow">03 / CHOOSE YOUR WORKSPACE</p><h2 id="st-pricing-title">The right scope.<br /><span>For your work.</span></h2></div><p>From your first lead to your team's next case. Choose the investigation allowance and reporting tools that fit your work.</p></div>
          <div className="st-pricing-grid">
            {plans.map(plan => <article className={`st-plan ${plan.name === 'Pro' ? 'st-plan-featured' : ''}`} key={plan.name} data-reveal>
              <div className="st-plan-top"><h3>{plan.name}</h3>{plan.name === 'Pro' && <span>PROFESSIONAL</span>}</div><p>{plan.description}</p><div className="st-price"><strong>${plan.price}</strong><span>/month</span></div>
              <a href="/account/signup" className={`st-button ${plan.name === 'Pro' ? '' : 'st-button-outline'}`}>Choose {plan.name} <ArrowUpRight size={17} aria-hidden="true" /></a>
              <ul>{plan.features.map(feature => <li key={feature}><Check size={15} aria-hidden="true" />{feature}</li>)}</ul>
            </article>)}
          </div>
          <p className="st-pricing-note">Source availability and third-party API limits apply. Optional providers may require their own credentials or credits.</p>
        </section>

        <section id="faq" className="st-container st-faq-section" aria-labelledby="st-faq-title">
          <div data-reveal><p className="st-eyebrow">THE DETAILS</p><h2 id="st-faq-title">Good questions.<br /><span>Clear answers.</span></h2></div>
          <div className="st-faq-list">{questions.map(([question, answer]) => <details key={question} data-reveal><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="st-container st-final-cta" aria-labelledby="st-cta-title" data-reveal>
          <p className="st-eyebrow">YOUR NEXT QUESTION STARTS HERE</p><h2 id="st-cta-title">Bring the picture<br /><span>into focus.</span></h2><a href="/account/signup" className="st-button">Get started with ShadowTrace <ArrowUpRight size={18} aria-hidden="true" /></a><span className="st-cta-mark" aria-hidden="true">+</span>
        </section>
      </main>
      <footer className="st-footer st-container"><div><a href="/" aria-label="ShadowTrace home"><BrandLogo className="st-logo" /></a><p>Open sources. Clearer perspective.</p></div><nav aria-label="Footer navigation"><a href="#platform">Platform</a><a href="#pricing">Pricing</a><a href="/ai/chat">AI Chat</a><a href="/account/signin">Sign in</a></nav><p className="st-footer-note">For authorized, lawful research.<br />A finding is not a verified identity.</p></footer>
    </div>
  );
}
