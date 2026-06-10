import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
  validation: {
    logErrors: false
  }
});

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
  high: number;
  low: number;
  open: number;
  volume: number;
  timestamp: Date;
  assetType: 'STOCK' | 'CRYPTO' | 'FOREX' | 'UNKNOWN';
}

export interface HistoricalPricePoint {
  date: Date;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

/**
 * Normalizes query symbols to standard Yahoo Finance formatting.
 * Examples:
 * - 'BTC' or 'BTC-USD' -> 'BTC-USD'
 * - 'USD/IDR' or 'USDIDR' -> 'USDIDR=X'
 * - 'BBCA' -> 'BBCA.JK' (Can be added, but standard tickers like BBCA.JK work out of the box)
 */
export function normalizeSymbol(symbol: string): { normalized: string; type: 'STOCK' | 'CRYPTO' | 'FOREX' | 'UNKNOWN' } {
  const clean = symbol.trim().toUpperCase();

  // 1. Forex checking (e.g., USD/IDR, EUR/USD, USDIDR)
  if (clean.includes('/') && clean.split('/').length === 2) {
    const parts = clean.split('/');
    return { normalized: `${parts[0]}${parts[1]}=X`, type: 'FOREX' };
  }
  if (clean.endsWith('=X')) {
    return { normalized: clean, type: 'FOREX' };
  }
  
  // Checking common currency patterns (6 letters matching currency pairs e.g. USDIDR, EURUSD)
  const forexPairs = ['USDIDR', 'EURUSD', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDJPY', 'SGDIDR', 'EURIDR'];
  if (forexPairs.includes(clean)) {
    return { normalized: `${clean}=X`, type: 'FOREX' };
  }

  // 2. Crypto checking (e.g., BTC, ETH, BTC-USD, BTCUSD)
  const cryptoList = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'DOT', 'LTC', 'LINK'];
  if (cryptoList.includes(clean)) {
    return { normalized: `${clean}-USD`, type: 'CRYPTO' };
  }
  if (clean.endsWith('-USD') || clean.endsWith('-IDR')) {
    return { normalized: clean, type: 'CRYPTO' };
  }

  // Fallback to check if it has "-" and is likely crypto
  if (clean.includes('-') && (clean.endsWith('USD') || clean.endsWith('USDT') || clean.endsWith('IDR'))) {
    return { normalized: clean, type: 'CRYPTO' };
  }

  // Default is assumed to be stock or unknown
  return { normalized: clean, type: 'STOCK' };
}

/**
 * Service to fetch market data from Yahoo Finance.
 */
export class FinanceService {
  /**
   * Fetches real-time price info for a given symbol.
   */
  static async getQuote(querySymbol: string): Promise<MarketQuote> {
    const { normalized, type } = normalizeSymbol(querySymbol);

    try {
      const quote = await yf.quote(normalized);
      
      if (!quote || quote.regularMarketPrice === undefined) {
        throw new Error(`Symbol "${querySymbol}" not found.`);
      }

      // Determine asset type
      let assetType: 'STOCK' | 'CRYPTO' | 'FOREX' | 'UNKNOWN' = type;
      if (quote.quoteType === 'CRYPTOCURRENCY') assetType = 'CRYPTO';
      else if (quote.quoteType === 'CURRENCY') assetType = 'FOREX';
      else if (quote.quoteType === 'EQUITY') assetType = 'STOCK';

      return {
        symbol: quote.symbol,
        name: quote.shortName || quote.longName || quote.symbol,
        price: quote.regularMarketPrice,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        currency: quote.currency || 'USD',
        marketState: quote.marketState || 'REGULAR',
        high: quote.regularMarketDayHigh || quote.regularMarketPrice,
        low: quote.regularMarketDayLow || quote.regularMarketPrice,
        open: quote.regularMarketOpen || quote.regularMarketPrice,
        volume: quote.regularMarketVolume || 0,
        timestamp: quote.regularMarketTime ? new Date(quote.regularMarketTime) : new Date(),
        assetType
      };
    } catch (error: any) {
      // Try alternative suffix for Forex if query failed and contains 6 letters
      if (type === 'STOCK' && querySymbol.length === 6) {
        try {
          const forexQuote = await yf.quote(`${querySymbol.toUpperCase()}=X`);
          return {
            symbol: forexQuote.symbol,
            name: forexQuote.shortName || forexQuote.symbol,
            price: forexQuote.regularMarketPrice!,
            change: forexQuote.regularMarketChange || 0,
            changePercent: forexQuote.regularMarketChangePercent || 0,
            currency: forexQuote.currency || 'USD',
            marketState: forexQuote.marketState || 'REGULAR',
            high: forexQuote.regularMarketDayHigh || forexQuote.regularMarketPrice!,
            low: forexQuote.regularMarketDayLow || forexQuote.regularMarketPrice!,
            open: forexQuote.regularMarketOpen || forexQuote.regularMarketPrice!,
            volume: forexQuote.regularMarketVolume || 0,
            timestamp: forexQuote.regularMarketTime ? new Date(forexQuote.regularMarketTime) : new Date(),
            assetType: 'FOREX'
          };
        } catch {
          // Fall through to original error
        }
      }
      throw new Error(`Failed to fetch quote for "${querySymbol}": ${error.message}`);
    }
  }

