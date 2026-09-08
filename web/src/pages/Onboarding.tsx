import { useCallback, useEffect, useRef, useState, type FormEvent, type DragEvent } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { apiFetch } from '../api/client';
import type { Clinic, Me, NpiVerificationResult, OnboardingStatus } from '../api/types';
import { BrandMark, ShieldIcon, LockIcon, CheckCircleIcon } from '../icons';

interface OnboardingProps {
  token: string;
  me: Me;
  clinic: Clinic | null;
  onComplete: () => void;
}

type Step = 'baa' | 'clinic_profile' | 'user_profile' | 'signature' | 'hipaa_training' | 'complete';

const STEPS: Step[] = ['baa', 'clinic_profile', 'user_profile', 'signature', 'hipaa_training', 'complete'];

const STEP_LABELS: Record<Step, string> = {
  baa: 'BAA Agreement',
  clinic_profile: 'Clinic Setup',
  user_profile: 'Your Profile',
  signature: 'Signature',
  hipaa_training: 'HIPAA Training',
  complete: 'Complete',
};

const STEP_DESCRIPTIONS: Record<Step, string> = {
  baa: 'Review and sign the Business Associate Agreement',
  clinic_profile: 'Set up your clinic information',
  user_profile: 'Complete your professional profile',
  signature: 'Create your digital signature',
  hipaa_training: 'Complete required HIPAA training',
  complete: 'You\'re all set!',
};

