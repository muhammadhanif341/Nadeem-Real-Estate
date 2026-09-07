/**
 * Standard fixed-rate amortization math for the mortgage calculator.
 * Pure and dependency-free on purpose — see mortgage.test.ts.
 */
export interface MortgageInput {
  /** Total property price. */
  price: number;
  /** Down payment as a fraction of price, e.g. 0.2 for 20%. */
  downPaymentPct: number;
  /** Annual interest rate as a percentage, e.g. 6.5 for 6.5%. */
  annualRatePct: number;
  /** Loan term in years. */
  termYears: number;
}

export interface MortgageResult {
  loanAmount: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
}

export function calculateMortgage(input: MortgageInput): MortgageResult {
  const { price, downPaymentPct, annualRatePct, termYears } = input;

  const loanAmount = Math.max(price * (1 - downPaymentPct), 0);
  const months = Math.max(termYears * 12, 1);
  const monthlyRate = annualRatePct / 100 / 12;

  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = loanAmount / months;
  } else {
    const factor = Math.pow(1 + monthlyRate, months);
    monthlyPayment = (loanAmount * monthlyRate * factor) / (factor - 1);
  }

  const totalPaid = monthlyPayment * months;
  const totalInterest = Math.max(totalPaid - loanAmount, 0);

  return {
    loanAmount: round2(loanAmount),
    monthlyPayment: round2(monthlyPayment),
    totalPaid: round2(totalPaid),
    totalInterest: round2(totalInterest),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
