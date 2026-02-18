'use client';

import Link from 'next/link';
import { ArrowLeft, UserCheck } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/register" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Registration
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information Collection</h2>
            <p>
              We collect information you provide directly to us when creating an account, such as your name, email address, and trading preferences.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Use of Information</h2>
            <p>
              Your information is used to provide and improve our services, including signal distribution, account management, and communication.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share information with trusted third-party service providers who assist us in operating our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Security Measures</h2>
            <p>
              We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to enhance your experience and analyze platform performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at support@hfcopytrader.com.
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
