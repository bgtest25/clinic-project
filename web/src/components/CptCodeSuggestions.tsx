import { useMemo, useState } from 'react';

interface CptCodeSuggestionsProps {
  plan: string;
  onAddCode: (code: string, description: string) => void;
}

interface CptCode {
  code: string;
  description: string;
  triggers: string[];
  category: 'office' | 'procedure' | 'injection' | 'counseling';
}

const CPT_CODES: CptCode[] = [
  // Office procedures
  {
    code: '99000',
    description: 'Specimen handling',
    triggers: ['specimen', 'sample', 'lab draw', 'blood draw'],
    category: 'office',
  },
  {
    code: '36415',
    description: 'Venipuncture',
    triggers: ['blood draw', 'venipuncture', 'phlebotomy', 'lab draw'],
    category: 'procedure',
  },
  {
    code: '81002',
    description: 'Urinalysis, non-automated',
    triggers: ['urinalysis', 'urine dip', 'ua'],
    category: 'procedure',
  },
  {
    code: '87880',
    description: 'Strep test, rapid',
    triggers: ['strep test', 'rapid strep', 'strep throat'],
    category: 'procedure',
  },
  {
    code: '87804',
    description: 'Influenza test, rapid',
    triggers: ['flu test', 'influenza test', 'rapid flu'],
    category: 'procedure',
  },
  {
    code: '87426',
    description: 'COVID-19 antigen test',
    triggers: ['covid test', 'covid-19', 'coronavirus test'],
    category: 'procedure',
  },
  // Injections
  {
    code: '90471',
    description: 'Immunization admin, 1st vaccine',
    triggers: ['vaccine', 'immunization', 'vaccination', 'flu shot'],
    category: 'injection',
  },
  {
    code: '90472',
    description: 'Immunization admin, each additional',
    triggers: ['additional vaccine', 'second vaccine'],
    category: 'injection',
  },
  {
    code: '96372',
    description: 'Therapeutic injection, IM/SQ',
    triggers: ['injection', 'im injection', 'intramuscular', 'toradol', 'depo'],
    category: 'injection',
  },
  {
    code: '20610',
    description: 'Joint injection, major',
    triggers: ['joint injection', 'knee injection', 'shoulder injection', 'steroid injection'],
    category: 'injection',
  },
  {
    code: '20605',
    description: 'Joint injection, intermediate',
    triggers: ['wrist injection', 'elbow injection', 'ankle injection'],
    category: 'injection',
  },
  {
    code: '20600',
    description: 'Joint injection, small',
    triggers: ['finger injection', 'toe injection', 'small joint'],
    category: 'injection',
  },
  // Procedures
  {
    code: '11102',
    description: 'Skin biopsy, tangential',
    triggers: ['shave biopsy', 'skin biopsy', 'lesion biopsy'],
    category: 'procedure',
  },
  {
    code: '11104',
    description: 'Skin biopsy, punch',
    triggers: ['punch biopsy', 'skin biopsy'],
    category: 'procedure',
  },
  {
    code: '17000',
    description: 'Destruction, lesion 1st',
    triggers: ['cryotherapy', 'liquid nitrogen', 'freeze', 'wart removal', 'lesion destruction'],
    category: 'procedure',
  },
  {
    code: '17003',
    description: 'Destruction, lesions 2-14',
    triggers: ['multiple lesions', 'additional lesion'],
    category: 'procedure',
  },
  {
    code: '10060',
    description: 'I&D abscess, simple',
    triggers: ['i&d', 'incision and drainage', 'abscess', 'drain'],
    category: 'procedure',
  },
  {
    code: '12001',
    description: 'Laceration repair, simple 2.5cm or less',
    triggers: ['laceration', 'suture', 'stitches', 'wound repair'],
    category: 'procedure',
  },
  {
    code: '69210',
    description: 'Cerumen removal',
    triggers: ['ear wax', 'cerumen', 'ear cleaning', 'impacted wax'],
    category: 'procedure',
  },
  {
    code: '93000',
    description: 'EKG with interpretation',
    triggers: ['ekg', 'ecg', 'electrocardiogram'],
    category: 'procedure',
  },
  {
    code: '94010',
    description: 'Spirometry',
    triggers: ['spirometry', 'pft', 'pulmonary function', 'breathing test'],
    category: 'procedure',
  },
  {
    code: '94760',
    description: 'Pulse oximetry',
    triggers: ['pulse ox', 'oxygen saturation', 'spo2'],
    category: 'procedure',
  },
  // Counseling
  {
    code: '99401',
    description: 'Preventive counseling, 15 min',
    triggers: ['counseling', 'education', 'lifestyle counseling'],
    category: 'counseling',
  },
  {
    code: '99406',
    description: 'Smoking cessation, 3-10 min',
    triggers: ['smoking cessation', 'tobacco counseling', 'quit smoking'],
    category: 'counseling',
  },
  {
    code: '99407',
    description: 'Smoking cessation, >10 min',
    triggers: ['smoking cessation', 'tobacco counseling', 'quit smoking'],
    category: 'counseling',
  },
  {
    code: 'G0442',
    description: 'Annual alcohol screening',
    triggers: ['alcohol screening', 'alcohol counseling', 'sbirt'],
    category: 'counseling',
  },
  {
    code: 'G0443',
    description: 'Alcohol brief intervention',
    triggers: ['alcohol intervention', 'alcohol counseling'],
    category: 'counseling',
  },
  {
    code: 'G0444',
    description: 'Annual depression screening',
    triggers: ['depression screening', 'phq', 'mental health screening'],
    category: 'counseling',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  office: 'Office',
  procedure: 'Procedures',
  injection: 'Injections',
  counseling: 'Counseling',
};

function findMatchingCodes(plan: string): CptCode[] {
  const text = plan.toLowerCase();
  return CPT_CODES.filter((code) =>
    code.triggers.some((trigger) => text.includes(trigger))
  );
}

export function CptCodeSuggestions({ plan, onAddCode }: CptCodeSuggestionsProps) {
  const [addedCodes, setAddedCodes] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const suggestions = useMemo(() => findMatchingCodes(plan), [plan]);
  const visibleSuggestions = suggestions.filter((s) => !addedCodes.has(s.code));

  function handleAddCode(code: CptCode) {
    onAddCode(code.code, code.description);
    setAddedCodes((prev) => new Set([...prev, code.code]));
  }

  if (visibleSuggestions.length === 0) {
    return null;
  }

  const groupedByCategory = visibleSuggestions.reduce(
    (acc, code) => {
      if (!acc[code.category]) acc[code.category] = [];
      acc[code.category].push(code);
      return acc;
    },
    {} as Record<string, CptCode[]>
  );

  const previewCodes = visibleSuggestions.slice(0, 4);

  return (
    <div className="cpt-suggestions">
      <div className="cpt-suggestions-header">
        <h3>CPT Code Suggestions</h3>
        {visibleSuggestions.length > 4 && (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Collapse' : `All (${visibleSuggestions.length})`}
          </button>
        )}
      </div>

      {expanded ? (
        <div className="cpt-grouped">
          {Object.entries(groupedByCategory).map(([category, codes]) => (
            <div key={category} className="cpt-group">
              <h4>{CATEGORY_LABELS[category] || category}</h4>
              {codes.map((code) => (
                <button
                  key={code.code}
                  type="button"
                  className="cpt-item"
                  onClick={() => handleAddCode(code)}
                >
                  <span className="cpt-code">{code.code}</span>
                  <span className="cpt-desc">{code.description}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="cpt-chips">
          {previewCodes.map((code) => (
            <button
              key={code.code}
              type="button"
              className="cpt-chip"
              onClick={() => handleAddCode(code)}
              title={code.description}
            >
              <span className="cpt-chip-code">{code.code}</span>
              <span className="cpt-chip-desc">{code.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
