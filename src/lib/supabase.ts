import { createClient } from '@supabase/supabase-js';

// Vite usa import.meta.env para leer las variables del archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Faltan las variables de entorno de Supabase en el archivo .env. Usando credenciales demo.');
}

// Este es tu "puente" oficial hacia la base de datos
// Configuramos un timeout global de fetch para evitar que las peticiones se queden "colgadas"
// indefinidamente si el backend de Supabase está pausado o inaccesible.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: async (url, options) => {
      const controller = new AbortController();
      // Timeout de 7 segundos
      const timeoutId = setTimeout(() => controller.abort(), 7000); 
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn(`Timeout en Supabase (7s) para la petición: ${url}`);
          throw new Error('Tiempo de espera agotado al conectar con el servidor.');
        }
        throw error;
      }
    }
  }
});