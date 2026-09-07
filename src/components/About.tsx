const values = [
  {
    title: "Proven Expertise",
    body: "Deep knowledge of local market trends, pricing, and property value.",
  },
  {
    title: "Reliable Guidance",
    body: "Honest, practical advice at every step of the process.",
  },
  {
    title: "Client-Focused Approach",
    body: "Every recommendation is tailored to your goals and budget.",
  },
];

export function About() {
  return (
    <section id="about" className="scroll-mt-24 bg-surface px-6 py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="relative mx-auto max-w-[340px] lg:mx-0 lg:max-w-none">
          <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-gradient-to-br from-bg-alt to-border shadow-md">
            <span className="font-heading text-4xl text-primary">Nadeem</span>
            <span className="text-xs tracking-[0.14em] text-text-muted uppercase">
              Real Estate Consultant
            </span>
          </div>
          <div className="absolute right-0 -bottom-6 left-0 mx-auto flex w-fit min-w-[140px] flex-col rounded-md bg-primary px-[22px] py-[18px] shadow-md sm:right-[-20px] sm:left-auto">
            <strong className="font-heading text-2xl text-accent-light">
              15+
            </strong>
            <span className="text-[0.78rem] text-text-inverse/80">
              Years in Real Estate
            </span>
          </div>
        </div>

        <div>
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            About Nadeem
          </p>
          <h2 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance">
            A Consultant Who Puts Your Interests First
          </h2>
          <p className="mt-5 text-text-muted">
            With over 15 years in the real estate industry, Nadeem has built a
            reputation as a dependable, detail-oriented consultant who guides
            clients through every stage of buying, selling, and investing in
            property. Every recommendation is grounded in real market data,
            not guesswork.
          </p>
          <p className="mt-4 text-text-muted">
            Clients work directly with Nadeem from the first consultation to
            closing day — no hand-offs, no confusion, just clear
            communication and steady support.
          </p>

          <ul className="mt-7 flex flex-col gap-4">
            {values.map((value) => (
              <li key={value.title} className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-accent text-[0.8rem] font-bold text-primary-dark"
                >
                  ✓
                </span>
                <span className="text-text-muted">
                  <strong className="text-text">{value.title} — </strong>
                  {value.body}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
