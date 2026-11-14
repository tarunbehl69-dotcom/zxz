import { auth } from './firebase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in.');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    isFormData?: boolean;
  } = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders };

  let fetchBody: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.isFormData) {
      fetchBody = options.body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(options.body);
    }
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: fetchBody,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}
