import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  name: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep, onStepClick }) => {
  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepClasses = (stepId: number) => {
    const status = getStepStatus(stepId);
    
    switch (status) {
      case 'completed':
        return 'bg-brand-500 text-white border-brand-500';
      case 'current':
        return 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-brand-500';
      case 'upcoming':
        return 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600';
    }
  };

  const getConnectorClasses = (stepId: number) => {
    const status = getStepStatus(stepId);
    
    if (status === 'completed') {
      return 'bg-brand-500';
    }
    return 'bg-slate-300 dark:bg-slate-600';
  };

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex items-center">
            <button
              onClick={() => onStepClick?.(step.id)}
              disabled={!onStepClick || step.id > currentStep}
              className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
                getStepClasses(step.id)
              } ${
                onStepClick && step.id <= currentStep 
                  ? 'hover:scale-105 cursor-pointer' 
                  : 'cursor-default'
              } ${
                step.id > currentStep ? 'opacity-50' : ''
              }`}
            >
              {getStepStatus(step.id) === 'completed' ? (
                <Check className="w-5 h-5" />
              ) : (
                <span className="text-sm font-semibold">{step.id}</span>
              )}
            </button>
            <div className="ml-3 hidden sm:block">
              <div className={`text-sm font-medium ${
                step.id === currentStep 
                  ? 'text-brand-600 dark:text-brand-400' 
                  : step.id < currentStep
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}>
                {step.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {step.description}
              </div>
            </div>
          </div>
          
          {/* Connector line */}
          {index < steps.length - 1 && (
            <div className="flex-1 mx-4 hidden sm:block">
              <div className={`h-0.5 transition-all duration-200 ${getConnectorClasses(step.id)}`} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepIndicator; 