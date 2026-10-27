import { createClient } from '@supabase/supabase-js';

// Vite usa import.meta.env para leer las variables del archivo .env
const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!envUrl || !envKey) {
  // En producción un build sin credenciales es un error de despliegue: fallar de forma explícita
  if (import.meta.env.PROD) {
    throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el entorno de build.');
  }
  console.warn('Faltan las variables de entorno de Supabase en el archivo .env. Usando credenciales demo.');
}

const supabaseUrl = envUrl || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = envKey || 'placeholder-anon-key';

const FETCH_TIMEOUT_MS = 7000;

// fetch con timeout global que RESPETA la señal de cancelación del llamador
// (antes la sobrescribía, haciendo inútil cualquier AbortController externo).
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const externalSignal = init?.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && !externalSignal?.aborted) {
      throw new Error('Tiempo de espera agotado al conectar con el servidor.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
};

// Este es tu "puente" oficial hacia la base de datos
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: { fetch: fetchWithTimeout },
});
