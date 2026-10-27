import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js'; // El tipo oficial de Supabase
import { toast } from 'sonner';

type Role = 'admin' | 'usuario';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  login: (emailOrUsername: string, pass: string) => Promise<void>;
  registro: (email: string, pass: string, username: string) => Promise<boolean>;
  actualizarUsername: (nuevoUsername: string) => Promise<void>;
  actualizarAvatar: (nuevoAvatarUrl: string) => Promise<void>;
  subirAvatar: (file: File) => Promise<string>;
  logout: () => Promise<void>;
  cargando: boolean; // Para evitar que la pantalla parpadee mientras valida
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isRole = (value: unknown): value is Role => value === 'admin' || value === 'usuario';
const avatarPorDefecto = (userId: string) => `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`;
const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String((err as { message?: unknown } | null)?.message ?? err);

// Códigos que indican que el servidor rechazó definitivamente la sesión (no un simple fallo de red)
const SESSION_REJECTED_STATUS = [401, 403, 404];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Evita cargas de perfil duplicadas para el mismo usuario (login + onAuthStateChange)
  const profileInflight = useRef(new Map<string, Promise<void>>());

  const limpiarPerfil = useCallback(() => {
    setRole(null);
    setUsername(null);
    setAvatarUrl(null);
  }, []);

  const fetchProfile = useCallback((userId: string, email?: string): Promise<void> => {
    const existente = profileInflight.current.get(userId);
    if (existente) return existente;

    const tarea = (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, username, avatar_url')
          .eq('id', userId)
          .maybeSingle();

        if (error || !data) {
          if (error) console.warn('Error al obtener perfil, usando valores por defecto:', error.message);
          setRole((prev) => prev || 'usuario');
          setUsername((prev) => prev || (email ? email.split('@')[0] : 'usuario'));
          setAvatarUrl((prev) => prev || avatarPorDefecto(userId));
        } else {
          setRole(isRole(data.role) ? data.role : 'usuario');
          setUsername(data.username);
          setAvatarUrl(data.avatar_url);
        }
      } catch (err) {
        console.error('Error inesperado al cargar perfil:', err);
        setRole((prev) => prev || 'usuario');
      } finally {
        profileInflight.current.delete(userId);
      }
    })();

    profileInflight.current.set(userId, tarea);
    return tarea;
  }, []);

  useEffect(() => {
    let active = true;

    // IMPORTANTE: el callback de onAuthStateChange NO debe hacer `await` de llamadas al cliente de
    // Supabase (riesgo de deadlock). Se actualiza el estado de forma síncrona y el trabajo de red se difiere.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setCargando(false);

      if (!currentUser) {
        limpiarPerfil();
        return;
      }

      // Un refresco de token no cambia el perfil
      if (event === 'TOKEN_REFRESHED') return;

      setTimeout(async () => {
        if (!active) return;

        // Al restaurar sesión, validar contra el servidor sin cerrar sesión ante simples fallos de red
        if (event === 'INITIAL_SESSION') {
          const { error } = await supabase.auth.getUser();
          if (!active) return;
          if (error && 'status' in error && typeof error.status === 'number' && SESSION_REJECTED_STATUS.includes(error.status)) {
            console.warn('Sesión inválida o usuario eliminado del servidor. Cerrando sesión local:', error.message);
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            return; // SIGNED_OUT limpiará el estado
          }
        }

        await fetchProfile(currentUser.id, currentUser.email);
      }, 0);
    });

    // Salvaguarda contra pantallas de carga infinitas (forma funcional: sin closure obsoleto)
    const timeoutId = setTimeout(() => {
      if (active) setCargando(false);
    }, 4500);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [fetchProfile, limpiarPerfil]);

  const login = useCallback(async (emailOrUsername: string, pass: string) => {
    let identifier = emailOrUsername.trim();
    // Quitar @ si el usuario lo ingresó al inicio del username
    if (identifier.startsWith('@')) {
      identifier = identifier.substring(1);
    }
    let resolvedEmail = identifier;

    // Si no contiene un '@', asumimos que es un username y buscamos su email
    if (!identifier.includes('@')) {
      const { data: email, error: rpcError } = await supabase.rpc('get_email_by_username', {
        username_to_find: identifier,
      });

      if (rpcError) {
        console.error('Error al resolver username por RPC:', rpcError.message);
      }

      if (!email) {
        throw new Error(`El nombre de usuario o correo "${emailOrUsername}" no está registrado.`);
      }
      resolvedEmail = email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: pass,
    });

    if (error) throw error;
    setUser(data.user);
    if (data.user) {
      // Comparte la promesa en curso con onAuthStateChange: una sola consulta
      await fetchProfile(data.user.id, data.user.email);
    }
  }, [fetchProfile]);

  const registro = useCallback(async (email: string, pass: string, usernameStr: string) => {
    const cleanUsername = usernameStr.trim();
    const cleanEmail = email.trim().toLowerCase();

    // ── Validaciones de formato en cliente ──────────────────────────────
    if (cleanUsername.length < 3) {
      toast.error('El nombre de usuario debe tener al menos 3 caracteres.');
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Por favor ingresa un correo electrónico válido.');
      throw new Error('Formato de correo electrónico inválido.');
    }

    // 1. Pre-validar en base de datos usando la RPC unificada
    const { data: checkData, error: checkError } = await supabase.rpc('check_user_exists', {
      email_to_check: cleanEmail,
      username_to_check: cleanUsername,
    });

    if (checkError) {
      console.warn('Fallo al pre-validar credenciales en base de datos:', checkError.message);
    } else if (checkData && checkData.length > 0) {
      const { email_exists, username_exists } = checkData[0] as { email_exists: boolean; username_exists: boolean };
      if (email_exists) {
        throw new Error(`El correo electrónico "${cleanEmail}" ya está registrado.`);
      }
      if (username_exists) {
        throw new Error(`El nombre de usuario "@${cleanUsername}" ya está en uso.`);
      }
    }

    // 2. Ejecutar registro de Supabase con manejo explícito de errores
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: { username: cleanUsername },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('Este correo ya está registrado. Intenta iniciar sesión.');
      } else if (error.message.includes('Password should be at least 6 characters')) {
        toast.error('La contraseña debe tener al menos 6 caracteres.');
      } else {
        toast.error(error.message || 'Error al crear la cuenta.');
      }
      throw error;
    }

    // Si se crea inmediatamente la sesión (confirmación por correo deshabilitada)
    if (data.session && data.user) {
      setUser(data.user);
      setRole('usuario');
      setUsername(cleanUsername);
      setAvatarUrl(avatarPorDefecto(data.user.id));

      // Sincronizar el perfil real desde la base de datos (creado por el trigger)
      await fetchProfile(data.user.id, data.user.email);
      return true;
    }

    return false; // Requiere confirmación de correo
  }, [fetchProfile]);

  // Se usa UPDATE (no upsert) y NUNCA se envían role/email desde el cliente:
  // el perfil lo crea el trigger handle_new_user y el rol solo lo puede cambiar un administrador de BD.
  const actualizarUsername = useCallback(async (nuevoUsername: string) => {
    if (!user) throw new Error('No hay sesión activa.');
    const cleanUsername = nuevoUsername.trim();

    if (cleanUsername.length < 3) {
      throw new Error('El username debe tener al menos 3 caracteres.');
    }

    try {
      // Si solo cambian mayúsculas/minúsculas no hace falta comprobar duplicados
      if (cleanUsername.toLowerCase() !== username?.toLowerCase()) {
        const { data: existente } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleanUsername)
          .neq('id', user.id)
          .maybeSingle();

        if (existente) {
          throw new Error(`El nombre de usuario "@${cleanUsername}" ya está en uso. Por favor, elige otro.`);
        }
      }

      const { error } = await supabase.from('profiles').update({ username: cleanUsername }).eq('id', user.id);
      if (error) throw error;

      setUsername(cleanUsername);
    } catch (err) {
      console.error('Error al actualizar username:', err);
      throw new Error(errorMessage(err), { cause: err });
    }
  }, [user, username]);

  const actualizarAvatar = useCallback(async (nuevoAvatarUrl: string) => {
    if (!user) throw new Error('No hay sesión activa.');

    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: nuevoAvatarUrl }).eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(nuevoAvatarUrl);
    } catch (err) {
      console.error('Error al actualizar avatar:', err);
      throw new Error(errorMessage(err), { cause: err });
    }
  }, [user]);

  const subirAvatar = useCallback(async (file: File): Promise<string> => {
    if (!user) throw new Error('No hay sesión activa.');

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      await actualizarAvatar(publicUrl);
      return publicUrl;
    } catch (err) {
      console.error('Error al subir avatar:', err);
      throw new Error(errorMessage(err) || 'Error inesperado al subir la imagen.', { cause: err });
    }
  }, [user, actualizarAvatar]);

  const logout = useCallback(async () => {
    // Limpieza síncrona de la UI
    setUser(null);
    limpiarPerfil();

    // Cierra solo ESTE dispositivo (antes 'global' cerraba sesión en todos sin avisar).
    // signOut ya elimina la sesión persistida: no hace falta purgar localStorage a mano.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Fallo en signOut:', e);
    }
  }, [limpiarPerfil]);

  const isAdmin = role === 'admin';

  // value memoizado: los consumidores solo se re-renderizan si algo realmente cambió
  const value = useMemo<AuthContextType>(
    () => ({
      user, role, username, avatarUrl, isAdmin,
      login, registro, actualizarUsername, actualizarAvatar, subirAvatar, logout, cargando,
    }),
    [user, role, username, avatarUrl, isAdmin, login, registro, actualizarUsername, actualizarAvatar, subirAvatar, logout, cargando]
  );

  return (
    <AuthContext.Provider value={value}>
      {cargando ? (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-[999]">
          <div className="w-12 h-12 border-4 border-t-indigo-500 border-zinc-800 rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Iniciando NEXUS // CORE...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
