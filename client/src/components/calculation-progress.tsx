import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { type CalculationProgress } from "@shared/schema";

interface CalculationProgressProps {
  calculationId: string;
  onComplete: (progress: CalculationProgress) => void;
}

export function CalculationProgress({ calculationId, onComplete }: CalculationProgressProps) {
  const { data: progress } = useQuery<CalculationProgress>({
    queryKey: ['/api/calculate', calculationId],
    refetchInterval: (query) => {
      const data = query.state.data as CalculationProgress | undefined;
      return data?.step === 'complete' ? false : 2000;
    },
    refetchIntervalInBackground: false,
  });

  // Handle completion separately with useEffect
  useEffect(() => {
    if (progress?.step === 'complete') {
      onComplete(progress);
    }
  }, [progress, onComplete]);

  if (!progress) return null;

  const steps = [
    {
      key: 'validation',
      title: 'Data Validation',
      description: 'Verifying file structure and data integrity'
    },
    {
      key: 'history-calc',
      title: 'History-Based Safety Stock',
      description: 'Calculating using standard deviation and service factors'
    },
    {
      key: 'forecast-calc',
      title: 'Forecast-Based Safety Stock',
      description: 'Calculating using forecast error percentages'
    },
    {
      key: 'complete',
      title: 'Generate Reports',
      description: 'Creating downloadable CSV files'
    }
  ];

  const getStepStatus = (stepKey: string) => {
    const currentStepIndex = steps.findIndex(s => s.key === progress.step);
    const stepIndex = steps.findIndex(s => s.key === stepKey);
    
    if (stepIndex < currentStepIndex) return 'complete';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-white" />;
      case 'active':
        return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
      case 'pending':
        return <span className="text-xs font-medium text-gray-600">{steps.findIndex(s => getStepStatus(s.key) === 'pending') + 1}</span>;
      default:
        return null;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-500';
      case 'active': return 'bg-primary';
      case 'pending': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Safety Stock Calculations</h2>
          <p className="text-sm text-gray-600">
            Processing your data using advanced statistical models for optimal inventory management.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => {
            const status = getStepStatus(step.key);
            const isActive = status === 'active';
            
            return (
              <div key={step.key} className="flex items-center space-x-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getStepColor(status)}`}>
                  {getStepIcon(status)}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${status === 'pending' ? 'text-gray-500' : 'text-gray-900'}`}>
                    {step.title}
                  </p>
                  <p className={`text-xs ${status === 'pending' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {step.description}
                  </p>
                  {isActive && progress.progress > 0 && (
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  status === 'complete' ? 'text-green-600' :
                  status === 'active' ? 'text-primary' : 
                  'text-gray-400'
                }`}>
                  {status === 'complete' ? 'Complete' :
                   status === 'active' ? `${progress.progress}%` :
                   'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current Status */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-primary mr-2" />
            <p className="text-sm text-primary font-medium">{progress.message}</p>
          </div>
          {progress.step !== 'complete' && (
            <p className="text-xs text-blue-600 mt-1">
              Processing... Please wait while calculations complete.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
