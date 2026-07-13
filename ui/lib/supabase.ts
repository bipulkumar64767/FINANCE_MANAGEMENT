import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function callEdgeFunction<T>(
  name: string,
  body?: unknown,
  method: 'POST' | 'GET' = 'POST'
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${supabaseUrl}/functions/v1/${name}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
  };
  if (session) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || `Request failed (${response.status})`;
    } catch {
      errorMessage = `Request failed (${response.status})`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data as T;
}
