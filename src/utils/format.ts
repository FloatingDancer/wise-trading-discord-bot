/**
 * Format helper functions for the Discord Bot
 */

/**
 * Formats a number to a currency string.
 * Automatically adjusts decimal places based on size of the number.
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A';
  }

  // Adjust precision based on value size
  let decimals = 2;
  if (value < 0.01) {
    decimals = 6;
  } else if (value < 1) {
    decimals = 4;
  }

  // Standard formatting
  const formatted = value.toFixed(decimals);
  
  // Choose currency prefix/suffix
  switch (currency.toUpperCase()) {
    case 'USD':
      return `$${formatted}`;
    case 'IDR':
      return `Rp${parseFloat(formatted).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: decimals })}`;
    case 'EUR':
      return `€${formatted}`;
    case 'GBP':
      return `£${formatted}`;
    default:
      return `${formatted} ${currency}`;
  }
}

/**
 * Formats a percentage change.
 * Prefix with '+' or '-' and format decimals.
 */
export function formatPercentage(change: number): string {
  if (change === undefined || change === null || isNaN(change)) {
    return 'N/A';
  }
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
}

/**
 * Formats a date to standard locale format.
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
}
