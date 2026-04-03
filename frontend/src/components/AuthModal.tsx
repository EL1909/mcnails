import React, { useState } from 'react';
import { X, Loader2, ArrowRight, Mail, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister } from '../api/auth';
import { cn } from '../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [idType, setIdType] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
  });

  if (!isOpen) return null;

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const data = await apiLogin(formData.identifier, formData.password);
        await login(data.access);
        onClose();
      } else {
        if (formData.password !== formData.password2) {
          setError('Las contraseñas no coinciden.');
          return;
        }
        const payload = {
          password: formData.password,
          password2: formData.password2,
          first_name: formData.first_name,
          last_name: formData.last_name,
          ...(idType === 'email' ? { email: formData.identifier } : { phone: formData.identifier }),
        };
        const data = await apiRegister(payload);
        await login(data.access);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900 bg-white text-stone-900 placeholder:text-stone-400";

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-center p-8 pb-0">
          <div>
            <div className="w-8 h-8 bg-stone-900 rounded-full flex items-center justify-center text-white font-serif text-sm italic mb-4">MC</div>
            <h2 className="text-3xl font-serif">
              {mode === 'login' ? 'Bienvenida' : 'Crear cuenta'}
            </h2>
            <p className="text-stone-500 text-sm mt-1">
              {mode === 'login' ? 'Accede a tus reservas y perfil.' : 'Únete para gestionar tus citas.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors self-start">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-4">
              <input required placeholder="Nombre" className={inputClass} value={formData.first_name} onChange={set('first_name')} />
              <input required placeholder="Apellido" className={inputClass} value={formData.last_name} onChange={set('last_name')} />
            </div>
          )}

          {/* Email / Phone toggle for register */}
          {mode === 'register' && (
            <div className="flex rounded-xl border border-stone-200 overflow-hidden">
              <button
                type="button"
                onClick={() => { setIdType('email'); setFormData(p => ({ ...p, identifier: '' })); }}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', idType === 'email' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50')}
              >
                <Mail size={15} /> Email
              </button>
              <button
                type="button"
                onClick={() => { setIdType('phone'); setFormData(p => ({ ...p, identifier: '' })); }}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', idType === 'phone' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50')}
              >
                <Phone size={15} /> WhatsApp
              </button>
            </div>
          )}

          <input
            required
            type={mode === 'register' ? (idType === 'email' ? 'email' : 'tel') : 'text'}
            placeholder={
              mode === 'login'
                ? 'Email o número de WhatsApp'
                : idType === 'email' ? 'Correo electrónico' : 'Número de WhatsApp'
            }
            className={inputClass}
            value={formData.identifier}
            onChange={set('identifier')}
          />

          <input required type="password" placeholder="Contraseña" className={inputClass} value={formData.password} onChange={set('password')} />

          {mode === 'register' && (
            <input required type="password" placeholder="Confirmar contraseña" className={inputClass} value={formData.password2} onChange={set('password2')} />
          )}

          <button
            disabled={loading}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {mode === 'login' ? 'Iniciar sesión' : 'Registrarme'}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            className="w-full text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center gap-1 pt-2"
          >
            {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            <ArrowRight size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
