import { useMemo, useState } from 'react';

interface EmLevelSuggestionProps {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  onSelectCode: (code: string) => void;
}

interface EmLevel {
  code: string;
  name: string;
  description: string;
  mdmLevel: string;
  timeRange: string;
  criteria: string[];
}

const EM_LEVELS: EmLevel[] = [
  {
    code: '99211',
    name: 'Level 1 (Minimal)',
    description: 'May not require presence of a physician',
    mdmLevel: 'N/A',
    timeRange: 'N/A',
    criteria: ['Typically nurse-only visit', 'Simple follow-up (e.g., BP check)', 'No new problems'],
  },
  {
    code: '99212',
    name: 'Level 2 (Straightforward)',
    description: 'Straightforward medical decision making',
    mdmLevel: 'Straightforward',
    timeRange: '10-19 min',
    criteria: [
      'Self-limited or minor problem',
      'Minimal data to review',
      'Minimal risk of complications',
    ],
  },
  {
    code: '99213',
    name: 'Level 3 (Low)',
    description: 'Low level of medical decision making',
    mdmLevel: 'Low',
    timeRange: '20-29 min',
    criteria: [
      '2+ self-limited problems OR 1 stable chronic illness',
      'Limited data review (order/review tests)',
      'Low risk (prescription drug management)',
    ],
  },
  {
    code: '99214',
    name: 'Level 4 (Moderate)',
    description: 'Moderate level of medical decision making',
    mdmLevel: 'Moderate',
    timeRange: '30-39 min',
    criteria: [
      '1+ chronic illness with mild exacerbation',
      '2+ chronic stable illnesses',
      '1 undiagnosed new problem with uncertain prognosis',
      'Moderate data review (independent interpretation)',
      'Moderate risk (prescription drug management requiring monitoring)',
    ],
  },
  {
    code: '99215',
    name: 'Level 5 (High)',
    description: 'High level of medical decision making',
    mdmLevel: 'High',
    timeRange: '40-54 min',
    criteria: [
      '1+ chronic illness with severe exacerbation',
      '1 acute or chronic illness that poses threat to life/function',
      'Extensive data review (external records, discussion with external physician)',
      'High risk (drug therapy requiring intensive monitoring, decision for major surgery)',
    ],
  },
];

function analyzeNoteComplexity(
  subjective: string,
  objective: string,
  assessment: string,
  plan: string
): { suggestedLevel: EmLevel; confidence: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  const allText = `${subjective} ${objective} ${assessment} ${plan}`.toLowerCase();
  const assessmentText = assessment.toLowerCase();
  const planText = plan.toLowerCase();

  const chronicIndicators = [
    'diabetes', 'hypertension', 'htn', 'copd', 'asthma', 'chf', 'heart failure',
    'chronic', 'ongoing', 'history of', 'controlled', 'uncontrolled', 'stable',
    'depression', 'anxiety', 'bipolar', 'arthritis', 'fibromyalgia', 'hypothyroid',
  ];
  const chronicCount = chronicIndicators.filter((i) => allText.includes(i)).length;

  if (chronicCount >= 3) {
    score += 3;
    factors.push('Multiple chronic conditions documented');
  } else if (chronicCount >= 1) {
    score += 1;
    factors.push('Chronic condition management');
  }

  const acuteIndicators = ['new onset', 'acute', 'exacerbation', 'worsening', 'flare'];
  if (acuteIndicators.some((i) => allText.includes(i))) {
    score += 2;
    factors.push('Acute or worsening condition');
  }

  const highRiskIndicators = [
    'chest pain', 'shortness of breath', 'syncope', 'stroke', 'mi', 'myocardial',
    'cancer', 'malignancy', 'tumor', 'emergency', 'hospitalization', 'icu',
    'surgery', 'surgical', 'biopsy', 'threat to life', 'severe',
  ];
  if (highRiskIndicators.some((i) => allText.includes(i))) {
    score += 2;
    factors.push('High-risk condition or presentation');
  }

  const dataIndicators = ['reviewed', 'results', 'labs', 'imaging', 'mri', 'ct scan', 'x-ray', 'ekg', 'ecg'];
  if (dataIndicators.some((i) => allText.includes(i))) {
    score += 1;
    factors.push('Data review documented');
  }

  const complexPlanIndicators = [
    'refer', 'referral', 'specialist', 'adjust', 'start', 'initiate', 'increase',
    'decrease', 'change', 'monitor', 'follow-up', 'additional testing',
  ];
  const planComplexity = complexPlanIndicators.filter((i) => planText.includes(i)).length;
  if (planComplexity >= 3) {
    score += 2;
    factors.push('Complex treatment plan');
  } else if (planComplexity >= 1) {
    score += 1;
    factors.push('Treatment management documented');
  }

  const totalLength = subjective.length + objective.length + assessment.length + plan.length;
  if (totalLength > 2000) {
    score += 1;
    factors.push('Comprehensive documentation');
  }

  const problemCount = (assessmentText.match(/\d\./g) || []).length;
  if (problemCount >= 3) {
    score += 1;
    factors.push(`${problemCount} problems addressed`);
  }

  let suggestedLevel: EmLevel;
  let confidence: number;

  if (score <= 1) {
    suggestedLevel = EM_LEVELS[1]; // 99212
    confidence = score === 0 ? 0.5 : 0.7;
  } else if (score <= 3) {
    suggestedLevel = EM_LEVELS[2]; // 99213
    confidence = 0.75;
  } else if (score <= 5) {
    suggestedLevel = EM_LEVELS[3]; // 99214
    confidence = 0.8;
  } else {
    suggestedLevel = EM_LEVELS[4]; // 99215
    confidence = 0.85;
  }

  if (factors.length === 0) {
    factors.push('Routine office visit');
  }

  return { suggestedLevel, confidence, factors };
}

