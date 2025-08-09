import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const calculations = pgTable("calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  historyData: text("history_data").notNull(),
  itemMaster: text("item_master").notNull(),
  forecastData: text("forecast_data"),
  historyResults: text("history_results"),
  forecastResults: text("forecast_results"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: text("created_at").default(sql`now()`),
});

export const insertCalculationSchema = createInsertSchema(calculations).pick({
  historyData: true,
  itemMaster: true,
  forecastData: true,
});

export type InsertCalculation = z.infer<typeof insertCalculationSchema>;
export type Calculation = typeof calculations.$inferSelect;

// CSV Data Types
export interface HistoryDataRow {
  ITEM_NAME: string;
  ORG_CODE: string;
  REF_DATE: string;
  REF_QTY: number;
}

export interface ItemMasterRow {
  ITEM_NAME: string;
  ORG_CODE: string;
  SUPPLY_LEAD_TIME_VAR_DAYS: number;
  SERVICE_LEVEL: number;
  LEAD_TIME: number;
}

export interface ForecastDataRow {
  ITEM_NAME: string;
  ORG_CODE: string;
  REF_DATE: string;
  REF_QTY: number;
  ERROR_TYPE: string;
  FORECAST_ERR_PERCENT: number;
}

export interface SafetyStockHistoryResult {
  ITEM_NAME: string;
  ORG_CODE: string;
  AVERAGE_DAILY_QTY: number;
  STD_DEV: number;
  LEAD_TIME: number;
  SUPPLY_LEAD_TIME_VAR_DAYS: number;
  SERVICE_LEVEL: number;
  SERVICE_FACTOR: number;
  SS_SUP: number;
  SS_DEMAND: number;
  TOTAL_SS: number;
  DAYS_OF_COVER: number;
}

export interface SafetyStockForecastResult {
  ITEM_NAME: string;
  ORG_CODE: string;
  AVG_DAILY_FCST: number;
  FORECAST_ERR_PERCENT: number;
  LEAD_TIME: number;
  SERVICE_LEVEL: number;
  SERVICE_FACTOR: number;
  SAFETY_STOCK: number;
  DAYS_OF_COVER: number;
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  recordCount?: number;
  preview?: any[];
}

export interface CalculationProgress {
  step: 'validation' | 'history-calc' | 'forecast-calc' | 'complete';
  progress: number;
  message: string;
  historyResults?: SafetyStockHistoryResult[];
  forecastResults?: SafetyStockForecastResult[];
}
