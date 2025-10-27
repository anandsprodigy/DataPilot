const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');

[uploadsDir, resultsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Helper function to read CSV or Excel file
function readFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.csv') {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } else {
    throw new Error('Unsupported file format');
  }
}

// Helper function to validate required columns
function validateColumns(data, requiredColumns, fileName) {
  if (!data || data.length === 0) {
    throw new Error(`${fileName} is empty`);
  }
  
  const columns = Object.keys(data[0]);
  const missingColumns = requiredColumns.filter(col => !columns.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`${fileName} is missing required columns: ${missingColumns.join(', ')}`);
  }
}

// Helper function to parse numeric value
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

// Helper function to calculate recommended quantity
function calcRecommended(supply, demand, minLevel, maxLevel) {
  if ((supply - demand) > minLevel) {
    return 0;
  } else {
    return demand + maxLevel - supply;
  }
}

// Main calculation function
function calculateMinMax(itemMasterData, supplyDemandData) {
  // Step 1: Group and sum ORDER_QUANTITY by ITEM_NAME, ORG_CODE, ORDER_GROUP
  const grouped = {};
  
  supplyDemandData.forEach(row => {
    const key = `${row.ITEM_NAME}|${row.ORG_CODE}|${row.ORDER_GROUP}`;
    if (!grouped[key]) {
      grouped[key] = {
        ITEM_NAME: row.ITEM_NAME,
        ORG_CODE: row.ORG_CODE,
        ORDER_GROUP: row.ORDER_GROUP,
        ORDER_QUANTITY: 0
      };
    }
    grouped[key].ORDER_QUANTITY += parseNumber(row.ORDER_QUANTITY);
  });
  
  // Step 2: Pivot the data (convert ORDER_GROUP to columns)
  const pivoted = {};
  
  Object.values(grouped).forEach(row => {
    const key = `${row.ITEM_NAME}|${row.ORG_CODE}`;
    if (!pivoted[key]) {
      pivoted[key] = {
        ITEM_NAME: row.ITEM_NAME,
        ORG_CODE: row.ORG_CODE,
        SUPPLY: 0,
        DEMAND: 0
      };
    }
    
    if (row.ORDER_GROUP.toUpperCase() === 'SUPPLY') {
      pivoted[key].SUPPLY += row.ORDER_QUANTITY;
    } else if (row.ORDER_GROUP.toUpperCase() === 'DEMAND') {
      pivoted[key].DEMAND += row.ORDER_QUANTITY;
    }
  });
  
  // Step 3: Merge with item master data
  const finalData = [];
  
  Object.values(pivoted).forEach(pivotRow => {
    const itemMaster = itemMasterData.find(
      item => item.ITEM_NAME === pivotRow.ITEM_NAME && 
              item.ORG_CODE === pivotRow.ORG_CODE
    );
    
    if (itemMaster) {
      const minLevel = parseNumber(itemMaster.MIN_QUANTITY_LEVEL);
      const maxLevel = parseNumber(itemMaster.MAX_QUANTITY_LEVEL);
      const leadTime = parseNumber(itemMaster.LEAD_TIME);
      const supply = pivotRow.SUPPLY;
      const demand = pivotRow.DEMAND;
      
      const recommendedQty = calcRecommended(supply, demand, minLevel, maxLevel);
      
      finalData.push({
        ITEM_NAME: pivotRow.ITEM_NAME,
        ORG_CODE: pivotRow.ORG_CODE,
        SUPPLY: supply,
        DEMAND: demand,
        MIN_QUANTITY_LEVEL: minLevel,
        MAX_QUANTITY_LEVEL: maxLevel,
        LEAD_TIME: leadTime,
        RECOMMENDED_QUANTITY: recommendedQty
      });
    }
  });
  
  // Step 4: Generate output rows (only where RECOMMENDED_QUANTITY > 0)
  const today = new Date();
  const outputRows = finalData
    .filter(row => row.RECOMMENDED_QUANTITY > 0)
    .map(row => {
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + row.LEAD_TIME);
      
      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      return {
        ORDER_GROUP: 'SUPPLY',
        ITEM_NAME: row.ITEM_NAME,
        ORG_CODE: row.ORG_CODE,
        ORDER_TYPE: 'Planned order',
        ORDER_QUANTITY: row.RECOMMENDED_QUANTITY,
        OLD_DUE_DATE: formatDate(dueDate),
        SUGG_DUE_DATE: formatDate(dueDate)
      };
    });
  
  return { finalData, outputRows };
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Min-Max Calculator API is running' });
});

