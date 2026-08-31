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
  processingError: string | null;
}

export interface DiarizedSegment {
  speaker: string;
  text: string;
  startTime: string;
  endTime: string;
}

export interface Transcript {
  id: string;
  encounterId: string;
  rawText: string;
  // Rows written before speaker diarization was wired up hold `{}`, not an
  // array — always check Array.isArray before rendering as segments.
  diarizedSegments: unknown;
  sttProvider: string;
  createdAt: string;
}

export interface ClinicalNote {
  id: string;
  encounterId: string;
  version: number;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  suggestedCodes: string | null;
  status: 'DRAFT' | 'SIGNED' | 'AMENDED';
  signedById: string | null;
  signedAt: string | null;
  satisfactionRating: number | null;
  feedbackComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EncounterDetail extends Encounter {
  patient: Patient;
  transcript: Transcript | null;
  clinicalNotes: ClinicalNote[];
}

export interface EncounterListItem extends Encounter {
  patient: Patient;
}

export interface InviteUserPayload {
  email: string;
  name: string;
  role: 'ADMIN' | 'CLINICIAN';
}

export interface MetricsSummary {
  totalNotesSigned: number;
  avgReviewTimeSeconds: number | null;
  avgSatisfactionRating: number | null;
  satisfactionResponseCount: number;
  avgEditsPerNote: number | null;
}

export interface User extends Me {
  deactivatedAt: string | null;
  deactivatedById: string | null;
}

export interface DataRequest {
  id: string;
  patientId: string;
  requestType: string;
  reason: string | null;
  status: string;
  loggedById: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface Clinic {
  id: string;
  name: string;
}

export interface CreateDataRequestPayload {
  requestType: 'deletion' | 'amendment';
  reason?: string;
}

export interface ResolveDataRequestPayload {
  status: 'approved' | 'denied';
  resolutionNote?: string;
}

export interface UpdatePatientPayload {
  name?: string;
  dateOfBirth?: string;
}
