'use client';

import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function RiskPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/register" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Registration
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/10">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Risk Disclaimer</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <section className="bg-red-500/5 border border-red-500/10 p-6 rounded-2xl mb-8">
            <p className="text-red-400 font-bold mb-2 uppercase text-xs tracking-wider">High Risk Warning</p>
            <p className="text-slate-200">
              Trading financial instruments involves significant risk and is not suitable for everyone. You should only trade with money you can afford to lose.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3 text-red-300">1. Nature of Copy Trading</h2>
            <p>
              Copy trading allows you to replicate the trades of other traders. While this can provide opportunities, it also means you are subject to the risks and losses incurred by those traders. Past performance is not indicative of future results.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Execution Risks</h2>
            <p>
              Trade execution may be affected by various factors, including network latency, slippage, and broker-specific conditions. We do not guarantee the accuracy or timeliness of trade replication.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. No Financial Advice</h2>
            <p>
              The signals and information provided on HF Copy Trader are for informational and educational purposes only. They do not constitute financial, investment, or legal advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Limitation of Liability</h2>
            <p>
              HF Copy Trader shall not be liable for any losses, damages, or costs incurred as a result of using our services or following trade signals.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. User Responsibility</h2>
            <p>
              You are solely responsible for managing your risk, including setting appropriate lot sizes, stop losses, and other risk management parameters within your own trading account.
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
