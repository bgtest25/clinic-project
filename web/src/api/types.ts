export interface Me {
  id: string;
  cognitoSub: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CLINICIAN';
  clinicId: string;
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  dateOfBirth: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  clinicianId: string;
  visitDate: string;
  status: string;
  consentCapturedAt: string | null;
  consentCapturedBy: string | null;
}
