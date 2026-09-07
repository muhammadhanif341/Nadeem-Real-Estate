import { describe, expect, it } from "vitest";
import { calculateMortgage } from "./mortgage";

describe("calculateMortgage", () => {
  it("computes a standard 30-year fixed-rate loan correctly", () => {
    const result = calculateMortgage({
      price: 500000,
      downPaymentPct: 0.2,
      annualRatePct: 6,
      termYears: 30,
    });

    expect(result.loanAmount).toBe(400000);
    // Known-good monthly payment for $400k at 6%/30yr ≈ $2398.20
    expect(result.monthlyPayment).toBeCloseTo(2398.2, 1);
    expect(result.totalInterest).toBeGreaterThan(0);
    // Allow for cent-level rounding drift across 360 compounded payments.
    expect(
      Math.abs(result.totalPaid - result.monthlyPayment * 360),
    ).toBeLessThan(5);
  });

  it("handles a 0% interest rate without dividing by zero", () => {
    const result = calculateMortgage({
      price: 240000,
      downPaymentPct: 0,
      annualRatePct: 0,
      termYears: 10,
    });

    expect(result.monthlyPayment).toBeCloseTo(2000, 5);
    expect(result.totalInterest).toBe(0);
  });

  it("never returns a negative loan amount when down payment exceeds price", () => {
    const result = calculateMortgage({
      price: 100000,
      downPaymentPct: 1.5,
      annualRatePct: 5,
      termYears: 15,
    });

    expect(result.loanAmount).toBe(0);
    expect(result.monthlyPayment).toBe(0);
  });
});
