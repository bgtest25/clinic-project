import { CheckIcon } from '../icons';

type StepStatus = 'pending' | 'active' | 'complete';

interface Step {
  label: string;
  status: StepStatus;
}

interface ProcessingProgressProps {
  currentStep: 'uploading' | 'transcribing' | 'drafting' | 'finalizing';
}

export function ProcessingProgress({ currentStep }: ProcessingProgressProps) {
  const getSteps = (): Step[] => {
    const steps: Step[] = [
      { label: 'Uploading recording', status: 'pending' },
      { label: 'Transcribing audio', status: 'pending' },
      { label: 'Generating SOAP note', status: 'pending' },
      { label: 'Finalizing', status: 'pending' },
    ];

    const stepMap: Record<string, number> = {
      uploading: 0,
      transcribing: 1,
      drafting: 2,
      finalizing: 3,
    };

    const activeIndex = stepMap[currentStep] ?? 0;

    return steps.map((step, index) => {
      if (index < activeIndex) {
        return { ...step, status: 'complete' };
      } else if (index === activeIndex) {
        return { ...step, status: 'active' };
      }
      return step;
    });
  };

  const steps = getSteps();

  return (
    <div className="processing-steps">
      {steps.map((step, index) => (
        <div key={index} className={`processing-step is-${step.status}`}>
          <div className="processing-step-indicator">
            {step.status === 'complete' ? (
              <CheckIcon />
            ) : (
              <span>{index + 1}</span>
            )}
          </div>
          <span className="processing-step-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}
