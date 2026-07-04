// Currencies a group can be denominated in. Deliberately limited to ISO 4217
// currencies with exactly 2 decimal places (minor unit = 100), because all
// money math in lib/money.ts assumes integer *cents* — a 0-decimal currency
// like JPY or a 3-decimal one like BHD would break the parsing/formatting
// contract, not just the display.
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD"] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
  );
}
