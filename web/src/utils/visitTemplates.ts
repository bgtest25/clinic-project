export type TemplateCategory =
  | 'general'
  | 'cardiology'
  | 'psychiatry'
  | 'orthopedics'
  | 'obgyn'
  | 'dermatology'
  | 'pulmonology'
  | 'gastroenterology'
  | 'neurology'
  | 'pediatrics';

export interface VisitTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'general', label: 'General / Primary Care' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'psychiatry', label: 'Psychiatry / Behavioral Health' },
  { value: 'orthopedics', label: 'Orthopedics' },
  { value: 'obgyn', label: 'OB/GYN' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'pulmonology', label: 'Pulmonology' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'pediatrics', label: 'Pediatrics' },
];

export const VISIT_TEMPLATES: VisitTemplate[] = [
  // ============ GENERAL / PRIMARY CARE ============
  {
    id: 'annual-physical',
    name: 'Annual Physical',
    description: 'Comprehensive yearly exam',
    category: 'general',
    subjective: `Chief Complaint: Annual physical examination

History of Present Illness:
Patient presents for routine annual physical. Reports feeling well overall.

Review of Systems:
- Constitutional: No fever, chills, or unintentional weight changes
- HEENT: No headaches, vision changes, hearing loss, or sore throat
- Cardiovascular: No chest pain, palpitations, or edema
- Respiratory: No shortness of breath, cough, or wheezing
- GI: No abdominal pain, nausea, vomiting, or changes in bowel habits
- GU: No dysuria, frequency, or hematuria
- Musculoskeletal: No joint pain or muscle weakness
- Neurological: No dizziness, numbness, or tingling
- Psychiatric: No depression, anxiety, or sleep disturbances

Social History:
- Tobacco:
- Alcohol:
- Exercise:
- Diet:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- RR:  /min
- Temp:  °F
- SpO2: %
- Height:
- Weight:
- BMI:

Physical Examination:
- General: Well-appearing, well-nourished, in no acute distress
- HEENT: Normocephalic, PERRLA, TMs clear bilaterally, oropharynx clear
- Neck: Supple, no lymphadenopathy, no thyromegaly
- Cardiovascular: Regular rate and rhythm, no murmurs, rubs, or gallops
- Respiratory: Clear to auscultation bilaterally, no wheezes or crackles
- Abdomen: Soft, non-tender, non-distended, normal bowel sounds
- Extremities: No edema, pulses 2+ bilaterally
- Skin: No rashes or lesions
- Neurological: Alert and oriented, cranial nerves II-XII intact`,
    assessment: `1. Annual physical examination - Routine
2.`,
    plan: `1. Health maintenance:
   - Reviewed immunization status
   - Discussed age-appropriate cancer screenings
   - Counseled on diet, exercise, and lifestyle modifications

2. Labs ordered:
   - CBC, CMP, Lipid panel

3. Referrals:

4. Follow-up: Return in 1 year for next annual exam, or sooner if concerns arise

5. Patient education provided regarding:
   - Preventive care recommendations
   - Warning signs to watch for`,
  },
  {
    id: 'sick-visit',
    name: 'Sick Visit',
    description: 'Acute illness evaluation',
    category: 'general',
    subjective: `Chief Complaint:

History of Present Illness:
- Onset:
- Duration:
- Location:
- Character:
- Severity (1-10):
- Aggravating factors:
- Alleviating factors:
- Associated symptoms:

Pertinent negatives:
- No fever/chills

Treatments tried:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- RR:  /min
- Temp:  °F
- SpO2: %

Physical Examination:
- General:
- Pertinent positives:
- Pertinent negatives:`,
    assessment: `1.

Differential diagnosis considered:`,
    plan: `1.

2. Medications:

3. Patient education:
   - Return precautions discussed
   - Advised to return if symptoms worsen or fail to improve

4. Follow-up:`,
  },
  {
    id: 'follow-up',
    name: 'Follow-up Visit',
    description: 'Problem-focused follow-up',
    category: 'general',
    subjective: `Chief Complaint: Follow-up for

Interval History:
Since last visit, patient reports:
- Symptoms:
- Medication compliance:
- Side effects:
- New concerns:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- Weight:

Focused Physical Examination:`,
    assessment: `1.

Progress: [Improved / Stable / Worsening]`,
    plan: `1. Continue current management:

2. Medication changes:

3. Follow-up: Return in  weeks/months

4. Patient verbalized understanding of plan`,
  },
  {
    id: 'chronic-care',
    name: 'Chronic Care Management',
    description: 'Ongoing chronic condition management',
    category: 'general',
    subjective: `Chief Complaint: Chronic care visit for

Disease-Specific Review:
- Current symptoms:
- Symptom control: [Well-controlled / Partially controlled / Uncontrolled]
- Exacerbations since last visit:
- Hospitalizations/ED visits:

Medication Review:
- Current medications:
- Compliance:
- Side effects:
- Refills needed:

Lifestyle:
- Diet adherence:
- Exercise:
- Smoking/Alcohol:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- Weight: (change since last visit: )

Disease-Specific Measurements:

Physical Examination:`,
    assessment: `1. [Condition] - [Controlled / Uncontrolled]
   - Current stage/severity:
   - Complications:

2.`,
    plan: `1. Medication management:
   - Continue:
   - Adjust:
   - Add:

2. Monitoring:
   - Labs ordered:
   - Next relevant test:

3. Referrals:

4. Patient education:
   - Disease management
   - Warning signs
   - When to seek urgent care

5. Follow-up: Return in  months

6. Care coordination:`,
  },

  // ============ CARDIOLOGY ============
  {
    id: 'cardiology-chest-pain',
    name: 'Chest Pain Evaluation',
    description: 'Cardiac workup for chest pain',
    category: 'cardiology',
    subjective: `Chief Complaint: Chest pain

History of Present Illness:
- Onset:
- Duration:
- Location: [Substernal / Left-sided / Diffuse]
- Character: [Sharp / Dull / Pressure / Squeezing / Burning]
- Radiation: [Arm / Jaw / Back / None]
- Severity (1-10):
- Aggravating factors: [Exertion / Deep breath / Position / Food]
- Alleviating factors: [Rest / Nitro / Antacids / Position change]
- Associated symptoms: [Dyspnea / Diaphoresis / Nausea / Palpitations]

Cardiac Risk Factors:
- Hypertension:
- Diabetes:
- Hyperlipidemia:
- Smoking history:
- Family history of CAD:
- Prior cardiac history:

Pertinent Negatives:
- No syncope
- No lower extremity edema
- No orthopnea/PND`,
    objective: `Vital Signs:
- BP: /  mmHg (both arms if indicated)
- HR:  bpm
- RR:  /min
- SpO2: %

Physical Examination:
- General: [Distress level]
- Cardiovascular:
  - JVP: [cm above sternal angle]
  - Carotid pulses: [Normal / Bruit]
  - Heart sounds: S1/S2 [Regular / Irregular], [Murmurs / Gallops]
  - PMI: [Location]
- Respiratory: [Breath sounds, crackles, wheezes]
- Extremities: [Edema, pulses, capillary refill]
- Abdomen: [Hepatomegaly, ascites]

Diagnostics:
- ECG: [Rhythm, rate, intervals, ST changes, Q waves]
- Prior ECG comparison:`,
    assessment: `1. Chest pain - [Typical angina / Atypical angina / Non-cardiac]
   - HEART score:
   - Risk stratification:

2. [Related conditions]`,
    plan: `1. Acute management:
   - Aspirin (if not contraindicated):
   - Nitroglycerin PRN:
   - Beta-blocker:

2. Diagnostic workup:
   - Troponin serial:
   - Stress test:
   - Echocardiogram:
   - Cardiac catheterization if indicated:

3. Risk factor modification:
   - Statin therapy:
   - Blood pressure control:
   - Smoking cessation:

4. Return precautions: Return immediately for worsening chest pain, dyspnea, diaphoresis, or syncope

5. Follow-up:`,
  },
  {
    id: 'cardiology-hf',
    name: 'Heart Failure Follow-up',
    description: 'CHF management visit',
    category: 'cardiology',
    subjective: `Chief Complaint: Heart failure follow-up

Interval History:
- Dyspnea: [At rest / With exertion / Stable]
- Orthopnea: [Number of pillows]
- PND: [Yes / No]
- Lower extremity swelling:
- Weight changes:
- Exercise tolerance: [Flights of stairs / Blocks walked]
- Hospitalizations since last visit:

NYHA Functional Class: [I / II / III / IV]

Medication Compliance:
- Diuretic:
- ACE-I/ARB/ARNI:
- Beta-blocker:
- MRA:
- SGLT2i:

Diet:
- Sodium restriction adherence:
- Fluid restriction adherence:
- Daily weights:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- Weight:  (dry weight goal: )
- SpO2: %

Physical Examination:
- General: [Distress level, cachexia]
- JVD: [cm above sternal angle at 45°]
- Cardiovascular:
  - Rhythm: [Regular / Irregular]
  - S3 gallop: [Present / Absent]
  - Murmurs:
- Respiratory:
  - Crackles: [None / Bases / Diffuse]
  - Decreased breath sounds:
- Abdomen:
  - Hepatomegaly:
  - Ascites:
- Extremities:
  - Edema: [ + / pitting / non-pitting]
  - Location: [Pedal / Pretibial / Thigh / Sacral]

Recent Labs/Studies:
- BNP/NT-proBNP:
- Creatinine/GFR:
- Potassium:
- Last echo (EF):`,
    assessment: `1. Heart failure with [reduced / preserved] ejection fraction
   - EF: %
   - NYHA Class:
   - Volume status: [Euvolemic / Hypervolemic / Hypovolemic]
   - Etiology:

2. [Comorbidities]`,
    plan: `1. Volume management:
   - Diuretic adjustment:
   - Weight goal:
   - Fluid restriction:

2. GDMT optimization:
   - ACE-I/ARB/ARNI:
   - Beta-blocker:
   - MRA:
   - SGLT2i:

3. Device therapy:
   - ICD/CRT status:

4. Monitoring:
   - Labs:
   - Next echo:

5. Lifestyle:
   - Sodium < 2g/day
   - Daily weights
   - Exercise as tolerated

6. Follow-up:`,
  },

  // ============ PSYCHIATRY ============
  {
    id: 'psychiatry-initial',
    name: 'Psychiatric Initial Evaluation',
    description: 'Comprehensive psychiatric assessment',
    category: 'psychiatry',
    subjective: `Chief Complaint:

History of Present Illness:
- Onset of current symptoms:
- Precipitating factors:
- Course: [Acute / Gradual / Chronic]
- Symptom severity:
- Impact on functioning:
- Prior episodes:

Psychiatric Review of Systems:
- Mood: [Depressed / Anxious / Irritable / Elevated]
- Sleep: [Insomnia / Hypersomnia / Pattern]
- Appetite/Weight changes:
- Energy level:
- Concentration:
- Interest/Pleasure (anhedonia):
- Guilt/Worthlessness:
- Psychomotor changes:
- Suicidal ideation: [Denied / Passive / Active - Plan/Intent]
- Homicidal ideation: [Denied / Present]
- Hallucinations: [Denied / Auditory / Visual / Other]
- Delusions: [Denied / Type]
- Anxiety symptoms:
- Panic attacks:
- Obsessions/Compulsions:
- Trauma history:
- Mania symptoms:

Safety Assessment:
- Current SI: [Denied / Passive / Active]
- Plan:
- Intent:
- Access to means:
- Protective factors:
- HI: [Denied / Present]

Psychiatric History:
- Prior diagnoses:
- Prior hospitalizations:
- Prior suicide attempts:
- Previous treatments/response:
- Current medications:

Substance Use History:
- Alcohol:
- Cannabis:
- Opioids:
- Stimulants:
- Other:
- Last use:

Family Psychiatric History:

Social History:
- Living situation:
- Employment/School:
- Relationships:
- Support system:
- Legal issues:`,
    objective: `Mental Status Examination:
- Appearance: [Grooming, dress, hygiene]
- Behavior: [Psychomotor activity, eye contact, cooperation]
- Speech: [Rate, rhythm, volume, tone]
- Mood (patient's words):
- Affect: [Range, congruence, appropriateness]
- Thought Process: [Linear / Circumstantial / Tangential / Disorganized]
- Thought Content:
  - Suicidal ideation:
  - Homicidal ideation:
  - Delusions:
  - Obsessions:
- Perceptions:
  - Hallucinations:
  - Illusions:
- Cognition:
  - Orientation:
  - Attention:
  - Memory:
- Insight: [Good / Fair / Poor]
- Judgment: [Good / Fair / Poor]

Physical Examination (if indicated):
- Vital signs:
- General appearance:
- Neurological:`,
    assessment: `1. [Primary diagnosis]
   - Severity: [Mild / Moderate / Severe]
   - With/without psychotic features:

2. [Comorbid conditions]

3. Risk Assessment:
   - Suicide risk: [Low / Moderate / High]
   - Violence risk: [Low / Moderate / High]`,
    plan: `1. Safety:
   - Safety plan reviewed:
   - Crisis resources provided:
   - Lethal means counseling:

2. Medication:
   - Starting:
   - Continuing:
   - Discontinuing:

3. Therapy:
   - Type recommended:
   - Referral:

4. Labs/Studies:

5. Coordination of care:

6. Follow-up: Return in  weeks

7. Emergency instructions: Go to nearest ER or call 988 if safety concerns arise`,
  },
  {
    id: 'psychiatry-followup',
    name: 'Psychiatric Follow-up',
    description: 'Medication management visit',
    category: 'psychiatry',
    subjective: `Chief Complaint: Psychiatric follow-up

Interval History:
- Overall status since last visit: [Better / Same / Worse]
- Mood:
- Sleep:
- Anxiety:
- Energy:
- Concentration:
- Appetite:

Medication Review:
- Current medications:
- Compliance:
- Side effects:
- Effectiveness:

Safety Screen:
- Suicidal ideation: [Denied]
- Homicidal ideation: [Denied]
- Self-harm:

Substance use:
- Alcohol:
- Other:

Functioning:
- Work/School:
- Relationships:
- Activities:

Stressors:`,
    objective: `Mental Status Examination:
- Appearance:
- Behavior:
- Speech:
- Mood:
- Affect:
- Thought Process:
- Thought Content: Denies SI/HI
- Perceptions: No AVH
- Cognition: A&Ox4
- Insight/Judgment:`,
    assessment: `1. [Diagnosis] - [Stable / Improved / Worsening]
   - On current regimen:
   - Response to treatment:

2.`,
    plan: `1. Medications:
   - Continue:
   - Adjust:
   - Add:
   - Taper:

2. Therapy:
   - Continue:
   - Referral:

3. Labs if indicated:

4. Follow-up: Return in  weeks

5. Safety plan reviewed, crisis resources reinforced`,
  },

  // ============ ORTHOPEDICS ============
  {
    id: 'ortho-joint-pain',
    name: 'Joint Pain Evaluation',
    description: 'Musculoskeletal complaint workup',
    category: 'orthopedics',
    subjective: `Chief Complaint: [Joint] pain

History of Present Illness:
- Location: [Specific joint/region]
- Laterality: [Right / Left / Bilateral]
- Onset: [Acute / Gradual / Traumatic]
- Duration:
- Character: [Aching / Sharp / Stiff / Burning]
- Severity (1-10):
- Timing: [Constant / Intermittent / Morning stiffness duration]
- Aggravating factors: [Weight-bearing / Stairs / Activity / Weather]
- Alleviating factors: [Rest / Ice / Heat / Medication]
- Associated symptoms: [Swelling / Redness / Warmth / Locking / Giving way]
- Mechanism of injury (if applicable):
- Previous episodes:
- Prior imaging:
- Prior treatments:
- Impact on function/ADLs:

Red Flags Review:
- No fever
- No unintentional weight loss
- No night pain waking from sleep
- No history of malignancy
- No IV drug use`,
    objective: `Physical Examination:

Inspection:
- Swelling:
- Erythema:
- Deformity:
- Atrophy:
- Gait (if applicable):

Palpation:
- Point tenderness:
- Warmth:
- Effusion:
- Crepitus:

Range of Motion:
- Active:
- Passive:
- Compared to contralateral:

Strength Testing:
- [Relevant muscle groups]:  /5

Special Tests:
[Joint-specific tests performed]

Neurovascular:
- Sensation:
- Pulses:
- Capillary refill:

Imaging Review:
- X-ray:
- MRI:
- Other:`,
    assessment: `1. [Joint] pain
   - Likely etiology: [OA / RA / Tendinopathy / Bursitis / Meniscal / Ligamentous]
   - Severity:
   - Chronicity:

2.`,
    plan: `1. Conservative management:
   - Activity modification:
   - Physical therapy referral:
   - Home exercise program:
   - Ice/Heat:
   - Bracing/Support:

2. Medications:
   - NSAIDs:
   - Topical agents:
   - Acetaminophen:

3. Injection therapy (if indicated):
   - Corticosteroid:
   - Hyaluronic acid:

4. Imaging:
   - X-ray:
   - MRI:

5. Referral:
   - Orthopedic surgery:
   - Rheumatology:

6. Follow-up: Return in  weeks if not improving

7. Return precautions: Return sooner for worsening pain, fever, inability to bear weight, or new neurological symptoms`,
  },

  // ============ OB/GYN ============
  {
    id: 'obgyn-prenatal',
    name: 'Prenatal Visit',
    description: 'Routine pregnancy check',
    category: 'obgyn',
    subjective: `Chief Complaint: Routine prenatal visit

Gestational Age:  weeks  days by [LMP / US]
EDD:
G P

Interval History:
- Fetal movement: [Present / Not yet felt]
- Contractions:
- Vaginal bleeding:
- Leakage of fluid:
- Dysuria:
- Headache:
- Visual changes:
- Epigastric pain:
- Swelling:

Current Symptoms:
- Nausea/Vomiting:
- Fatigue:
- Other:

Medications/Supplements:
- Prenatal vitamin:
- Folic acid:
- Iron:
- Other:

Diet/Nutrition:
Smoking/Alcohol/Drugs: Denies`,
    objective: `Vital Signs:
- BP: /  mmHg
- Weight:  (pre-pregnancy weight: , total gain: )
- HR:  bpm

Physical Examination:
- General: Well-appearing, NAD
- Cardiovascular: RRR
- Extremities: [Edema assessment]

Obstetric Examination:
- Fundal height:  cm
- Fetal heart tones:  bpm by Doppler
- Fetal position (if applicable):
- Cervical exam (if indicated):

Labs/Studies:
- Most recent:
- Today:`,
    assessment: `1. Intrauterine pregnancy at  weeks
   - [Appropriate / Small / Large] for gestational age
   - Fetal heart tones present

2. [Any complications or comorbidities]`,
    plan: `1. Routine prenatal care:
   - Continue prenatal vitamins
   - Continue current medications

2. Labs/Studies:
   - [Gestational age-appropriate testing]

3. Patient education:
   - Warning signs reviewed (bleeding, decreased fetal movement, ROM, severe headache, vision changes)
   - Kick counts starting at 28 weeks

4. Next visit:  weeks

5. Upcoming milestones:
   - Anatomy scan:
   - Glucose screening:
   - GBS screening:`,
  },
  {
    id: 'obgyn-gyn-annual',
    name: 'Annual GYN Exam',
    description: "Women's health visit",
    category: 'obgyn',
    subjective: `Chief Complaint: Annual gynecologic examination

Menstrual History:
- LMP:
- Cycle length:  days
- Duration:  days
- Flow: [Light / Moderate / Heavy]
- Dysmenorrhea:
- Intermenstrual bleeding:
- Postcoital bleeding:

Obstetric History:
- G P Ab

Contraception:
- Current method:
- Satisfaction:
- Desire for pregnancy:

Sexual History:
- Sexually active:
- Partners: [Male / Female / Both]
- Dyspareunia:
- STI history:

GYN History:
- Prior abnormal Pap:
- Prior GYN surgeries:
- History of fibroids/cysts:

Breast:
- Self-exam:
- Prior mammogram:
- Breast complaints:

Urinary:
- Incontinence:
- Frequency/Urgency:

Review of Systems:
- Hot flashes:
- Mood changes:
- Vaginal dryness:`,
    objective: `Vital Signs:
- BP: /  mmHg
- Weight:
- BMI:

Physical Examination:
- Thyroid: No nodules or enlargement
- Breast: No masses, tenderness, or discharge
- Abdomen: Soft, non-tender, no masses

Pelvic Examination:
- External: Normal vulva and perineum
- Vagina: Normal rugae, no lesions or discharge
- Cervix: [Appearance], no CMT
- Uterus: [Size, position, mobility]
- Adnexa: No masses or tenderness

Specimens Collected:
- Pap smear:
- HPV co-testing:
- STI screening:`,
    assessment: `1. Annual gynecologic examination
   - Screening status:
   - Contraception:

2.`,
    plan: `1. Cervical cancer screening:
   - Pap smear collected
   - HPV co-testing (if age-appropriate)
   - Results will be communicated

2. Contraception:
   - [Current plan]

3. Breast health:
   - Mammogram: [Due / Ordered / Up to date]

4. STI screening:
   - [Tests ordered]

5. Immunizations:
   - HPV:
   - Tdap:

6. Health maintenance counseling:
   - [Topics discussed]

7. Follow-up: Return in 1 year or sooner if concerns`,
  },

  // ============ DERMATOLOGY ============
  {
    id: 'derm-skin-lesion',
    name: 'Skin Lesion Evaluation',
    description: 'Dermatologic lesion assessment',
    category: 'dermatology',
    subjective: `Chief Complaint: Skin lesion/rash

History of Present Illness:
- Location:
- Duration:
- Onset: [Sudden / Gradual]
- Evolution: [Changing / Stable]
- Symptoms: [Pruritus / Pain / Burning / None]
- Prior similar lesions:
- Triggers identified:
- Treatments tried:
- Response to treatment:

Associated Symptoms:
- Fever:
- Arthralgias:
- Other systemic symptoms:

Exposures:
- New medications:
- New products (soap, detergent, cosmetics):
- Contacts with similar rash:
- Travel:
- Occupational:
- Sun exposure:

Personal History:
- Atopy (eczema, asthma, allergies):
- Prior skin cancers:
- Immunosuppression:

Family History:
- Skin cancer:
- Psoriasis:
- Atopic conditions:

Sun Exposure History:
- Sunburns:
- Tanning bed use:
- Sun protection habits:`,
    objective: `Skin Examination:

Primary Lesion Description:
- Type: [Macule / Papule / Plaque / Nodule / Vesicle / Pustule / Patch]
- Color:
- Size:
- Shape: [Round / Oval / Irregular / Annular]
- Border: [Well-defined / Ill-defined / Raised]
- Surface: [Smooth / Rough / Scaly / Crusted]
- Distribution: [Localized / Generalized / Pattern]
- Arrangement: [Grouped / Linear / Dermatomal / Scattered]

Secondary Changes:
- Scale:
- Crust:
- Erosion:
- Ulceration:
- Lichenification:
- Excoriation:

ABCDE Assessment (if pigmented lesion):
- Asymmetry:
- Border:
- Color:
- Diameter:
- Evolution:

Additional Findings:
- Lymphadenopathy:
- Nail changes:
- Mucosal involvement:

Dermoscopy (if performed):`,
    assessment: `1. [Lesion description] - [Location]
   - Differential diagnosis:
     a.
     b.
     c.
   - Most likely:

2.`,
    plan: `1. Diagnostic:
   - Biopsy: [Shave / Punch / Excisional]
   - KOH prep:
   - Culture:
   - Wood's lamp:

2. Treatment:
   - Topical:
   - Systemic:
   - Procedural:

3. Patient education:
   - Sun protection
   - Skin self-examination
   - Warning signs

4. Follow-up:
   - Biopsy results in  days
   - Return in  weeks to assess response

5. Referral (if indicated):`,
  },

  // ============ PEDIATRICS ============
  {
    id: 'well-child',
    name: 'Well-Child Visit',
    description: 'Pediatric wellness check',
    category: 'pediatrics',
    subjective: `Chief Complaint: Well-child visit - [age]

Developmental History:
- Gross motor:
- Fine motor:
- Language:
- Social/Emotional:

Nutrition:
- Feeding: [Breast / Formula / Solids]
- Diet concerns:
- Vitamins/Supplements:

Sleep:
- Hours per night:
- Sleep location:
- Sleep concerns:

Elimination:
- Voiding:
- Stooling:

Safety:
- Car seat:
- Childproofing:
- Water safety:
- Helmet use:

School/Daycare:
- Attendance:
- Performance:
- Behavioral concerns:

Screen Time:

Parental Concerns:`,
    objective: `Vital Signs:
- Weight:  ( percentile)
- Height/Length:  ( percentile)
- Head circumference:  ( percentile) [if <3 years]
- BMI:  ( percentile) [if >2 years]
- BP: /  mmHg [if >3 years]

Physical Examination:
- General: Well-appearing, well-nourished, appropriate for stated age
- HEENT: Normocephalic, fontanelle [if applicable], red reflex present, TMs clear, oropharynx clear
- Neck: Supple, no lymphadenopathy
- Cardiovascular: Regular rate and rhythm, no murmurs
- Respiratory: Clear to auscultation bilaterally
- Abdomen: Soft, non-tender, no hepatosplenomegaly
- GU: Normal external genitalia, Tanner stage [if applicable]
- Musculoskeletal: Normal gait, spine straight
- Skin: No rashes
- Neurological: Age-appropriate tone, reflexes, strength

Developmental Assessment:
- Milestones: [Age-appropriate / Concerns noted]
- Developmental screening tool (if applicable):`,
    assessment: `1. Well-child visit - [age]
   - Growth: [Appropriate / Concerns]
   - Development: [On track / Concerns]

2.`,
    plan: `1. Immunizations administered:

2. Anticipatory guidance:
   - Safety
   - Nutrition
   - Development
   - Sleep
   - Oral health

3. Screenings:
   - Vision:
   - Hearing:
   - Lead:
   - Developmental:
   - Mental health:

4. Referrals:

5. Next well-child visit: [age/date]

6. Parents given opportunity to ask questions`,
  },

  // ============ PULMONOLOGY ============
  {
    id: 'pulm-copd',
    name: 'COPD Follow-up',
    description: 'Chronic lung disease management',
    category: 'pulmonology',
    subjective: `Chief Complaint: COPD follow-up

COPD History:
- GOLD Stage:
- Last spirometry:
- FEV1:

Interval History:
- Dyspnea: [At rest / With exertion / Stable / Worsening]
- mMRC Dyspnea Scale:
- Cough:
- Sputum: [Color / Volume / Change]
- Wheezing:
- Exercise tolerance:
- Oxygen use:

Exacerbations:
- Since last visit:
- ED visits:
- Hospitalizations:
- Courses of steroids/antibiotics:

Medications:
- Inhalers: [List with technique assessment]
- Nebulizers:
- Oxygen:
- Compliance:

Smoking Status:
- Current:
- Pack-years:
- Quit date (if applicable):
- Cessation assistance:

Vaccinations:
- Influenza:
- Pneumococcal:
- COVID-19:

Pulmonary Rehab:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- RR:  /min
- SpO2: % on [room air / O2 at L/min]
- Weight:

Physical Examination:
- General: [Respiratory distress assessment, cachexia, barrel chest]
- HEENT: [Pursed lip breathing, use of accessory muscles]
- Cardiovascular: [RV heave, S2 accentuation]
- Respiratory:
  - Breath sounds: [Diminished / Wheezes / Crackles]
  - Chest expansion:
  - Percussion:
  - Prolonged expiratory phase:
- Extremities: [Clubbing, cyanosis, edema]

Spirometry (if performed today):
- FEV1:
- FVC:
- FEV1/FVC:

Recent Labs/Imaging:
- ABG:
- CBC:
- CXR:
- CT chest:`,
    assessment: `1. COPD - GOLD Stage
   - Symptom burden: [CAT score / mMRC]
   - Exacerbation risk:
   - Group: [A / B / E]

2. [Comorbidities: CHF, OSA, anxiety, osteoporosis]`,
    plan: `1. Inhaler therapy:
   - LAMA:
   - LABA:
   - ICS (if indicated):
   - Rescue inhaler:
   - Inhaler technique reviewed

2. Oxygen:
   - Current prescription:
   - Titration:

3. Pulmonary rehabilitation:

4. Smoking cessation:
   - Counseling provided
   - Pharmacotherapy:

5. Vaccinations:
   - Influenza:
   - Pneumococcal:

6. Action plan for exacerbations reviewed

7. Labs/Studies:
   - Spirometry:
   - ABG:
   - Imaging:

8. Follow-up: Return in  months`,
  },

  // ============ GASTROENTEROLOGY ============
  {
    id: 'gi-abdominal-pain',
    name: 'Abdominal Pain Evaluation',
    description: 'GI symptom workup',
    category: 'gastroenterology',
    subjective: `Chief Complaint: Abdominal pain

History of Present Illness:
- Location: [RUQ / Epigastric / Periumbilical / LLQ / RLQ / Diffuse]
- Onset:
- Duration:
- Character: [Crampy / Sharp / Dull / Burning / Colicky]
- Severity (1-10):
- Radiation:
- Timing: [Constant / Intermittent / Postprandial]
- Aggravating factors: [Eating / Fasting / Specific foods / Position]
- Alleviating factors: [Antacids / Bowel movement / Position]

Associated Symptoms:
- Nausea:
- Vomiting: [Bilious / Non-bilious / Bloody]
- Diarrhea:
- Constipation:
- Blood in stool: [Melena / Hematochezia]
- Weight loss:
- Dysphagia:
- Heartburn:
- Bloating:
- Jaundice:
- Fever:

Bowel Habits:
- Frequency:
- Consistency (Bristol scale):
- Changes:

Diet:
- Triggers:
- Alcohol:
- NSAIDs:

Red Flags Review:
- Unintentional weight loss:
- GI bleeding:
- Anemia:
- Age >50 with new symptoms:
- Family history GI malignancy:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- Temp:  °F
- Weight:

Physical Examination:
- General: [Distress level, nutritional status]
- Abdomen:
  - Inspection: [Distension, scars, visible peristalsis]
  - Auscultation: [Bowel sounds - normal/hyperactive/hypoactive/absent]
  - Percussion: [Tympany, dullness, shifting dullness]
  - Palpation:
    - Tenderness: [Location, severity]
    - Guarding:
    - Rebound:
    - Masses:
    - Organomegaly:
    - Murphy's sign:
    - McBurney's point:
    - Rovsing's sign:
- Rectal exam (if indicated):
  - Stool guaiac:
  - Masses:
  - Tenderness:

Labs/Studies:
- CBC:
- CMP:
- Lipase:
- LFTs:
- Imaging:`,
    assessment: `1. Abdominal pain - [Location]
   - Differential diagnosis:
     a.
     b.
     c.
   - Most likely etiology:

2.`,
    plan: `1. Diagnostic workup:
   - Labs:
   - Imaging: [Ultrasound / CT / MRI]
   - Endoscopy: [EGD / Colonoscopy]
   - Other:

2. Empiric treatment:
   - Diet modifications:
   - PPI:
   - Antispasmodic:
   - Other:

3. Symptom management:
   - Pain control:
   - Anti-emetic:

4. Red flag precautions:
   - Return for severe pain, bloody stool, vomiting blood, fever, or inability to tolerate fluids

5. Follow-up:
   - Results review:
   - Return in  weeks`,
  },

  // ============ NEUROLOGY ============
  {
    id: 'neuro-headache',
    name: 'Headache Evaluation',
    description: 'Primary headache assessment',
    category: 'neurology',
    subjective: `Chief Complaint: Headache

History of Present Illness:
- Onset: [Sudden / Gradual]
- Duration of current episode:
- Frequency: [Daily / Weekly / Monthly]
- Location: [Unilateral / Bilateral / Frontal / Temporal / Occipital / Global]
- Character: [Throbbing / Pressure / Sharp / Dull]
- Severity (1-10):
- Aura: [Visual / Sensory / Motor / None]
- Triggers: [Stress / Sleep / Food / Menses / Weather]
- Aggravating factors: [Light / Sound / Activity / Position]
- Alleviating factors: [Dark room / Sleep / Medications]

Associated Symptoms:
- Nausea/Vomiting:
- Photophobia:
- Phonophobia:
- Visual changes:
- Neck stiffness:
- Fever:
- Focal neurological symptoms:

Red Flags (SNOOP):
- Systemic symptoms (fever, weight loss):
- Neurological symptoms:
- Onset sudden (thunderclap):
- Older age (>50 new onset):
- Prior headache history different:

Headache History:
- Age at first headache:
- Prior diagnosis:
- Previous workup:
- Prior treatments and response:

Current Medications:
- Preventive:
- Abortive:
- Frequency of analgesic use:

Impact:
- Missed work/school:
- MIDAS score:`,
    objective: `Vital Signs:
- BP: /  mmHg
- HR:  bpm
- Temp:  °F

Physical Examination:
- General: [Distress level]
- HEENT:
  - Temporal arteries: [Tenderness, induration]
  - Sinuses: [Tenderness]
  - TMJ: [Tenderness, clicking]
  - Fundoscopic: [Papilledema]
- Neck: [Rigidity, ROM, tenderness]

Neurological Examination:
- Mental status: Alert, oriented
- Cranial nerves: II-XII intact
  - II: Visual acuity, visual fields
  - III, IV, VI: EOM, pupils
  - V: Facial sensation
  - VII: Facial symmetry
  - VIII: Hearing
  - IX, X: Palate, gag
  - XI: Shoulder shrug
  - XII: Tongue
- Motor: 5/5 strength throughout
- Sensory: Intact to light touch
- Reflexes: 2+ symmetric
- Coordination: Finger-to-nose, heel-to-shin intact
- Gait: Normal

Imaging (if available):
- CT head:
- MRI brain:`,
    assessment: `1. Headache - [Type]
   - [Migraine / Tension-type / Cluster / Secondary]
   - Frequency: [Episodic / Chronic]
   - With/without aura:

2. Rule out: [Secondary causes considered]`,
    plan: `1. Acute/Abortive treatment:
   - First-line:
   - Rescue:

2. Preventive treatment (if indicated):
   - Lifestyle: Sleep hygiene, hydration, regular meals, exercise
   - Medication:
   - Frequency criteria:

3. Headache diary:
   - Track frequency, triggers, medication use

4. Avoid medication overuse:
   - Limit acute medications to <10-15 days/month

5. Imaging:
   - [Indicated / Not indicated]
   - Reason:

6. Follow-up: Return in  weeks to assess treatment response

7. Red flag precautions: Return immediately for sudden severe "worst headache of life," fever with stiff neck, confusion, focal weakness, or vision loss`,
  },
];

const CUSTOM_TEMPLATES_KEY = 'havenote.visitTemplates.custom.v1';

export function getCustomTemplates(): VisitTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VisitTemplate[];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: VisitTemplate): VisitTemplate[] {
  const custom = getCustomTemplates();
  const existing = custom.findIndex((t) => t.id === template.id);
  if (existing >= 0) {
    custom[existing] = template;
  } else {
    custom.push(template);
  }
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(custom));
  return custom;
}

export function deleteCustomTemplate(id: string): VisitTemplate[] {
  const custom = getCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(custom));
  return custom;
}

export function getAllTemplates(): VisitTemplate[] {
  return [...VISIT_TEMPLATES, ...getCustomTemplates()];
}

export function getTemplatesByCategory(category: TemplateCategory): VisitTemplate[] {
  return getAllTemplates().filter((t) => t.category === category);
}
