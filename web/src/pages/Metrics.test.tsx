import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { Me, MetricsSummary } from '../api/types';
import { Metrics } from './Metrics';

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }));

const me: Me = { id: 'user-1', cognitoSub: 'sub-1', email: 'a@x.test', name: 'Alice', role: 'ADMIN', clinicId: 'clinic-a' };

describe('Metrics', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('fetches metrics scoped to the clinic and renders the stat tiles', async () => {
    const summary: MetricsSummary = {
      totalNotesSigned: 12,
      avgReviewTimeSeconds: 150,
      avgSatisfactionRating: 4.5,
      satisfactionResponseCount: 8,
      avgEditsPerNote: 2.25,
    };
    vi.mocked(apiFetch).mockResolvedValue(summary);
    render(<Metrics token="tok" me={me} onBack={vi.fn()} />);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/clinics/clinic-a/metrics', 'tok');
    expect(screen.getByText('2.5 min')).toBeInTheDocument();
    expect(screen.getByText('2.3')).toBeInTheDocument();
    expect(screen.getByText('4.5 / 5')).toBeInTheDocument();
    expect(screen.getByText('8 responses')).toBeInTheDocument();
  });

  it('formats review time in hours once it crosses 60 minutes', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      totalNotesSigned: 1,
      avgReviewTimeSeconds: 5400,
      avgSatisfactionRating: null,
      satisfactionResponseCount: 0,
      avgEditsPerNote: null,
    } satisfies MetricsSummary);
    render(<Metrics token="tok" me={me} onBack={vi.fn()} />);

    expect(await screen.findByText('1.5 hr')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('0 responses')).toBeInTheDocument();
  });

  it('singularizes the response count caption for exactly one response', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      totalNotesSigned: 1,
      avgReviewTimeSeconds: null,
      avgSatisfactionRating: 5,
      satisfactionResponseCount: 1,
      avgEditsPerNote: 0,
    } satisfies MetricsSummary);
    render(<Metrics token="tok" me={me} onBack={vi.fn()} />);

    expect(await screen.findByText('1 response')).toBeInTheDocument();
  });

  it('shows an error state when loading fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('boom'));
    render(<Metrics token="tok" me={me} onBack={vi.fn()} />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
