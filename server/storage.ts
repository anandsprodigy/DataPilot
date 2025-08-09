import { type Calculation, type InsertCalculation } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  createCalculation(calculation: InsertCalculation): Promise<Calculation>;
  getCalculation(id: string): Promise<Calculation | undefined>;
  updateCalculation(id: string, updates: Partial<Calculation>): Promise<Calculation>;
  deleteCalculation(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private calculations: Map<string, Calculation>;

  constructor() {
    this.calculations = new Map();
  }

  async createCalculation(insertCalculation: InsertCalculation): Promise<Calculation> {
    const id = randomUUID();
    const calculation: Calculation = { 
      ...insertCalculation, 
      id,
      status: "pending",
      historyResults: null,
      forecastResults: null,
      forecastData: insertCalculation.forecastData || null,
      createdAt: new Date().toISOString()
    };
    this.calculations.set(id, calculation);
    return calculation;
  }

  async getCalculation(id: string): Promise<Calculation | undefined> {
    return this.calculations.get(id);
  }

  async updateCalculation(id: string, updates: Partial<Calculation>): Promise<Calculation> {
    const existing = this.calculations.get(id);
    if (!existing) {
      throw new Error("Calculation not found");
    }
    const updated = { ...existing, ...updates };
    this.calculations.set(id, updated);
    return updated;
  }

  async deleteCalculation(id: string): Promise<boolean> {
    return this.calculations.delete(id);
  }
}

export const storage = new MemStorage();
