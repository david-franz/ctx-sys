export default function PricingPage() {
  return (
    <main className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Start free, upgrade when you need more.
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
            highlighted={false}
          />
        </div>

        {/* FAQ Section */}
        <div className="mt-24">
          <h2 className="text-2xl font-bold text-gray-900 text-center">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
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
  highlighted
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-8 ${
        highlighted
          ? 'border-indigo-600 ring-2 ring-indigo-600'
          : 'border-gray-200'
      }`}
    >
      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <p className="mt-2 text-gray-600">{description}</p>
      <p className="mt-4">
        <span className="text-4xl font-bold text-gray-900">{price}</span>
        {period && <span className="text-gray-600">{period}</span>}
      </p>
      <ul className="mt-6 space-y-3">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center text-gray-600">
            <svg className="h-5 w-5 text-indigo-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <a
        href="/signup"
        className={`mt-8 block w-full rounded-md py-3 text-center font-semibold ${
          highlighted
            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        }`}
      >
        {cta}
      </a>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900">{question}</h3>
      <p className="mt-2 text-gray-600">{answer}</p>
    </div>
  );
}
