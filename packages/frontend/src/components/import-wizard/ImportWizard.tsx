import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';

// Types -------------------------------------------------------------
interface Step {
  id: number;
  name: string;
  description?: string;
}

interface WizardContextValue {
  steps: Step[];
  currentStep: number;
  goTo: (step: number) => void;
  next: () => void;
  previous: () => void;
}

interface ImportWizardProps {
  /** Ordered list of steps */
  steps: Step[];
  /** Optional starting position (defaults to first step) */
  initialStep?: number;
  /** Render-prop pattern gives consumers full control while reusing navigation logic */
  children: (ctx: WizardContextValue) => ReactNode;
}

// Context -----------------------------------------------------------
const WizardContext = createContext<WizardContextValue | null>(null);

export const useWizard = (): WizardContextValue => {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used within <ImportWizard>');
  return ctx;
};

// Component ---------------------------------------------------------
const ImportWizard: React.FC<ImportWizardProps> = ({ steps, initialStep = steps[0]?.id ?? 1, children }) => {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  const goTo = useCallback((step: number) => {
    if (steps.some(s => s.id === step)) {
      setCurrentStep(step);
    }
  }, [steps]);

  const next = useCallback(() => {
    const idx = steps.findIndex(s => s.id === currentStep);
    const nextStep = steps[idx + 1];
    if (nextStep) setCurrentStep(nextStep.id);
  }, [currentStep, steps]);

  const previous = useCallback(() => {
    const idx = steps.findIndex(s => s.id === currentStep);
    const prevStep = steps[idx - 1];
    if (prevStep) setCurrentStep(prevStep.id);
  }, [currentStep, steps]);

  const contextValue: WizardContextValue = {
    steps,
    currentStep,
    goTo,
    next,
    previous,
  };

  return (
    <WizardContext.Provider value={contextValue}>
      {children(contextValue)}
    </WizardContext.Provider>
  );
};

export default ImportWizard; 