export function EmLevelSuggestion({
  subjective,
  objective,
  assessment,
  plan,
  onSelectCode,
}: EmLevelSuggestionProps) {
  const [showDetails, setShowDetails] = useState(false);

  const analysis = useMemo(
    () => analyzeNoteComplexity(subjective, objective, assessment, plan),
    [subjective, objective, assessment, plan]
  );

  const hasContent = subjective || objective || assessment || plan;

  if (!hasContent) {
    return (
      <div className="em-level-suggestion em-level-empty">
        <p>Add note content to see E/M level suggestions.</p>
      </div>
    );
  }

  return (
    <div className="em-level-suggestion">
      <div className="em-level-header">
        <h3>E/M Level Suggestion</h3>
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>

      <div className="em-level-suggested">
        <div className="em-level-code-display">
          <span className="em-level-code">{analysis.suggestedLevel.code}</span>
          <span className="em-level-name">{analysis.suggestedLevel.name}</span>
        </div>
        <div className="em-level-meta">
          <span className="em-level-mdm">MDM: {analysis.suggestedLevel.mdmLevel}</span>
          <span className="em-level-time">Time: {analysis.suggestedLevel.timeRange}</span>
        </div>
        <div className="em-level-confidence">
          Confidence: {Math.round(analysis.confidence * 100)}%
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => onSelectCode(analysis.suggestedLevel.code)}
        >
          Add to codes
        </button>
      </div>

      <div className="em-level-factors">
        <span className="em-level-factors-label">Based on:</span>
        <ul>
          {analysis.factors.map((factor, i) => (
            <li key={i}>{factor}</li>
          ))}
        </ul>
      </div>

      {showDetails && (
        <div className="em-level-all">
          <h4>All E/M Levels (2021 Guidelines)</h4>
          <div className="em-level-grid">
            {EM_LEVELS.slice(1).map((level) => (
              <button
                key={level.code}
                type="button"
                className={`em-level-option ${level.code === analysis.suggestedLevel.code ? 'is-suggested' : ''}`}
                onClick={() => onSelectCode(level.code)}
              >
                <span className="em-level-option-code">{level.code}</span>
                <span className="em-level-option-name">{level.name}</span>
                <span className="em-level-option-time">{level.timeRange}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="em-level-disclaimer">
        This suggestion is based on documentation content analysis. Final coding decisions should
        be made by qualified coders based on complete medical record review.
      </p>
    </div>
  );
}
