import {
  ArrowUpRight,
  ArrowLeft,
  Fingerprint,
  ScanLine,
  FileText,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import "./product.css";

/** Presentation only: account pages retain their existing handlers and state. */
export default function AccountLayout({
  title,
  description,
  mode = "signin",
  children,
}) {
  const creating = mode === "signup";
  return (
    <div className="st-product st-account-page">
      <header className="st-account-header">
        <a href="/" aria-label="ShadowTrace home">
          <BrandLogo className="st-logo" />
        </a>
        <a
          className="st-account-header-link"
          href={creating ? "/account/signin" : "/account/signup"}
        >
          {creating
            ? "Already a member? Sign in"
            : "New here? Create an account"}
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </header>
      <main className="st-account-grid">
        <section className="st-account-intro" aria-label="About your workspace">
          <p className="st-eyebrow">
            <span aria-hidden="true">+</span> OPEN-SOURCE INTELLIGENCE, IN FOCUS
          </p>
          <h2>
            Every lead.
            <br />
            <span>A clearer picture.</span>
          </h2>
          <p className="st-account-description">
            Your workspace for public-source research. Follow the evidence,
            connect the context, and keep your reasoning in view.
          </p>
          <div
            className="st-account-diagram"
            aria-label="Research workflow illustration"
          >
            <div className="st-account-diagram-label">
              THE INVESTIGATION WORKSPACE <span>01 / 03</span>
            </div>
            <div className="st-account-flow">
              <div>
                <Fingerprint size={25} aria-hidden="true" />
                <span>COLLECT</span>
                <small>Start with a lead</small>
              </div>
              <i aria-hidden="true" />
              <div>
                <ScanLine size={25} aria-hidden="true" />
                <span>REVIEW</span>
                <small>Examine the sources</small>
              </div>
              <i aria-hidden="true" />
              <div>
                <FileText size={25} aria-hidden="true" />
                <span>REPORT</span>
                <small>Keep the evidence</small>
              </div>
            </div>
            <p>Source-led research. Human judgment.</p>
          </div>
          <a className="st-text-link" href="/">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to the platform
          </a>
        </section>
        <section className="st-account-card" aria-labelledby="st-account-title">
          <div className="st-account-card-heading">
            <p className="st-eyebrow">YOUR SHADOWTRACE WORKSPACE</p>
            <h1 id="st-account-title">{title}</h1>
            <p>{description}</p>
          </div>
          {children}
        </section>
      </main>
      <footer className="st-account-footer">
        <span>Open sources. Clearer perspective.</span>
        <span>For authorized, lawful research.</span>
      </footer>
    </div>
  );
}
