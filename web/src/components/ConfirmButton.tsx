import { useState } from 'react';

export function ConfirmButton({
  label,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  className = 'btn btn-danger btn-sm',
  busy = false,
  onConfirm,
}: {
  label: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  busy?: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="confirm-inline">
      <span className="confirm-inline-label">Are you sure?</span>
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onConfirm}>
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => setConfirming(false)}
      >
        {cancelLabel}
      </button>
    </span>
  );
}
