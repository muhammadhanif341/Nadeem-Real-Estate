"use client";

import { useMemo, useState } from "react";
import { calculateMortgage } from "@/lib/mortgage";
import { formatPrice } from "@/lib/format";

export function MortgageCalculator({
  price,
  currency = "USD",
}: {
  price: number;
  currency?: "USD" | "PKR";
}) {
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [annualRatePct, setAnnualRatePct] = useState(6.5);
  const [termYears, setTermYears] = useState(30);

  const result = useMemo(
    () =>
      calculateMortgage({
        price,
        downPaymentPct: downPaymentPct / 100,
        annualRatePct,
        termYears,
      }),
    [price, downPaymentPct, annualRatePct, termYears],
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h3 className="mb-4 text-lg">Mortgage Calculator</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Down payment</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(Number(e.target.value))}
              className="w-full rounded-sm border border-border bg-bg px-3 py-2 tabular-nums"
            />
            <span className="text-text-muted">%</span>
          </span>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Interest rate</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={25}
              step={0.05}
              value={annualRatePct}
              onChange={(e) => setAnnualRatePct(Number(e.target.value))}
              className="w-full rounded-sm border border-border bg-bg px-3 py-2 tabular-nums"
            />
            <span className="text-text-muted">%</span>
          </span>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-semibold">Loan term</span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={40}
              step={1}
              value={termYears}
              onChange={(e) => setTermYears(Number(e.target.value))}
              className="w-full rounded-sm border border-border bg-bg px-3 py-2 tabular-nums"
            />
            <span className="text-text-muted">yrs</span>
          </span>
        </label>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-text-muted uppercase">Loan amount</dt>
          <dd className="font-heading text-lg font-bold tabular-nums text-primary">
            {formatPrice(result.loanAmount, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase">
            Monthly payment
          </dt>
          <dd className="font-heading text-lg font-bold tabular-nums text-accent-dark">
            {formatPrice(result.monthlyPayment, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted uppercase">
            Total interest
          </dt>
          <dd className="font-heading text-lg font-bold tabular-nums text-primary">
            {formatPrice(result.totalInterest, currency)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-text-muted">
        Estimate only — excludes taxes, insurance, and fees. Consult a
        lender for an exact quote.
      </p>
    </div>
  );
}
