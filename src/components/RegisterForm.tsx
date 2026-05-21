import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await register(email, password);
    
    if (error) {
      alert("Error al registrarse: " + error.message);
    } else {
      alert("¡Registro exitoso! Por favor, verifica tu correo si es necesario.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-md border border-gray-100 max-w-sm mx-auto">
      <h2 className="text-xl font-bold mb-4">Crear Cuenta</h2>
      <input
        type="email"
        placeholder="Correo electrónico"
        className="w-full p-2 mb-3 border rounded"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Contraseña"
        className="w-full p-2 mb-4 border rounded"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-emerald-600 text-white py-2 rounded font-semibold hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Registrando...' : 'Registrarse'}
      </button>
    </form>
  );
}