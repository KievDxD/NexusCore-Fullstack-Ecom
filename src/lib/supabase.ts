import { createClient } from '@supabase/supabase-js';

// Vite usa import.meta.env para leer las variables del archivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Faltan las variables de entorno de Supabase en el archivo .env. Usando credenciales demo.');
}

// Este es tu "puente" oficial hacia la base de datos
export const supabase = createClient(supabaseUrl, supabaseAnonKey);