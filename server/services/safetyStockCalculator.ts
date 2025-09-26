import { HistoryDataRow, ItemMasterRow, ForecastDataRow, SafetyStockHistoryResult, SafetyStockForecastResult } from "@shared/schema";

/**
 * SafetyStockCalculator -- Python-matching behavior
 *
 * Key detail: when building daily samples for std-dev, if there are multiple
 * history rows for the same calendar date, include each row as a separate
 * sample in the daily samples array (this mirrors the Python merge behaviour).
 *
 * If no rows for a date, include a single 0 for that date.
 *
 * Population std-dev (divide by N) is used to match np.std default.
 */
export class SafetyStockCalculator {
  // Inverse normal approximation (same as you used)
  static normInv(p: number): number {
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

    if (p < 0 || p > 1) throw new Error("Input must be between 0 and 1");

    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c1*q + c2)*q + c3)*q + c4)*q + c5)*q + c6) /
             ((((d1*q + d2)*q + d3)*q + d4)*q + 1);
    }

    if (p <= pHigh) {
      const q = p - 0.5;
      const r = q * q;
      return (((((a1*r + a2)*r + a3)*r + a4)*r + a5)*r + a6) * q /
             (((((b1*r + b2)*r + b3)*r + b4)*r + b5)*r + 1);
    }

    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1*q + c2)*q + c3)*q + c4)*q + c5)*q + c6) /
           ((((d1*q + d2)*q + d3)*q + d4)*q + 1);
  }

  // Strict MM/DD/YYYY parse first (to match pd.to_datetime(format="%m/%d/%Y")), fallback to Date
  private static parseDate(dateInput?: string | Date): Date | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

    const s = String(dateInput).trim();
    const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
    const m = s.match(mmddyyyy);
    if (m) {
      const mm = parseInt(m[1], 10);
      const dd = parseInt(m[2], 10);
      let yyyy = parseInt(m[3], 10);
      if (yyyy < 100) yyyy += 2000;
      const d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }

    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
  }

  private static iso(d: Date) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  static calculateHistoryBased(historyData: HistoryDataRow[], itemMaster: ItemMasterRow[]): SafetyStockHistoryResult[] {
    console.log('History calc start', { history: historyData.length, master: itemMaster.length });

    // Group history rows by item|org
    const grouped = new Map<string, HistoryDataRow[]>();
    for (const r of historyData) {
      const k = `${r.ITEM_NAME}|${r.ORG_CODE}`;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    }

    const results: SafetyStockHistoryResult[] = [];

    // Fix for downlevelIteration: use Array.from to iterate Map
    for (const [key, rows] of Array.from(grouped.entries())) {
      const [itemName, orgCode] = key.split('|');

      const master = itemMaster.find(m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode);
      if (!master) {
        console.warn(`No master for ${itemName}-${orgCode}`);
        continue;
      }

      // Build a map from ISO date -> array of quantities (do NOT sum them)
      const qtyArrays = new Map<string, number[]>();
      let minDate: Date | null = null;
      let maxDate: Date | null = null;
      let totalQty = 0;

      for (const r of rows) {
        const parsed = this.parseDate(r.REF_DATE as any);
        if (!parsed) {
          console.warn('Skipping invalid date row', { itemName, orgCode, date: r.REF_DATE });
          continue;
        }
        const iso = this.iso(parsed);
        const qty = Number(r.REF_QTY) || 0;
        if (!qtyArrays.has(iso)) qtyArrays.set(iso, []);
        qtyArrays.get(iso)!.push(qty);

        totalQty += qty;
        if (!minDate || parsed.getTime() < minDate.getTime()) minDate = parsed;
        if (!maxDate || parsed.getTime() > maxDate.getTime()) maxDate = parsed;
      }

      if (!minDate || !maxDate) {
        console.warn('No valid date range for', itemName, orgCode);
        continue;
      }

      // MAX_MONTH_END as in Python: end of the month of maxDate
      const maxMonthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

      const msPerDay = 1000 * 60 * 60 * 24;
      // Python used (MAX_MONTH_END - min).dt.days (integer), so use floor
      const durationDays = Math.floor((maxMonthEnd.getTime() - minDate.getTime()) / msPerDay);

      if (durationDays <= 0) {
        console.warn('Non-positive durationDays', { itemName, orgCode, durationDays, minDate, maxMonthEnd });
        continue;
      }

      // Average daily qty: ceil(totalQty / durationDays) (to match Python np.ceil)
      const avgDailyQty = Math.ceil(totalQty / durationDays);

      // Build daily samples: iterate inclusive from minDate -> maxMonthEnd
      // For each date:
      //   - if qtyArrays has multiple entries for date => push each value separately
      //   - if no entries => push single 0
      const samples: number[] = [];
      const cur = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
      const end = new Date(maxMonthEnd.getFullYear(), maxMonthEnd.getMonth(), maxMonthEnd.getDate());
      while (cur <= end) {
        const isoCur = this.iso(cur);
        const arr = qtyArrays.get(isoCur);
        if (!arr || arr.length === 0) {
          samples.push(0);
        } else {
          // include each matching row as separate sample (matches Python merge result)
          for (const v of arr) samples.push(v);
        }
        cur.setDate(cur.getDate() + 1);
      }

      // population std-dev (divide by N) to match np.std default
      const n = samples.length;
      const mean = n ? (samples.reduce((s, v) => s + v, 0) / n) : 0;
      const variance = n ? (samples.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n) : 0;
      const stdDev = Math.sqrt(variance);

      const serviceLevelFrac = (Number(master.SERVICE_LEVEL) || 0) / 100;
      const serviceFactor = this.normInv(serviceLevelFrac);

      const ssSup = Math.ceil(avgDailyQty * (Number(master.SUPPLY_LEAD_TIME_VAR_DAYS) || 0));
      const leadTime = Number(master.LEAD_TIME) || 0;
      const supplyVar = Number(master.SUPPLY_LEAD_TIME_VAR_DAYS) || 0;

      const ssDemand = Math.ceil(stdDev * serviceFactor * Math.sqrt(leadTime + supplyVar));
      const totalSs = ssSup + ssDemand;
      const daysOfCover = avgDailyQty > 0 ? totalSs / avgDailyQty : null;

      results.push({
        ITEM_NAME: itemName,
        ORG_CODE: orgCode,
        AVERAGE_DAILY_QTY: avgDailyQty,
        STD_DEV: stdDev,
        LEAD_TIME: leadTime,
        SUPPLY_LEAD_TIME_VAR_DAYS: supplyVar,
        SERVICE_LEVEL: Number(master.SERVICE_LEVEL) || 0,
        SERVICE_FACTOR: serviceFactor,
        SS_SUP: ssSup,
        SS_DEMAND: ssDemand,
        TOTAL_SS: totalSs,
        DAYS_OF_COVER: daysOfCover === null ? 0 : daysOfCover,
      });

      // optional debug
      console.log({
        item: itemName,
        org: orgCode,
        minDate: minDate.toISOString().slice(0,10),
        maxMonthEnd: maxMonthEnd.toISOString().slice(0,10),
        durationDays,
        totalQty,
        avgDailyQty,
        samplesCount: n,
        stdDev,
        ssSup,
        ssDemand,
        totalSs
      });
    }

    return results;
  }

  static calculateForecastBased(forecastData: ForecastDataRow[], itemMaster: ItemMasterRow[]): SafetyStockForecastResult[] {
    // Group forecast by item/org
    const grouped = new Map<string, ForecastDataRow[]>();
    for (const r of forecastData) {
      const k = `${r.ITEM_NAME}|${r.ORG_CODE}`;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(r);
    }

    const results: SafetyStockForecastResult[] = [];

    // Fix for downlevelIteration: use Array.from to iterate Map
    for (const [key, rows] of Array.from(grouped.entries())) {
      const [itemName, orgCode] = key.split('|');
      const master = itemMaster.find(m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode);
      if (!master) continue;

      let totalQty = 0;
      let totalDurationDays = 0;
      const errPercents: number[] = [];

      for (const r of rows) {
        const parsed = this.parseDate(r.REF_DATE as any);
        if (!parsed) {
          console.warn('Skipping invalid forecast date', r.REF_DATE);
          continue;
        }
        const monthEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0);
        const msPerDay = 1000 * 60 * 60 * 24;
        // Python used ceil here when computing durationDays per row
        const durationDays = Math.ceil((monthEnd.getTime() - parsed.getTime()) / msPerDay);
        totalDurationDays += durationDays;
        totalQty += Number(r.REF_QTY) || 0;
        if (r.FORECAST_ERR_PERCENT !== undefined && r.FORECAST_ERR_PERCENT !== null) errPercents.push(Number(r.FORECAST_ERR_PERCENT));
      }

      if (totalDurationDays <= 0) continue;

      // avg daily forecast rounding matches Python .round(0)
      const avgDailyFcst = Math.round(totalQty / totalDurationDays);
      const forecastErrPercent = errPercents.length ? Math.min(...errPercents) : 0;

      const serviceFactor = this.normInv((Number(master.SERVICE_LEVEL) || 0) / 100);
      const leadTime = Number(master.LEAD_TIME) || 0;

      const safetyStock = Math.round(
        1.25 * serviceFactor * (forecastErrPercent / 100) * Math.sqrt(30) * avgDailyFcst * Math.sqrt(leadTime)
      );

      const daysOfCover = avgDailyFcst > 0 ? Math.round(safetyStock / avgDailyFcst) : null;

      results.push({
        ITEM_NAME: itemName,
        ORG_CODE: orgCode,
        AVG_DAILY_FCST: avgDailyFcst,
        FORECAST_ERR_PERCENT: forecastErrPercent,
        LEAD_TIME: leadTime,
        SERVICE_LEVEL: Number(master.SERVICE_LEVEL) || 0,
        SERVICE_FACTOR: serviceFactor,
        SAFETY_STOCK: safetyStock,
        DAYS_OF_COVER: daysOfCover === null ? 0 : daysOfCover,
      });
    }

    return results;
  }
}
