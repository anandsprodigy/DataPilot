import { HistoryDataRow, ItemMasterRow, ForecastDataRow } from "@shared/schema";

export class CSVParser {
  static parseHistoryData(csvText: string): HistoryDataRow[] {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
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
      
      const values = line.split(',').map(v => v.trim());
      const row: HistoryDataRow = {
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')],
        ORG_CODE: values[headers.indexOf('ORG_CODE')],
        REF_DATE: values[headers.indexOf('REF_DATE')],
        REF_QTY: parseFloat(values[headers.indexOf('REF_QTY')]) || 0,
      };
      data.push(row);
    }
    
    return data;
  }

  static parseItemMaster(csvText: string): ItemMasterRow[] {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const requiredHeaders = ['ITEM_NAME', 'ORG_CODE', 'SUPPLY_LEAD_TIME_VAR_DAYS', 'SERVICE_LEVEL', 'LEAD_TIME'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    const data: ItemMasterRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      const row: ItemMasterRow = {
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')],
        ORG_CODE: values[headers.indexOf('ORG_CODE')],
        SUPPLY_LEAD_TIME_VAR_DAYS: parseInt(values[headers.indexOf('SUPPLY_LEAD_TIME_VAR_DAYS')]) || 0,
        SERVICE_LEVEL: parseFloat(values[headers.indexOf('SERVICE_LEVEL')]) || 0,
        LEAD_TIME: parseInt(values[headers.indexOf('LEAD_TIME')]) || 0,
      };
      data.push(row);
    }
    
    return data;
  }

  static parseForecastData(csvText: string): ForecastDataRow[] {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const requiredHeaders = ['ITEM_NAME', 'ORG_CODE', 'REF_DATE', 'REF_QTY', 'ERROR_TYPE', 'FORECAST_ERR_PERCENT'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    const data: ForecastDataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.trim());
      const row: ForecastDataRow = {
        ITEM_NAME: values[headers.indexOf('ITEM_NAME')],
        ORG_CODE: values[headers.indexOf('ORG_CODE')],
        REF_DATE: values[headers.indexOf('REF_DATE')],
        REF_QTY: parseFloat(values[headers.indexOf('REF_QTY')]) || 0,
        ERROR_TYPE: values[headers.indexOf('ERROR_TYPE')],
        FORECAST_ERR_PERCENT: parseFloat(values[headers.indexOf('FORECAST_ERR_PERCENT')]) || 0,
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
