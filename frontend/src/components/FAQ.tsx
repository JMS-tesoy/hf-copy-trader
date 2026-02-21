'use client';

import Link from 'next/link';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    id: 'getting-started',
    question: 'How do I get started as a copy trader?',
    answer:
      'Create an account, fund your trading account, then open your Portal. In the Subscriptions tab, browse available masters and subscribe with your preferred lot multiplier. Once active, new master signals are copied to your account automatically.',
  },
  {
    id: 'copy-execution',
    question: 'When does copying begin after I subscribe?',
    answer:
      'Copying starts for new signals after your subscription is active. Existing positions already open before you subscribe are not automatically imported unless your strategy settings explicitly support that behavior.',
  },
  {
    id: 'lot-multiplier',
    question: 'What does lot multiplier mean?',
    answer:
      'Lot multiplier controls trade size relative to the master. Example: if the master opens 0.10 lots and your multiplier is 2, your copied trade opens at 0.20 lots (subject to broker limits and margin availability).',
  },
  {
    id: 'risk-control',
    question: 'How can I manage risk while copying?',
    answer:
      'You can spread risk by subscribing to multiple masters, use a conservative lot multiplier, and review open positions regularly in My Trades. If needed, pause or unsubscribe from a master and adjust strategy settings in the subscription panel.',
  },
  {
    id: 'pause-unsubscribe',
    question: 'Can I pause or unsubscribe anytime?',
    answer:
      'Yes. You can change subscription status from the Subscriptions tab at any time. After pausing or unsubscribing, no new trades are copied from that master unless you reactivate or subscribe again.',
  },
  {
    id: 'open-positions',
    question: 'What happens to trades already open when I unsubscribe?',
    answer:
      'Existing open trades remain in your account unless they are closed by your own rules or manually closed. Unsubscribing mainly stops future copy signals from that master.',
  },
  {
    id: 'latency',
    question: 'Are copied trades real-time?',
    answer:
      'Signals are processed in real-time and reflected in the Live Signals section of your portal. Final execution timing can still vary based on network conditions, broker execution speed, and account constraints.',
  },
  {
    id: 'trade-history',
    question: 'Where can I track copied trades and performance?',
    answer:
      'Use the My Trades tab for detailed copied trade history and status filters, and use Overview for account-level stats like open positions, total trades, and your symbol exposure chart.',
  },
  {
    id: 'requirements',
    question: 'Is there a minimum balance requirement?',
    answer:
      'Minimum balance depends on your broker, instrument margin rules, and the masters you follow. Keep enough available margin so copied trades can open without being rejected.',
  },
  {
    id: 'security',
    question: 'How is account and trade data protected?',
    answer:
      'The platform uses authenticated API sessions and controlled access to subscription/trade endpoints. You should also protect your account with strong credentials and avoid sharing your login details.',
  },
];

export function FAQ() {
  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Link
            href="/portal"
            className="inline-flex items-center text-sm text-emerald-400 hover:text-emerald-300 transition-colors mb-4"
          >
            Back to Portal
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Frequently Asked Questions</h1>
          <p className="text-slate-400">
            Find answers to common questions about our copy trading platform.
          </p>
        </div>

        <div className="accordion accordion-shadow *:accordion-item-active:shadow-md">
          {faqItems.map((item, index) => (
            <div
              key={item.id}
              className="accordion-item border border-slate-800 bg-slate-900/70"
              id={item.id}
            >
              <button
                className="accordion-toggle inline-flex w-full items-center justify-between px-5 py-4 text-start hover:bg-slate-800/60"
                aria-controls={`${item.id}-collapse`}
                aria-expanded={index === 0 ? 'true' : 'false'}
              >
                <span className="text-white font-medium pr-4">{item.question}</span>
                <span className="icon-[tabler--chevron-left] accordion-item-active:-rotate-90 text-emerald-400 size-5 shrink-0 transition-transform duration-300 rtl:-rotate-180" />
              </button>
              <div
                id={`${item.id}-collapse`}
                className={`accordion-content w-full overflow-hidden transition-[height] duration-300 ${
                  index === 0 ? '' : 'hidden'
                }`}
                aria-labelledby={item.id}
                role="region"
              >
                <div className="px-5 pb-4">
                  <p className="text-slate-300 font-normal leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-slate-900 border border-slate-800 rounded-xl p-8">
          <h2 className="text-xl font-bold text-white mb-3">Still have questions?</h2>
          <p className="text-slate-400 mb-4">
            Can&apos;t find the answer you&apos;re looking for? Please contact our support team.
          </p>
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
