const services = [
  {
    number: "01",
    title: "Property Buying",
    body: "Guided support in finding, evaluating, and purchasing a property that fits your needs, timeline, and budget.",
  },
  {
    number: "02",
    title: "Property Selling",
    body: "Strategic pricing, presentation, and negotiation designed to sell your property quickly and at the best value.",
  },
  {
    number: "03",
    title: "Property Investment Consulting",
    body: "Data-informed advice on high-potential investment opportunities and long-term portfolio growth.",
  },
  {
    number: "04",
    title: "Property Search & Guidance",
    body: "A personalized property search that filters out the noise and focuses on options that truly match your goals.",
  },
];

export function ServicesSection() {
  return (
    <section id="services" className="scroll-mt-24 bg-bg-alt px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            What Nadeem Offers
          </p>
          <h2 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance">
            Services Built Around Your Goals
          </h2>
          <p className="mt-3 text-[1.05rem] text-text-muted">
            Whether you&apos;re buying, selling, or investing, every service
            is tailored to your situation.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.number}
              className="rounded-md border border-border bg-surface p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-accent font-heading text-[1.1rem] font-bold text-accent-text">
                {service.number}
              </span>
              <h3 className="mb-2">{service.title}</h3>
              <p className="text-[0.93rem] text-text-muted">{service.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