const CREDENTIALS_OPTIONS = [
  { value: 'MD', label: 'MD - Doctor of Medicine' },
  { value: 'DO', label: 'DO - Doctor of Osteopathic Medicine' },
  { value: 'NP', label: 'NP - Nurse Practitioner' },
  { value: 'PA', label: 'PA - Physician Assistant' },
  { value: 'APRN', label: 'APRN - Advanced Practice RN' },
  { value: 'RN', label: 'RN - Registered Nurse' },
  { value: 'LPN', label: 'LPN - Licensed Practical Nurse' },
  { value: 'LCSW', label: 'LCSW - Clinical Social Worker' },
  { value: 'LMFT', label: 'LMFT - Marriage & Family Therapist' },
  { value: 'PhD', label: 'PhD - Doctor of Philosophy' },
  { value: 'PsyD', label: 'PsyD - Doctor of Psychology' },
  { value: 'DPT', label: 'DPT - Doctor of Physical Therapy' },
  { value: 'PharmD', label: 'PharmD - Doctor of Pharmacy' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

const HIPAA_ATTESTATION = `I acknowledge that I have received and reviewed the HIPAA Privacy and Security training materials. I understand my responsibilities regarding the protection of Protected Health Information (PHI) and agree to comply with all applicable HIPAA regulations and the organization's privacy and security policies.`;

export function Onboarding({ token, me, clinic, onComplete }: OnboardingProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('baa');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdminOrOwner = me.role === 'OWNER' || me.role === 'ADMIN';

  const loadStatus = useCallback(async (autoNavigate = true) => {
    try {
      const st = await apiFetch<OnboardingStatus>('/onboarding/status', token);
      setStatus(st);
      if (autoNavigate) {
        if (st.nextStep && st.nextStep !== 'complete') {
          setCurrentStep(st.nextStep);
        } else if (st.user.onboardingComplete) {
          // Only auto-exit on initial load, not after completing steps
          onComplete();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding status');
    }
  }, [token, onComplete]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function goToStep(step: Step) {
    setError(null);
    setCurrentStep(step);
  }

  function currentStepIndex() {
    return STEPS.indexOf(currentStep);
  }

  function getStepStatus(step: Step): 'complete' | 'current' | 'upcoming' | 'skipped' {
    const idx = STEPS.indexOf(step);
    const currentIdx = currentStepIndex();
    const isSkipped = !isAdminOrOwner && (step === 'baa' || step === 'clinic_profile');
    if (isSkipped) return 'skipped';
    if (idx < currentIdx) return 'complete';
    if (idx === currentIdx) return 'current';
    return 'upcoming';
  }

  if (!status) {
    return (
      <div className="ob-shell">
        <div className="ob-loading">
          <div className="ob-loading-spinner" />
          <p>Preparing your onboarding experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-shell">
      <div className="ob-container">
        {/* Left sidebar with progress */}
        <aside className="ob-sidebar">
          <div className="ob-sidebar-header">
            <span className="ob-brand">
              <BrandMark />
              <span>Havenote</span>
            </span>
          </div>

          <nav className="ob-progress">
            {STEPS.filter((s) => s !== 'complete').map((step, i) => {
              const stepStatus = getStepStatus(step);
              return (
                <div key={step} className={`ob-progress-item ob-progress-${stepStatus}`}>
                  <div className="ob-progress-indicator">
                    {stepStatus === 'complete' ? (
                      <CheckCircleIcon />
                    ) : stepStatus === 'skipped' ? (
                      <span className="ob-progress-skip">-</span>
                    ) : (
                      <span className="ob-progress-number">{i + 1}</span>
                    )}
                  </div>
                  <div className="ob-progress-content">
                    <span className="ob-progress-label">{STEP_LABELS[step]}</span>
                    <span className="ob-progress-desc">{STEP_DESCRIPTIONS[step]}</span>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="ob-trust-badges">
            <div className="ob-trust-badge">
              <ShieldIcon />
              <span>HIPAA Compliant</span>
            </div>
            <div className="ob-trust-badge">
              <LockIcon />
              <span>256-bit Encryption</span>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="ob-main">
          <div className="ob-content">
            {error && (
              <div className="ob-error">
                <p>{error}</p>
                <button onClick={() => setError(null)}>Dismiss</button>
              </div>
            )}

            {currentStep === 'baa' && (
              <BaaStep
                token={token}
                clinic={clinic}
                isAdminOrOwner={isAdminOrOwner}
                onComplete={() => {
                  loadStatus(false);
                  goToStep('clinic_profile');
                }}
                onSkip={() => goToStep('clinic_profile')}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
            )}

            {currentStep === 'clinic_profile' && (
              <ClinicProfileStep
                token={token}
                clinic={clinic}
                isAdminOrOwner={isAdminOrOwner}
                onComplete={() => {
                  loadStatus(false);
                  goToStep('user_profile');
                }}
                onSkip={() => goToStep('user_profile')}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
            )}

            {currentStep === 'user_profile' && (
              <UserProfileStep
                token={token}
                me={me}
                onComplete={() => {
                  loadStatus(false);
                  goToStep('signature');
                }}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
            )}

            {currentStep === 'signature' && (
              <SignatureStep
                token={token}
                me={me}
                onComplete={() => {
                  loadStatus(false);
                  goToStep('hipaa_training');
                }}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
            )}

            {currentStep === 'hipaa_training' && (
              <HipaaTrainingStep
                token={token}
                onComplete={() => {
                  // Don't call loadStatus() here - it would auto-exit before showing welcome page
                  goToStep('complete');
                }}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
              />
            )}

            {currentStep === 'complete' && <CompleteStep onComplete={onComplete} />}
          </div>
        </main>
      </div>
    </div>
  );
}

interface StepProps {
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}

interface BaaStepProps extends StepProps {
  token: string;
  clinic: Clinic | null;
  isAdminOrOwner: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

function BaaStep({ token, clinic, isAdminOrOwner, onComplete, onSkip, busy, setBusy, setError }: BaaStepProps) {
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [signatoryEmail, setSignatoryEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const baaRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (baaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = baaRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 20) {
        setScrolledToEnd(true);
      }
    }
  }

  if (!isAdminOrOwner) {
    return (
      <div className="ob-step ob-step-skipped">
        <div className="ob-step-icon">
          <ShieldIcon />
        </div>
        <h1>Business Associate Agreement</h1>
        <p className="ob-step-subtitle">
          Your clinic administrator will sign the BAA on behalf of your organization.
          You can proceed with setting up your personal profile.
        </p>
        <button className="ob-btn ob-btn-primary" onClick={onSkip}>
          Continue to Profile Setup
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed || !clinic || !scrolledToEnd) return;
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/onboarding/clinic/${clinic.id}/baa`, token, {
        method: 'POST',
        body: JSON.stringify({ signatoryName, signatoryTitle, signatoryEmail }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign BAA');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-step">
      <h1>Business Associate Agreement</h1>
      <p className="ob-step-subtitle">
        As a HIPAA-covered entity, you must sign a Business Associate Agreement (BAA) with Havenote
        before processing protected health information (PHI).
      </p>

      <div className="ob-baa-container">
        <div className="ob-baa-header">
          <h2>HIPAA Business Associate Agreement</h2>
          <span className="ob-baa-version">Version 1.0 | Effective upon signature</span>
        </div>

        <div className="ob-baa-document" ref={baaRef} onScroll={handleScroll}>
          <p className="ob-baa-parties">
            This Business Associate Agreement ("Agreement") is entered into by and between{' '}
            <strong>{clinic?.name || '[Your Organization]'}</strong> ("Covered Entity") and{' '}
            <strong>Havenote, Inc.</strong> ("Business Associate"), collectively referred to as the "Parties."
          </p>

          <h3>RECITALS</h3>
          <p>
            WHEREAS, Covered Entity is a healthcare provider subject to the Health Insurance Portability and
            Accountability Act of 1996 ("HIPAA"), the Health Information Technology for Economic and Clinical
            Health Act ("HITECH Act"), and implementing regulations (collectively, "HIPAA Rules"); and
          </p>
          <p>
            WHEREAS, Business Associate provides clinical documentation and transcription services that involve
            the creation, receipt, maintenance, or transmission of Protected Health Information ("PHI"); and
          </p>
          <p>
            WHEREAS, the Parties wish to establish the terms and conditions pursuant to which Business Associate
            may receive and use PHI in connection with the services provided.
          </p>

          <h3>1. DEFINITIONS</h3>
          <p>
            Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms
            defined in 45 CFR Parts 160 and 164. "Protected Health Information" or "PHI" means individually
            identifiable health information transmitted or maintained in any form or medium.
          </p>

          <h3>2. OBLIGATIONS OF BUSINESS ASSOCIATE</h3>
          <p>Business Associate agrees to:</p>
          <ol type="a">
            <li>Not use or disclose PHI other than as permitted or required by this Agreement or as Required by Law;</li>
            <li>Use appropriate administrative, physical, and technical safeguards to prevent unauthorized use or disclosure of PHI;</li>
            <li>Comply with Subpart C of 45 CFR Part 164 (Security Rule) with respect to electronic PHI;</li>
            <li>Report to Covered Entity any use or disclosure of PHI not provided for by this Agreement of which it becomes aware, including any Security Incident or Breach;</li>
            <li>In accordance with 45 CFR 164.502(e)(1)(ii), ensure that any subcontractors that create, receive, maintain, or transmit PHI on behalf of Business Associate agree to the same restrictions and conditions;</li>
            <li>Make available PHI to Covered Entity or the Individual as required under 45 CFR 164.524;</li>
            <li>Make available PHI for amendment and incorporate any amendments as required under 45 CFR 164.526;</li>
            <li>Make available information required to provide an accounting of disclosures as required under 45 CFR 164.528;</li>
            <li>Make its internal practices, books, and records relating to the use and disclosure of PHI available to the Secretary of HHS for purposes of determining compliance;</li>
            <li>Return or destroy all PHI upon termination of this Agreement, if feasible.</li>
          </ol>

          <h3>3. PERMITTED USES AND DISCLOSURES</h3>
          <p>
            Business Associate may use or disclose PHI only as necessary to perform clinical documentation
            services for Covered Entity, as specified in the underlying services agreement, or as Required by Law.
            Business Associate may use PHI for its proper management and administration or to carry out its legal
            responsibilities, provided that any disclosure is Required by Law or Business Associate obtains
            reasonable assurances from the recipient.
          </p>

          <h3>4. TERM AND TERMINATION</h3>
          <p>
            This Agreement shall be effective as of the date of electronic signature below and shall terminate
            when all PHI is destroyed or returned to Covered Entity, or if return or destruction is not feasible,
            protections are extended to such information. Either Party may terminate this Agreement upon thirty (30)
            days written notice if the other Party has materially breached this Agreement and failed to cure such
            breach within the notice period.
          </p>

          <h3>5. MISCELLANEOUS</h3>
          <p>
            <strong>Regulatory References.</strong> Any reference to a regulatory provision shall include any
            successor provision. <strong>Amendment.</strong> This Agreement may not be modified except by written
            agreement signed by both Parties. <strong>Survival.</strong> The obligations of Business Associate
            under Section 2 shall survive termination of this Agreement. <strong>Interpretation.</strong> Any
            ambiguity shall be resolved in favor of a meaning that permits compliance with HIPAA Rules.
          </p>

          <div className="ob-baa-scroll-indicator">
            {scrolledToEnd ? 'You have reviewed the complete agreement' : 'Please scroll to review the complete agreement'}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ob-form">
        <div className="ob-form-row">
          <label className="ob-field">
            <span className="ob-field-label">Signatory Full Name</span>
            <input
              type="text"
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
              placeholder="Enter your full legal name"
              required
            />
          </label>
        </div>

        <div className="ob-form-row ob-form-row-2">
          <label className="ob-field">
            <span className="ob-field-label">Title / Position</span>
            <input
              type="text"
              value={signatoryTitle}
              onChange={(e) => setSignatoryTitle(e.target.value)}
              placeholder="e.g., Medical Director, Practice Manager"
              required
            />
          </label>
          <label className="ob-field">
            <span className="ob-field-label">Email Address</span>
            <input
              type="email"
              value={signatoryEmail}
              onChange={(e) => setSignatoryEmail(e.target.value)}
              placeholder="For BAA copy delivery"
              required
            />
          </label>
        </div>

        <label className="ob-checkbox">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={!scrolledToEnd}
          />
          <span>
            I have read, understand, and agree to the terms of this Business Associate Agreement on behalf of{' '}
            <strong>{clinic?.name || 'my organization'}</strong>. I am authorized to bind my organization to this agreement.
          </span>
        </label>

        <button type="submit" className="ob-btn ob-btn-primary" disabled={busy || !agreed || !scrolledToEnd}>
          {busy ? 'Processing...' : 'Sign Agreement & Continue'}
        </button>
      </form>
    </div>
  );
}

interface ClinicProfileStepProps extends StepProps {
  token: string;
  clinic: Clinic | null;
  isAdminOrOwner: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

function ClinicProfileStep({
  token,
  clinic,
  isAdminOrOwner,
  onComplete,
  onSkip,
  busy,
  setBusy,
  setError,
}: ClinicProfileStepProps) {
  const [name, setName] = useState(clinic?.name || '');
  const [addressStreet, setAddressStreet] = useState(clinic?.addressStreet || '');
  const [addressCity, setAddressCity] = useState(clinic?.addressCity || '');
  const [addressState, setAddressState] = useState(clinic?.addressState || '');
  const [addressZip, setAddressZip] = useState(clinic?.addressZip || '');
  const [phone, setPhone] = useState(clinic?.phone || '');
  const [fax, setFax] = useState(clinic?.fax || '');
  const [npi, setNpi] = useState(clinic?.npi || '');
  const [npiVerified, setNpiVerified] = useState<NpiVerificationResult | null>(null);
  const [verifyingNpi, setVerifyingNpi] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(clinic?.logoUrl || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAdminOrOwner) {
    return (
      <div className="ob-step ob-step-skipped">
        <div className="ob-step-icon">
          <ShieldIcon />
        </div>
        <h1>Clinic Profile Setup</h1>
        <p className="ob-step-subtitle">
          Your clinic administrator will complete the clinic profile setup.
          You can proceed with setting up your personal profile.
        </p>
        <button className="ob-btn ob-btn-primary" onClick={onSkip}>
          Continue to Your Profile
        </button>
      </div>
    );
  }

  async function verifyNpi() {
    if (!npi || npi.length !== 10) {
      setError('NPI must be exactly 10 digits');
      return;
    }
    setVerifyingNpi(true);
    setError(null);
    try {
      const result = await apiFetch<NpiVerificationResult>(`/onboarding/npi/verify?npi=${npi}`, token);
      setNpiVerified(result);
      if (result.valid && result.address) {
        if (!addressStreet) setAddressStreet(result.address.street);
        if (!addressCity) setAddressCity(result.address.city);
        if (!addressState) setAddressState(result.address.state);
        if (!addressZip) setAddressZip(result.address.zip);
        if (result.phone && !phone) setPhone(formatPhoneDisplay(result.phone));
        if (result.fax && !fax) setFax(formatPhoneDisplay(result.fax));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify NPI');
    } finally {
      setVerifyingNpi(false);
    }
  }

  function handleLogoDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleLogoFile(file);
    }
  }

  function handleLogoFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clinic) return;
    setError(null);
    setBusy(true);
    try {
      // Upload logo if selected
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        // For now, we'll use a data URL - in production, use S3 presigned URLs
        // await apiFetch(`/onboarding/clinic/${clinic.id}/logo`, token, { method: 'POST', body: formData });
      }

      await apiFetch(`/onboarding/clinic/${clinic.id}/profile`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name || undefined,
          addressStreet: addressStreet || undefined,
          addressCity: addressCity || undefined,
          addressState: addressState || undefined,
          addressZip: addressZip || undefined,
          phone: phone.replace(/\D/g, '') || undefined,
          fax: fax.replace(/\D/g, '') || undefined,
          npi: npi || undefined,
        }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update clinic profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-step">
      <h1>Clinic Profile Setup</h1>
      <p className="ob-step-subtitle">
        This information will appear on all generated documents including visit summaries,
        referral letters, and prior authorization requests.
      </p>

      <form onSubmit={handleSubmit} className="ob-form">
        {/* Logo Upload */}
        <div className="ob-logo-section">
          <span className="ob-field-label">Clinic Logo (Optional)</span>
          <div
            className={`ob-logo-dropzone ${dragOver ? 'ob-logo-dropzone-active' : ''} ${logoPreview ? 'ob-logo-dropzone-has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleLogoDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {logoPreview ? (
              <div className="ob-logo-preview">
                <img src={logoPreview} alt="Logo preview" />
                <button type="button" className="ob-logo-remove" onClick={(e) => {
                  e.stopPropagation();
                  setLogoPreview(null);
                  setLogoFile(null);
                }}>Remove</button>
              </div>
            ) : (
              <div className="ob-logo-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <p>Drop your logo here or click to browse</p>
                <span>PNG, JPG up to 5MB</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
              hidden
            />
          </div>
        </div>

        <label className="ob-field">
          <span className="ob-field-label">Clinic / Practice Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter clinic name"
            required
          />
        </label>

        <div className="ob-npi-section">
          <label className="ob-field ob-field-flex">
            <span className="ob-field-label">Organization NPI</span>
            <div className="ob-field-with-button">
              <input
                type="text"
                value={npi}
                onChange={(e) => {
                  setNpi(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setNpiVerified(null);
                }}
                placeholder="10-digit NPI"
                maxLength={10}
              />
              <button
                type="button"
                className="ob-btn ob-btn-secondary"
                onClick={verifyNpi}
                disabled={verifyingNpi || npi.length !== 10}
              >
                {verifyingNpi ? 'Verifying...' : 'Verify & Auto-fill'}
              </button>
            </div>
          </label>
          {npiVerified && (
            <div className={`ob-npi-result ${npiVerified.valid ? 'ob-npi-valid' : 'ob-npi-invalid'}`}>
              {npiVerified.valid ? (
                <>
                  <CheckCircleIcon />
                  <span><strong>Verified:</strong> {npiVerified.name}</span>
                </>
              ) : (
                <span>NPI not found in NPPES registry</span>
              )}
            </div>
          )}
        </div>

        <label className="ob-field">
          <span className="ob-field-label">Street Address</span>
          <input
            type="text"
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
            placeholder="123 Medical Center Drive, Suite 100"
            required
          />
        </label>

        <div className="ob-form-row ob-form-row-3">
          <label className="ob-field ob-field-2">
            <span className="ob-field-label">City</span>
            <input
              type="text"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder="City"
              required
            />
          </label>
          <label className="ob-field">
            <span className="ob-field-label">State</span>
            <select value={addressState} onChange={(e) => setAddressState(e.target.value)} required>
              <option value="">Select</option>
              {US_STATES.map((st) => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </label>
          <label className="ob-field">
            <span className="ob-field-label">ZIP Code</span>
            <input
              type="text"
              value={addressZip}
              onChange={(e) => setAddressZip(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
              placeholder="12345"
              required
            />
          </label>
        </div>

        <div className="ob-form-row ob-form-row-2">
          <label className="ob-field">
            <span className="ob-field-label">Phone Number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
              placeholder="(555) 123-4567"
              required
            />
          </label>
          <label className="ob-field">
            <span className="ob-field-label">Fax Number (Optional)</span>
            <input
              type="tel"
              value={fax}
              onChange={(e) => setFax(formatPhoneDisplay(e.target.value))}
              placeholder="(555) 123-4568"
            />
          </label>
        </div>

        <button type="submit" className="ob-btn ob-btn-primary" disabled={busy}>
          {busy ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}

interface UserProfileStepProps extends StepProps {
  token: string;
  me: Me;
  onComplete: () => void;
}

function UserProfileStep({ token, me, onComplete, busy, setBusy, setError }: UserProfileStepProps) {
  const [name, setName] = useState(me.name || '');
  const [credentials, setCredentials] = useState(me.credentials || '');
  const [title, setTitle] = useState(me.title || '');
  const [specialty, setSpecialty] = useState(me.specialty || '');
  const [individualNpi, setIndividualNpi] = useState(me.individualNpi || '');
  const [npiVerified, setNpiVerified] = useState<NpiVerificationResult | null>(null);
  const [verifyingNpi, setVerifyingNpi] = useState(false);

  async function verifyNpi() {
    if (!individualNpi || individualNpi.length !== 10) {
      setError('NPI must be exactly 10 digits');
      return;
    }
    setVerifyingNpi(true);
    setError(null);
    try {
      const result = await apiFetch<NpiVerificationResult>(`/onboarding/npi/verify?npi=${individualNpi}`, token);
      setNpiVerified(result);
      if (result.valid) {
        if (result.credentials && !credentials) setCredentials(result.credentials);
        if (result.specialty && !specialty) setSpecialty(result.specialty);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify NPI');
    } finally {
      setVerifyingNpi(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/onboarding/profile', token, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name || undefined,
          credentials: credentials || undefined,
          title: title || undefined,
          specialty: specialty || undefined,
          individualNpi: individualNpi || undefined,
        }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-step">
      <h1>Your Professional Profile</h1>
      <p className="ob-step-subtitle">
        This information will appear on clinical documents you sign, including notes, referrals, and prescriptions.
      </p>

      <form onSubmit={handleSubmit} className="ob-form">
        <label className="ob-field">
          <span className="ob-field-label">Full Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Jane Smith"
            required
          />
        </label>

        <div className="ob-form-row ob-form-row-2">
          <label className="ob-field">
            <span className="ob-field-label">Credentials</span>
            <select value={credentials} onChange={(e) => setCredentials(e.target.value)}>
              <option value="">Select credentials</option>
              {CREDENTIALS_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="ob-field">
            <span className="ob-field-label">Title / Role</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Primary Care Physician"
            />
          </label>
        </div>

        <label className="ob-field">
          <span className="ob-field-label">Specialty</span>
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Family Medicine, Internal Medicine, etc."
          />
        </label>

        <div className="ob-npi-section">
          <label className="ob-field ob-field-flex">
            <span className="ob-field-label">Individual NPI</span>
            <div className="ob-field-with-button">
              <input
                type="text"
                value={individualNpi}
                onChange={(e) => {
                  setIndividualNpi(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setNpiVerified(null);
                }}
                placeholder="10-digit NPI"
                maxLength={10}
              />
              <button
                type="button"
                className="ob-btn ob-btn-secondary"
                onClick={verifyNpi}
                disabled={verifyingNpi || individualNpi.length !== 10}
              >
                {verifyingNpi ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </label>
          {npiVerified && (
            <div className={`ob-npi-result ${npiVerified.valid ? 'ob-npi-valid' : 'ob-npi-invalid'}`}>
              {npiVerified.valid ? (
                <>
                  <CheckCircleIcon />
                  <span><strong>Verified:</strong> {npiVerified.name}{npiVerified.credentials && `, ${npiVerified.credentials}`}</span>
                </>
              ) : (
                <span>NPI not found in NPPES registry</span>
              )}
            </div>
          )}
        </div>

        <button type="submit" className="ob-btn ob-btn-primary" disabled={busy}>
          {busy ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}

interface SignatureStepProps extends StepProps {
  token: string;
  me: Me;
  onComplete: () => void;
}

function SignatureStep({ token, me, onComplete, busy, setBusy, setError }: SignatureStepProps) {
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [typedSignature, setTypedSignature] = useState(me.name || '');
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);

  function clearSignature() {
    sigCanvasRef.current?.clear();
    setHasDrawnSignature(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    let signatureData: string;

    if (signatureType === 'typed') {
      if (!typedSignature.trim()) {
        setError('Please enter your signature');
        return;
      }
      signatureData = `typed:${typedSignature}`;
    } else {
      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
        setError('Please draw your signature');
        return;
      }
      signatureData = sigCanvasRef.current.toDataURL('image/png');
    }

    setError(null);
    setBusy(true);
    try {
      await apiFetch('/onboarding/profile/signature', token, {
        method: 'POST',
        body: JSON.stringify({ signatureUrl: signatureData, signatureType }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signature');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-step">
      <h1>Digital Signature</h1>
      <p className="ob-step-subtitle">
        Create your digital signature for signing clinical notes, referrals, and other medical documents.
        This signature will be legally binding.
      </p>

      <div className="ob-signature-tabs">
        <button
          type="button"
          className={`ob-signature-tab ${signatureType === 'typed' ? 'ob-signature-tab-active' : ''}`}
          onClick={() => setSignatureType('typed')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Type Signature
        </button>
        <button
          type="button"
          className={`ob-signature-tab ${signatureType === 'drawn' ? 'ob-signature-tab-active' : ''}`}
          onClick={() => setSignatureType('drawn')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M14 7h7v7" />
          </svg>
          Draw Signature
        </button>
      </div>

      <form onSubmit={handleSubmit} className="ob-form">
        {signatureType === 'typed' && (
          <div className="ob-signature-typed">
            <label className="ob-field">
              <span className="ob-field-label">Type your name as it should appear</span>
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Your Name"
                className="ob-signature-input"
                required
              />
            </label>
            <div className="ob-signature-preview">
              <span className="ob-signature-preview-label">Preview</span>
              <div className="ob-signature-preview-box">
                <span className="ob-signature-text">{typedSignature || 'Your Signature'}</span>
              </div>
            </div>
          </div>
        )}

        {signatureType === 'drawn' && (
          <div className="ob-signature-drawn">
            <div className="ob-signature-canvas-container">
              <span className="ob-signature-canvas-label">Draw your signature below</span>
              <div className="ob-signature-canvas-wrapper">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="#1a365d"
                  canvasProps={{
                    className: 'ob-signature-canvas',
                  }}
                  onEnd={() => setHasDrawnSignature(true)}
                />
                <div className="ob-signature-canvas-line" />
              </div>
              <button
                type="button"
                className="ob-btn ob-btn-ghost"
                onClick={clearSignature}
                disabled={!hasDrawnSignature}
              >
                Clear & Retry
              </button>
            </div>
          </div>
        )}

        <div className="ob-signature-legal">
          <p>
            By saving this signature, I acknowledge that this digital signature will be used to sign
            clinical documents and will have the same legal effect as a handwritten signature.
          </p>
        </div>

        <button type="submit" className="ob-btn ob-btn-primary" disabled={busy}>
          {busy ? 'Saving...' : 'Save Signature & Continue'}
        </button>
      </form>
    </div>
  );
}

interface HipaaTrainingStepProps extends StepProps {
  token: string;
  onComplete: () => void;
}

function HipaaTrainingStep({ token, onComplete, busy, setBusy, setError }: HipaaTrainingStepProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const progress = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));
      setScrollProgress(progress);
    }
  }

  const canAcknowledge = scrollProgress >= 95;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acknowledged || !canAcknowledge) return;
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/onboarding/training/hipaa', token, {
        method: 'POST',
        body: JSON.stringify({ attestationText: HIPAA_ATTESTATION }),
      });
      await apiFetch('/onboarding/complete', token, { method: 'POST' });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete HIPAA training');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob-step">
      <h1>HIPAA Privacy & Security Training</h1>
      <p className="ob-step-subtitle">
        Federal law requires all healthcare workforce members to receive HIPAA training.
        This training must be renewed annually.
      </p>

      <div className="ob-hipaa-progress">
        <div className="ob-hipaa-progress-bar" style={{ width: `${scrollProgress}%` }} />
        <span>{scrollProgress}% complete</span>
      </div>

      <div className="ob-hipaa-content" ref={contentRef} onScroll={handleScroll}>
        <section className="ob-hipaa-section">
          <h2>Introduction to HIPAA</h2>
          <p>
            The Health Insurance Portability and Accountability Act (HIPAA) was enacted in 1996 to establish
            national standards for protecting sensitive patient health information. As a healthcare workforce
            member, you play a critical role in maintaining patient privacy and the security of health information.
          </p>
        </section>

        <section className="ob-hipaa-section">
          <h2>What is Protected Health Information (PHI)?</h2>
          <p>
            PHI is any information that can be used to identify a patient and relates to their past, present,
            or future physical or mental health condition, healthcare services provided, or payment for healthcare.
          </p>
          <div className="ob-hipaa-list">
            <h3>Examples of PHI include:</h3>
            <ul>
              <li>Patient names, addresses, and dates (birth, admission, discharge, death)</li>
              <li>Phone numbers, fax numbers, and email addresses</li>
              <li>Social Security numbers and medical record numbers</li>
              <li>Health plan beneficiary numbers and account numbers</li>
              <li>Certificate/license numbers and vehicle identifiers</li>
              <li>Device identifiers and serial numbers</li>
              <li>Web URLs, IP addresses, and biometric identifiers</li>
              <li>Full face photographs and comparable images</li>
              <li>Any other unique identifying number, characteristic, or code</li>
            </ul>
          </div>
        </section>

        <section className="ob-hipaa-section">
          <h2>The Minimum Necessary Standard</h2>
          <p>
            HIPAA requires that you only access, use, or disclose the minimum amount of PHI necessary to
            accomplish the intended purpose. This means:
          </p>
          <ul>
            <li>Only access patient records when you have a legitimate work-related reason</li>
            <li>Never look up information about friends, family members, coworkers, or celebrities</li>
            <li>Share only the information necessary for the recipient to perform their job function</li>
            <li>When in doubt, consult your supervisor or privacy officer</li>
          </ul>
        </section>

        <section className="ob-hipaa-section">
          <h2>Patient Rights Under HIPAA</h2>
          <p>Patients have specific rights regarding their health information:</p>
          <ul>
            <li><strong>Right to Access:</strong> Patients can request copies of their medical records</li>
            <li><strong>Right to Amend:</strong> Patients can request corrections to inaccurate information</li>
            <li><strong>Right to Accounting:</strong> Patients can request a list of disclosures of their PHI</li>
            <li><strong>Right to Restrict:</strong> Patients can request restrictions on certain uses and disclosures</li>
            <li><strong>Right to Confidential Communications:</strong> Patients can request alternative communication methods</li>
            <li><strong>Right to Notice:</strong> Patients must receive notice of privacy practices</li>
          </ul>
        </section>

        <section className="ob-hipaa-section">
          <h2>Security Safeguards</h2>
          <p>You are responsible for following these security practices:</p>

          <div className="ob-hipaa-card">
            <h3>Physical Safeguards</h3>
            <ul>
              <li>Never leave PHI visible on your screen when stepping away</li>
              <li>Position monitors away from public view</li>
              <li>Secure paper documents containing PHI</li>
              <li>Properly dispose of PHI using approved methods (shredding, secure disposal bins)</li>
            </ul>
          </div>

          <div className="ob-hipaa-card">
            <h3>Technical Safeguards</h3>
            <ul>
              <li>Use strong, unique passwords and never share them</li>
              <li>Lock your workstation when unattended (Windows + L)</li>
              <li>Only access systems using your own credentials</li>
              <li>Report suspicious emails or potential phishing attempts</li>
              <li>Never disable security software or circumvent security controls</li>
            </ul>
          </div>

          <div className="ob-hipaa-card">
            <h3>Administrative Safeguards</h3>
            <ul>
              <li>Complete required training on time</li>
              <li>Follow established policies and procedures</li>
              <li>Report security incidents promptly</li>
              <li>Verify the identity of individuals requesting PHI</li>
            </ul>
          </div>
        </section>

        <section className="ob-hipaa-section">
          <h2>Breach Notification Requirements</h2>
          <p>
            A breach is the unauthorized acquisition, access, use, or disclosure of PHI that compromises
            the security or privacy of the information. If you discover or suspect a breach:
          </p>
          <ol>
            <li><strong>Stop</strong> the activity if you can do so safely</li>
            <li><strong>Report</strong> the incident immediately to your supervisor or privacy officer</li>
            <li><strong>Document</strong> what happened, when, and who was involved</li>
            <li><strong>Cooperate</strong> fully with any investigation</li>
          </ol>
          <p className="ob-hipaa-warning">
            Failure to report a known breach can result in personal liability and penalties up to $250,000
            and imprisonment.
          </p>
        </section>

        <section className="ob-hipaa-section">
          <h2>Penalties for HIPAA Violations</h2>
          <p>HIPAA violations can result in serious consequences:</p>
          <table className="ob-hipaa-table">
            <thead>
              <tr>
                <th>Violation Category</th>
                <th>Penalty Range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Unknowing violation</td>
                <td>$100 - $50,000 per violation</td>
              </tr>
              <tr>
                <td>Reasonable cause</td>
                <td>$1,000 - $50,000 per violation</td>
              </tr>
              <tr>
                <td>Willful neglect (corrected)</td>
                <td>$10,000 - $50,000 per violation</td>
              </tr>
              <tr>
                <td>Willful neglect (not corrected)</td>
                <td>$50,000+ per violation</td>
              </tr>
            </tbody>
          </table>
          <p>Annual maximum penalty: $1.5 million per violation category</p>
        </section>

        <section className="ob-hipaa-section ob-hipaa-section-final">
          <h2>Acknowledgment</h2>
          <p>
            By completing this training and checking the box below, you acknowledge that you have read,
            understood, and agree to comply with all HIPAA Privacy and Security requirements. You understand
            that violations may result in disciplinary action, termination, and/or criminal prosecution.
          </p>
        </section>
      </div>

      <form onSubmit={handleSubmit} className="ob-form">
        <label className={`ob-checkbox ${!canAcknowledge ? 'ob-checkbox-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={!canAcknowledge}
          />
          <span>{HIPAA_ATTESTATION}</span>
        </label>

        {!canAcknowledge && (
          <p className="ob-hipaa-scroll-hint">Please scroll through and read all training content to continue</p>
        )}

        <button type="submit" className="ob-btn ob-btn-primary" disabled={busy || !acknowledged || !canAcknowledge}>
          {busy ? 'Completing...' : 'Complete Training & Finish Setup'}
        </button>
      </form>
    </div>
  );
}

interface CompleteStepProps {
  onComplete: () => void;
}

function CompleteStep({ onComplete }: CompleteStepProps) {
  return (
    <div className="ob-step ob-step-complete">
      <div className="ob-complete-animation">
        <div className="ob-complete-circle">
          <CheckCircleIcon />
        </div>
      </div>

      <h1>Welcome to Havenote!</h1>
      <p className="ob-step-subtitle">
        Your account is fully set up and ready to use. You can now start documenting patient visits
        with AI-powered clinical documentation.
      </p>

      <div className="ob-complete-features">
        <div className="ob-complete-feature">
          <div className="ob-complete-feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </div>
          <h3>Voice Recording</h3>
          <p>Record patient visits and let AI handle the documentation</p>
        </div>
        <div className="ob-complete-feature">
          <div className="ob-complete-feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          </div>
          <h3>SOAP Notes</h3>
          <p>AI-generated clinical notes ready for review and signature</p>
        </div>
        <div className="ob-complete-feature">
          <div className="ob-complete-feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h3>After-Visit Summaries</h3>
          <p>Patient-friendly summaries generated automatically</p>
        </div>
      </div>

      <button className="ob-btn ob-btn-primary ob-btn-large" onClick={onComplete}>
        Get Started
      </button>
    </div>
  );
}

// Helper function
function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
