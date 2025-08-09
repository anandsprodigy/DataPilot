import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFiles) => void;
  onStartCalculation: () => void;
}

interface UploadedFiles {
  historyData?: { data: any[]; preview: any[]; recordCount: number };
  itemMaster?: { data: any[]; preview: any[]; recordCount: number };
  forecastData?: { data: any[]; preview: any[]; recordCount: number };
}

export function FileUpload({ onFilesUploaded, onStartCalculation }: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFiles = async (files: { [key: string]: File }) => {
    setIsUploading(true);
    const formData = new FormData();
    
    Object.entries(files).forEach(([key, file]) => {
      formData.append(key, file);
    });

    try {
      const response = await apiRequest('POST', '/api/upload', formData);
      const results = await response.json();
      
      setUploadedFiles(prevUploadedFiles => {
        const newUploadedFiles: UploadedFiles = { ...prevUploadedFiles };
        
        Object.entries(results).forEach(([key, result]: [string, any]) => {
          if (result.success) {
            newUploadedFiles[key as keyof UploadedFiles] = {
              data: [],
              preview: result.preview || [],
              recordCount: result.recordCount || 0
            };
            toast({
              title: "File uploaded",
              description: `${key} uploaded successfully with ${result.recordCount} records`,
            });
          } else {
            toast({
              title: "Upload failed",
              description: result.message,
              variant: "destructive",
            });
          }
        });
        
        onFilesUploaded(newUploadedFiles);
        return newUploadedFiles;
      });
      
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const createDropzone = (fileType: keyof UploadedFiles, title: string, description: string, requiredColumns: string[]) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadFiles({ [fileType]: acceptedFiles[0] });
      }
    }, [fileType]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: { 'text/csv': ['.csv'] },
      maxFiles: 1,
      disabled: isUploading
    });

    const isUploaded = !!uploadedFiles[fileType];

    return (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          isDragActive 
            ? 'border-primary bg-blue-50 scale-[1.02]' 
            : isUploaded 
              ? 'border-green-300 bg-green-50' 
              : 'border-gray-300 hover:border-primary hover:bg-blue-50'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        
        {isUploaded ? (
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
        ) : (
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        )}
        
        <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-500 mb-2">{description}</p>
        <p className="text-xs text-gray-400">
          Required columns: {requiredColumns.join(', ')}
        </p>
        
        {isUploaded && (
          <div className="mt-3">
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Uploaded
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {uploadedFiles[fileType]?.recordCount} records detected
            </p>
          </div>
        )}
      </div>
    );
  };

  const clearAllFiles = () => {
    setUploadedFiles({});
    onFilesUploaded({});
  };

  const uploadedCount = Object.keys(uploadedFiles).length;
  const canStartCalculation = uploadedCount >= 2; // At least history and master data required

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload Required Files</h2>
          <p className="text-sm text-gray-600">
            Upload the CSV files required for safety stock calculations. History Data and Item Master are required, Forecast Data is optional.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {createDropzone(
            'historyData',
            'History Data',
            'HISTORY_DATA.csv',
            ['ITEM_NAME', 'ORG_CODE', 'REF_DATE', 'REF_QTY']
          )}
          
          {createDropzone(
            'itemMaster',
            'Item Master',
            'ITEM_MASTER.csv',
            ['ITEM_NAME', 'ORG_CODE', 'LEAD_TIME', 'SUPPLY_LEAD_TIME_VAR_DAYS', 'SERVICE_LEVEL']
          )}
          
          {createDropzone(
            'forecastData',
            'Forecast Data (Optional)',
            'FORECAST_DATA.csv',
            ['ITEM_NAME', 'ORG_CODE', 'REF_DATE', 'REF_QTY', 'ERROR_TYPE', 'FORECAST_ERR_PERCENT']
          )}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {uploadedCount} of 3 files uploaded
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={clearAllFiles}
              disabled={uploadedCount === 0 || isUploading}
            >
              Clear All
            </Button>
            <Button
              onClick={onStartCalculation}
              disabled={!canStartCalculation || isUploading}
              className="bg-primary hover:bg-blue-700"
            >
              Start Calculations
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
