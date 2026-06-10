import axios from 'axios';
import { HistoricalPricePoint } from './finance.js';

export class ChartGenerator {
  /**
   * Generates a price history chart image buffer from historical price points.
   * @param symbol Asset ticker/symbol
   * @param data Historical price points
   * @param range Date range (e.g. 1d, 1m, 1y)
   */
  static async generatePriceChart(
    symbol: string,
    data: HistoricalPricePoint[],
    range: string
  ): Promise<Buffer> {
    if (!data || data.length === 0) {
      throw new Error('No historical data points available to generate a chart.');
    }

    // Format dates for labels
    const labels = data.map((point) => {
      const d = point.date;
      if (range === '1d') {
        // Just show hour:minute
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      } else if (range === '5d' || range === '1w') {
        // Show day and hour
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit' });
      } else {
        // Show day and month
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      }
    });

    const prices = data.map((point) => point.close);
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const isUp = endPrice >= startPrice;
    
    // Choose neon theme colors based on performance
    const lineColor = isUp ? '#10b981' : '#ef4444'; // Neon Green vs Neon Red
    const backgroundColor = isUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

    // QuickChart Chart.js config structure (v2 or v3 supported, using Chart.js v2 config format)
    const chartConfig = {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${symbol} Price`,
            data: prices,
            fill: true,
            borderColor: lineColor,
            borderWidth: 2,
            backgroundColor: backgroundColor,
            pointRadius: data.length > 50 ? 0 : 2,
            pointHoverRadius: 5,
            lineTension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: `${symbol} - ${range.toUpperCase()} Chart (${isUp ? '📈 Up' : '📉 Down'})`,
          fontColor: '#f4f4f5',
          fontSize: 16,
          fontFamily: 'Inter, sans-serif',
          padding: 15
        },
        legend: {
          display: false
        },
        scales: {
          xAxes: [
            {
              gridLines: {
                color: 'rgba(63, 63, 70, 0.4)',
                zeroLineColor: 'rgba(63, 63, 70, 0.6)'
              },
              ticks: {
                fontColor: '#a1a1aa',
                fontFamily: 'Inter, sans-serif',
                maxTicksLimit: 10
              }
            }
          ],
          yAxes: [
            {
              gridLines: {
                color: 'rgba(63, 63, 70, 0.4)',
                zeroLineColor: 'rgba(63, 63, 70, 0.6)'
              },
              ticks: {
                fontColor: '#a1a1aa',
                fontFamily: 'Inter, sans-serif',
                callback: function(value: number) {
                  // Clean display formatting for axis
                  if (value >= 1000) {
                    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  } else if (value < 1) {
                    return value.toFixed(4);
                  }
                  return value.toFixed(2);
                }
              }
            }
          ]
        }
      }
    };

    try {
      const response = await axios.post(
        'https://quickchart.io/chart',
        {
          chart: chartConfig,
          width: 800,
          height: 400,
          backgroundColor: '#18181b' // Sleek zinc-900 background
        },
        {
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      throw new Error(`Failed to generate chart image via QuickChart: ${error.message}`);
    }
  }
}
