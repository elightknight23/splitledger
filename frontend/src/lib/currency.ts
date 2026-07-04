// Mirrors backend/src/lib/currency.ts — all 2-decimal ISO 4217 currencies,
// because the money math on both sides assumes integer cents.
export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
] as const;

export function currencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

// Amounts arrive as Decimal strings from the backend ("16.67") or as numbers
// from client-side cents math; sign is preserved, so pass Math.abs()'d input
// where the design shows magnitude + a separate OWES/IS OWED label.
export function formatMoney(value: string | number, code: string): string {
  return `${currencySymbol(code)}${Number(value).toFixed(2)}`;
}
