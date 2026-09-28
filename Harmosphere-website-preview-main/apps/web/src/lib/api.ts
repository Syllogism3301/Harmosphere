export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }
let refreshJob: Promise<boolean> | undefined;
async function refresh() {
  if (!refreshJob) {
    const run = async () => {
      if ((await fetch('/api/auth/me', { cache: 'no-store' })).ok) return true;
      return (await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Harmosphere': '1' }, body: '{}' })).ok;
    };
    refreshJob = (async () => 'locks' in navigator ? await navigator.locks.request('harmosphere-refresh', run) : await run())().finally(() => { refreshJob = undefined; });
  }
  return refreshJob;
}
export async function api<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const request = () => fetch(`/api${path}`, {
    method: options.method ?? 'GET', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Harmosphere': '1' },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  let response = await request();
  if (response.status === 401 && options.auth && await refresh()) response = await request();
  const data = await response.json().catch(() => ({ code: 'NETWORK_ERROR' }));
  if (!response.ok) throw new ApiError(response.status, data.code ?? 'REQUEST_FAILED');
  return data;
}
