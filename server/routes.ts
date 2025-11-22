import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import {
  type FileUploadResponse,
  type CalculationProgress,
} from "@shared/schema";
import { CSVParser } from "./services/csvParser";
import { SafetyStockCalculator } from "./services/safetyStockCalculator";
import { MinMaxCalculator } from "./services/minMaxCalculator";
import multer from "multer";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

interface MulterRequest extends Request {
  files?:
    | { [fieldname: string]: Express.Multer.File[] }
    | Express.Multer.File[];
}

// Create directories if they don't exist
const uploadDir = path.join(process.cwd(), "uploads");
const resultsDir = path.join(process.cwd(), "results");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// In-memory calculation tracking
const calculations = new Map<
  string,
  {
    id: string;
    status: string;
    historyResults?: any[];
    forecastResults?: any[];
    createdAt: Date;
  }
>();

function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function clearAllFiles() {
  // Clear uploads directory
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
      fs.unlinkSync(path.join(uploadDir, file));
    }
  }

  // Clear results directory
  if (fs.existsSync(resultsDir)) {
    const files = fs.readdirSync(resultsDir);
    for (const file of files) {
      fs.unlinkSync(path.join(resultsDir, file));
    }
  }

  // Clear calculations memory
  calculations.clear();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload and validate CSV files
  app.post(
    "/api/upload",
    upload.fields([
      { name: "historyData", maxCount: 1 },
      { name: "itemMaster", maxCount: 1 },
      { name: "forecastData", maxCount: 1 },
      { name: "supplyDemandData", maxCount: 1 },
    ]),
    async (req: MulterRequest, res) => {
      try {
        const files = req.files;
        console.log("Upload request received:", {
          files: files ? Object.keys(files) : "no files",
        });
        const responses: { [key: string]: FileUploadResponse } = {};

        if (!files || Object.keys(files).length === 0) {
          console.log("No files received in upload request");
          return res.json({});
        }

        for (const [fieldName, fileArray] of Object.entries(
          files as { [key: string]: Express.Multer.File[] },
        )) {
          if (Array.isArray(fileArray) && fileArray.length > 0) {
            const file = fileArray[0];
            const csvText = file.buffer.toString("utf8");

            try {
              // Save file to uploads directory
              const fileName = `${fieldName}.csv`;
              const filePath = path.join(uploadDir, fileName);
              fs.writeFileSync(filePath, csvText);

              let data: any[] = [];
              let recordCount = 0;

              switch (fieldName) {
                case "historyData":
                  data = CSVParser.parseHistoryData(csvText);
                  recordCount = data.length;
                  break;
                case "itemMaster":
                  data = CSVParser.parseItemMaster(csvText);
                  recordCount = data.length;
                  break;
                case "forecastData":
                  data = CSVParser.parseForecastData(csvText);
                  recordCount = data.length;
                  break;
                case "supplyDemandData":
                  data = CSVParser.parseSupplyDemandData(csvText);
                  recordCount = data.length;
                  break;
              }

              responses[fieldName] = {
                success: true,
                message: `${fieldName} uploaded successfully`,
                recordCount,
                preview: data.slice(0, 10),
              };
            } catch (parseError: any) {
              responses[fieldName] = {
                success: false,
                message: `Error parsing ${fieldName}: ${parseError.message}`,
              };
            }
          }
        }

        res.json(responses);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Start safety stock calculations
  app.post("/api/calculate", async (req, res) => {
    try {
      // Read uploaded files from uploads directory
      const historyFilePath = path.join(uploadDir, "historyData.csv");
      const itemMasterFilePath = path.join(uploadDir, "itemMaster.csv");
      const forecastFilePath = path.join(uploadDir, "forecastData.csv");

      if (
        !fs.existsSync(historyFilePath) ||
        !fs.existsSync(itemMasterFilePath)
      ) {
        return res.status(400).json({
          message:
            "Required files not found. Please upload History Data and Item Master files.",
        });
      }

      // Create new calculation
      const calculationId = generateId();
      calculations.set(calculationId, {
        id: calculationId,
        status: "pending",
        createdAt: new Date(),
      });

      // Start async calculation process
      processCalculation(calculationId);

      res.json({ calculationId });
    } catch (error: any) {
      console.error("Calculate endpoint error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get calculation progress and results
  app.get("/api/calculate/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const calculation = calculations.get(id);

      if (!calculation) {
        return res.status(404).json({ message: "Calculation not found" });
      }

      const response: CalculationProgress = {
        step: calculation.status as any,
        progress: getProgressPercentage(calculation.status),
        message: getProgressMessage(calculation.status),
      };

      if (calculation.historyResults) {
        response.historyResults = calculation.historyResults;
      }

      if (calculation.forecastResults) {
        response.forecastResults = calculation.forecastResults;
      }

      res.json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Download all results as zip file
  app.get("/api/download/:id/zip", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Attempting to download zip for calculation ID: ${id}`);

      // Always check for pre-generated zip file first (regardless of calculation ID)
      const zipPath = path.join(resultsDir, "safety_stock_results.zip");
      console.log(`Looking for zip file at: ${zipPath}`);

      if (fs.existsSync(zipPath)) {
        console.log(`Found pre-generated zip file: ${zipPath}`);

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="safety_stock_results.zip"',
        );

        const zipBuffer = fs.readFileSync(zipPath);
        console.log(`Zip file size: ${zipBuffer.length} bytes`);
        res.send(zipBuffer);
      } else {
        console.log(`Zip file not found: ${zipPath}`);
        console.log(`Results directory exists: ${fs.existsSync(resultsDir)}`);
        console.log(`Results directory path: ${resultsDir}`);
        console.log(
          "Available files in results:",
          fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir) : [],
        );
        res.status(404).json({ message: "Results not found" });
      }
    } catch (error: any) {
      console.error("Zip download error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Download results as CSV
  app.get("/api/download/:id/:type", async (req, res) => {
    try {
      const { id, type } = req.params;
      const calculation = calculations.get(id);

      if (!calculation) {
        return res.status(404).json({ message: "Calculation not found" });
      }

      let data: any[] = [];
      let filename = "";

      if (type === "history" && calculation.historyResults) {
        data = calculation.historyResults;
        filename = "SAFETY_STOCK_DATA.csv";
      } else if (type === "forecast" && calculation.forecastResults) {
        data = calculation.forecastResults;
        filename = "SAFETY_STOCK_FCST_BASED.csv";
      } else {
        return res.status(404).json({ message: "Results not found" });
      }

      const csvContent = CSVParser.generateCSV(data);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(csvContent);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Clear all data endpoint
  app.post("/api/clear-all", async (req, res) => {
    try {
      clearAllFiles();
      res.json({ message: "All data cleared successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Min-Max Calculator upload endpoint
  app.post(
    "/api/minmax/upload",
    upload.fields([
      { name: "itemMaster", maxCount: 1 },
      { name: "supplyDemandData", maxCount: 1 },
    ]),
    async (req: MulterRequest, res) => {
      console.log("Min-max upload endpoint hit");
      try {
        const files = req.files;
        console.log("Upload request received:", {
          files: files ? Object.keys(files) : "no files",
        });
        const responses: { [key: string]: FileUploadResponse } = {};

        if (!files || Object.keys(files).length === 0) {
          return res.status(400).json({ 
            error: "No files received",
            message: "Please select at least one file to upload"
          });
        }

        for (const [fieldName, fileArray] of Object.entries(
          files as { [key: string]: Express.Multer.File[] },
        )) {
          if (Array.isArray(fileArray) && fileArray.length > 0) {
            const file = fileArray[0];
            const csvText = file.buffer.toString("utf8");

            try {
              // Save file to uploads directory
              const fileName = `${fieldName}.csv`;
              const filePath = path.join(uploadDir, fileName);
              fs.writeFileSync(filePath, csvText);

              let data: any[] = [];
              let recordCount = 0;

              switch (fieldName) {
                case "itemMaster":
                  data = CSVParser.parseItemMaster(csvText);
                  recordCount = data.length;
                  break;
                case "supplyDemandData":
                  data = CSVParser.parseSupplyDemandData(csvText);
                  recordCount = data.length;
                  break;
                default:
                  throw new Error(`Unknown file type: ${fieldName}`);
              }

              if (recordCount === 0) {
                throw new Error("No valid records found in file");
              }

              responses[fieldName] = {
                success: true,
                message: `${fieldName} uploaded successfully`,
                recordCount,
                preview: data.slice(0, 10),
              };
            } catch (parseError: any) {
              console.error(`Error parsing ${fieldName}:`, parseError);
              responses[fieldName] = {
                success: false,
                message: `Error parsing ${fieldName}: ${parseError.message}`,
              };
            }
          }
        }

        // Ensure we always return valid JSON
        if (Object.keys(responses).length === 0) {
          console.log("No files processed, returning error");
          res.status(400).json({ 
            error: "No files processed",
            message: "No valid files were processed"
          });
          return;
        }

        console.log("Sending success response with", Object.keys(responses).length, "files");
        res.setHeader("Content-Type", "application/json");
        res.status(200).json(responses);
        return;
      } catch (error: any) {
        console.error("Min-max upload endpoint error:", error);
        res.setHeader("Content-Type", "application/json");
        res.status(400).json({ 
          error: error.message || "Upload failed",
          message: error.message || "An error occurred while processing the upload"
        });
        return;
      }
    },
  );

  // Min-Max Calculator endpoints
  app.post("/api/minmax/calculate", async (req, res) => {
    try {
      const { reviewPeriodDays = 30, useSupplyDemandData = false } = req.body;

      // Read uploaded files
      const itemMasterFilePath = path.join(uploadDir, "itemMaster.csv");
      const supplyDemandFilePath = path.join(uploadDir, "supplyDemandData.csv");
      const historyFilePath = path.join(uploadDir, "historyData.csv");
      const forecastFilePath = path.join(uploadDir, "forecastData.csv");

      if (!fs.existsSync(itemMasterFilePath)) {
        return res.status(400).json({
          message: "Item Master file is required.",
        });
      }

      const itemMaster = CSVParser.parseItemMaster(
        fs.readFileSync(itemMasterFilePath, "utf8")
      );

      let minMaxResults: any[] = [];

      if (useSupplyDemandData && fs.existsSync(supplyDemandFilePath)) {
        // Use supply-demand data directly
        const supplyDemandData = CSVParser.parseSupplyDemandData(
          fs.readFileSync(supplyDemandFilePath, "utf8")
        );
        
        // Group supply-demand data by ITEM_NAME and ORG_CODE
        const grouped = new Map<string, typeof supplyDemandData>();
        for (const sd of supplyDemandData) {
          const key = `${sd.ITEM_NAME}|${sd.ORG_CODE}`;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(sd);
        }
        
        // Calculate min-max from supply-demand data
        minMaxResults = Array.from(grouped.entries()).map(([key, orders]) => {
          const [itemName, orgCode] = key.split('|');
          
          // Find matching item master
          const master = itemMaster.find(
            m => m.ITEM_NAME === itemName && m.ORG_CODE === orgCode
          );

          // Sum order quantities for this item/org
          const totalOrderQuantity = orders.reduce((sum, o) => sum + (o.ORDER_QUANTITY || 0), 0);
          
          // Use master data for calculations
          const leadTime = master?.LEAD_TIME || 0;
          const supplyLeadTimeVar = master?.SUPPLY_LEAD_TIME_VAR_DAYS || 0;
          
          // If master has MIN/MAX levels, use them; otherwise calculate
          let minLevel: number;
          let maxLevel: number;
          let orderQuantity: number;
          
          if (master?.MIN_QUANTITY_LEVEL !== undefined && master?.MAX_QUANTITY_LEVEL !== undefined) {
            // Use provided min/max levels from item master
            minLevel = Math.ceil(master.MIN_QUANTITY_LEVEL);
            maxLevel = Math.ceil(master.MAX_QUANTITY_LEVEL);
            orderQuantity = Math.ceil(maxLevel - minLevel);
          } else {
            // Calculate from supply-demand data
            // Average daily quantity from total orders (assuming orders span review period)
            const avgDailyQty = totalOrderQuantity > 0 ? Math.ceil(totalOrderQuantity / reviewPeriodDays) : 0;
            
            // Safety stock = Average Daily Qty × Supply Lead Time Var
            const safetyStock = Math.ceil(avgDailyQty * supplyLeadTimeVar);

            // Min (Reorder Point) = Safety Stock + (Average Daily Demand × Lead Time)
            minLevel = Math.ceil(safetyStock + (avgDailyQty * leadTime));

            // Order Quantity = Average Daily Demand × Review Period or use total from orders
            orderQuantity = Math.max(
              Math.ceil(avgDailyQty * reviewPeriodDays),
              Math.ceil(totalOrderQuantity)
            );

            // Max (Maximum Stock Level) = Min + Order Quantity
            maxLevel = Math.ceil(minLevel + orderQuantity);
          }

          return {
            ITEM_NAME: itemName,
            ORG_CODE: orgCode,
            AVERAGE_DAILY_QTY: totalOrderQuantity > 0 ? Math.ceil(totalOrderQuantity / reviewPeriodDays) : 0,
            LEAD_TIME: leadTime,
            SAFETY_STOCK: master ? Math.ceil((totalOrderQuantity / reviewPeriodDays) * supplyLeadTimeVar) : 0,
            MIN_LEVEL: minLevel,
            MAX_LEVEL: maxLevel,
            ORDER_QUANTITY: orderQuantity,
            REVIEW_PERIOD_DAYS: reviewPeriodDays,
            TOTAL_ORDERS: orders.length,
            TOTAL_ORDER_QUANTITY: totalOrderQuantity,
          };
        });
      } else if (fs.existsSync(historyFilePath)) {
        // Use history-based safety stock
        const historyData = CSVParser.parseHistoryData(
          fs.readFileSync(historyFilePath, "utf8")
        );
        const historyResults = SafetyStockCalculator.calculateHistoryBased(
          historyData,
          itemMaster
        );
        minMaxResults = MinMaxCalculator.calculateFromHistory(
          historyResults,
          reviewPeriodDays
        );
      } else if (fs.existsSync(forecastFilePath)) {
        // Use forecast-based safety stock
        const forecastData = CSVParser.parseForecastData(
          fs.readFileSync(forecastFilePath, "utf8")
        );
        const forecastResults = SafetyStockCalculator.calculateForecastBased(
          forecastData,
          itemMaster
        );
        minMaxResults = MinMaxCalculator.calculateFromForecast(
          forecastResults,
          reviewPeriodDays
        );
      } else {
        return res.status(400).json({
          message: "Please upload either Supply-Demand Data, History Data, or Forecast Data.",
        });
      }

      // Save results to file
      const csvContent = CSVParser.generateCSV(minMaxResults);
      const resultsFilePath = path.join(resultsDir, "MIN_MAX_RESULTS.csv");
      fs.writeFileSync(resultsFilePath, csvContent);

      res.json({
        success: true,
        results: minMaxResults,
        recordCount: minMaxResults.length,
      });
    } catch (error: any) {
      console.error("Min-Max calculation error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Download min-max results
  app.get("/api/minmax/download", async (req, res) => {
    try {
      const resultsFilePath = path.join(resultsDir, "MIN_MAX_RESULTS.csv");

      if (!fs.existsSync(resultsFilePath)) {
        return res.status(404).json({ message: "Min-Max results not found" });
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="MIN_MAX_RESULTS.csv"'
      );
      res.send(fs.readFileSync(resultsFilePath, "utf8"));
    } catch (error: any) {
      console.error("Min-Max download error:", error);
      res.status(400).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processCalculation(id: string) {
  try {
    console.log(`Starting calculation process for ID: ${id}`);

    const calculation = calculations.get(id);
    if (!calculation) return;

    // Update status to validation
    calculation.status = "validation";

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Read and parse files
    const historyFilePath = path.join(uploadDir, "historyData.csv");
    const itemMasterFilePath = path.join(uploadDir, "itemMaster.csv");
    const forecastFilePath = path.join(uploadDir, "forecastData.csv");

    const historyData = CSVParser.parseHistoryData(
      fs.readFileSync(historyFilePath, "utf8"),
    );
    const itemMaster = CSVParser.parseItemMaster(
      fs.readFileSync(itemMasterFilePath, "utf8"),
    );

    console.log(
      `Processing history data: ${historyData.length} rows, item master: ${itemMaster.length} rows`,
    );

    // Update status to history calculation
    calculation.status = "history-calc";

    // Calculate history-based safety stock
    const historyResults = SafetyStockCalculator.calculateHistoryBased(
      historyData,
      itemMaster,
    );
    console.log(
      `History calculation result: ${historyResults.length} items calculated`,
    );

    calculation.historyResults = historyResults;

    // Save history results to file
    let historyCsvContent = "";
    if (historyResults.length > 0) {
      historyCsvContent = CSVParser.generateCSV(historyResults);
      fs.writeFileSync(
        path.join(resultsDir, "SAFETY_STOCK_DATA.csv"),
        historyCsvContent,
      );
    }

    console.log(
      `History results stored for ID: ${id}, count: ${historyResults.length}`,
    );

    // If forecast data is provided, calculate forecast-based safety stock
    let forecastCsvContent = "";
    if (fs.existsSync(forecastFilePath)) {
      calculation.status = "forecast-calc";

      const forecastData = CSVParser.parseForecastData(
        fs.readFileSync(forecastFilePath, "utf8"),
      );
      console.log(`Processing forecast data: ${forecastData.length} rows`);
      const forecastResults = SafetyStockCalculator.calculateForecastBased(
        forecastData,
        itemMaster,
      );
      console.log(
        `Forecast calculation result: ${forecastResults.length} items calculated`,
      );

      calculation.forecastResults = forecastResults;

      // Save forecast results to file
      if (forecastResults.length > 0) {
        forecastCsvContent = CSVParser.generateCSV(forecastResults);
        fs.writeFileSync(
          path.join(resultsDir, "SAFETY_STOCK_FCST_BASED.csv"),
          forecastCsvContent,
        );
      }

      console.log(
        `Forecast results stored for ID: ${id}, count: ${forecastResults.length}`,
      );
    }

    // Create zip file with results
    const zip = new JSZip();
    let hasFiles = false;

    if (historyCsvContent) {
      zip.file("SAFETY_STOCK_DATA.csv", historyCsvContent);
      hasFiles = true;
    }

    if (forecastCsvContent) {
      zip.file("SAFETY_STOCK_FCST_BASED.csv", forecastCsvContent);
      hasFiles = true;
    }

    if (hasFiles) {
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const zipPath = path.join(resultsDir, "safety_stock_results.zip");
      fs.writeFileSync(zipPath, zipBuffer);
      console.log(`Zip file created at: ${zipPath}`);
    }

    // Mark as complete
    calculation.status = "complete";

    console.log(`Calculation completed for ID: ${id}`);
  } catch (error) {
    console.error("Calculation error:", error);
    const calculation = calculations.get(id);
    if (calculation) {
      calculation.status = "error";
    }
  }
}

function getProgressPercentage(status: string): number {
  switch (status) {
    case "pending":
      return 0;
    case "validation":
      return 25;
    case "history-calc":
      return 50;
    case "forecast-calc":
      return 75;
    case "complete":
      return 100;
    case "error":
      return 100;
    default:
      return 0;
  }
}

function getProgressMessage(status: string): string {
  switch (status) {
    case "pending":
      return "Initializing calculation...";
    case "validation":
      return "Validating input data...";
    case "history-calc":
      return "Calculating history-based safety stock...";
    case "forecast-calc":
      return "Calculating forecast-based safety stock...";
    case "complete":
      return "Calculation completed successfully";
    case "error":
      return "Calculation failed";
    default:
      return "Unknown status";
  }
}
