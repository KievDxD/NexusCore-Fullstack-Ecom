import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error atrapado por ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleLogout = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('Error al forzar logout local:', e);
    } finally {
      // Limpiar localStorage manualmente
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
          localStorage.removeItem(key);
        }
      }
      window.location.href = '/login';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl max-w-lg w-full flex flex-col items-center">
            <div className="bg-red-500/20 p-4 rounded-full text-red-500 mb-6 border border-red-500/30">
              <AlertTriangle size={48} />
            </div>
            
            <h1 className="text-2xl font-black tracking-tighter mb-2 text-zinc-100">
              ¡Ups! Algo salió mal.
            </h1>
            <p className="text-sm text-zinc-400 mb-8 max-w-sm">
              La aplicación encontró un error inesperado y no puede continuar. Puedes intentar recargar la página o cerrar sesión.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-zinc-100 text-zinc-950 hover:bg-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw size={18} />
                Recargar página
              </button>
              
              <button
                onClick={this.handleLogout}
                className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>

            {/* Opcional: Mostrar el mensaje de error en desarrollo */}
            <div className="mt-8 w-full">
              <p className="text-xs text-zinc-500 font-mono text-left bg-zinc-950/50 p-4 rounded-xl overflow-auto border border-zinc-800/50 max-h-32">
                {this.state.error?.message || 'Error desconocido'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
