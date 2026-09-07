import Link from "next/link";
import { siteConfig } from "@/lib/site";

export function Footer() {
  return (
    <footer className="bg-primary-dark text-text-inverse/85">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="font-heading text-lg text-text-inverse">
            {siteConfig.name}
          </span>
          <span className="text-sm text-text-inverse/60">
            {siteConfig.tagline}
          </span>
        </div>

        <nav
          className="flex flex-col gap-2.5 text-sm"
          aria-label="Footer"
        >
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-text-inverse/75 hover:text-accent-light"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2.5 text-sm text-text-inverse/75">
          <span>{siteConfig.phone}</span>
          <span>{siteConfig.email}</span>
          <span>
            {siteConfig.address.line1}, {siteConfig.address.line2}
          </span>
        </div>
      </div>
      <div className="border-t border-text-inverse/10 py-5">
        <p className="text-center text-[0.82rem] text-text-inverse/60">
          &copy; {new Date().getFullYear()} {siteConfig.fullName}. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
