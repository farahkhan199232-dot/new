// Money helpers. All amounts are stored as integer minor units (paise / cents).
export const CURRENCY_DIGITS = { INR: 2, USD: 2, EUR: 2, GBP: 2, AUD: 2, JPY: 0 };

export function toMinor(amount, currency = 'USD') {
  const d = CURRENCY_DIGITS[currency] ?? 2;
  return Math.round(Number(amount) * 10 ** d);
}

export function fromMinor(minor, currency = 'USD') {
  const d = CURRENCY_DIGITS[currency] ?? 2;
  return minor / 10 ** d;
}

export function formatMoney(minor, currency = 'USD') {
  const d = CURRENCY_DIGITS[currency] ?? 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d,
    }).format(minor / 10 ** d);
  } catch {
    return `${currency} ${(minor / 10 ** d).toFixed(d)}`;
  }
}
