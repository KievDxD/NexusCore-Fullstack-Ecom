import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js'; // El tipo oficial de Supabase

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'usuario' | null;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  login: (emailOrUsername: string, pass: string) => Promise<void>;
  registro: (email: string, pass: string, username: string) => Promise<void>;
  actualizarUsername: (nuevoUsername: string) => Promise<void>;
  actualizarAvatar: (nuevoAvatarUrl: string) => Promise<void>;
  subirAvatar: (file: File) => Promise<string>;
  logout: () => Promise<void>;
  cargando: boolean; // Para evitar que la pantalla parpadee mientras valida
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'usuario' | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, username, avatar_url')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn("Error al obtener perfil, usando valores locales o por defecto:", error.message);
        setRole(prev => prev || 'usuario');
        setUsername(prev => prev || (email ? email.split('@')[0] : 'usuario'));
        setAvatarUrl(prev => prev || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`);
      } else if (data) {
        setRole(data.role as 'admin' | 'usuario');
        setUsername(data.username);
        setAvatarUrl(data.avatar_url);
      }
    } catch (err) {
      console.error("Error inesperado al cargar perfil:", err);
      setRole(prev => prev || 'usuario');
    }
  };

  useEffect(() => {
    let active = true;

    // Escuchar cambios de autenticación y cargar sesión inicial de manera segura
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`onAuthStateChange event: ${event}`, session);
      if (!active) return;

      const currentUser = session?.user ?? null;

      if (currentUser) {
        // Carga optimista: Asumir que la sesión local es válida para renderizar inmediatamente la UI
        setUser(currentUser);
        if (active) setCargando(false);

        // Verificar la sesión real contra el servidor en segundo plano
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
        
        if (error || !verifiedUser) {
          console.warn("Sesión inválida o usuario eliminado del servidor. Limpiando sesión local:", error?.message);
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (e) {
            console.warn("Fallo al ejecutar signOut local:", e);
          }
          setUser(null);
          setRole(null);
          setUsername(null);
          setAvatarUrl(null);
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
              localStorage.removeItem(key);
            }
          }
          return;
        }

        // Si es válido, actualizar el usuario y cargar su perfil público en background
        setUser(verifiedUser);
        await fetchProfile(verifiedUser.id, verifiedUser.email);
      } else {
        // Si no hay sesión, limpiar estados
        setUser(null);
        setRole(null);
        setUsername(null);
        setAvatarUrl(null);
        if (active) setCargando(false);
      }
    });

    // Salvaguarda para evitar pantallas de carga infinitas
    const timeoutId = setTimeout(() => {
      if (active && cargando) {
        console.warn("Tiempo de espera de inicialización agotado. Desactivando cargando.");
        setCargando(false);
      }
    }, 4500);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (emailOrUsername: string, pass: string) => {
    let identifier = emailOrUsername.trim();
    // Quitar @ si el usuario lo ingresó al inicio del username
    if (identifier.startsWith('@')) {
      identifier = identifier.substring(1);
    }
    let resolvedEmail = identifier;

    // Si no contiene un '@', asumimos que es un username y buscamos su email
    if (!identifier.includes('@')) {
      const { data: email, error: rpcError } = await supabase.rpc('get_email_by_username', {
        username_to_find: identifier
      });

      if (rpcError) {
        console.error("Error al resolver username por RPC:", rpcError.message);
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
  };

  const registro = async (email: string, pass: string, usernameStr: string) => {
    const cleanUsername = usernameStr.trim();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Pre-validar en base de datos usando la RPC unificada
    const { data: checkData, error: checkError } = await supabase.rpc('check_user_exists', {
      email_to_check: cleanEmail,
      username_to_check: cleanUsername
    });

    if (checkError) {
      console.warn("Fallo al pre-validar credenciales en base de datos:", checkError.message);
    } else if (checkData && checkData.length > 0) {
      const { email_exists, username_exists } = checkData[0] as { email_exists: boolean, username_exists: boolean };
      if (email_exists) {
        throw new Error(`El correo electrónico "${cleanEmail}" ya está registrado.`);
      }
      if (username_exists) {
        throw new Error(`El nombre de usuario "@${cleanUsername}" ya está en uso.`);
      }
    }

    // 2. Ejecutar registro de Supabase
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: { username: cleanUsername },
        emailRedirectTo: window.location.origin
      }
    });

    if (error) throw error;
    
    // Si se crea inmediatamente la sesión
    if (data.user) {
      setUser(data.user);
      // Garantizar que la UI se actualice inmediatamente con los datos locales de registro
      setRole('usuario');
      setUsername(cleanUsername);
      setAvatarUrl(`https://api.dicebear.com/7.x/bottts/svg?seed=${data.user.id}`);

      // Sincronizar el perfil real desde la base de datos (creado por el trigger)
      await fetchProfile(data.user.id, data.user.email);
    }
  };

  const actualizarUsername = async (nuevoUsername: string) => {
    if (!user) throw new Error('No hay sesión activa.');
    const cleanUsername = nuevoUsername.trim();

    if (cleanUsername.length < 3) {
      throw new Error('El username debe tener al menos 3 caracteres.');
    }

    try {
      // 1. Verificar si el username ya está en uso por OTRO usuario
      // Optimizacion: Si solo esta cambiando mayusculas/minusculas, no hacer el select
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

      // 2. Hacer upsert del perfil completo
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: cleanUsername,
          email: user.email,
          role: role || 'usuario',
          avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`
        });

      if (error) throw error;

      // 3. Sincronizar estado local inmediatamente
      setUsername(cleanUsername);
    } catch (err) {
      console.error("Error al actualizar username:", err);
      const errorMsg = err instanceof Error ? err.message : (err as Record<string, unknown>)?.message || String(err);
      throw new Error(String(errorMsg), { cause: err });
    }
  };

  const actualizarAvatar = async (nuevoAvatarUrl: string) => {
    if (!user) throw new Error('No hay sesión activa.');

    try {
      // Usar upsert para garantizar creación de perfil si no existe
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username || user.email?.split('@')[0] || 'usuario',
          email: user.email,
          role: role || 'usuario',
          avatar_url: nuevoAvatarUrl
        });

      if (error) throw error;
      setAvatarUrl(nuevoAvatarUrl);
    } catch (err) {
      console.error("Error al actualizar avatar:", err);
      const errorMsg = err instanceof Error ? err.message : (err as Record<string, unknown>)?.message || String(err);
      throw new Error(String(errorMsg), { cause: err });
    }
  };

  const subirAvatar = async (file: File): Promise<string> => {
    if (!user) throw new Error('No hay sesión activa.');

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Subir archivo al bucket de avatars
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obtener la URL pública del archivo
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Actualizar la base de datos con la nueva URL
      await actualizarAvatar(publicUrl);

      return publicUrl;
    } catch (err) {
      console.error("Error al subir avatar:", err);
      const error = err instanceof Error ? err : new Error(String(err));
      throw new Error(error.message || 'Error inesperado al subir la imagen.', { cause: err });
    }
  };

  const logout = async () => {
    try {
      // Intentar signOut estándar (notifica al servidor y borra local)
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("Error devuelto por Supabase signOut:", error);
        // Si falla el servidor, forzar cierre local
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (err) {
      console.warn("Excepción durante signOut:", err);
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      // Siempre limpiar estados locales de React de forma síncrona
      setUser(null);
      setRole(null);
      setUsername(null);
      setAvatarUrl(null);

      // Borrar manualmente todas las claves de localStorage de Supabase por si acaso
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        console.warn("No se pudo limpiar localStorage manualmente:", e);
      }

      // Reinicio nuclear de la app para asegurar la limpieza del estado
      window.location.href = '/login';
    }
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, role, username, avatarUrl, isAdmin, login, registro, actualizarUsername, actualizarAvatar, subirAvatar, logout, cargando }}>
      {cargando ? (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-999">
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