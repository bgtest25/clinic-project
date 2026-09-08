import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../api/client';
import type { Clinic, Me, NpiVerificationResult, OnboardingStatus } from '../api/types';
import { BrandMark } from '../icons';

interface OnboardingProps {
  token: string;
  me: Me;
  clinic: Clinic | null;
  onComplete: () => void;
}

type Step = 'baa' | 'clinic_profile' | 'user_profile' | 'signature' | 'hipaa_training' | 'complete';

const STEPS: Step[] = ['baa', 'clinic_profile', 'user_profile', 'signature', 'hipaa_training', 'complete'];

const STEP_LABELS: Record<Step, string> = {
  baa: 'Sign BAA',
  clinic_profile: 'Clinic Setup',
  user_profile: 'Your Profile',
  signature: 'Signature',
  hipaa_training: 'HIPAA Training',
  complete: 'Complete',
};

const CREDENTIALS_OPTIONS = [
  'MD', 'DO', 'NP', 'PA', 'APRN', 'RN', 'LPN', 'LCSW', 'LMFT', 'PhD', 'PsyD',
  'DPT', 'OD', 'DPM', 'DC', 'DMD', 'DDS', 'PharmD',
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV',
  'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
  'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const HIPAA_ATTESTATION = `I acknowledge that I have received and reviewed the HIPAA Privacy and Security training materials. I understand my responsibilities regarding the protection of Protected Health Information (PHI) and agree to comply with all applicable HIPAA regulations and the organization's privacy and security policies.`;

export function Onboarding({ token, me, clinic, onComplete }: OnboardingProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('baa');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdminOrOwner = me.role === 'OWNER' || me.role === 'ADMIN';

  useEffect(() => {
    loadStatus();
  }, [token]);

  async function loadStatus() {
    try {
      const st = await apiFetch<OnboardingStatus>('/onboarding/status', token);
      setStatus(st);
      if (st.nextStep) {
        setCurrentStep(st.nextStep);
      } else if (st.user.onboardingComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding status');
    }
  }

  function goToStep(step: Step) {
    setError(null);
    setCurrentStep(step);
  }

  function currentStepIndex() {
    return STEPS.indexOf(currentStep);
  }

  if (!status) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card card">
          <span className="brand">
            <BrandMark />
            Havenote
          </span>
          <p>Loading onboarding status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card card">
        <span className="brand">
          <BrandMark />
          Havenote
        </span>
        <h1>Welcome to Havenote</h1>
        <p className="onboarding-subtitle">Complete setup to start using clinical documentation</p>

        <div className="onboarding-progress">
          {STEPS.filter((s) => s !== 'complete').map((step, i) => {
            const isActive = step === currentStep;
            const isPast = currentStepIndex() > i;
            const isSkipped = !isAdminOrOwner && (step === 'baa' || step === 'clinic_profile');
            return (
              <div
                key={step}
                className={`onboarding-step ${isActive ? 'active' : ''} ${isPast ? 'complete' : ''} ${isSkipped ? 'skipped' : ''}`}
              >
                <div className="step-indicator">{isPast ? '✓' : i + 1}</div>
                <span className="step-label">{STEP_LABELS[step]}</span>
              </div>
            );
          })}
        </div>

        {error && <p className="error">{error}</p>}

        {currentStep === 'baa' && (
          <BaaStep
            token={token}
            clinic={clinic}
            isAdminOrOwner={isAdminOrOwner}
            onComplete={() => {
              loadStatus();
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
              loadStatus();
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
              loadStatus();
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
              loadStatus();
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
              loadStatus();
              goToStep('complete');
            }}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
          />
        )}

        {currentStep === 'complete' && <CompleteStep onComplete={onComplete} />}
      </div>
    </div>
  );
}

interface BaaStepProps {
  token: string;
  clinic: Clinic | null;
  isAdminOrOwner: boolean;
  onComplete: () => void;
  onSkip: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}

function BaaStep({ token, clinic, isAdminOrOwner, onComplete, onSkip, busy, setBusy, setError }: BaaStepProps) {
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [signatoryEmail, setSignatoryEmail] = useState('');
  const [agreed, setAgreed] = useState(false);

  if (!isAdminOrOwner) {
    return (
      <div className="onboarding-step-content">
        <h2>Business Associate Agreement</h2>
        <p>Your clinic administrator will sign the BAA. You can continue with your profile setup.</p>
        <button className="btn btn-primary btn-block" onClick={onSkip}>
          Continue
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!agreed || !clinic) return;
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
    <div className="onboarding-step-content">
      <h2>Business Associate Agreement</h2>
      <p>
        As a HIPAA-covered entity, you must sign a Business Associate Agreement (BAA) with Havenote before
        processing protected health information.
      </p>

      <div className="baa-document">
        <h3>HIPAA Business Associate Agreement</h3>
        <div className="baa-scroll">
          <p>
            <strong>Effective Date:</strong> Upon electronic signature below
          </p>
          <p>
            This Business Associate Agreement ("Agreement") is entered into by and between{' '}
            <strong>{clinic?.name || 'Your Clinic'}</strong> ("Covered Entity") and{' '}
            <strong>Havenote, Inc.</strong> ("Business Associate").
          </p>
          <h4>1. Definitions</h4>
          <p>
            Terms used but not defined in this Agreement shall have the same meaning as those terms in the HIPAA
            Rules (45 CFR Parts 160 and 164).
          </p>
          <h4>2. Obligations of Business Associate</h4>
          <p>
            Business Associate agrees to: (a) not use or disclose PHI other than as permitted or required by this
            Agreement or as Required by Law; (b) use appropriate safeguards and comply with the Security Rule to
            prevent unauthorized use or disclosure of PHI; (c) report any use or disclosure not provided for by
            this Agreement.
          </p>
          <h4>3. Term and Termination</h4>
          <p>
            This Agreement shall be effective as of the Effective Date and shall terminate when all PHI is
            destroyed or returned.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          Signatory Name
          <input
            type="text"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
            placeholder="Full legal name"
            required
          />
        </label>
        <label className="field">
          Title
          <input
            type="text"
            value={signatoryTitle}
            onChange={(e) => setSignatoryTitle(e.target.value)}
            placeholder="e.g., Practice Manager, Medical Director"
            required
          />
        </label>
        <label className="field">
          Email
          <input
            type="email"
            value={signatoryEmail}
            onChange={(e) => setSignatoryEmail(e.target.value)}
            placeholder="Email for BAA copy"
            required
          />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I have read and agree to the terms of this Business Associate Agreement on behalf of{' '}
            {clinic?.name || 'my clinic'}.
          </span>
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !agreed}>
          {busy ? 'Signing...' : 'Sign Agreement'}
        </button>
      </form>
    </div>
  );
}

interface ClinicProfileStepProps {
  token: string;
  clinic: Clinic | null;
  isAdminOrOwner: boolean;
  onComplete: () => void;
  onSkip: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
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

  if (!isAdminOrOwner) {
    return (
      <div className="onboarding-step-content">
        <h2>Clinic Profile</h2>
        <p>Your clinic administrator will complete the clinic profile. Continue with your profile setup.</p>
        <button className="btn btn-primary btn-block" onClick={onSkip}>
          Continue
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
        if (result.phone && !phone) setPhone(result.phone);
        if (result.fax && !fax) setFax(result.fax);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify NPI');
    } finally {
      setVerifyingNpi(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clinic) return;
    setError(null);
    setBusy(true);
    try {
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
    <div className="onboarding-step-content">
      <h2>Clinic Profile</h2>
      <p>Set up your clinic's information. This will appear on all generated documents.</p>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          Clinic Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Clinic Name"
            required
          />
        </label>

        <div className="field-group">
          <label className="field flex-1">
            Organization NPI
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
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={verifyNpi}
            disabled={verifyingNpi || npi.length !== 10}
          >
            {verifyingNpi ? 'Verifying...' : 'Verify & Auto-fill'}
          </button>
        </div>
        {npiVerified && (
          <div className={`npi-result ${npiVerified.valid ? 'valid' : 'invalid'}`}>
            {npiVerified.valid ? (
              <>
                <strong>Verified:</strong> {npiVerified.name}
              </>
            ) : (
              <>NPI not found in NPPES registry</>
            )}
          </div>
        )}

        <label className="field">
          Street Address
          <input
            type="text"
            value={addressStreet}
            onChange={(e) => setAddressStreet(e.target.value)}
            placeholder="123 Medical Center Dr"
            required
          />
        </label>

        <div className="field-row">
          <label className="field flex-2">
            City
            <input
              type="text"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
              placeholder="City"
              required
            />
          </label>
          <label className="field">
            State
            <select value={addressState} onChange={(e) => setAddressState(e.target.value)} required>
              <option value="">Select</option>
              {US_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            ZIP
            <input
              type="text"
              value={addressZip}
              onChange={(e) => setAddressZip(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
              placeholder="12345"
              required
            />
          </label>
        </div>

        <div className="field-row">
          <label className="field flex-1">
            Phone
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              required
            />
          </label>
          <label className="field flex-1">
            Fax
            <input type="tel" value={fax} onChange={(e) => setFax(e.target.value)} placeholder="(555) 123-4568" />
          </label>
        </div>

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}

interface UserProfileStepProps {
  token: string;
  me: Me;
  onComplete: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
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
    <div className="onboarding-step-content">
      <h2>Your Profile</h2>
      <p>Set up your clinician profile. This information will appear on documents you sign.</p>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          Full Name
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" required />
        </label>

        <div className="field-row">
          <label className="field flex-1">
            Credentials
            <select value={credentials} onChange={(e) => setCredentials(e.target.value)}>
              <option value="">Select</option>
              {CREDENTIALS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field flex-2">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Primary Care Physician"
            />
          </label>
        </div>

        <label className="field">
          Specialty
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="Family Medicine"
          />
        </label>

        <div className="field-group">
          <label className="field flex-1">
            Individual NPI
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
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={verifyNpi}
            disabled={verifyingNpi || individualNpi.length !== 10}
          >
            {verifyingNpi ? 'Verifying...' : 'Verify'}
          </button>
        </div>
        {npiVerified && (
          <div className={`npi-result ${npiVerified.valid ? 'valid' : 'invalid'}`}>
            {npiVerified.valid ? (
              <>
                <strong>Verified:</strong> {npiVerified.name}
                {npiVerified.credentials && `, ${npiVerified.credentials}`}
              </>
            ) : (
              <>NPI not found in NPPES registry</>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}

interface SignatureStepProps {
  token: string;
  me: Me;
  onComplete: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}

function SignatureStep({ token, me, onComplete, busy, setBusy, setError }: SignatureStepProps) {
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed');
  const [typedSignature, setTypedSignature] = useState(me.name || '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (signatureType === 'typed' && !typedSignature.trim()) {
      setError('Please enter your signature');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const signatureUrl = signatureType === 'typed' ? `typed:${typedSignature}` : 'drawn:placeholder';
      await apiFetch('/onboarding/profile/signature', token, {
        method: 'POST',
        body: JSON.stringify({ signatureUrl, signatureType }),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save signature');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-step-content">
      <h2>Digital Signature</h2>
      <p>Create your digital signature for signing clinical notes and documents.</p>

      <div className="signature-tabs">
        <button
          type="button"
          className={`tab ${signatureType === 'typed' ? 'active' : ''}`}
          onClick={() => setSignatureType('typed')}
        >
          Type Signature
        </button>
        <button
          type="button"
          className={`tab ${signatureType === 'drawn' ? 'active' : ''}`}
          onClick={() => setSignatureType('drawn')}
        >
          Draw Signature
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        {signatureType === 'typed' && (
          <div className="signature-typed-area">
            <label className="field">
              Type your name as it should appear
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Your Name"
                className="signature-input"
                required
              />
            </label>
            <div className="signature-preview">
              <span className="signature-text">{typedSignature || 'Your Signature'}</span>
            </div>
          </div>
        )}

        {signatureType === 'drawn' && (
          <div className="signature-draw-area">
            <p>Draw signature feature coming soon. Please use typed signature for now.</p>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving...' : 'Save Signature & Continue'}
        </button>
      </form>
    </div>
  );
}

interface HipaaTrainingStepProps {
  token: string;
  onComplete: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string | null) => void;
}

function HipaaTrainingStep({ token, onComplete, busy, setBusy, setError }: HipaaTrainingStepProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [viewedAll, setViewedAll] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!acknowledged || !viewedAll) return;
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
    <div className="onboarding-step-content">
      <h2>HIPAA Training</h2>
      <p>Complete HIPAA privacy and security training. This is required annually.</p>

      <div className="hipaa-training-content" onScroll={(e) => {
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
          setViewedAll(true);
        }
      }}>
        <h3>HIPAA Privacy Rule Overview</h3>
        <p>
          The HIPAA Privacy Rule establishes national standards to protect individuals' medical records and other
          personal health information. As a healthcare provider, you have responsibilities to protect patient
          privacy.
        </p>

        <h4>What is Protected Health Information (PHI)?</h4>
        <p>PHI includes any information that can identify a patient, including:</p>
        <ul>
          <li>Names, addresses, dates (birth, admission, discharge)</li>
          <li>Phone numbers, email addresses, Social Security numbers</li>
          <li>Medical record numbers, health plan numbers</li>
          <li>Photos, biometric identifiers, any unique identifying numbers</li>
        </ul>

        <h4>Minimum Necessary Standard</h4>
        <p>
          You should only access, use, or disclose the minimum amount of PHI necessary to accomplish the intended
          purpose. Never access patient records out of curiosity or for reasons unrelated to treatment.
        </p>

        <h4>Patient Rights</h4>
        <p>Patients have the right to:</p>
        <ul>
          <li>Access and obtain copies of their health records</li>
          <li>Request corrections to their health information</li>
          <li>Receive notice of how their information is used</li>
          <li>Request restrictions on certain uses and disclosures</li>
        </ul>

        <h4>Security Safeguards</h4>
        <ul>
          <li>Lock your workstation when stepping away</li>
          <li>Never share passwords or login credentials</li>
          <li>Verify patient identity before disclosing information</li>
          <li>Report any suspected breaches immediately</li>
        </ul>

        <h4>Breach Notification</h4>
        <p>
          If you discover or suspect a breach of PHI, report it immediately to your supervisor or compliance
          officer. Failure to report can result in significant penalties.
        </p>

        <p className="scroll-hint">{viewedAll ? 'You have reviewed all content.' : 'Scroll down to continue reading...'}</p>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={!viewedAll}
          />
          <span>{HIPAA_ATTESTATION}</span>
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !acknowledged || !viewedAll}>
          {busy ? 'Completing...' : 'Complete Training'}
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
    <div className="onboarding-step-content onboarding-complete">
      <div className="complete-icon">✓</div>
      <h2>Setup Complete!</h2>
      <p>You're all set to start using Havenote for clinical documentation.</p>
      <button className="btn btn-primary btn-block" onClick={onComplete}>
        Get Started
      </button>
    </div>
  );
}
