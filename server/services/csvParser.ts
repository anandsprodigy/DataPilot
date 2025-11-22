import { HistoryDataRow, ItemMasterRow, ForecastDataRow, SupplyDemandDataRow } from "@shared/schema";

export class CSVParser {
  static parseHistoryData(csvText: string): HistoryDataRow[] {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }
    const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    
    // Validate required headers
    const requiredHeaders = ['ITEM_NAME', 'ORG_CODE', 'REF_DATE', 'REF_QTY'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    const data: HistoryDataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}. Skipping.`);
        continue;
      }
      
      const row: HistoryDataRow = {
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')] || '',
        ORG_CODE: values[headers.indexOf('ORG_CODE')] || '',
        REF_DATE: values[headers.indexOf('REF_DATE')] || '',
        REF_QTY: parseFloat(values[headers.indexOf('REF_QTY')]) || 0,
      };
      data.push(row);
    }
    
    return data;
  }

  static parseItemMaster(csvText: string): ItemMasterRow[] {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }
    const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    
    const requiredHeaders = ['ITEM_NAME', 'ORG_CODE', 'SUPPLY_LEAD_TIME_VAR_DAYS', 'SERVICE_LEVEL', 'LEAD_TIME'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}. Found headers: ${headers.join(', ')}`);
    }

    const data: ItemMasterRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}. Skipping.`);
        continue;
      }
      
      const row: ItemMasterRow = {
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')] || '',
        ORG_CODE: values[headers.indexOf('ORG_CODE')] || '',
        SUPPLY_LEAD_TIME_VAR_DAYS: parseInt(values[headers.indexOf('SUPPLY_LEAD_TIME_VAR_DAYS')] || '0', 10) || 0,
        SERVICE_LEVEL: parseFloat(values[headers.indexOf('SERVICE_LEVEL')] || '0') || 0,
        LEAD_TIME: parseInt(values[headers.indexOf('LEAD_TIME')] || '0', 10) || 0,
      };

      // Optional fields
      if (headers.includes('MIN_QUANTITY_LEVEL')) {
        const val = values[headers.indexOf('MIN_QUANTITY_LEVEL')];
        row.MIN_QUANTITY_LEVEL = val ? parseFloat(val) : undefined;
        if (isNaN(row.MIN_QUANTITY_LEVEL!)) row.MIN_QUANTITY_LEVEL = undefined;
      }
      if (headers.includes('MAX_QUANTITY_LEVEL')) {
        const val = values[headers.indexOf('MAX_QUANTITY_LEVEL')];
        row.MAX_QUANTITY_LEVEL = val ? parseFloat(val) : undefined;
        if (isNaN(row.MAX_QUANTITY_LEVEL!)) row.MAX_QUANTITY_LEVEL = undefined;
      }

      data.push(row);
    }
    
    return data;
  }

  static parseForecastData(csvText: string): ForecastDataRow[] {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }
    const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    
    const requiredHeaders = ['ITEM_NAME', 'ORG_CODE', 'REF_DATE', 'REF_QTY', 'ERROR_TYPE', 'FORECAST_ERR_PERCENT'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    const data: ForecastDataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}. Skipping.`);
        continue;
      }
      
      const row: ForecastDataRow = {
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')] || '',
        ORG_CODE: values[headers.indexOf('ORG_CODE')] || '',
        REF_DATE: values[headers.indexOf('REF_DATE')] || '',
        REF_QTY: parseFloat(values[headers.indexOf('REF_QTY')] || '0') || 0,
        ERROR_TYPE: values[headers.indexOf('ERROR_TYPE')] || '',
        FORECAST_ERR_PERCENT: parseFloat(values[headers.indexOf('FORECAST_ERR_PERCENT')] || '0') || 0,
      };
      data.push(row);
    }
    
    return data;
  }

  // Helper function to parse CSV line handling quoted values
  static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  }

  static parseSupplyDemandData(csvText: string): SupplyDemandDataRow[] {
    const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }
    
    const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    
    // Required headers: ORDER_GROUP, ITEM_NAME, ORG_CODE, ORDER_TYPE, ORDER_QUANTITY, OLD_DUE_DATE, SUGG_DUE_DATE
    const requiredHeaders = ['ORDER_GROUP', 'ITEM_NAME', 'ORG_CODE', 'ORDER_TYPE', 'ORDER_QUANTITY', 'OLD_DUE_DATE', 'SUGG_DUE_DATE'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}. Found headers: ${headers.join(', ')}`);
    }

    const data: SupplyDemandDataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
      
      if (values.length !== headers.length) {
        console.warn(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}. Skipping.`);
        continue;
      }
      
      const row: SupplyDemandDataRow = {
        ORDER_GROUP: values[headers.indexOf('ORDER_GROUP')] || '',
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')] || '',
        ORG_CODE: values[headers.indexOf('ORG_CODE')] || '',
        ORDER_TYPE: values[headers.indexOf('ORDER_TYPE')] || '',
        ORDER_QUANTITY: parseFloat(values[headers.indexOf('ORDER_QUANTITY')] || '0') || 0,
        OLD_DUE_DATE: values[headers.indexOf('OLD_DUE_DATE')] || '',
        SUGG_DUE_DATE: values[headers.indexOf('SUGG_DUE_DATE')] || '',
      };

      data.push(row);
    }
    
    return data;
  }

  static generateCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'number') {
          return value.toFixed(2);
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }
}
