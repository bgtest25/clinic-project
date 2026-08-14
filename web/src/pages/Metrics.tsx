import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { Me, MetricsSummary } from '../api/types';
import { Skeleton } from '../components/Skeleton';

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
}

function StatTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {caption && <span className="stat-caption">{caption}</span>}
    </div>
  );
}

export function Metrics({ token, me, onBack }: { token: string; me: Me; onBack: () => void }) {
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MetricsSummary>(`/clinics/${me.clinicId}/metrics`, token)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load metrics'));
  }, [me.clinicId, token]);

  return (
    <div className="page page-wide">
      <button type="button" className="link-button back-link" onClick={onBack}>
        ← Back to visits
      </button>
      <div className="dashboard-header">
        <div>
          <h1>Pilot metrics</h1>
          <p>How documentation is going for your clinic so far.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !summary && (
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="card stat-tile" key={i}>
              <Skeleton className="skeleton-line" style={{ width: '60%', height: '0.8rem' }} />
              <Skeleton className="skeleton-line" style={{ width: '40%', height: '1.9rem' }} />
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="stat-grid">
          <StatTile label="Notes signed" value={String(summary.totalNotesSigned)} />
          <StatTile
            label="Avg. review time"
            value={formatDuration(summary.avgReviewTimeSeconds)}
            caption="Draft ready → signed"
          />
          <StatTile
            label="Avg. edits per note"
            value={summary.avgEditsPerNote === null ? '—' : summary.avgEditsPerNote.toFixed(1)}
            caption="Before sign-off"
          />
          <StatTile
            label="Avg. satisfaction"
            value={summary.avgSatisfactionRating === null ? '—' : `${summary.avgSatisfactionRating.toFixed(1)} / 5`}
            caption={`${summary.satisfactionResponseCount} response${summary.satisfactionResponseCount === 1 ? '' : 's'}`}
          />
        </div>
      )}
    </div>
  );
}
