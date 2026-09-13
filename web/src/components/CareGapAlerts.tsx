import { useState } from 'react';
import type { Patient } from '../api/types';

interface CareGapAlertsProps {
  patient: Patient | null;
  onDismiss?: (gapId: string) => void;
  onAddress?: (gapId: string) => void;
}

interface CareGap {
  id: string;
  type: 'preventive' | 'screening' | 'immunization' | 'chronic';
  title: string;
  description: string;
  ageRange: [number, number] | null;
  frequency: string;
  gender?: 'M' | 'F' | null;
  priority: 'high' | 'medium' | 'low';
}

const CARE_GAPS: CareGap[] = [
  {
    id: 'colonoscopy',
    type: 'screening',
    title: 'Colorectal Cancer Screening',
    description: 'Colonoscopy recommended every 10 years starting at age 45',
    ageRange: [45, 75],
    frequency: 'every 10 years',
    gender: null,
    priority: 'high',
  },
  {
    id: 'mammogram',
    type: 'screening',
    title: 'Breast Cancer Screening',
    description: 'Mammogram recommended every 1-2 years starting at age 40',
    ageRange: [40, 74],
    frequency: 'every 1-2 years',
    gender: 'F',
    priority: 'high',
  },
  {
    id: 'pap-smear',
    type: 'screening',
    title: 'Cervical Cancer Screening',
    description: 'Pap smear every 3 years for ages 21-65, or every 5 years with HPV co-testing',
    ageRange: [21, 65],
    frequency: 'every 3-5 years',
    gender: 'F',
    priority: 'high',
  },
  {
    id: 'flu-vaccine',
    type: 'immunization',
    title: 'Annual Influenza Vaccine',
    description: 'Flu shot recommended annually for all patients 6 months and older',
    ageRange: null,
    frequency: 'annually',
    gender: null,
    priority: 'medium',
  },
  {
    id: 'pneumonia-vaccine',
    type: 'immunization',
    title: 'Pneumococcal Vaccine',
    description: 'PCV15/PCV20 recommended for adults 65+',
    ageRange: [65, 120],
    frequency: 'once',
    gender: null,
    priority: 'medium',
  },
  {
    id: 'shingles-vaccine',
    type: 'immunization',
    title: 'Shingles Vaccine',
    description: 'Shingrix recommended for adults 50+',
    ageRange: [50, 120],
    frequency: 'once (2-dose series)',
    gender: null,
    priority: 'medium',
  },
  {
    id: 'lipid-panel',
    type: 'preventive',
    title: 'Lipid Panel',
    description: 'Cholesterol screening recommended every 4-6 years for adults',
    ageRange: [20, 120],
    frequency: 'every 4-6 years',
    gender: null,
    priority: 'medium',
  },
  {
    id: 'diabetes-screening',
    type: 'preventive',
    title: 'Diabetes Screening',
    description: 'A1C or fasting glucose recommended every 3 years for adults 35+',
    ageRange: [35, 120],
    frequency: 'every 3 years',
    gender: null,
    priority: 'medium',
  },
  {
    id: 'bp-check',
    type: 'preventive',
    title: 'Blood Pressure Screening',
    description: 'Annual BP check recommended for all adults',
    ageRange: [18, 120],
    frequency: 'annually',
    gender: null,
    priority: 'low',
  },
  {
    id: 'aaa-screening',
    type: 'screening',
    title: 'Abdominal Aortic Aneurysm Screening',
    description: 'One-time ultrasound for men 65-75 who have ever smoked',
    ageRange: [65, 75],
    frequency: 'once',
    gender: 'M',
    priority: 'medium',
  },
  {
    id: 'dexa-scan',
    type: 'screening',
    title: 'Bone Density Screening',
    description: 'DEXA scan recommended for women 65+ or postmenopausal with risk factors',
    ageRange: [65, 120],
    frequency: 'every 2 years',
    gender: 'F',
    priority: 'medium',
  },
  {
    id: 'lung-cancer-screening',
    type: 'screening',
    title: 'Lung Cancer Screening',
    description: 'Low-dose CT for adults 50-80 with 20+ pack-year smoking history',
    ageRange: [50, 80],
    frequency: 'annually',
    gender: null,
    priority: 'high',
  },
];

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getApplicableGaps(patient: Patient | null): CareGap[] {
  if (!patient) return [];

  const age = calculateAge(patient.dateOfBirth);

  return CARE_GAPS.filter((gap) => {
    if (gap.ageRange) {
      const [min, max] = gap.ageRange;
      if (age < min || age > max) return false;
    }
    return true;
  }).sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function CareGapAlerts({ patient, onDismiss, onAddress }: CareGapAlertsProps) {
  const [dismissedGaps, setDismissedGaps] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const applicableGaps = getApplicableGaps(patient);
  const visibleGaps = applicableGaps.filter((g) => !dismissedGaps.has(g.id));
  const highPriorityCount = visibleGaps.filter((g) => g.priority === 'high').length;

  function handleDismiss(gapId: string) {
    setDismissedGaps((prev) => new Set([...prev, gapId]));
    onDismiss?.(gapId);
  }

  function handleAddress(gapId: string) {
    onAddress?.(gapId);
  }

  if (!patient || visibleGaps.length === 0) {
    return null;
  }

  const previewGaps = visibleGaps.slice(0, 3);
  const remainingCount = visibleGaps.length - 3;

  return (
    <div className="care-gap-alerts">
      <div className="care-gap-header">
        <h3>
          Care Gaps
          {highPriorityCount > 0 && (
            <span className="care-gap-badge care-gap-badge-high">{highPriorityCount} high priority</span>
          )}
        </h3>
        {visibleGaps.length > 3 && (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `Show all (${visibleGaps.length})`}
          </button>
        )}
      </div>

      <div className="care-gap-list">
        {(expanded ? visibleGaps : previewGaps).map((gap) => (
          <div key={gap.id} className={`care-gap-item care-gap-${gap.priority}`}>
            <div className="care-gap-icon">
              {gap.type === 'immunization' && '💉'}
              {gap.type === 'screening' && '🔬'}
              {gap.type === 'preventive' && '🩺'}
              {gap.type === 'chronic' && '📋'}
            </div>
            <div className="care-gap-content">
              <span className="care-gap-title">{gap.title}</span>
              <span className="care-gap-desc">{gap.description}</span>
              <span className="care-gap-frequency">Frequency: {gap.frequency}</span>
            </div>
            <div className="care-gap-actions">
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => handleAddress(gap.id)}
              >
                Address
              </button>
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                onClick={() => handleDismiss(gap.id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>

      {!expanded && remainingCount > 0 && (
        <p className="care-gap-more">
          + {remainingCount} more care gap{remainingCount > 1 ? 's' : ''}
        </p>
      )}

      <p className="care-gap-disclaimer">
        Based on USPSTF guidelines. Verify patient history before ordering.
      </p>
    </div>
  );
}
