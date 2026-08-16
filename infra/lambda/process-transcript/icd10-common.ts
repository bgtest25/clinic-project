// Mirrors web/src/data/icd10-common.ts. Duplicated rather than imported across
// the workspace boundary because the web app and this Lambda are two separate
// esbuild bundles (NodejsFunction bundles only what's reachable from
// lambda/process-transcript/index.ts) with no shared package between them —
// keep both copies in sync by hand if this list changes. Small (~60 entries),
// so the drift risk is low; worth promoting to an actual shared workspace
// package if it grows.
//
// A curated list of commonly-seen outpatient/urgent-care ICD-10-CM codes, meant purely as a
// grounding source for AI-suggested codes. This is NOT a complete or authoritative ICD-10-CM
// code set (the real tabular list has 70,000+ entries and changes yearly) — always verify
// against CMS/an EHR's certified code table before using a code for billing or the chart.
export interface Icd10Code {
  code: string;
  description: string;
  category: string;
}

export const ICD10_COMMON_CODES: Icd10Code[] = [
  // Respiratory
  { code: 'J00', description: 'Acute nasopharyngitis (common cold)', category: 'Respiratory' },
  { code: 'J01.90', description: 'Acute sinusitis, unspecified', category: 'Respiratory' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', category: 'Respiratory' },
  { code: 'J02.0', description: 'Streptococcal pharyngitis', category: 'Respiratory' },
  { code: 'J03.90', description: 'Acute tonsillitis, unspecified', category: 'Respiratory' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Respiratory' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', category: 'Respiratory' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified', category: 'Respiratory' },
  { code: 'J30.9', description: 'Allergic rhinitis, unspecified', category: 'Respiratory' },
  { code: 'J32.9', description: 'Chronic sinusitis, unspecified', category: 'Respiratory' },
  { code: 'R05.9', description: 'Cough, unspecified', category: 'Respiratory' },
  { code: 'R06.02', description: 'Shortness of breath', category: 'Respiratory' },

  // ENT / Eye
  { code: 'H66.90', description: 'Otitis media, unspecified ear', category: 'ENT / Eye' },
  { code: 'H60.90', description: 'Otitis externa, unspecified ear', category: 'ENT / Eye' },
  { code: 'R07.0', description: 'Pain in throat', category: 'ENT / Eye' },
  { code: 'H10.9', description: 'Unspecified conjunctivitis', category: 'ENT / Eye' },

  // Gastrointestinal
  { code: 'R10.9', description: 'Abdominal pain, unspecified', category: 'Gastrointestinal' },
  { code: 'R11.0', description: 'Nausea', category: 'Gastrointestinal' },
  { code: 'R11.2', description: 'Nausea with vomiting, unspecified', category: 'Gastrointestinal' },
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', category: 'Gastrointestinal' },
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis', category: 'Gastrointestinal' },
  { code: 'K59.00', description: 'Constipation, unspecified', category: 'Gastrointestinal' },
  { code: 'K52.9', description: 'Noninfective gastroenteritis and colitis, unspecified', category: 'Gastrointestinal' },
  { code: 'R19.7', description: 'Diarrhea, unspecified', category: 'Gastrointestinal' },

  // Musculoskeletal
  { code: 'M54.9', description: 'Dorsalgia, unspecified (back pain)', category: 'Musculoskeletal' },
  { code: 'M25.50', description: 'Pain in unspecified joint', category: 'Musculoskeletal' },
  { code: 'M79.10', description: 'Myalgia, unspecified site', category: 'Musculoskeletal' },
  { code: 'M17.9', description: 'Osteoarthritis of knee, unspecified', category: 'Musculoskeletal' },
  { code: 'M19.90', description: 'Osteoarthritis, unspecified site', category: 'Musculoskeletal' },
  { code: 'M62.830', description: 'Muscle spasm of back', category: 'Musculoskeletal' },

  // Dermatologic
  { code: 'L30.9', description: 'Dermatitis, unspecified', category: 'Dermatologic' },
  { code: 'L20.9', description: 'Atopic dermatitis, unspecified', category: 'Dermatologic' },
  { code: 'L03.90', description: 'Cellulitis, unspecified', category: 'Dermatologic' },
  { code: 'B35.9', description: 'Dermatophytosis, unspecified', category: 'Dermatologic' },
  { code: 'L50.9', description: 'Urticaria, unspecified', category: 'Dermatologic' },

  // Cardiovascular
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular' },
  { code: 'R00.0', description: 'Tachycardia, unspecified', category: 'Cardiovascular' },
  { code: 'R07.9', description: 'Chest pain, unspecified', category: 'Cardiovascular' },

  // Endocrine / Metabolic
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine' },
  { code: 'E66.9', description: 'Obesity, unspecified', category: 'Endocrine' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine' },
  { code: 'E86.0', description: 'Dehydration', category: 'Endocrine' },

  // Mental health
  { code: 'F41.9', description: 'Anxiety disorder, unspecified', category: 'Mental Health' },
  { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental Health' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified', category: 'Mental Health' },
  { code: 'F51.01', description: 'Primary insomnia', category: 'Mental Health' },

  // Genitourinary
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary' },
  { code: 'N30.90', description: 'Cystitis, unspecified without hematuria', category: 'Genitourinary' },
  { code: 'N23', description: 'Unspecified renal colic', category: 'Genitourinary' },
  { code: 'R30.0', description: 'Dysuria', category: 'Genitourinary' },
  { code: 'R31.9', description: 'Hematuria, unspecified', category: 'Genitourinary' },

  // Neurological
  { code: 'R51.9', description: 'Headache, unspecified', category: 'Neurological' },
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus', category: 'Neurological' },
  { code: 'R42', description: 'Dizziness and giddiness', category: 'Neurological' },

  // Infectious / General
  { code: 'B34.9', description: 'Viral infection, unspecified', category: 'Infectious / General' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'Infectious / General' },
  { code: 'R53.83', description: 'Fatigue', category: 'Infectious / General' },

  // Preventive / Well-visit
  { code: 'Z00.00', description: 'Encounter for general adult medical exam without abnormal findings', category: 'Preventive' },
  { code: 'Z00.01', description: 'Encounter for general adult medical exam with abnormal findings', category: 'Preventive' },
  { code: 'Z00.129', description: 'Encounter for routine child health exam without abnormal findings', category: 'Preventive' },
  { code: 'Z23', description: 'Encounter for immunization', category: 'Preventive' },

  // Injury (kept minimal — laterality/encounter-suffix codes are the most likely to be wrong
  // without a real chart to check, so only the most well-established generic ones are included)
  { code: 'S06.0X0A', description: 'Concussion without loss of consciousness, initial encounter', category: 'Injury' },
  { code: 'T14.90XA', description: 'Injury, unspecified, initial encounter', category: 'Injury' },
];
