import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCalculationSchema, type FileUploadResponse, type CalculationProgress } from "@shared/schema";
import { CSVParser } from "./services/csvParser";
import { SafetyStockCalculator } from "./services/safetyStockCalculator";
import multer from "multer";

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
      const { historyData, itemMaster, forecastData } = req.body;
      
      // Validate input
      const validatedData = insertCalculationSchema.parse({
        historyData: JSON.stringify(historyData),
        itemMaster: JSON.stringify(itemMaster),
        forecastData: forecastData ? JSON.stringify(forecastData) : undefined
      });

      // Create calculation record
      const calculation = await storage.createCalculation(validatedData);

      // Start async calculation process
      processCalculation(calculation.id, historyData, itemMaster, forecastData);

      res.json({ calculationId: calculation.id });
    } catch (error: any) {
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
    // Update status to validation
    await storage.updateCalculation(id, { status: 'validation' });
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update status to history calculation
    await storage.updateCalculation(id, { status: 'history-calc' });
    
    // Calculate history-based safety stock
    const historyResults = SafetyStockCalculator.calculateHistoryBased(historyData, itemMaster);
    
    await storage.updateCalculation(id, { 
      historyResults: JSON.stringify(historyResults)
    });

    // If forecast data is provided, calculate forecast-based safety stock
    if (forecastData && forecastData.length > 0) {
      await storage.updateCalculation(id, { status: 'forecast-calc' });
      
      const forecastResults = SafetyStockCalculator.calculateForecastBased(forecastData, itemMaster);
      
      await storage.updateCalculation(id, { 
        forecastResults: JSON.stringify(forecastResults)
      });
    }

    // Mark as complete
    await storage.updateCalculation(id, { status: 'complete' });
    
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
