import { ContactForm } from "@/components/ContactForm";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { siteConfig } from "@/lib/site";

export function ContactSection() {
  return (
    <section id="contact" className="scroll-mt-24 bg-bg px-6 py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-14 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-3 inline-block text-[0.8rem] font-bold tracking-[0.14em] text-accent-text uppercase">
            Get In Touch
          </p>
          <h2 className="text-[clamp(1.7rem,2.5vw+1rem,2.4rem)] text-balance">
            Let&apos;s Find Your Next Property
          </h2>
          <p className="mt-3 max-w-[60ch] text-[1.05rem] text-text-muted">
            Reach out today to book a free consultation — Nadeem will walk
            you through your options and next steps.
          </p>

          <dl className="mt-8 grid grid-cols-1 gap-7 sm:grid-cols-2">
            <div>
              <dt className="mb-1.5 text-xs font-bold tracking-[0.1em] text-accent-text uppercase">
                Phone
              </dt>
              <dd>{siteConfig.phone}</dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-bold tracking-[0.1em] text-accent-text uppercase">
                Email
              </dt>
              <dd>{siteConfig.email}</dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-bold tracking-[0.1em] text-accent-text uppercase">
                Office Hours
              </dt>
              <dd>
                {siteConfig.officeHours.weekdays}
                <br />
                {siteConfig.officeHours.saturday}
              </dd>
            </div>
            <div>
              <dt className="mb-1.5 text-xs font-bold tracking-[0.1em] text-accent-text uppercase">
                Office Address
              </dt>
              <dd>
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.line2}
              </dd>
            </div>
          </dl>

          <div className="mt-10 max-w-xl">
            <ContactForm />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-primary to-primary-dark p-10 text-text-inverse shadow-lg">
          <h3 className="text-[1.4rem] text-text-inverse">
            Book a Free Consultation
          </h3>
          <p className="mt-2 text-[0.94rem] text-text-inverse/75">
            Speak directly with Nadeem about your buying, selling, or
            investment goals — no obligation.
          </p>
          <a
            href="tel:+923339357378"
            className="mt-6 flex w-full items-center justify-center rounded-sm border-[1.5px] border-accent bg-accent px-8 py-4 text-base font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white hover:shadow-md"
          >
            Call Now
          </a>
          <div className="mt-3">
            <WhatsAppButton variant="light" />
          </div>
          <a
            href="mailto:contact@nadeemrealestate.com"
            className="mt-3 flex w-full items-center justify-center rounded-sm border-[1.5px] border-text-inverse/40 bg-transparent px-8 py-4 text-base font-semibold text-text-inverse transition-all hover:-translate-y-0.5 hover:border-text-inverse hover:bg-text-inverse/[0.08]"
          >
            Send an Email
          </a>

          <div
            role="group"
            aria-label="Nadeem Real Estate location on Google Maps"
            className="mt-6 rounded-lg border border-text-inverse/15 bg-text-inverse/[0.06] p-6"
          >
            <h3 className="text-[1.1rem] text-text-inverse">Visit Us</h3>
            <p className="mt-1 text-[0.9rem] font-semibold text-accent-light">
              Nadeem Real Estate &middot; Attock
            </p>
            <p className="mt-2 text-[0.9rem] text-text-inverse/75">
              Find our official location on Google Maps and get directions
              straight to our office.
            </p>
            <a
              href="https://maps.google.com/maps?vet=10CAAQoqAOahcKEwiQleryruKWAxUAAAAAHQAAAAAQTA..i&pvq=Cg0vZy8xMXdxeTVmNTd4IhgKEm5hZGVlbSByZWFsIGVzdGF0ZRACGAM&lqi=ChluYWRlZW0gcmVhbCBlc3RhdGUgYXR0b2NrSPyp2tLbu4CACFonEAAQARACGAAYARgDIhluYWRlZW0gcmVhbCBlc3RhdGUgYXR0b2NrkgEQY29ycG9yYXRlX29mZmljZQ&fvr=1&cs=1&um=1&ie=UTF-8&fb=1&gl=sa&sa=X&ftid=0x38df19001b046da9:0x7d62fbe4a2a4fa49"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Nadeem Real Estate location and get directions on Google Maps (opens in a new tab)"
              className="mt-4 flex w-full items-center justify-center rounded-sm border-[1.5px] border-accent bg-accent px-6 py-3.5 text-sm font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white hover:shadow-md"
            >
              Open in Google Maps — Get Directions
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