  /**
   * Fetches historical data points for chart generation.
   * Ranges: '1d', '5d', '1m', '3m', '6m', '1y', 'ytd', 'max'
   */
  static async getHistoricalData(querySymbol: string, range: string = '1m'): Promise<{ quotes: HistoricalPricePoint[]; meta: any }> {
    const { normalized } = normalizeSymbol(querySymbol);

    // Map range to yahoo finance query details
    let interval: '1m' | '2m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h' | '1d' | '5d' | '1wk' | '1mo' | '3mo' = '1d';
    
    // Choose appropriate interval based on range to prevent fetching too much data
    switch (range) {
      case '1d':
        interval = '5m'; // 5-minute ticks for intraday 1-day chart
        break;
      case '5d':
        interval = '15m'; // 15-minute ticks for 5-day chart
        break;
      case '1w':
        interval = '30m';
        break;
      case '1m':
        interval = '1d'; // Daily ticks for 1 month
        break;
      case '3m':
      case '6m':
        interval = '1d';
        break;
      case '1y':
        interval = '1wk'; // Weekly ticks for 1 year
        break;
      default:
        interval = '1d';
    }

    try {
      const result = await yf.chart(normalized, {
        period1: this.getStartDateForRange(range),
        interval
      });

      if (!result || !result.quotes || result.quotes.length === 0) {
        throw new Error(`No historical data found for "${normalized}" with range "${range}"`);
      }

      // Filter and map to simple structure
      const quotes: HistoricalPricePoint[] = result.quotes
        .filter((q: any) => q.date && q.close !== null && q.close !== undefined)
        .map((q: any) => ({
          date: new Date(q.date),
          close: q.close,
          open: q.open,
          high: q.high,
          low: q.low,
          volume: q.volume
        }));

      return {
        quotes,
        meta: result.meta
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch chart data for "${querySymbol}": ${error.message}`);
    }
  }

  private static getStartDateForRange(range: string): Date {
    const date = new Date();
    switch (range) {
      case '1d':
        date.setDate(date.getDate() - 1);
        break;
      case '5d':
        date.setDate(date.getDate() - 5);
        break;
      case '1w':
        date.setDate(date.getDate() - 7);
        break;
      case '1m':
        date.setMonth(date.getMonth() - 1);
        break;
      case '3m':
        date.setMonth(date.getMonth() - 3);
        break;
      case '6m':
        date.setMonth(date.getMonth() - 6);
        break;
      case '1y':
        date.setFullYear(date.getFullYear() - 1);
        break;
      default:
        date.setMonth(date.getMonth() - 1); // default 1m
    }
    return date;
  }
}
