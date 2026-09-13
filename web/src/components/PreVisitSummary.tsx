import { useState, useEffect } from 'react';
import type { Patient } from '../api/types';

interface PreVisitSummaryProps {
  patient: Patient | null;
  visitReason?: string;
  previousVisitDate?: string;
  previousDiagnoses?: string[];
  medications?: string[];
  allergies?: string[];
  onClose?: () => void;
}

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PreVisitSummary({
  patient,
  visitReason,
  previousVisitDate,
  previousDiagnoses = [],
  medications = [],
  allergies = [],
  onClose,
}: PreVisitSummaryProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = patient ? `previsit-dismissed-${patient.id}` : null;
    if (key && sessionStorage.getItem(key) === 'true') {
      setDismissed(true);
    }
  }, [patient]);

  function handleDismiss() {
    setDismissed(true);
    if (patient) {
      sessionStorage.setItem(`previsit-dismissed-${patient.id}`, 'true');
    }
    onClose?.();
  }

  if (!patient || dismissed) {
    return null;
  }

  const age = calculateAge(patient.dateOfBirth);
  const hasAllergies = allergies.length > 0;
  const hasMedications = medications.length > 0;
  const hasPreviousDiagnoses = previousDiagnoses.length > 0;

  return (
    <div className="pre-visit-summary">
      <div className="pre-visit-header">
        <h3>Pre-Visit Summary</h3>
        <button
          type="button"
          className="pre-visit-close"
          onClick={handleDismiss}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="pre-visit-patient">
        <div className="pre-visit-patient-main">
          <span className="pre-visit-patient-name">{patient.name}</span>
          <span className="pre-visit-patient-demo">
            {age} y/o · DOB: {formatDate(patient.dateOfBirth)}
          </span>
        </div>
        {visitReason && (
          <div className="pre-visit-reason">
            <span className="pre-visit-label">Chief Complaint:</span>
            <span className="pre-visit-value">{visitReason}</span>
          </div>
        )}
      </div>

      <div className="pre-visit-sections">
        <div className={`pre-visit-section ${hasAllergies ? 'has-items' : ''}`}>
          <span className="pre-visit-section-icon">⚠️</span>
          <div className="pre-visit-section-content">
            <span className="pre-visit-section-title">Allergies</span>
            {hasAllergies ? (
              <ul className="pre-visit-list allergy-list">
                {allergies.map((allergy, i) => (
                  <li key={i}>{allergy}</li>
                ))}
              </ul>
            ) : (
              <span className="pre-visit-none">NKDA (No Known Drug Allergies)</span>
            )}
          </div>
        </div>

        <div className={`pre-visit-section ${hasMedications ? 'has-items' : ''}`}>
          <span className="pre-visit-section-icon">💊</span>
          <div className="pre-visit-section-content">
            <span className="pre-visit-section-title">Current Medications</span>
            {hasMedications ? (
              <ul className="pre-visit-list">
                {medications.slice(0, 5).map((med, i) => (
                  <li key={i}>{med}</li>
                ))}
                {medications.length > 5 && (
                  <li className="pre-visit-more">+{medications.length - 5} more</li>
                )}
              </ul>
            ) : (
              <span className="pre-visit-none">None documented</span>
            )}
          </div>
        </div>

        <div className={`pre-visit-section ${hasPreviousDiagnoses ? 'has-items' : ''}`}>
          <span className="pre-visit-section-icon">📋</span>
          <div className="pre-visit-section-content">
            <span className="pre-visit-section-title">Active Problems</span>
            {hasPreviousDiagnoses ? (
              <ul className="pre-visit-list">
                {previousDiagnoses.slice(0, 5).map((dx, i) => (
                  <li key={i}>{dx}</li>
                ))}
                {previousDiagnoses.length > 5 && (
                  <li className="pre-visit-more">+{previousDiagnoses.length - 5} more</li>
                )}
              </ul>
            ) : (
              <span className="pre-visit-none">None documented</span>
            )}
          </div>
        </div>
      </div>

      {previousVisitDate && (
        <div className="pre-visit-footer">
          Last visit: {formatDate(previousVisitDate)}
        </div>
      )}
    </div>
  );
}
