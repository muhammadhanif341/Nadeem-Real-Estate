"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-[84px] max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/#home" className="flex flex-shrink-0 items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-heading text-xl text-accent-light">
            N
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-heading text-xl font-bold text-primary">
              {siteConfig.name}
            </span>
            <span className="text-[0.68rem] tracking-[0.12em] text-text-muted uppercase">
              {siteConfig.tagline}
            </span>
          </span>
        </Link>

        <nav
          className="hidden flex-1 items-center justify-end gap-8 lg:flex"
          aria-label="Primary"
        >
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b-2 border-transparent py-2 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent-dark"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/#contact"
            className="rounded-md border-[1.5px] border-accent bg-accent px-6 py-3 text-sm font-semibold text-primary-dark transition-all hover:-translate-y-0.5 hover:border-accent-dark hover:bg-accent-dark hover:text-white hover:shadow-md"
          >
            Book a Consultation
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-sm lg:hidden"
          aria-expanded={open}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open ? (
        <nav
          className="border-t border-border bg-surface px-6 py-2 lg:hidden"
          aria-label="Primary"
        >
          <ul className="flex flex-col divide-y divide-border">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-3.5 text-sm font-semibold text-text"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/#contact"
            onClick={() => setOpen(false)}
            className="mt-4 mb-2 flex w-full items-center justify-center rounded-md border-[1.5px] border-accent bg-accent px-6 py-3.5 text-sm font-semibold text-primary-dark"
          >
            Book a Consultation
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
