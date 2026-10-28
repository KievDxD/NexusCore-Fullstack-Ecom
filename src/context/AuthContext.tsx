import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js';
import { toast } from 'sonner';

type Role = 'admin' | 'usuario';

interface CachedProfile {
  userId: string;
  role: Role;
  username: string | null;
  avatarUrl: string | null;
}

const PROFILE_STORAGE_KEY = 'nexus_auth_profile_v1';

function loadCachedProfile(): CachedProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedProfile>;
    if (
      parsed &&
      typeof parsed.userId === 'string' &&
      (parsed.role === 'admin' || parsed.role === 'usuario')
    ) {
      return {
        userId: parsed.userId,
        role: parsed.role,
        username: parsed.username ?? null,
        avatarUrl: parsed.avatarUrl ?? null,
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveCachedProfile(profile: CachedProfile | null) {
  try {
    if (!profile) {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    } else {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    }
  } catch {
    // ignore storage errors
  }
}

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
  cargando: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isRole = (value: unknown): value is Role => value === 'admin' || value === 'usuario';
const avatarPorDefecto = (userId: string) => `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`;
const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String((err as { message?: unknown } | null)?.message ?? err);

// Códigos que indican que el servidor rechazó definitivamente la sesión (no un simple fallo de red)
const SESSION_REJECTED_STATUS = [401, 403, 404];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialCached = useMemo(() => loadCachedProfile(), []);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(initialCached?.role ?? null);
  const [username, setUsername] = useState<string | null>(initialCached?.username ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialCached?.avatarUrl ?? null);
  const [cargando, setCargando] = useState(true);

  // Evita cargas de perfil duplicadas para el mismo usuario (login + onAuthStateChange)
  const profileInflight = useRef(new Map<string, Promise<void>>());

  const limpiarPerfil = useCallback(() => {
    setRole(null);
    setUsername(null);
    setAvatarUrl(null);
    saveCachedProfile(null);
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
          if (error) console.warn('Error al obtener perfil, conservando caché o valores por defecto:', error.message);
          const cached = loadCachedProfile();
          const fallbackRole: Role = cached?.userId === userId ? cached.role : 'usuario';
          const fallbackUsername =
            (cached?.userId === userId ? cached.username : null) || (email ? email.split('@')[0] : 'usuario');
          const fallbackAvatar =
            (cached?.userId === userId ? cached.avatarUrl : null) || avatarPorDefecto(userId);

          setRole(fallbackRole);
          setUsername(fallbackUsername);
          setAvatarUrl(fallbackAvatar);
          saveCachedProfile({
            userId,
            role: fallbackRole,
            username: fallbackUsername,
            avatarUrl: fallbackAvatar,
          });
        } else {
          const resolvedRole: Role = isRole(data.role) ? data.role : 'usuario';
          setRole(resolvedRole);
          setUsername(data.username);
          setAvatarUrl(data.avatar_url);
          saveCachedProfile({
            userId,
            role: resolvedRole,
            username: data.username,
            avatarUrl: data.avatar_url,
          });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        limpiarPerfil();
        setCargando(false);
        return;
      }

      // Hidratar inmediatamente desde caché si coincide el userId para evitar cualquier parpadeo al pulsar F5
      const cached = loadCachedProfile();
      if (cached && cached.userId === currentUser.id) {
        setRole(cached.role);
        setUsername(cached.username);
        setAvatarUrl(cached.avatarUrl);
        setCargando(false);
      }

      if (event === 'TOKEN_REFRESHED') {
        setCargando(false);
        return;
      }

      setTimeout(async () => {
        if (!active) return;

        if (event === 'INITIAL_SESSION') {
          const { error } = await supabase.auth.getUser();
          if (!active) return;
          if (error && 'status' in error && typeof error.status === 'number' && SESSION_REJECTED_STATUS.includes(error.status)) {
            console.warn('Sesión inválida o usuario eliminado del servidor. Cerrando sesión local:', error.message);
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            if (active) setCargando(false);
            return;
          }
        }

        await fetchProfile(currentUser.id, currentUser.email);
        if (active) setCargando(false);
      }, 0);
    });

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
    if (identifier.startsWith('@')) {
      identifier = identifier.substring(1);
    }
    let resolvedEmail = identifier;

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
      await fetchProfile(data.user.id, data.user.email);
    }
  }, [fetchProfile]);

  const registro = useCallback(async (email: string, pass: string, usernameStr: string) => {
    const cleanUsername = usernameStr.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      toast.error('El nombre de usuario debe tener al menos 3 caracteres.');
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Por favor ingresa un correo electrónico válido.');
      throw new Error('Formato de correo electrónico inválido.');
    }

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

    if (data.session && data.user) {
      setUser(data.user);
      setRole('usuario');
      setUsername(cleanUsername);
      setAvatarUrl(avatarPorDefecto(data.user.id));
      await fetchProfile(data.user.id, data.user.email);
      return true;
    }

    return false;
  }, [fetchProfile]);

  const actualizarUsername = useCallback(async (nuevoUsername: string) => {
    if (!user) throw new Error('No hay sesión activa.');
    const cleanUsername = nuevoUsername.trim();

    if (cleanUsername.length < 3) {
      throw new Error('El username debe tener al menos 3 caracteres.');
    }

    try {
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
      if (role) {
        saveCachedProfile({ userId: user.id, role, username: cleanUsername, avatarUrl });
      }
    } catch (err) {
      console.error('Error al actualizar username:', err);
      throw new Error(errorMessage(err), { cause: err });
    }
  }, [user, username, role, avatarUrl]);

  const actualizarAvatar = useCallback(async (nuevoAvatarUrl: string) => {
    if (!user) throw new Error('No hay sesión activa.');

    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: nuevoAvatarUrl }).eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(nuevoAvatarUrl);
      if (role) {
        saveCachedProfile({ userId: user.id, role, username, avatarUrl: nuevoAvatarUrl });
      }
    } catch (err) {
      console.error('Error al actualizar avatar:', err);
      throw new Error(errorMessage(err), { cause: err });
    }
  }, [user, role, username]);

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
    setUser(null);
    limpiarPerfil();

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Fallo en signOut:', e);
    }
  }, [limpiarPerfil]);

  const isAdmin = role === 'admin';

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
