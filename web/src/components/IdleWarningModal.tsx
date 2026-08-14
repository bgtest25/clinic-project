export function IdleWarningModal({
  secondsLeft,
  onStay,
  onSignOut,
}: {
  secondsLeft: number;
  onStay: () => void;
  onSignOut: () => void;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="modal-overlay" role="presentation">
      <div className="card modal-card" role="alertdialog" aria-modal="true" aria-labelledby="idle-modal-title">
        <h2 id="idle-modal-title">Still there?</h2>
        <p className="auth-subtitle">
          For your security, you'll be signed out in{' '}
          <strong>
            {minutes}:{seconds.toString().padStart(2, '0')}
          </strong>{' '}
          due to inactivity.
        </p>
        <div className="review-actions">
          <button className="btn btn-primary" onClick={onStay} autoFocus>
            Stay signed in
          </button>
          <button className="btn btn-ghost" onClick={onSignOut}>
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
