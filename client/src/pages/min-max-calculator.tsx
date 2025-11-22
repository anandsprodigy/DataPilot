import { useState } from "react";
import { MinMaxFileUpload } from "@/components/min-max-file-upload";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { Download, Calculator, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MinMaxResult {
  ITEM_NAME: string;
  ORG_CODE: string;
  AVERAGE_DAILY_QTY: number;
  LEAD_TIME: number;
  SAFETY_STOCK: number;
  MIN_LEVEL: number;
  MAX_LEVEL: number;
  ORDER_QUANTITY: number;
  REVIEW_PERIOD_DAYS?: number;
  TOTAL_ORDERS?: number;
  TOTAL_ORDER_QUANTITY?: number;
}

interface MinMaxUploadedFiles {
  itemMaster?: { data: any[]; preview: any[]; recordCount: number };
  supplyDemandData?: { data: any[]; preview: any[]; recordCount: number };
}

export default function MinMaxCalculator() {
  const [uploadedFiles, setUploadedFiles] = useState<MinMaxUploadedFiles>({});
  const [reviewPeriodDays, setReviewPeriodDays] = useState(30);
  const [useSupplyDemandData, setUseSupplyDemandData] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<MinMaxResult[] | null>(null);
  const { toast } = useToast();

  const handleFilesUploaded = (files: MinMaxUploadedFiles) => {
    setUploadedFiles(files);
    setResults(null);
  };

  const handleCalculate = async () => {
    if (!uploadedFiles.itemMaster) {
      toast({
        title: "Missing Files",
        description: "Please upload Item Master file.",
        variant: "destructive",
      });
      return;
    }

    if (useSupplyDemandData && !uploadedFiles.supplyDemandData) {
      toast({
        title: "Missing Files",
        description: "Please upload Supply-Demand Data file when using supply-demand mode.",
        variant: "destructive",
      });
      return;
    }

// --- FIXED apiRequest FUNCTION ---
async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    method: options.method ?? "GET", // ✔ keeps your POST request intact
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null as T;
  }
}


//added change


    setCalculating(true);
    try {
      const response = await apiRequest<{
        success: boolean;
        results: MinMaxResult[];
        recordCount: number;
      }>("/api/minmax/calculate", {
        method: "POST",
        body: JSON.stringify({
          reviewPeriodDays,
          useSupplyDemandData,
        }),
      });

      if (response.success) {
        setResults(response.results);
        toast({
          title: "Calculation Complete",
          description: `Calculated min-max levels for ${response.recordCount} items.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Calculation Failed",
        description: error.message || "An error occurred during calculation.",
        variant: "destructive",
      });
    } finally {
      setCalculating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch("/api/minmax/download");
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "MIN_MAX_RESULTS.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Complete",
        description: "Min-Max results downloaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "An error occurred during download.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-inter">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Calculator className="w-8 h-8" />
            Min-Max Calculator
          </h1>
          <p className="text-gray-600 mt-2">
            Calculate minimum (reorder point) and maximum stock levels based on safety stock and demand patterns.
          </p>
        </div>

        {/* File Upload Section */}
        <MinMaxFileUpload onFilesUploaded={handleFilesUploaded} />

        {/* Configuration Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Calculation Parameters</CardTitle>
            <CardDescription>
              Configure review period and calculation method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reviewPeriod">Review Period (Days)</Label>
                <Input
                  id="reviewPeriod"
                  type="number"
                  min="1"
                  value={reviewPeriodDays}
                  onChange={(e) => setReviewPeriodDays(parseInt(e.target.value) || 30)}
                />
                <p className="text-sm text-gray-500">
                  Number of days between inventory reviews
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id="useSupplyDemandData"
                  checked={useSupplyDemandData}
                  onCheckedChange={setUseSupplyDemandData}
                />
                <Label htmlFor="useSupplyDemandData" className="cursor-pointer">
                  Use Supply-Demand Data (if available, falls back to History/Forecast)
                </Label>
              </div>
            </div>
            <Button
              onClick={handleCalculate}
              disabled={calculating || !uploadedFiles.itemMaster || (useSupplyDemandData && !uploadedFiles.supplyDemandData)}
              className="w-full md:w-auto"
            >
              {calculating ? "Calculating..." : "Calculate Min-Max Levels"}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {results && results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Min-Max Calculation Results</CardTitle>
                  <CardDescription>
                    {results.length} items calculated
                  </CardDescription>
                </div>
                <Button onClick={handleDownload} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Org Code</TableHead>
                      <TableHead>Avg Daily Qty</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Safety Stock</TableHead>
                      <TableHead>Min Level</TableHead>
                      <TableHead>Max Level</TableHead>
                      <TableHead>Order Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, idx) => (
                      <TableRow key={`${result.ITEM_NAME}-${result.ORG_CODE}-${idx}`}>
                        <TableCell className="font-medium">{result.ITEM_NAME}</TableCell>
                        <TableCell>{result.ORG_CODE}</TableCell>
                        <TableCell>{result.AVERAGE_DAILY_QTY.toLocaleString()}</TableCell>
                        <TableCell>{result.LEAD_TIME}</TableCell>
                        <TableCell>{result.SAFETY_STOCK.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {result.MIN_LEVEL.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {result.MAX_LEVEL.toLocaleString()}
                        </TableCell>
                        <TableCell>{result.ORDER_QUANTITY.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {results && results.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No results found. Please check your input files.</p>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}

