import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FilePreviewProps {
  files: {
    historyData?: { preview: any[]; recordCount: number };
    itemMaster?: { preview: any[]; recordCount: number };
    forecastData?: { preview: any[]; recordCount: number };
  };
}

export function FilePreview({ files }: FilePreviewProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<'historyData' | 'itemMaster' | 'forecastData'>('historyData');

  if (Object.keys(files).length === 0) return null;

  const activeData = files[activeTab];
  const availableTabs = Object.keys(files) as Array<keyof typeof files>;

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'historyData': return 'History Data';
      case 'itemMaster': return 'Item Master';
      case 'forecastData': return 'Forecast Data';
      default: return tab;
    }
  };

  if (!isVisible) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <Button
            variant="ghost"
            onClick={() => setIsVisible(true)}
            className="w-full justify-between"
          >
            <span>Show File Preview</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">File Preview</h2>
          <Button
            variant="ghost"
            onClick={() => setIsVisible(false)}
            className="text-primary hover:text-blue-700"
          >
            <span>Hide Preview</span>
            <ChevronUp className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Preview Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {getTabTitle(tab)}
              </button>
            ))}
          </nav>
        </div>

        {/* Preview Table */}
        {activeData && activeData.preview.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(activeData.preview[0]).map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeData.preview.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value: any, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="mt-3 text-xs text-gray-500 text-center">
          Showing first 10 rows of {activeData?.recordCount.toLocaleString()} total records
        </div>
      </CardContent>
    </Card>
  );
}
