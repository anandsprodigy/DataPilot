import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCalculationSchema, type FileUploadResponse, type CalculationProgress } from "@shared/schema";
import { CSVParser } from "./services/csvParser";
import { SafetyStockCalculator } from "./services/safetyStockCalculator";
import multer from "multer";
import JSZip from "jszip";

interface MulterRequest extends Request {
  files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Upload and validate CSV files
  app.post('/api/upload', upload.fields([
    { name: 'historyData', maxCount: 1 },
    { name: 'itemMaster', maxCount: 1 },
    { name: 'forecastData', maxCount: 1 }
  ]), async (req: MulterRequest, res) => {
    try {
      const files = req.files;
      console.log('Upload request received:', { files: files ? Object.keys(files) : 'no files' });
      const responses: { [key: string]: FileUploadResponse } = {};

      if (!files || Object.keys(files).length === 0) {
        console.log('No files received in upload request');
        return res.json({});
      }

      for (const [fieldName, fileArray] of Object.entries(files || {})) {
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const csvText = file.buffer.toString('utf-8');

          try {
            let data: any[] = [];
            let recordCount = 0;

            switch (fieldName) {
              case 'historyData':
                data = CSVParser.parseHistoryData(csvText);
                recordCount = data.length;
                break;
              case 'itemMaster':
                data = CSVParser.parseItemMaster(csvText);
                recordCount = data.length;
                break;
              case 'forecastData':
                data = CSVParser.parseForecastData(csvText);
                recordCount = data.length;
                break;
            }

            responses[fieldName] = {
              success: true,
              message: `${fieldName} uploaded successfully`,
              recordCount,
              preview: data.slice(0, 10)
            };

          } catch (parseError: any) {
            responses[fieldName] = {
              success: false,
              message: `Error parsing ${fieldName}: ${parseError.message}`
            };
          }
        }
      }

      res.json(responses);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Start safety stock calculations
  app.post('/api/calculate', async (req, res) => {
    try {
      // Get the latest uploaded files from database
      const files = await db.select().from(uploadedFiles).orderBy(uploadedFiles.uploadedAt);
      
      console.log(`Found ${files.length} uploaded files in database`);
      
      let historyData: any[] = [];
      let itemMaster: any[] = [];
      let forecastData: any[] = [];
      
      // Parse the stored file data
      for (const file of files) {
        console.log(`Processing file: ${file.fileName} (type: ${file.fileType})`);
        const csvData = CSVParser.parseCSV(file.content);
        
        if (file.fileType === 'historyData') {
          historyData = CSVParser.parseHistoryData(file.content);
          console.log(`Parsed history data: ${historyData.length} rows`);
        } else if (file.fileType === 'itemMaster') {
          itemMaster = CSVParser.parseItemMaster(file.content);
          console.log(`Parsed item master: ${itemMaster.length} rows`);
        } else if (file.fileType === 'forecastData') {
          forecastData = CSVParser.parseForecastData(file.content);
          console.log(`Parsed forecast data: ${forecastData.length} rows`);
        }
      }
      
      if (historyData.length === 0 || itemMaster.length === 0) {
        return res.status(400).json({ 
          message: 'Required files not found. Please upload History Data and Item Master files.' 
        });
      }
      
      // Validate input
      const validatedData = insertCalculationSchema.parse({
        historyData: JSON.stringify(historyData),
        itemMaster: JSON.stringify(itemMaster),
        forecastData: forecastData.length > 0 ? JSON.stringify(forecastData) : undefined
      });

      // Create calculation record
      const calculation = await storage.createCalculation(validatedData);

      // Start async calculation process
      processCalculation(calculation.id, historyData, itemMaster, forecastData);

      res.json({ calculationId: calculation.id });
    } catch (error: any) {
      console.error('Calculate endpoint error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get calculation progress and results
  app.get('/api/calculate/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const calculation = await storage.getCalculation(id);
      
      if (!calculation) {
        return res.status(404).json({ message: 'Calculation not found' });
      }

      const response: CalculationProgress = {
        step: calculation.status as any,
        progress: getProgressPercentage(calculation.status),
        message: getProgressMessage(calculation.status),
      };

      if (calculation.historyResults) {
        response.historyResults = JSON.parse(calculation.historyResults);
      }

      if (calculation.forecastResults) {
        response.forecastResults = JSON.parse(calculation.forecastResults);
      }

      res.json(response);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Download results as CSV
  app.get('/api/download/:id/:type', async (req, res) => {
    try {
      const { id, type } = req.params;
      const calculation = await storage.getCalculation(id);
      
      if (!calculation) {
        return res.status(404).json({ message: 'Calculation not found' });
      }

      let data: any[] = [];
      let filename = '';

      if (type === 'history' && calculation.historyResults) {
        data = JSON.parse(calculation.historyResults);
        filename = 'SAFETY_STOCK_DATA.csv';
      } else if (type === 'forecast' && calculation.forecastResults) {
        data = JSON.parse(calculation.forecastResults);
        filename = 'SAFETY_STOCK_FCST_BASED.csv';
      } else {
        return res.status(404).json({ message: 'Results not found' });
      }

      const csvContent = CSVParser.generateCSV(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Download all results as zip file
  app.get('/api/download/:id/zip', async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Attempting to download zip for calculation ID: ${id}`);
      const calculation = await storage.getCalculation(id);
      
      if (!calculation) {
        console.log(`Calculation not found for ID: ${id}`);
        return res.status(404).json({ message: 'Calculation not found' });
      }

      console.log(`Found calculation:`, {
        id: calculation.id,
        status: calculation.status,
        hasHistoryResults: !!calculation.historyResults,
        hasForecastResults: !!calculation.forecastResults
      });

      const zip = new JSZip();
      let hasFiles = false;

      // Add history results if available
      if (calculation.historyResults) {
        const historyData = JSON.parse(calculation.historyResults);
        const historyCsv = CSVParser.generateCSV(historyData);
        zip.file('SAFETY_STOCK_DATA.csv', historyCsv);
        hasFiles = true;
      }

      // Add forecast results if available
      if (calculation.forecastResults) {
        const forecastData = JSON.parse(calculation.forecastResults);
        const forecastCsv = CSVParser.generateCSV(forecastData);
        zip.file('SAFETY_STOCK_FCST_BASED.csv', forecastCsv);
        hasFiles = true;
      }

      if (!hasFiles) {
        return res.status(404).json({ message: 'No results found' });
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="safety_stock_results.zip"');
      res.send(zipBuffer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Clear all data endpoint
  app.post('/api/clear-all', async (req, res) => {
    try {
      await storage.clearAllFiles();
      res.json({ message: 'All data cleared successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processCalculation(
  id: string, 
  historyData: any[], 
  itemMaster: any[], 
  forecastData?: any[]
) {
  try {
    console.log(`Starting calculation process for ID: ${id}`);
    
    // Update status to validation
    await storage.updateCalculation(id, { status: 'validation' });
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update status to history calculation
    await storage.updateCalculation(id, { status: 'history-calc' });
    
    // Calculate history-based safety stock
    console.log(`Processing history data: ${historyData.length} rows, item master: ${itemMaster.length} rows`);
    const historyResults = SafetyStockCalculator.calculateHistoryBased(historyData, itemMaster);
    console.log(`History calculation result: ${historyResults.length} items calculated`);
    
    await storage.updateCalculation(id, { 
      historyResults: JSON.stringify(historyResults)
    });
    
    console.log(`History results stored for ID: ${id}, count: ${historyResults.length}`);

    // If forecast data is provided, calculate forecast-based safety stock
    if (forecastData && forecastData.length > 0) {
      await storage.updateCalculation(id, { status: 'forecast-calc' });
      
      console.log(`Processing forecast data: ${forecastData.length} rows`);
      const forecastResults = SafetyStockCalculator.calculateForecastBased(forecastData, itemMaster);
      console.log(`Forecast calculation result: ${forecastResults.length} items calculated`);
      
      await storage.updateCalculation(id, { 
        forecastResults: JSON.stringify(forecastResults)
      });
      
      console.log(`Forecast results stored for ID: ${id}, count: ${forecastResults.length}`);
    }

    // Mark as complete
    await storage.updateCalculation(id, { status: 'complete' });
    
    console.log(`Calculation completed for ID: ${id}`);
    
  } catch (error) {
    console.error('Calculation error:', error);
    await storage.updateCalculation(id, { status: 'error' });
  }
}

function getProgressPercentage(status: string): number {
  switch (status) {
    case 'pending': return 0;
    case 'validation': return 25;
    case 'history-calc': return 50;
    case 'forecast-calc': return 75;
    case 'complete': return 100;
    default: return 0;
  }
}

function getProgressMessage(status: string): string {
  switch (status) {
    case 'pending': return 'Calculation queued';
    case 'validation': return 'Validating data integrity';
    case 'history-calc': return 'Calculating history-based safety stock';
    case 'forecast-calc': return 'Calculating forecast-based safety stock';
    case 'complete': return 'Calculations complete';
    case 'error': return 'Calculation failed';
    default: return 'Unknown status';
  }
}
