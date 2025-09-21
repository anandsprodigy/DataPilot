import { useState, useEffect } from "react";
import { FileUpload } from "@/components/file-upload";
import { FilePreview } from "@/components/file-preview";
import { CalculationProgress } from "@/components/calculation-progress";
import { ResultsSection } from "@/components/results-section";
import { BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { LogOut } from "lucide-react";
import { type CalculationProgress as CalculationProgressType } from "@shared/schema";

type AppState = 'upload' | 'calculating' | 'results';

interface UploadedFiles {
  historyData?: { data: any[]; preview: any[]; recordCount: number };
  itemMaster?: { data: any[]; preview: any[]; recordCount: number };
  forecastData?: { data: any[]; preview: any[]; recordCount: number };
}


type User = {
  firstName: string;
  lastName: string;
  emailAddress: string;
};

export default function Home() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [calculationId, setCalculationId] = useState<string>('');
  const [results, setResults] = useState<CalculationProgressType | null>(null);
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);


//manage session
  useEffect(() => {
    const stored = sessionStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    } else {
      // no session → redirect to login
      window.location.href = "/login";
    }
  }, []);

  if (!user) {
    return <div className="min-h-screen flex justify-center items-center text-2xl">Loading...</div>;
  }

  const handleFilesUploaded = (files: UploadedFiles) => {
    setUploadedFiles(files);
  };

  const startCalculation = async () => {
    if (!uploadedFiles.historyData || !uploadedFiles.itemMaster) {
      toast({
        title: "Missing required files",
        description: "Please upload both Historical Data and Item Master files",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/calculate', {
        historyData: uploadedFiles.historyData.data,
        itemMaster: uploadedFiles.itemMaster.data,
        forecastData: uploadedFiles.forecastData?.data || []
      });

      const data = await response.json();
      setCalculationId(data.calculationId);
      setAppState('calculating');
      
      toast({
        title: "Calculation started",
        description: "Safety stock calculations are now processing",
      });
    } catch (error: any) {
      toast({
        title: "Calculation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCalculationComplete = (progress: CalculationProgressType) => {
    setResults(progress);
    setAppState('results');
    toast({
      title: "Calculations complete",
      description: "All safety stock calculations have finished successfully",
    });
  };

  const startNewCalculation = () => {
    setAppState('upload');
    setUploadedFiles({});
    setCalculationId('');
    setResults(null);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-inter h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Safety Stock Calculator</h1>
                <p className="text-sm text-gray-500">Professional Supply Chain Analytics</p>
              </div>
            </div>
            <div className="flex justify-baseline items-center">
                <p className="mx-4">{user?user.firstName.toUpperCase()+" "+user.lastName.toUpperCase():"Not Logged In"}</p>
                <button type="button" className="text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300 font-medium rounded-full text-sm px-5 py-2.5 text-center me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900"         onClick={() => {
                    sessionStorage.clear();
                    window.location.href = "/login";
                    }}>LogOut</button>
          </div>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* File Upload Section */}
        {appState === 'upload' && (
          <>
            <FileUpload
              onFilesUploaded={handleFilesUploaded}
              onStartCalculation={startCalculation}
            />
            <FilePreview files={uploadedFiles} />
          </>
        )}

        {/* Calculation Progress Section */}
        {appState === 'calculating' && (
          <CalculationProgress
            calculationId={calculationId}
            onComplete={handleCalculationComplete}
          />
        )}

        {/* Results Section */}
        {appState === 'results' && results && (
          <ResultsSection
            calculationId={calculationId}
            historyResults={results.historyResults}
            forecastResults={results.forecastResults}
            onStartNew={startNewCalculation}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16 bottom-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">©{new Date().getFullYear()} Copyrights reserved.</p>
            <div className="flex space-x-6 mt-4 sm:mt-0">
              {/* <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Documentation</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">Support</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-700">API</a> */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
