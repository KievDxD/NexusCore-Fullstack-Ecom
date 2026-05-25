import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type User } from '@supabase/supabase-js'; // El tipo oficial de Supabase

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'usuario' | null;
  username: string | null;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registro: (email: string, pass: string, username: string) => Promise<void>;
  actualizarUsername: (nuevoUsername: string) => Promise<void>;
  logout: () => Promise<void>;
  cargando: boolean; // Para evitar que la pantalla parpadee mientras valida
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'usuario' | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error al obtener perfil:", error.message);
        setRole('usuario');
        setUsername(null);
      } else if (data) {
        setRole(data.role as 'admin' | 'usuario');
        setUsername(data.username);
      }
    } catch (err) {
      console.error("Error inesperado al cargar perfil:", err);
      setRole('usuario');
      setUsername(null);
    }
  };

  useEffect(() => {
    // 1. Revisar si hay un usuario logueado al cargar la página
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setRole(null);
        setUsername(null);
      }
      setCargando(false);
    });

    // 2. Quedarse "escuchando" si el usuario entra o sale en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setRole(null);
        setUsername(null);
      }
      setCargando(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) throw error;
    setUser(data.user);
    if (data.user) {
      await fetchProfile(data.user.id);
    }
  };

  const registro = async (email: string, pass: string, usernameStr: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { username: usernameStr.toLowerCase() }
      }
    });

    if (error) throw error;
    
    // Si se crea inmediatamente la sesión
    if (data.user) {
      setUser(data.user);
      // Garantizar que la UI se actualice inmediatamente con los datos locales de registro
      setRole('usuario');
      setUsername(usernameStr.toLowerCase());

      // Intentar guardar en base de datos (por si no hay trigger activo)
      // Pero no bloqueamos la experiencia de usuario si falla por duplicado/RLS del trigger
      supabase
        .from('profiles')
        .insert([
          { 
            id: data.user.id, 
            username: usernameStr.toLowerCase(), 
            role: 'usuario',
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.user.id}`
          }
        ])
        .then(({ error: profileError }) => {
          if (profileError) {
            console.log("El disparador de base de datos ya insertó el perfil.");
            // Verificar si el rol real en BD es diferente
            fetchProfile(data.user!.id);
          }
        });
    }
  };

  const actualizarUsername = async (nuevoUsername: string) => {
    if (!user) throw new Error('No hay sesión activa.');
    const cleanUsername = nuevoUsername.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      throw new Error('El username debe tener al menos 3 caracteres.');
    }

    try {
      // 1. Verificar si el username ya está en uso por OTRO usuario
      const { data: existente } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', user.id)
        .maybeSingle();

      if (existente) {
        throw new Error(`El nombre de usuario "@${cleanUsername}" ya está en uso. Por favor, elige otro.`);
      }

      // 2. Comprobar si ya existe el perfil de este usuario
      const { data: perfilPropio } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (perfilPropio) {
        // Hacer UPDATE
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ username: cleanUsername })
          .eq('id', user.id);

        if (updateError) throw updateError;
      } else {
        // Hacer INSERT
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: cleanUsername,
            role: role || 'usuario',
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`
          });

        if (insertError) throw insertError;
      }

      // 3. Sincronizar estado local inmediatamente
      setUsername(cleanUsername);
    } catch (err: any) {
      console.error("Error al actualizar username:", err);
      if (err.message) throw err;
      throw new Error('Error inesperado al actualizar el username. Intenta de nuevo.');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setUsername(null);
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, role, username, isAdmin, login, registro, actualizarUsername, logout, cargando }}>
      {!cargando && children} 
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};