import { HistoryDataRow, ItemMasterRow, ForecastDataRow, SafetyStockHistoryResult, SafetyStockForecastResult } from "@shared/schema";

export class SafetyStockCalculator {
  // Normal distribution inverse CDF approximation (service factor calculation)
  static normInv(p: number): number {
    // Approximation of the inverse standard normal CDF
    const a1 = -3.969683028665376e+01;
    const a2 =  2.209460984245205e+02;
    const a3 = -2.759285104469687e+02;
    const a4 =  1.383577518672690e+02;
    const a5 = -3.066479806614716e+01;
    const a6 =  2.506628277459239e+00;

    const b1 = -5.447609879822406e+01;
    const b2 =  1.615858368580409e+02;
    const b3 = -1.556989798598866e+02;
    const b4 =  6.680131188771972e+01;
    const b5 = -1.328068155288572e+01;

    const c1 = -7.784894002430293e-03;
    const c2 = -3.223964580411365e-01;
    const c3 = -2.400758277161838e+00;
    const c4 = -2.549732539343734e+00;
    const c5 =  4.374664141464968e+00;
    const c6 =  2.938163982698783e+00;

    const d1 =  7.784695709041462e-03;
    const d2 =  3.224671290700398e-01;
    const d3 =  2.445134137142996e+00;
    const d4 =  3.754408661907416e+00;

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < 0 || p > 1) {
      throw new Error("Input must be between 0 and 1");
    }

    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }

    if (p <= pHigh) {
      const q = p - 0.5;
      const r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }

    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }

  static calculateHistoryBased(
    historyData: HistoryDataRow[],
    itemMaster: ItemMasterRow[]
  ): SafetyStockHistoryResult[] {
    console.log('Starting history-based calculation with:', { 
      historyCount: historyData.length, 
      masterCount: itemMaster.length 
    });
    
    // Group history data by item and org
    const grouped = new Map<string, HistoryDataRow[]>();
    for (const row of historyData) {
      const key = `${row.ITEM_NAME}|${row.ORG_CODE}`;  // Use | instead of - to avoid splitting issues
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }

    console.log('Grouped history data into', grouped.size, 'item-org combinations');

    const results: SafetyStockHistoryResult[] = [];

    // Debug: show sample data from both sources
    console.log('Sample history data:', historyData.slice(0, 2));
    console.log('Sample master data:', itemMaster.slice(0, 2));

    for (const [key, rows] of Array.from(grouped.entries())) {
      const [itemName, orgCode] = key.split('|');
      
      console.log(`Processing item: ${itemName}, org: ${orgCode}, rows: ${rows.length}`);
      
      // Find matching master data
      const masterData = itemMaster.find(
        m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode
      );
      
      if (!masterData) {
        console.log(`No master data found for ${itemName}-${orgCode}`);
        // Debug: show available master data
        console.log('Available master items:', itemMaster.map(m => `${m.ITEM_NAME}-${m.ORG_CODE}`));
        continue;
      }
      
      console.log(`Found master data for ${itemName}-${orgCode}:`, masterData);

      // Calculate total quantity and date range
      const totalQty = rows.reduce((sum: number, row: HistoryDataRow) => sum + row.REF_QTY, 0);
      
      // Parse dates and find range
      const dates = rows.map((row: HistoryDataRow) => new Date(row.REF_DATE)).sort((a: Date, b: Date) => a.getTime() - b.getTime());
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      
      // Calculate duration in days (end of month)
      const maxMonthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
      const durationDays = Math.ceil((maxMonthEnd.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Average daily quantity
      const avgDailyQty = Math.ceil(totalQty / durationDays);

      // Create daily data array for standard deviation calculation
      const dailyData: number[] = [];
      const currentDate = new Date(minDate);
      const endDate = new Date(maxMonthEnd);

      while (currentDate <= endDate) {
        const dateStr = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getDate().toString().padStart(2, '0')}/${currentDate.getFullYear()}`;
        const matchingRow = rows.find((row: HistoryDataRow) => row.REF_DATE === dateStr);
        dailyData.push(matchingRow ? matchingRow.REF_QTY : 0);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate standard deviation
      const mean = dailyData.reduce((sum, val) => sum + val, 0) / dailyData.length;
      const variance = dailyData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyData.length;
      const stdDev = Math.sqrt(variance);

      // Calculate service factor
      const serviceFactor = this.normInv(masterData.SERVICE_LEVEL / 100);

      // Calculate safety stocks
      const ssSup = Math.ceil(avgDailyQty * masterData.SUPPLY_LEAD_TIME_VAR_DAYS);
      const ssDemand = Math.ceil(stdDev * serviceFactor * Math.sqrt(masterData.LEAD_TIME + masterData.SUPPLY_LEAD_TIME_VAR_DAYS));
      const totalSs = ssSup + ssDemand;
      const daysOfCover = totalSs / avgDailyQty;

      results.push({
        ITEM_NAME: itemName,
        ORG_CODE: orgCode,
        AVERAGE_DAILY_QTY: avgDailyQty,
        STD_DEV: stdDev,
        LEAD_TIME: masterData.LEAD_TIME,
        SUPPLY_LEAD_TIME_VAR_DAYS: masterData.SUPPLY_LEAD_TIME_VAR_DAYS,
        SERVICE_LEVEL: masterData.SERVICE_LEVEL,
        SERVICE_FACTOR: serviceFactor,
        SS_SUP: ssSup,
        SS_DEMAND: ssDemand,
        TOTAL_SS: totalSs,
        DAYS_OF_COVER: daysOfCover,
      });
    }

    return results;
  }

  static calculateForecastBased(
    forecastData: ForecastDataRow[],
    itemMaster: ItemMasterRow[]
  ): SafetyStockForecastResult[] {
    // Group forecast data by item and org
    const grouped = new Map<string, ForecastDataRow[]>();
    for (const row of forecastData) {
      const key = `${row.ITEM_NAME}|${row.ORG_CODE}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    }

    const results: SafetyStockForecastResult[] = [];

    for (const [key, rows] of Array.from(grouped.entries())) {
      const [itemName, orgCode] = key.split('|');
      
      // Find matching master data
      const masterData = itemMaster.find(
        m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode
      );
      
      if (!masterData) continue;

      // Calculate totals
      const totalQty = rows.reduce((sum: number, row: ForecastDataRow) => sum + row.REF_QTY, 0);
      
      // Calculate duration (sum of days to month end for each forecast)
      let totalDurationDays = 0;
      for (const row of rows) {
        const refDate = new Date(row.REF_DATE);
        const monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
        const durationDays = Math.ceil((monthEnd.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDurationDays += durationDays;
      }

      // Average daily forecast
      const avgDailyFcst = Math.round(totalQty / totalDurationDays);

      // Get forecast error percentage (assuming minimum from grouped data)
      const forecastErrPercent = Math.min(...rows.map(row => row.FORECAST_ERR_PERCENT));

      // Calculate service factor
      const serviceFactor = this.normInv(masterData.SERVICE_LEVEL / 100);

      // Calculate safety stock using forecast-based formula
      const safetyStock = Math.round(
        1.25 * serviceFactor * (forecastErrPercent / 100) * Math.sqrt(30) * avgDailyFcst * Math.sqrt(masterData.LEAD_TIME)
      );

      const daysOfCover = Math.round(safetyStock / avgDailyFcst);

      results.push({
        ITEM_NAME: itemName,
        ORG_CODE: orgCode,
        AVG_DAILY_FCST: avgDailyFcst,
        FORECAST_ERR_PERCENT: forecastErrPercent,
        LEAD_TIME: masterData.LEAD_TIME,
        SERVICE_LEVEL: masterData.SERVICE_LEVEL,
        SERVICE_FACTOR: serviceFactor,
        SAFETY_STOCK: safetyStock,
        DAYS_OF_COVER: daysOfCover,
      });
    }

    return results;
  }
}


// import { HistoryDataRow, ItemMasterRow, ForecastDataRow, SafetyStockHistoryResult, SafetyStockForecastResult } from "@shared/schema";

/**
 * Fixed SafetyStockCalculator
 * - normalizes dates to YYYY-MM-DD
 * - aggregates multiple rows per day (sums)
 * - builds daily series reliably from minDate -> maxMonthEnd
 * - uses population std dev (divide by N). Change to sample (N-1) if needed.
 */
// export class SafetyStockCalculator {
//   // Normal distribution inverse CDF approximation (service factor calculation)
//   static normInv(p: number): number {
//     // Approximation of the inverse standard normal CDF
//     const a1 = -3.969683028665376e+01;
//     const a2 =  2.209460984245205e+02;
//     const a3 = -2.759285104469687e+02;
//     const a4 =  1.383577518672690e+02;
//     const a5 = -3.066479806614716e+01;
//     const a6 =  2.506628277459239e+00;

//     const b1 = -5.447609879822406e+01;
//     const b2 =  1.615858368580409e+02;
//     const b3 = -1.556989798598866e+02;
//     const b4 =  6.680131188771972e+01;
//     const b5 = -1.328068155288572e+01;

//     const c1 = -7.784894002430293e-03;
//     const c2 = -3.223964580411365e-01;
//     const c3 = -2.400758277161838e+00;
//     const c4 = -2.549732539343734e+00;
//     const c5 =  4.374664141464968e+00;
//     const c6 =  2.938163982698783e+00;

//     const d1 =  7.784695709041462e-03;
//     const d2 =  3.224671290700398e-01;
//     const d3 =  2.445134137142996e+00;
//     const d4 =  3.754408661907416e+00;

//     const pLow = 0.02425;
//     const pHigh = 1 - pLow;

//     if (p < 0 || p > 1) {
//       throw new Error("Input must be between 0 and 1");
//     }

//     if (p < pLow) {
//       const q = Math.sqrt(-2 * Math.log(p));
//       return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
//         ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
//     }

//     if (p <= pHigh) {
//       const q = p - 0.5;
//       const r = q * q;
//       return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
//         (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
//     }

//     const q = Math.sqrt(-2 * Math.log(1 - p));
//     return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
//       ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
//   }

//   // Helper: robust date parse -> returns Date or null
//   private static parseDateFlexible(dateInput: string | Date | undefined): Date | null {
//     if (!dateInput) return null;
//     if (dateInput instanceof Date) {
//       return isNaN(dateInput.getTime()) ? null : dateInput;
//     }
//     // Try native parse first
//     const d1 = new Date(dateInput);
//     if (!isNaN(d1.getTime())) return d1;

//     // Try MM/DD/YYYY explicit parse (common in your CSVs)
//     const parts = (dateInput + "").split('/');
//     if (parts.length === 3) {
//       const m = parseInt(parts[0], 10);
//       const d = parseInt(parts[1], 10);
//       const y = parseInt(parts[2], 10);
//       if (!Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(y)) {
//         const d2 = new Date(y, m - 1, d);
//         if (!isNaN(d2.getTime())) return d2;
//       }
//     }

//     // Try ISO fallback
//     const d2 = new Date(dateInput);
//     return isNaN(d2.getTime()) ? null : d2;
//   }

//   // Normalize date to YYYY-MM-DD
//   private static toIsoDate(d: Date): string {
//     return d.toISOString().slice(0, 10);
//   }

//   static calculateHistoryBased(
//     historyData: HistoryDataRow[],
//     itemMaster: ItemMasterRow[]
//   ): SafetyStockHistoryResult[] {
//     console.log('Starting history-based calculation with:', { 
//       historyCount: historyData.length, 
//       masterCount: itemMaster.length 
//     });

//     // Group history data by item and org
//     const grouped = new Map<string, HistoryDataRow[]>();
//     for (const row of historyData) {
//       const key = `${row.ITEM_NAME}|${row.ORG_CODE}`;
//       if (!grouped.has(key)) grouped.set(key, []);
//       grouped.get(key)!.push(row);
//     }

//     console.log('Grouped history data into', grouped.size, 'item-org combinations');

//     const results: SafetyStockHistoryResult[] = [];

//     // Debug: show sample data from both sources
//     console.log('Sample history data:', historyData.slice(0, 2));
//     console.log('Sample master data:', itemMaster.slice(0, 2));

//     for (const [key, rows] of Array.from(grouped.entries())) {
//       const [itemName, orgCode] = key.split('|');

//       console.log(`Processing item: ${itemName}, org: ${orgCode}, rows: ${rows.length}`);

//       // Find matching master data
//       const masterData = itemMaster.find(
//         m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode
//       );

//       if (!masterData) {
//         console.log(`No master data found for ${itemName}-${orgCode}`);
//         console.log('Available master items:', itemMaster.map(m => `${m.ITEM_NAME}-${m.ORG_CODE}`));
//         continue;
//       }

//       console.log(`Found master data for ${itemName}-${orgCode}:`, masterData);

//       // Parse all input dates and build date-qty aggregation (sum multiple per day)
//       const qtyByIsoDate = new Map<string, number>();
//       let minDate: Date | null = null;
//       let maxDate: Date | null = null;
//       let totalQty = 0;

//       for (const r of rows) {
//         const parsed = this.parseDateFlexible(r.REF_DATE as any);
//         if (!parsed) {
//           console.warn(`Skipping row with invalid date for ${itemName}-${orgCode}:`, r.REF_DATE);
//           continue;
//         }
//         const iso = this.toIsoDate(parsed);
//         const qty = Number(r.REF_QTY) || 0;
//         qtyByIsoDate.set(iso, (qtyByIsoDate.get(iso) || 0) + qty);

//         totalQty += qty;

//         if (!minDate || parsed.getTime() < minDate.getTime()) minDate = parsed;
//         if (!maxDate || parsed.getTime() > maxDate.getTime()) maxDate = parsed;
//       }

//       if (!minDate || !maxDate) {
//         console.warn(`No valid dates found for ${itemName}-${orgCode}, skipping.`);
//         continue;
//       }

//       // Calculate duration in days: up to month end of maxDate
//       const maxMonthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0); // month end
//       const durationDays = Math.ceil((maxMonthEnd.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
//       if (durationDays <= 0) {
//         console.warn(`Non-positive durationDays for ${itemName}-${orgCode}. minDate=${minDate}, maxMonthEnd=${maxMonthEnd}`);
//         continue;
//       }

//       // Average daily quantity (ceil to match Python behavior)
//       const avgDailyQty = Math.ceil(totalQty / durationDays);

//       // Build daily series from minDate to maxMonthEnd using iso date map
//       const dailyData: number[] = [];
//       const current = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
//       const end = new Date(maxMonthEnd.getFullYear(), maxMonthEnd.getMonth(), maxMonthEnd.getDate());
//       while (current <= end) {
//         const iso = this.toIsoDate(current);
//         dailyData.push(qtyByIsoDate.get(iso) || 0);
//         current.setDate(current.getDate() + 1);
//       }

//       // Calculate population standard deviation (divide by N). If you want sample std dev, use N-1.
//       const n = dailyData.length;
//       const mean = dailyData.reduce((s, v) => s + v, 0) / n;
//       // population variance:
//       const variance = dailyData.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
//       const stdDev = Math.sqrt(variance);

//       // Compute service factor (normInv takes probabilities between 0 and 1)
//       const serviceLevelFraction = (Number(masterData.SERVICE_LEVEL) || 0) / 100;
//       const serviceFactor = this.normInv(serviceLevelFraction);

//       // Calculate safety stocks
//       const ssSup = Math.ceil(avgDailyQty * (Number(masterData.SUPPLY_LEAD_TIME_VAR_DAYS) || 0));
//       const leadTime = Number(masterData.LEAD_TIME) || 0;
//       const ssDemand = Math.ceil(stdDev * serviceFactor * Math.sqrt(leadTime + (Number(masterData.SUPPLY_LEAD_TIME_VAR_DAYS) || 0)));
//       const totalSs = ssSup + ssDemand;
//       const daysOfCover = avgDailyQty > 0 ? totalSs / avgDailyQty : null;

//       results.push({
//         ITEM_NAME: itemName,
//         ORG_CODE: orgCode,
//         AVERAGE_DAILY_QTY: avgDailyQty,
//         STD_DEV: stdDev,
//         LEAD_TIME: leadTime,
//         SUPPLY_LEAD_TIME_VAR_DAYS: Number(masterData.SUPPLY_LEAD_TIME_VAR_DAYS) || 0,
//         SERVICE_LEVEL: Number(masterData.SERVICE_LEVEL) || 0,
//         SERVICE_FACTOR: serviceFactor,
//         SS_SUP: ssSup,
//         SS_DEMAND: ssDemand,
//         TOTAL_SS: totalSs,
//         DAYS_OF_COVER: daysOfCover === null ? 0 : daysOfCover,
//       });

//       // Helpful debug log to match Python outputs for a sample item
//       console.log({
//         item: itemName,
//         org: orgCode,
//         minDate: minDate.toISOString().slice(0,10),
//         maxMonthEnd: maxMonthEnd.toISOString().slice(0,10),
//         durationDays,
//         totalQty,
//         avgDailyQty,
//         stdDev,
//         serviceFactor,
//         ssSup,
//         ssDemand,
//         totalSs
//       });
//     }

//     return results;
//   }

//   static calculateForecastBased(
//     forecastData: ForecastDataRow[],
//     itemMaster: ItemMasterRow[]
//   ): SafetyStockForecastResult[] {
//     // Group forecast data by item and org
//     const grouped = new Map<string, ForecastDataRow[]>();
//     for (const row of forecastData) {
//       const key = `${row.ITEM_NAME}|${row.ORG_CODE}`;
//       if (!grouped.has(key)) grouped.set(key, []);
//       grouped.get(key)!.push(row);
//     }

//     const results: SafetyStockForecastResult[] = [];

//     for (const [key, rows] of Array.from(grouped.entries())) {
//       const [itemName, orgCode] = key.split('|');

//       // Find matching master data
//       const masterData = itemMaster.find(
//         m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode
//       );

//       if (!masterData) continue;

//       // Parse dates robustly and compute for each forecast row the days to month end
//       let totalQty = 0;
//       let totalDurationDays = 0;
//       const errPercents: number[] = [];

//       for (const r of rows) {
//         const parsed = this.parseDateFlexible(r.REF_DATE as any);
//         if (!parsed) {
//           console.warn(`Skipping forecast row with invalid date for ${itemName}-${orgCode}:`, r.REF_DATE);
//           continue;
//         }
//         const monthEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0);
//         const durationDays = Math.ceil((monthEnd.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
//         totalDurationDays += durationDays;
//         totalQty += Number(r.REF_QTY) || 0;
//         if (r.FORECAST_ERR_PERCENT !== undefined && r.FORECAST_ERR_PERCENT !== null) {
//           errPercents.push(Number(r.FORECAST_ERR_PERCENT));
//         }
//       }

//       if (totalDurationDays <= 0) {
//         console.warn(`No duration calculated for forecast item ${itemName}-${orgCode}. Skipping.`);
//         continue;
//       }

//       // Average daily forecast (rounded as in your Python code)
//       const avgDailyFcst = Math.round(totalQty / totalDurationDays) || 0;

//       // Forecast error percent - you used min in both implementations; keep same logic
//       const forecastErrPercent = errPercents.length ? Math.min(...errPercents) : 0;

//       const serviceFactor = this.normInv((Number(masterData.SERVICE_LEVEL) || 0) / 100);

//       const leadTime = Number(masterData.LEAD_TIME) || 0;

//       const safetyStock = Math.round(
//         1.25 * serviceFactor * (forecastErrPercent / 100) * Math.sqrt(30) * avgDailyFcst * Math.sqrt(leadTime)
//       );

//       const daysOfCover = avgDailyFcst > 0 ? Math.round(safetyStock / avgDailyFcst) : null;

//       results.push({
//         ITEM_NAME: itemName,
//         ORG_CODE: orgCode,
//         AVG_DAILY_FCST: avgDailyFcst,
//         FORECAST_ERR_PERCENT: forecastErrPercent,
//         LEAD_TIME: leadTime,
//         SERVICE_LEVEL: Number(masterData.SERVICE_LEVEL) || 0,
//         SERVICE_FACTOR: serviceFactor,
//         SAFETY_STOCK: safetyStock,
//         DAYS_OF_COVER: daysOfCover === null ? 0 : daysOfCover,
//       });

//       // Optional debug
//       console.log({
//         item: itemName,
//         org: orgCode,
//         totalQty,
//         totalDurationDays,
//         avgDailyFcst,
//         forecastErrPercent,
//         serviceFactor,
//         safetyStock,
//       });
//     }

//     return results;
//   }
// }
