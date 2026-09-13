import { useState } from 'react';

interface PatientInstructionsProps {
  plan: string;
  assessment: string;
  onCopy: (instructions: string) => void;
}

interface InstructionTemplate {
  id: string;
  title: string;
  triggers: string[];
  instructions: string[];
  warnings: string[];
}

const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  {
    id: 'hypertension',
    title: 'High Blood Pressure',
    triggers: ['hypertension', 'htn', 'high blood pressure', 'elevated bp'],
    instructions: [
      'Take your blood pressure medication at the same time each day',
      'Limit sodium intake to less than 2,300mg daily',
      'Exercise for at least 30 minutes most days of the week',
      'Monitor your blood pressure at home and keep a log',
      'Limit alcohol and avoid smoking',
    ],
    warnings: [
      'Severe headache with vision changes',
      'Chest pain or shortness of breath',
      'Blood pressure consistently above 180/120',
    ],
  },
  {
    id: 'diabetes',
    title: 'Diabetes Management',
    triggers: ['diabetes', 'diabetic', 'blood sugar', 'glucose', 'a1c'],
    instructions: [
      'Check your blood sugar as directed',
      'Take medications exactly as prescribed',
      'Follow your meal plan and count carbohydrates',
      'Check your feet daily for cuts, blisters, or sores',
      'Keep all follow-up appointments',
    ],
    warnings: [
      'Blood sugar below 70 or above 300 mg/dL',
      'Confusion, dizziness, or excessive thirst',
      'Wounds that do not heal',
    ],
  },
  {
    id: 'uti',
    title: 'Urinary Tract Infection',
    triggers: ['uti', 'urinary tract infection', 'bladder infection', 'dysuria'],
    instructions: [
      'Complete all antibiotics even if you feel better',
      'Drink plenty of water (8-10 glasses daily)',
      'Urinate when you feel the urge; do not hold it',
      'Wipe front to back after using the bathroom',
      'Avoid caffeine and alcohol until symptoms resolve',
    ],
    warnings: [
      'Fever above 101°F',
      'Back or flank pain',
      'Blood in urine',
      'Symptoms not improving after 48 hours of antibiotics',
    ],
  },
  {
    id: 'respiratory',
    title: 'Upper Respiratory Infection',
    triggers: ['uri', 'cold', 'upper respiratory', 'viral', 'cough', 'congestion'],
    instructions: [
      'Rest and stay hydrated with water, tea, or broth',
      'Use a humidifier to ease congestion',
      'Over-the-counter medications for symptom relief as directed',
      'Wash hands frequently to prevent spread',
      'Stay home while symptomatic to avoid infecting others',
    ],
    warnings: [
      'Difficulty breathing or shortness of breath',
      'Fever lasting more than 3-4 days',
      'Symptoms worsening after initial improvement',
      'Severe sore throat making it hard to swallow',
    ],
  },
  {
    id: 'back-pain',
    title: 'Back Pain',
    triggers: ['back pain', 'lumbar', 'low back', 'lbp'],
    instructions: [
      'Apply ice for the first 48 hours, then switch to heat',
      'Take anti-inflammatory medication as directed',
      'Avoid prolonged bed rest; gentle movement is helpful',
      'Practice good posture and ergonomics',
      'Do gentle stretching exercises as tolerated',
    ],
    warnings: [
      'Numbness or weakness in legs',
      'Loss of bladder or bowel control',
      'Fever with back pain',
      'Pain after a fall or injury',
    ],
  },
  {
    id: 'anxiety-depression',
    title: 'Anxiety/Depression',
    triggers: ['anxiety', 'depression', 'mental health', 'mood'],
    instructions: [
      'Take medication as prescribed; do not stop suddenly',
      'Attend all therapy appointments',
      'Practice regular sleep habits and exercise',
      'Reach out to support system when struggling',
      'Limit alcohol and caffeine intake',
    ],
    warnings: [
      'Thoughts of self-harm or suicide',
      'Severe anxiety or panic attacks',
      'Inability to perform daily activities',
      'New or worsening symptoms',
    ],
  },
  {
    id: 'gastro',
    title: 'Gastrointestinal Issues',
    triggers: ['gerd', 'reflux', 'nausea', 'vomiting', 'diarrhea', 'abdominal pain'],
    instructions: [
      'Eat smaller, more frequent meals',
      'Avoid spicy, fatty, or acidic foods',
      'Do not lie down for 2-3 hours after eating',
      'Stay hydrated, especially with diarrhea/vomiting',
      'Take medications as directed',
    ],
    warnings: [
      'Blood in stool or vomit',
      'Severe abdominal pain',
      'Signs of dehydration (dark urine, dizziness)',
      'Unable to keep any fluids down for 24 hours',
    ],
  },
];

function findMatchingTemplates(assessment: string, plan: string): InstructionTemplate[] {
  const text = `${assessment} ${plan}`.toLowerCase();
  return INSTRUCTION_TEMPLATES.filter((template) =>
    template.triggers.some((trigger) => text.includes(trigger))
  );
}

export function PatientInstructions({ plan, assessment, onCopy }: PatientInstructionsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const matchingTemplates = findMatchingTemplates(assessment, plan);

  if (matchingTemplates.length === 0) {
    return null;
  }

  function handleCopyAll(template: InstructionTemplate) {
    const text = `
${template.title.toUpperCase()}

INSTRUCTIONS:
${template.instructions.map((i) => `• ${i}`).join('\n')}

WHEN TO SEEK CARE:
${template.warnings.map((w) => `⚠️ ${w}`).join('\n')}
`.trim();
    onCopy(text);
  }

  return (
    <div className="patient-instructions">
      <div className="patient-instructions-header">
        <h3>Patient Instructions</h3>
        <span className="patient-instructions-count">{matchingTemplates.length} condition(s)</span>
      </div>

      <div className="patient-instructions-list">
        {matchingTemplates.map((template) => (
          <div key={template.id} className="patient-instruction-item">
            <button
              type="button"
              className="patient-instruction-toggle"
              onClick={() => setExpanded(expanded === template.id ? null : template.id)}
            >
              <span className="patient-instruction-title">{template.title}</span>
              <span className="patient-instruction-expand">
                {expanded === template.id ? '−' : '+'}
              </span>
            </button>

            {expanded === template.id && (
              <div className="patient-instruction-content">
                <div className="patient-instruction-section">
                  <h4>Instructions</h4>
                  <ul>
                    {template.instructions.map((inst, i) => (
                      <li key={i}>{inst}</li>
                    ))}
                  </ul>
                </div>

                <div className="patient-instruction-section patient-instruction-warnings">
                  <h4>When to Seek Care</h4>
                  <ul>
                    {template.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleCopyAll(template)}
                >
                  Copy to clipboard
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
