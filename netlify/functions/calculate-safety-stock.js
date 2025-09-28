// SafetyStockCalculator implementation
class SafetyStockCalculator {
  // Inverse normal approximation
  static normInv(p) {
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

  static parseDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

    const s = String(dateInput).trim();
    const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
    const m = s.match(mmddyyyy);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      let yyyy = parseInt(m[3], 10);
      if (yyyy < 100) yyyy += 2000;
      const d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }

    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? null : d2;
  }

  static iso(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  static calculateHistoryBased(historyData, itemMaster) {
    // Group history by item|org
    const grouped = new Map();
    for (const r of historyData) {
      const k = `${r.ITEM_NAME}|${r.ORG_CODE}`;
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(r);
    }

    const results = [];

    for (const [key, rows] of Array.from(grouped.entries())) {
      const [itemName, orgCode] = key.split('|');

      const master = itemMaster.find(m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode);
      if (!master) continue;

      // Build a map from ISO date -> array of quantities
      const qtyArrays = new Map();
      let minDate = null;
      let maxDate = null;
      let totalQty = 0;

      for (const r of rows) {
        const parsed = this.parseDate(r.REF_DATE);
        if (!parsed) continue;
        
        const iso = this.iso(parsed);
        const qty = Number(r.REF_QTY) || 0;
        if (!qtyArrays.has(iso)) qtyArrays.set(iso, []);
        qtyArrays.get(iso).push(qty);

        totalQty += qty;
        if (!minDate || parsed.getTime() < minDate.getTime()) minDate = parsed;
        if (!maxDate || parsed.getTime() > maxDate.getTime()) maxDate = parsed;
      }

      if (!minDate || !maxDate) continue;

      const maxMonthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
      const durationDays = Math.ceil((maxMonthEnd.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

      if (durationDays <= 0) continue;

      const avgDailyQty = Math.ceil(totalQty / durationDays);

      // Build daily samples
      const dailyData = [];
      const currentDate = new Date(minDate);
      const endDate = new Date(maxMonthEnd);

      while (currentDate <= endDate) {
        const isoCur = this.iso(currentDate);
        const arr = qtyArrays.get(isoCur);
        if (!arr || arr.length === 0) {
          dailyData.push(0);
        } else {
          for (const v of arr) dailyData.push(v);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate standard deviation
      const mean = dailyData.length ? dailyData.reduce((sum, val) => sum + val, 0) / dailyData.length : 0;
      const variance = dailyData.length ? dailyData.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyData.length : 0;
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
        DAYS_OF_COVER: daysOfCover
      });
    }

    return results;
  }
}

// Netlify Function Handler
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const { historyData, itemMaster } = JSON.parse(event.body);
    const results = SafetyStockCalculator.calculateHistoryBased(historyData, itemMaster);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',  // Add CORS headers
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(results)
    };
  } catch (error) {
    console.error('Error in safety stock calculation:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',  // Add CORS headers
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};