import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="py-24 bg-white dark:bg-slate-900 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">Pricing</h2>
          <h1 className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">
            Start free, upgrade when you need more. ctx-sys is open source.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {/* Free Tier */}
          <PricingCard
            name="Free"
            price="$0"
            description="Perfect for trying out ctx-sys"
            features={[
              'Single project',
              'Up to 1,000 queries/month',
              'Ollama embeddings (local)',
              'Community support',
              'Basic analytics'
            ]}
            cta="Get Started"
            ctaHref="/docs"
            highlighted={false}
          />

          {/* Pro Tier */}
          <PricingCard
            name="Pro"
            price="$19"
            period="/month"
            description="For professional developers"
            features={[
              'Unlimited projects',
              'Unlimited queries',
              'Cloud embeddings (faster)',
              'Priority support',
              'Advanced analytics',
              'Git hooks integration',
              'Team sharing (up to 5)'
            ]}
            cta="Start Free Trial"
            ctaHref="/signup"
            highlighted={true}
          />

          {/* Team Tier */}
          <PricingCard
            name="Team"
            price="$49"
            period="/user/month"
            description="For teams building together"
            features={[
              'Everything in Pro',
              'Unlimited team members',
              'Shared knowledge base',
              'Admin dashboard',
              'SSO integration',
              'SLA guarantee',
              'Dedicated support'
            ]}
            cta="Contact Sales"
            ctaHref="/contact"
            highlighted={false}
          />
        </div>

        {/* Open Source Note */}
        <div className="mt-16 text-center p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
            ctx-sys is Open Source
          </h3>
          <p className="mt-2 text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            The core ctx-sys library is MIT licensed and free to use. Paid tiers offer cloud features,
            team collaboration, and priority support for those who need them.
          </p>
          <Link
            href="https://github.com/davidfranz/ctx-sys"
            className="inline-flex items-center gap-2 mt-4 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            View on GitHub
          </Link>
        </div>

        {/* FAQ Section */}
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <FAQItem
              question="Is there really a free tier?"
              answer="Yes! The free tier includes everything you need to try ctx-sys. You can use it with Ollama for completely local, free embeddings."
            />
            <FAQItem
              question="What counts as a query?"
              answer="A query is any context retrieval request made through the MCP tools. Internal operations like indexing don't count."
            />
            <FAQItem
              question="Can I self-host?"
              answer="ctx-sys is open source and can be fully self-hosted. The paid tiers offer cloud features like team sync and managed embeddings."
            />
            <FAQItem
              question="Do you offer discounts?"
              answer="We offer 50% off for students, educators, and open source maintainers. Contact us for details."
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-8 ${
        highlighted
          ? 'border-cyan-500 ring-2 ring-cyan-500 bg-white dark:bg-slate-800'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
      }`}
    >
      {highlighted && (
        <div className="mb-4">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30 rounded-full">
            Most Popular
          </span>
        </div>
      )}
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{name}</h3>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{description}</p>
      <p className="mt-4">
        <span className="text-4xl font-bold text-slate-900 dark:text-white">{price}</span>
        {period && <span className="text-slate-600 dark:text-slate-400">{period}</span>}
      </p>
      <ul className="mt-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center text-slate-600 dark:text-slate-300">
            <svg className="h-5 w-5 text-cyan-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 block w-full rounded-xl py-3 text-center font-semibold transition-all ${
          highlighted
            ? 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/25'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
      <h3 className="font-semibold text-slate-900 dark:text-white">{question}</h3>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{answer}</p>
    </div>
  );
}
