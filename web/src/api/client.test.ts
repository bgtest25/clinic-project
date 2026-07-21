import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, ApiError, apiFetch } from './client';

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the bearer token and no Content-Type when there is no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ ok: boolean }>('/things', 'tok-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/things',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }) }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(result).toEqual({ ok: true });
  });

  it('adds Content-Type: application/json when a body is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/things', 'tok-123', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('returns undefined for a 204 response without parsing JSON', async () => {
    const json = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/things/1', 'tok-123', { method: 'DELETE' });

    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('throws ApiError with the response body and status on a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Patient not found'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/patients/x', 'tok-123')).rejects.toMatchObject({
      message: 'Patient not found',
      status: 404,
    });
  });

  it('falls back to statusText when the error body is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/things', 'tok-123')).rejects.toMatchObject({
      message: 'Internal Server Error',
      status: 500,
    });
  });
});

describe('apiDownload', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a download link, clicks it, and revokes the object URL on success', async () => {
    const blob = new Blob(['pdf-bytes']);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal('fetch', fetchMock);

    const clickSpy = vi.fn();
    const anchor = { href: '', download: '', click: clickSpy, remove: vi.fn() } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);

    await apiDownload('/encounters/1/note/pdf', 'tok-123', 'note.pdf');

    expect(anchor.download).toBe('note.pdf');
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('throws ApiError and never touches the DOM on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchMock);
    const createElementSpy = vi.spyOn(document, 'createElement');

    await expect(apiDownload('/encounters/1/note/pdf', 'tok-123', 'note.pdf')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(createElementSpy).not.toHaveBeenCalled();
  });
});
