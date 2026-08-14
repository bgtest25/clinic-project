import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import type { EncounterListItem, Me } from '../api/types';
import { EmptyIcon } from '../icons';
import { rowActivation } from '../utils/a11y';
import { SkeletonTable } from '../components/Skeleton';

const POLL_MS = 15000;
const PAGE_SIZE = 20;
const PROCESSING_STATUSES = ['TRANSCRIBING', 'DRAFTING'];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'RECORDING', label: 'Recording' },
  { value: 'TRANSCRIBING', label: 'Transcribing' },
  { value: 'DRAFTING', label: 'Drafting' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'SIGNED', label: 'Signed' },
  { value: 'FAILED', label: 'Failed' },
];

const DATE_OPTIONS = [
  { value: 'ALL', label: 'Any time' },
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: 'Last 7 days' },
  { value: '30D', label: 'Last 30 days' },
];

function withinDateRange(visitDate: string, range: string): boolean {
  if (range === 'ALL') return true;
  const visit = new Date(visitDate).getTime();
  const now = Date.now();
  const days = range === 'TODAY' ? 1 : range === '7D' ? 7 : 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return visit >= cutoff;
}

export function Dashboard({
  token,
  me,
  onSelect,
  onNew,
  onInvite,
  onMetrics,
  onUsers,
  onPatients,
}: {
  token: string;
  me: Me;
  onSelect: (encounterId: string) => void;
  onNew: () => void;
  onInvite: () => void;
  onMetrics: () => void;
  onUsers: () => void;
  onPatients: () => void;
}) {
  const [encounters, setEncounters] = useState<EncounterListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const hasRequestedNotifyRef = useRef(false);

  function load() {
    return apiFetch<EncounterListItem[]>(`/encounters?clinicianId=${me.id}`, token)
      .then((latest) => {
        setEncounters((prev) => {
          if (prev && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            for (const enc of latest) {
              const before = prev.find((p) => p.id === enc.id);
              if (
                before &&
                PROCESSING_STATUSES.includes(before.status) &&
                enc.status === 'IN_REVIEW' &&
                !notifiedIdsRef.current.has(enc.id)
              ) {
                notifiedIdsRef.current.add(enc.id);
                new Notification('Note ready for review', {
                  body: `${enc.patient.name}'s draft note is ready.`,
                });
              }
            }
          }
          return latest;
        });
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load your visits'));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.id, token]);

  const hasProcessing = useMemo(
    () => (encounters ?? []).some((e) => PROCESSING_STATUSES.includes(e.status)),
    [encounters],
  );

  useEffect(() => {
    if (!hasProcessing) return;
    if (!hasRequestedNotifyRef.current && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      hasRequestedNotifyRef.current = true;
      Notification.requestPermission().catch(() => {});
    }
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProcessing]);

  const readyForReviewCount = useMemo(
    () => (encounters ?? []).filter((e) => e.status === 'IN_REVIEW').length,
    [encounters],
  );

  const filtered = useMemo(() => {
    if (!encounters) return [];
    const q = search.trim().toLowerCase();
    return encounters
      .filter((e) => (q ? e.patient.name.toLowerCase().includes(q) : true))
      .filter((e) => (statusFilter === 'ALL' ? true : e.status === statusFilter))
      .filter((e) => withinDateRange(e.visitDate, dateFilter))
      .sort((a, b) => {
        const aReady = a.status === 'IN_REVIEW' ? 0 : 1;
        const bReady = b.status === 'IN_REVIEW' ? 0 : 1;
        if (aReady !== bReady) return aReady - bReady;
        return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
      });
  }, [encounters, search, statusFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter]);

  return (
    <div className="page page-wide">
      <div className="dashboard-header">
        <div>
          <h1>
            Your visits
            {readyForReviewCount > 0 && <span className="status-badge status-in_review dashboard-ready-badge">{readyForReviewCount} ready for review</span>}
          </h1>
          <p>Resume an in-progress visit or start a new one.</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn btn-secondary" onClick={onPatients}>
            Patients
          </button>
          {me.role === 'ADMIN' && (
            <>
              <button className="btn btn-secondary" onClick={onMetrics}>
                View metrics
              </button>
              <button className="btn btn-secondary" onClick={onInvite}>
                Invite clinician
              </button>
              <button className="btn btn-secondary" onClick={onUsers}>
                Manage users
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={onNew}>
            + Start new visit
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!error && !encounters && <SkeletonTable rows={5} cols={3} />}

      {encounters && encounters.length === 0 && (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <EmptyIcon />
          </div>
          <p>No visits yet. Start your first one above.</p>
        </div>
      )}

      {encounters && encounters.length > 0 && (
        <>
          <div className="filter-bar">
            <input
              type="search"
              className="filter-search"
              placeholder="Search by patient name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search visits by patient name"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} aria-label="Filter by visit date">
              {DATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card empty-state">
              <p>No visits match your filters.</p>
            </div>
          ) : (
            <div className="card dashboard-card">
              <table className="encounter-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Visit date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((encounter) => (
                    <tr
                      key={encounter.id}
                      className="encounter-row"
                      {...rowActivation(() => onSelect(encounter.id))}
                    >
                      <td className="patient-name">{encounter.patient.name}</td>
                      <td>{new Date(encounter.visitDate).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge status-${encounter.status.toLowerCase()}`}>
                          {encounter.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              <span className="status-line">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
