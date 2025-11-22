import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MinMaxFileUploadProps {
  onFilesUploaded: (files: MinMaxUploadedFiles) => void;
}

interface MinMaxUploadedFiles {
  itemMaster?: { data: any[]; preview: any[]; recordCount: number };
  supplyDemandData?: { data: any[]; preview: any[]; recordCount: number };
}

export function MinMaxFileUpload({ onFilesUploaded }: MinMaxFileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<MinMaxUploadedFiles>({});
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadFiles = async (files: { [key: string]: File }) => {
    setIsUploading(true);
    const formData = new FormData();
    
    Object.entries(files).forEach(([key, file]) => {
      formData.append(key, file);
    });

    try {
      const response = await fetch("/api/minmax/upload", {
        method: "POST",
        body: formData,
      });
      
      // Check content type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          message: `Upload failed with status ${response.status}` 
        }));
        throw new Error(errorData.message || errorData.error || `Upload failed with status ${response.status}`);
      }
      
      let results;
      try {
        const text = await response.text();
        if (!text || text.trim() === '') {
          throw new Error("Empty response from server");
        }
        results = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON parse error:", parseError);
        console.error("Response text:", parseError.responseText || "No response text");
        throw new Error(`Invalid response from server: ${parseError.message}. Please check the file format and try again.`);
      }
      
      if (!results || (typeof results === 'object' && Object.keys(results).length === 0)) {
        throw new Error("No files were processed. Please ensure you selected valid CSV files.");
      }
      
      setUploadedFiles(prevUploadedFiles => {
        const newUploadedFiles: MinMaxUploadedFiles = { ...prevUploadedFiles };
        let hasError = false;
        
        Object.entries(results).forEach(([key, result]: [string, any]) => {
          if (result.success) {
            newUploadedFiles[key as keyof MinMaxUploadedFiles] = {
              data: [],
              preview: result.preview || [],
              recordCount: result.recordCount || 0
            };
            toast({
              title: "File uploaded",
              description: `${key} uploaded successfully with ${result.recordCount} records`,
            });
          } else {
            hasError = true;
            toast({
              title: "Upload failed",
              description: result.message || `Failed to upload ${key}`,
              variant: "destructive",
            });
          }
        });

        onFilesUploaded(newUploadedFiles);
        return newUploadedFiles;
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload error",
        description: error.message || "Failed to upload files. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const createDropzone = (
    fieldName: "itemMaster" | "supplyDemandData",
    label: string,
    fileName: string,
    requiredHeaders: string[]
  ) => {
    const isUploaded = !!uploadedFiles[fieldName];

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      accept: {
        "text/csv": [".csv"],
      },
      maxFiles: 1,
      onDrop: async (acceptedFiles) => {
        if (acceptedFiles.length > 0) {
          await uploadFiles({ [fieldName]: acceptedFiles[0] });
        }
      },
      disabled: isUploading,
    });

    return (
      <div key={fieldName} className="space-y-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : isUploaded
                ? "border-green-500 bg-green-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }
            ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {isUploaded ? (
              <>
                <CheckCircle className="w-8 h-8 text-green-500" />
                <p className="text-sm font-medium text-green-700">
                  {fileName} uploaded
                </p>
                <p className="text-xs text-green-600">
                  {uploadedFiles[fieldName]?.recordCount} records
                </p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? "Drop the file here"
                    : `Click or drag ${fileName} here`}
                </p>
                <p className="text-xs text-gray-500">
                  Required headers: {requiredHeaders.join(", ")}
                </p>
              </>
            )}
          </div>
        </div>
        {isUploaded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setUploadedFiles((prev) => {
                const newFiles = { ...prev };
                delete newFiles[fieldName];
                onFilesUploaded(newFiles);
                return newFiles;
              });
            }}
            className="w-full"
          >
            <X className="w-4 h-4 mr-2" />
            Remove
          </Button>
        )}
      </div>
    );
  };

  const clearAllFiles = () => {
    setUploadedFiles({});
    onFilesUploaded({});
  };

  const uploadedCount = Object.keys(uploadedFiles).length;

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Upload Required Files
          </h2>
          <p className="text-sm text-gray-600">
            Upload Item Master and Supply-Demand Data CSV files for min-max calculations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {createDropzone(
            "itemMaster",
            "Item Master",
            "ITEM_MASTER.csv",
            ["ITEM_NAME", "ORG_CODE", "SUPPLY_LEAD_TIME_VAR_DAYS", "SERVICE_LEVEL", "LEAD_TIME", "MIN_QUANTITY_LEVEL", "MAX_QUANTITY_LEVEL"]
          )}

          {createDropzone(
            "supplyDemandData",
            "Supply-Demand Data",
            "SUPPLY_DEMAND_DATA.csv",
            ["ORDER_GROUP", "ITEM_NAME", "ORG_CODE", "ORDER_TYPE", "ORDER_QUANTITY", "OLD_DUE_DATE", "SUGG_DUE_DATE"]
          )}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {uploadedCount > 0 && (
              <span>
                {uploadedCount} file{uploadedCount !== 1 ? "s" : ""} uploaded
              </span>
            )}
          </div>
          {uploadedCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFiles}>
              Clear All
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

