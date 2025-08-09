import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle, RotateCcw } from "lucide-react";
import {
  type SafetyStockHistoryResult,
  type SafetyStockForecastResult,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface ResultsSectionProps {
  calculationId: string;
  historyResults?: SafetyStockHistoryResult[];
  forecastResults?: SafetyStockForecastResult[];
  onStartNew: () => void;
}

export function ResultsSection({
  calculationId,
  historyResults = [],
  forecastResults = [],
  onStartNew,
}: ResultsSectionProps) {
  const { toast } = useToast();

  const downloadResults = async (type: "history" | "forecast") => {
    try {
      const response = await fetch(`/api/download/${calculationId}/${type}`);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        type === "history"
          ? "SAFETY_STOCK_DATA.csv"
          : "SAFETY_STOCK_FCST_BASED.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description: `${type === "history" ? "History-based" : "Forecast-based"} results downloaded successfully`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download results. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadAllResults = async () => {
    try {
      const response = await fetch(`/api/download/${calculationId}/zip`);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      console.log("Download URL:", url);
      const a = document.createElement("a");
      console.log("Download link created:", a);
      a.href = url;
      console.log("Download link href set:", a.href);
      a.download = "safety_stock_results.zip";
      alert("Downloading zip file" + a.href + " " + a.download);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download started",
        description:
          "Both SAFETY_STOCK_DATA.csv and SAFETY_STOCK_FCST_BASED.csv downloaded as zip file",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download results. Please try again.",
        variant: "destructive",
      });
    }
  };

  const historyAvgDays =
    historyResults.length > 0
      ? (
          historyResults.reduce((sum, r) => sum + r.DAYS_OF_COVER, 0) /
          historyResults.length
        ).toFixed(1)
      : "0";

  const forecastAvgError =
    forecastResults.length > 0
      ? (
          forecastResults.reduce((sum, r) => sum + r.FORECAST_ERR_PERCENT, 0) /
          forecastResults.length
        ).toFixed(1)
      : "0";

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* History-Based Results */}
        {historyResults.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    History-Based Safety Stock
                  </h3>
                  <p className="text-sm text-gray-500">
                    Based on historical demand patterns
                  </p>
                </div>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Complete
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Items Processed
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {historyResults.length}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Avg Days Coverage
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {historyAvgDays}
                  </p>
                </div>
              </div>

              {/* Sample Results Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">
                        Item
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">
                        Org
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">
                        Safety Stock
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">
                        Days Cover
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {historyResults.slice(0, 3).map((result, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 text-gray-900">
                          {result.ITEM_NAME}
                        </td>
                        <td className="px-2 py-2 text-gray-900">
                          {result.ORG_CODE}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900">
                          {result.TOTAL_SS.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900">
                          {result.DAYS_OF_COVER.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => downloadResults("history")}
                  className="w-full text-primary border-blue-200 bg-blue-50 hover:bg-blue-100"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download History-Based Results (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Forecast-Based Results */}
        {forecastResults.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Forecast-Based Safety Stock
                  </h3>
                  <p className="text-sm text-gray-500">
                    Based on forecast error analysis
                  </p>
                </div>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Complete
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Items Processed
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {forecastResults.length}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    Avg Error Rate
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {forecastAvgError}%
                  </p>
                </div>
              </div>

              {/* Sample Results Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">
                        Item
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-gray-500">
                        Org
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">
                        Safety Stock
                      </th>
                      <th className="px-2 py-2 text-right font-medium text-gray-500">
                        Days Cover
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {forecastResults.slice(0, 3).map((result, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 text-gray-900">
                          {result.ITEM_NAME}
                        </td>
                        <td className="px-2 py-2 text-gray-900">
                          {result.ORG_CODE}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900">
                          {result.SAFETY_STOCK.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-900">
                          {result.DAYS_OF_COVER}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => downloadResults("forecast")}
                  className="w-full text-primary border-blue-200 bg-blue-50 hover:bg-blue-100"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Forecast-Based Results (CSV)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Combined Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Calculations Complete
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Safety stock calculations have been completed successfully. You
              can download the results or start a new calculation.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={downloadAllResults}
                className="bg-primary hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download All Results
              </Button>
              <Button variant="outline" onClick={onStartNew}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Start New Calculation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
