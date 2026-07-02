// All money math in the service layer happens in integer cents — JS floats
// can't represent most decimal fractions exactly (0.1 + 0.2 !== 0.3), which
// would make "splits must sum to the total" randomly fail on valid input.
// Prisma Decimal columns accept the string form ("12.34") losslessly.

const MONEY_PATTERN = /^(\d{1,8})(?:\.(\d{1,2}))?$/;

export function parseMoneyToCents(value: unknown): number | null {
  // Accept JSON numbers too, but do the parsing on the string form so we
  // never do float arithmetic on the value itself.
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string") {
    return null;
  }

  const match = MONEY_PATTERN.exec(raw.trim());
  if (!match) {
    return null;
  }

  const whole = Number(match[1]);
  const fraction = match[2] ?? "";
  const cents = whole * 100 + Number(fraction.padEnd(2, "0") || "0");
  return cents > 0 ? cents : null;
}

export function centsToDecimalString(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
