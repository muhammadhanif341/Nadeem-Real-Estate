const reasons = [
  {
    title: "Professional Guidance",
    body: "Clear, experienced advice at every stage — from first inquiry to final closing.",
  },
  {
    title: "Deep Market Knowledge",
    body: "Up-to-date insight into local pricing, trends, and neighborhood value.",
  },
  {
    title: "Transparent Communication",
    body: "Straightforward updates and honest answers, with no hidden surprises.",
  },
  {
    title: "Personalized Service",
    body: "A tailored approach built around your goals, budget, and timeline.",
  },
];

export function WhyChooseSection() {
  return (
    <section
      id="why-choose"
      className="scroll-mt-24 bg-gradient-to-br from-primary to-primary-dark px-6 py-24 text-text-inverse"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            Why Choose Nadeem
          </p>
          <h2 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance text-text-inverse">
            A Partner You Can Trust With a Major Decision
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-md border border-text-inverse/15 bg-text-inverse/[0.06] p-[30px]"
            >
              <span
                aria-hidden="true"
                className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-full bg-accent font-bold text-primary-dark"
              >
                ✓
              </span>
              <h3 className="text-text-inverse">{reason.title}</h3>
              <p className="text-[0.92rem] text-text-inverse/75">
                {reason.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
