import { SafetyStockHistoryResult, SafetyStockForecastResult, ItemMasterRow, MinMaxResult } from "@shared/schema";

/**
 * MinMaxCalculator
 * 
 * Calculates Min (Reorder Point) and Max (Maximum Stock Level) based on:
 * - Min = Safety Stock + (Average Daily Demand × Lead Time)
 * - Max = Min + Order Quantity (or Min + Average Daily Demand × Review Period)
 */
export class MinMaxCalculator {
  /**
   * Calculate Min-Max levels from history-based safety stock results
   */
  static calculateFromHistory(
    safetyStockResults: SafetyStockHistoryResult[],
    reviewPeriodDays: number = 30
  ): MinMaxResult[] {
    const results: MinMaxResult[] = [];

    for (const ss of safetyStockResults) {
      // Min (Reorder Point) = Safety Stock + (Average Daily Demand × Lead Time)
      const minLevel = Math.ceil(
        ss.TOTAL_SS + (ss.AVERAGE_DAILY_QTY * ss.LEAD_TIME)
      );

      // Order Quantity = Average Daily Demand × Review Period
      const orderQuantity = Math.ceil(ss.AVERAGE_DAILY_QTY * reviewPeriodDays);

      // Max (Maximum Stock Level) = Min + Order Quantity
      const maxLevel = Math.ceil(minLevel + orderQuantity);

      results.push({
        ITEM_NAME: ss.ITEM_NAME,
        ORG_CODE: ss.ORG_CODE,
        AVERAGE_DAILY_QTY: ss.AVERAGE_DAILY_QTY,
        LEAD_TIME: ss.LEAD_TIME,
        SAFETY_STOCK: ss.TOTAL_SS,
        MIN_LEVEL: minLevel,
        MAX_LEVEL: maxLevel,
        ORDER_QUANTITY: orderQuantity,
        REVIEW_PERIOD_DAYS: reviewPeriodDays,
      });
    }

    return results;
  }

  /**
   * Calculate Min-Max levels from forecast-based safety stock results
   */
  static calculateFromForecast(
    forecastResults: SafetyStockForecastResult[],
    reviewPeriodDays: number = 30
  ): MinMaxResult[] {
    const results: MinMaxResult[] = [];

    for (const fcst of forecastResults) {
      // Min (Reorder Point) = Safety Stock + (Average Daily Forecast × Lead Time)
      const minLevel = Math.ceil(
        fcst.SAFETY_STOCK + (fcst.AVG_DAILY_FCST * fcst.LEAD_TIME)
      );

      // Order Quantity = Average Daily Forecast × Review Period
      const orderQuantity = Math.ceil(fcst.AVG_DAILY_FCST * reviewPeriodDays);

      // Max (Maximum Stock Level) = Min + Order Quantity
      const maxLevel = Math.ceil(minLevel + orderQuantity);

      results.push({
        ITEM_NAME: fcst.ITEM_NAME,
        ORG_CODE: fcst.ORG_CODE,
        AVERAGE_DAILY_QTY: fcst.AVG_DAILY_FCST,
        LEAD_TIME: fcst.LEAD_TIME,
        SAFETY_STOCK: fcst.SAFETY_STOCK,
        MIN_LEVEL: minLevel,
        MAX_LEVEL: maxLevel,
        ORDER_QUANTITY: orderQuantity,
        REVIEW_PERIOD_DAYS: reviewPeriodDays,
      });
    }

    return results;
  }

  /**
   * Calculate Min-Max levels directly from history data and item master
   * (Alternative method that doesn't require pre-calculated safety stock)
   */
  static calculateDirect(
    historyData: Array<{ ITEM_NAME: string; ORG_CODE: string; REF_DATE: string; REF_QTY: number }>,
    itemMaster: ItemMasterRow[],
    reviewPeriodDays: number = 30
  ): MinMaxResult[] {
    // Group history by item and org
    const grouped = new Map<string, Array<{ REF_DATE: string; REF_QTY: number }>>();
    
    for (const row of historyData) {
      const key = `${row.ITEM_NAME}|${row.ORG_CODE}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push({ REF_DATE: row.REF_DATE, REF_QTY: row.REF_QTY });
    }

    const results: MinMaxResult[] = [];

    for (const [key, rows] of grouped.entries()) {
      const [itemName, orgCode] = key.split('|');
      
      // Find matching item master
      const master = itemMaster.find(
        m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode
      );

      if (!master) {
        console.warn(`No master data found for ${itemName}-${orgCode}`);
        continue;
      }

      // Calculate total quantity and date range
      const totalQty = rows.reduce((sum, r) => sum + r.REF_QTY, 0);
      
      // Parse dates
      const dates = rows.map(r => {
        const d = this.parseDate(r.REF_DATE);
        return d ? d.getTime() : 0;
      }).filter(t => t > 0).sort((a, b) => a - b);

      if (dates.length === 0) continue;

      const minDate = new Date(dates[0]);
      const maxDate = new Date(dates[dates.length - 1]);
      
      // Calculate duration (end of month of max date)
      const maxMonthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
      const durationDays = Math.ceil(
        (maxMonthEnd.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (durationDays <= 0) continue;

      // Average daily quantity
      const avgDailyQty = Math.ceil(totalQty / durationDays);

      // For simplicity, use a basic safety stock calculation
      // SS = Average Daily Qty × Supply Lead Time Var Days
      const safetyStock = Math.ceil(
        avgDailyQty * (master.SUPPLY_LEAD_TIME_VAR_DAYS || 0)
      );

      // Min (Reorder Point) = Safety Stock + (Average Daily Demand × Lead Time)
      const minLevel = Math.ceil(safetyStock + (avgDailyQty * master.LEAD_TIME));

      // Order Quantity = Average Daily Demand × Review Period
      const orderQuantity = Math.ceil(avgDailyQty * reviewPeriodDays);

      // Max (Maximum Stock Level) = Min + Order Quantity
      const maxLevel = Math.ceil(minLevel + orderQuantity);

      results.push({
        ITEM_NAME: itemName,
        ORG_CODE: orgCode,
        AVERAGE_DAILY_QTY: avgDailyQty,
        LEAD_TIME: master.LEAD_TIME,
        SAFETY_STOCK: safetyStock,
        MIN_LEVEL: minLevel,
        MAX_LEVEL: maxLevel,
        ORDER_QUANTITY: orderQuantity,
        REVIEW_PERIOD_DAYS: reviewPeriodDays,
      });
    }

    return results;
  }

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
}

