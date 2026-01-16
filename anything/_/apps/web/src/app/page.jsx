"use client";

import { useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Shield,
  Search,
  Target,
  Brain,
  FileText,
  Map,
  ArrowRight,
  Check,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function HomePage() {
  const { data: user, loading } = useUser();

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/dashboard";
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#263043] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to dashboard
  }

  const faqItems = [
    {
      question: "How can I find a person for free?",
      answer: (
        <div className="space-y-4 text-slate-300">
          <p>
            You can try piecing together scraps of public data using search
            engines and scattered tools—but that approach is slow, incomplete,
            and unreliable.
          </p>
          <div className="text-white font-medium">
            ShadowTrace does this properly.
          </div>
          <p>
            Instead of hopping between dozens of sites, ShadowTrace aggregates
            publicly available data sources into one unified search, giving you
            instant visibility into:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Known names and aliases</li>
            <li>Location history</li>
            <li>Phone numbers and emails</li>
            <li>Online presence across platforms</li>
          </ul>
          <p>
            You’re still using open-source intelligence, but without the
            friction, guesswork, or dead ends. Start with ShadowTrace and only
            dig deeper if you need to—most people don’t.
          </p>
        </div>
      ),
    },
    {
      question: "How do I do a true people search?",
      answer: (
        <div className="space-y-4 text-slate-300">
          <p>
            A true people search isn’t about typing a name into Google and
            hoping for the best. It’s about correlation.
          </p>
          <p className="text-slate-300">
            ShadowTrace performs real people searches by:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Cross-referencing identity data across multiple public datasets
            </li>
            <li>
              Linking names, usernames, emails, and phone numbers automatically
            </li>
            <li>Flagging inconsistencies, gaps, and hidden connections</li>
            <li>Showing why data is connected—not just listing it</li>
          </ul>
          <p>
            This is the difference between a basic lookup and actual OSINT
            methodology. ShadowTrace is built to do the correlation work for
            you, so you don’t miss critical links.
          </p>
        </div>
      ),
    },
    {
      question:
        "How can I search for someone’s professional background online?",
      answer: (
        <div className="space-y-4 text-slate-300">
          <p>
            Professional history is often fragmented across platforms—LinkedIn,
            company sites, licensing boards, old bios, press mentions.
          </p>
          <p className="text-slate-300">
            ShadowTrace consolidates this intelligence by:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Mapping employment history across public records and platforms
            </li>
            <li>
              Identifying current and past roles tied to the same individual
            </li>
            <li>
              Surfacing business affiliations, domains, and professional
              footprints
            </li>
            <li>Revealing career patterns that don’t appear on a résumé</li>
          </ul>
          <p>
            Instead of manually checking ten different sites, ShadowTrace gives
            you a single, structured professional profile built from real
            data—not self-reported summaries.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#263043] text-white">
      {/* Header */}
      <header className="border-b border-[#37425B]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-7 w-auto" variant="onDark" />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/ai/chat"
              className="hidden sm:inline px-3 py-2 text-slate-300 hover:text-white transition-colors text-sm"
              title="Open AI Chat"
            >
              AI Chat
            </a>
            <a
              href="/account/signin"
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </a>
            <a
              href="/account/signup"
              className="px-4 py-2 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-medium"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Advanced OSINT Intelligence
            <br />
            <span className="text-[#00D1FF]">Powered by AI</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Uncover digital footprints, analyze threats, and generate
            comprehensive intelligence reports with our cutting-edge OSINT
            platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/account/signup"
              className="px-8 py-4 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-semibold text-lg"
            >
              Start Free Trial
            </a>
            <a
              href="#features"
              className="px-8 py-4 border border-[#37425B] rounded-lg hover:bg-[#37425B] transition-colors font-semibold text-lg"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-[#232D41]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Comprehensive OSINT Capabilities
            </h2>
            <p className="text-slate-300 text-lg">
              Everything you need for professional intelligence gathering and
              analysis
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-[#2D384E] rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-[#00D1FF]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="text-[#00D1FF]" size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Multi-Source Collection
              </h3>
              <p className="text-slate-400">
                Gather intelligence from emails, domains, usernames, phone
                numbers, and IP addresses
              </p>
            </div>

            <div className="bg-[#2D384E] rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-[#00D1FF]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Brain className="text-[#00D1FF]" size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-3">
                AI-Powered Analysis
              </h3>
              <p className="text-slate-400">
                Advanced AI algorithms analyze patterns, correlate data, and
                assess risk levels
              </p>
            </div>

            <div className="bg-[#2D384E] rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-[#00D1FF]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="text-[#00D1FF]" size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Professional Reports
              </h3>
              <p className="text-slate-400">
                Generate detailed PDF and HTML reports with executive summaries
                and recommendations
              </p>
            </div>

            <div className="bg-[#2D384E] rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-[#00D1FF]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Map className="text-[#00D1FF]" size={32} />
              </div>
              <h3 className="text-lg font-semibold mb-3">Geographic Mapping</h3>
              <p className="text-slate-400">
                Visualize investigation data on interactive maps with risk-based
                markers
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">FAQ</h2>
            <p className="text-slate-300 text-lg">
              Clear answers to common questions about people search and OSINT.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.question}
                className="group bg-[#2D384E] border border-[#37425B] rounded-xl p-5"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4">
                  <div className="text-lg font-semibold text-white">
                    {item.question}
                  </div>
                  <div className="mt-1 flex-shrink-0 text-slate-300 group-open:rotate-180 transition-transform">
                    <ArrowRight size={18} />
                  </div>
                </summary>
                <div className="mt-4">{item.answer}</div>
              </details>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="/account/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-semibold"
            >
              Start with ShadowTrace
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-slate-300 text-lg">
              Flexible pricing for individuals, teams, and enterprises
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-[#2D384E] rounded-lg p-8 border border-[#37425B]">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2">Starter</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-slate-400">
                  Perfect for individual investigators
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>10 investigations per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Basic OSINT collection</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>AI risk analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>PDF reports</span>
                </li>
              </ul>
              <a
                href="/account/signup"
                className="w-full block text-center py-3 bg-[#37425B] text-white rounded-lg hover:bg-[#303B52] transition-colors font-semibold"
              >
                Get Started
              </a>
            </div>

            {/* Pro Plan */}
            <div className="bg-[#2D384E] rounded-lg p-8 border border-[#00D1FF] ring-1 ring-[#00D1FF]/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-[#00D1FF] text-[#263043] px-3 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2">Pro</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">$99</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-slate-400">For professional investigators</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>50 investigations per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Advanced OSINT collection</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Enhanced AI analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>PDF & HTML reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Map visualization</span>
                </li>
              </ul>
              <a
                href="/account/signup"
                className="w-full block text-center py-3 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-semibold"
              >
                Get Started
              </a>
            </div>

            {/* Agency Plan */}
            <div className="bg-[#2D384E] rounded-lg p-8 border border-[#37425B]">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2">Agency</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">$249</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-slate-400">For teams and agencies</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>200 investigations per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Premium OSINT sources</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Advanced AI correlation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>Custom report branding</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="text-green-400" size={16} />
                  <span>API access</span>
                </li>
              </ul>
              <a
                href="/account/signup"
                className="w-full block text-center py-3 bg-[#37425B] text-white rounded-lg hover:bg-[#303B52] transition-colors font-semibold"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-[#232D41]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Investigating?
          </h2>
          <p className="text-slate-300 text-lg mb-8">
            Join thousands of investigators, security professionals, and
            researchers who trust ShadowTrace
          </p>
          <a
            href="/account/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#00D1FF] text-[#263043] rounded-lg hover:bg-[#00B8E6] transition-colors font-semibold text-lg"
          >
            Start Free Trial
            <ArrowRight size={20} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#37425B] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <BrandLogo className="h-6 w-auto" variant="onDark" />
          </div>
          <div className="flex items-center gap-6 text-slate-400">
            <a href="/ai/chat" className="hover:text-white transition-colors">
              AI Chat
            </a>
            <a
              href="/account/signin"
              className="hover:text-white transition-colors"
            >
              Sign In
            </a>
            <a
              href="/account/signup"
              className="hover:text-white transition-colors"
            >
              Sign Up
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
