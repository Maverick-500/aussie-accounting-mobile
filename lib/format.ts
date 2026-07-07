/**
 * Format a number as Australian dollars (AUD).
 * Accepts a dollar amount (not cents).
 */
export function formatAud(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}
