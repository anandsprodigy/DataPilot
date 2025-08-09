import { type Calculation, type InsertCalculation, calculations, uploadedFiles } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createCalculation(calculation: InsertCalculation): Promise<Calculation>;
  getCalculation(id: string): Promise<Calculation | undefined>;
  updateCalculation(id: string, updates: Partial<Calculation>): Promise<Calculation>;
  deleteCalculation(id: string): Promise<boolean>;
  storeFile(fileName: string, fileType: string, content: string, recordCount: number, previewData: any[]): Promise<string>;
  getFile(id: string): Promise<any>;
  clearAllFiles(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createCalculation(insertCalculation: InsertCalculation): Promise<Calculation> {
    const [calculation] = await db
      .insert(calculations)
      .values(insertCalculation)
      .returning();
    return calculation;
  }

  async getCalculation(id: string): Promise<Calculation | undefined> {
    const [calculation] = await db
      .select()
      .from(calculations)
      .where(eq(calculations.id, id));
    return calculation || undefined;
  }

  async updateCalculation(id: string, updates: Partial<Calculation>): Promise<Calculation> {
    const [calculation] = await db
      .update(calculations)
      .set(updates)
      .where(eq(calculations.id, id))
      .returning();
    
    if (!calculation) {
      throw new Error("Calculation not found");
    }
    
    return calculation;
  }

  async deleteCalculation(id: string): Promise<boolean> {
    const result = await db
      .delete(calculations)
      .where(eq(calculations.id, id));
    return (result.rowCount || 0) > 0;
  }

  // File storage methods
  async storeFile(fileName: string, fileType: string, content: string, recordCount: number, previewData: any[]): Promise<string> {
    const [file] = await db
      .insert(uploadedFiles)
      .values({
        fileName,
        fileType,
        content,
        recordCount,
        previewData: JSON.stringify(previewData)
      })
      .returning();
    return file.id;
  }

  async getFile(id: string): Promise<any> {
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, id));
    
    if (file) {
      return {
        ...file,
        previewData: JSON.parse(file.previewData)
      };
    }
    return undefined;
  }

  async clearAllFiles(): Promise<void> {
    await db.delete(uploadedFiles);
    await db.delete(calculations);
  }
}

export const storage = new DatabaseStorage();
