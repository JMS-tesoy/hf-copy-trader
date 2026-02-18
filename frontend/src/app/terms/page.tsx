'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/register" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Registration
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using HF Copy Trader, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>
              HF Copy Trader provides a platform for trade signal distribution and automated copying. We do not provide financial advice, and our platform is for informational and educational purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. Any activity occurring under your account is your sole responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Fees and Payments</h2>
            <p>
              Fees for services, if applicable, will be clearly communicated. All payments are non-refundable unless otherwise specified.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at our discretion, without notice, for any violation of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Modifications</h2>
            <p>
              HF Copy Trader may modify these terms at any time. Your continued use of the platform constitutes acceptance of the revised terms.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-sm text-slate-500">
          Last updated: February 18, 2026
        </div>
      </div>
    </div>
  );
}
