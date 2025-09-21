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
import Footer from "@/components/footer";
import Header from "@/components/header";

type AppState = "upload" | "calculating" | "results";

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
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [calculationId, setCalculationId] = useState<string>("");
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
    return (
      <div className="min-h-screen flex justify-center items-center text-2xl">
        Loading...
      </div>
    );
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
      const response = await apiRequest("POST", "/api/calculate", {
        historyData: uploadedFiles.historyData.data,
        itemMaster: uploadedFiles.itemMaster.data,
        forecastData: uploadedFiles.forecastData?.data || [],
      });

      const data = await response.json();
      setCalculationId(data.calculationId);
      setAppState("calculating");

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
    setAppState("results");
    toast({
      title: "Calculations complete",
      description: "All safety stock calculations have finished successfully",
    });
  };

  const startNewCalculation = () => {
    setAppState("upload");
    setUploadedFiles({});
    setCalculationId("");
    setResults(null);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-inter h-screen">
      <Header />
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* File Upload Section */}
        {appState === "upload" && (
          <>
            <FileUpload
              onFilesUploaded={handleFilesUploaded}
              onStartCalculation={startCalculation}
            />
            <FilePreview files={uploadedFiles} />
          </>
        )}

        {/* Calculation Progress Section */}
        {appState === "calculating" && (
          <CalculationProgress
            calculationId={calculationId}
            onComplete={handleCalculationComplete}
          />
        )}

        {/* Results Section */}
        {appState === "results" && results && (
          <ResultsSection
            calculationId={calculationId}
            historyResults={results.historyResults}
            forecastResults={results.forecastResults}
            onStartNew={startNewCalculation}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
