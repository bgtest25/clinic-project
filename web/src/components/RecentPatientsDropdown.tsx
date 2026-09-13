import { useEffect, useRef, useState } from 'react';
import { getRecentPatients, type RecentPatient } from '../utils/recentPatients';
import { ClockIcon } from '../icons';

interface RecentPatientsDropdownProps {
  onSelectPatient: (patientId: string) => void;
  onStartVisit: (patientId: string) => void;
}

export function RecentPatientsDropdown({ onSelectPatient, onStartVisit }: RecentPatientsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [patients, setPatients] = useState<RecentPatient[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPatients(getRecentPatients());
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="recent-patients" ref={dropdownRef}>
      <button
        type="button"
        className="recent-patients-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <ClockIcon />
        Recent
      </button>

      {open && (
        <div className="recent-patients-dropdown">
          <div className="recent-patients-header">Recent Patients</div>
          {patients.length === 0 ? (
            <div className="recent-patients-empty">
              No recent patients yet. Patients you view or create visits for will appear here.
            </div>
          ) : (
            <div className="recent-patients-list">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  className="recent-patient-item"
                  onClick={() => {
                    onSelectPatient(patient.id);
                    setOpen(false);
                  }}
                >
                  <div className="recent-patient-info">
                    <span className="recent-patient-name">{patient.name}</span>
                    <span className="recent-patient-dob">
                      DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className="recent-patient-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartVisit(patient.id);
                      setOpen(false);
                    }}
                  >
                    + New Visit
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