// Main calculation endpoint
app.post('/api/minmax/calculate', upload.fields([
  { name: 'itemMaster', maxCount: 1 },
  { name: 'supplyDemand', maxCount: 1 }
]), async (req, res) => {
  let itemMasterPath, supplyDemandPath;
  
  try {
    // Validate file uploads
    if (!req.files || !req.files.itemMaster || !req.files.supplyDemand) {
      return res.status(400).json({ 
        error: 'Both itemMaster and supplyDemand files are required' 
      });
    }
    
    itemMasterPath = req.files.itemMaster[0].path;
    supplyDemandPath = req.files.supplyDemand[0].path;
    
    // Read and validate Item Master file
    const itemMasterData = readFile(itemMasterPath);
    validateColumns(
      itemMasterData,
      ['ITEM_NAME', 'ORG_CODE', 'MIN_QUANTITY_LEVEL', 'MAX_QUANTITY_LEVEL', 'LEAD_TIME'],
      'Item Master file'
    );
    
    // Read and validate Supply Demand file
    const supplyDemandData = readFile(supplyDemandPath);
    validateColumns(
      supplyDemandData,
      ['ITEM_NAME', 'ORG_CODE', 'ORDER_GROUP', 'ORDER_QUANTITY'],
      'Supply Demand file'
    );
    
    // Perform calculation
    const { finalData, outputRows } = calculateMinMax(itemMasterData, supplyDemandData);
    
    // Create blank rows
    const blankRows = [
      { ORDER_GROUP: '', ITEM_NAME: '', ORG_CODE: '', ORDER_TYPE: '', ORDER_QUANTITY: '', OLD_DUE_DATE: '', SUGG_DUE_DATE: '' },
      { ORDER_GROUP: '', ITEM_NAME: '', ORG_CODE: '', ORDER_TYPE: '', ORDER_QUANTITY: '', OLD_DUE_DATE: '', SUGG_DUE_DATE: '' }
    ];
    
    // Combine: original supply demand data + blank rows + output rows
    const combinedData = [
      ...supplyDemandData,
      ...blankRows,
      ...outputRows
    ];
    
    // Generate output CSV
    const timestamp = Date.now();
    const outputFilename = `MinMax_Result_${timestamp}.csv`;
    const outputPath = path.join(resultsDir, outputFilename);
    
    const csvContent = stringify(combinedData, {
      header: true,
      columns: Object.keys(combinedData[0])
    });
    
    fs.writeFileSync(outputPath, csvContent);
    
    // Clean up uploaded files
    fs.unlinkSync(itemMasterPath);
    fs.unlinkSync(supplyDemandPath);
    
    // Send response
    res.json({
      success: true,
      message: 'Calculation completed successfully',
      totalRecords: finalData.length,
      recommendedOrders: outputRows.length,
      filename: outputFilename
    });
    
  } catch (error) {
    console.error('Calculation error:', error);
    
    // Clean up files on error
    if (itemMasterPath && fs.existsSync(itemMasterPath)) {
      fs.unlinkSync(itemMasterPath);
    }
    if (supplyDemandPath && fs.existsSync(supplyDemandPath)) {
      fs.unlinkSync(supplyDemandPath);
    }
    
    res.status(500).json({
      error: error.message || 'An error occurred during calculation'
    });
  }
});

// Download result endpoint
app.get('/api/minmax/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(resultsDir, filename);
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ 
    error: error.message || 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Min-Max Calculator server running on port ${PORT}`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Results directory: ${resultsDir}`);
});
