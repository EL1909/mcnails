import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowRight, Mail, Phone, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister, requestPasswordReset, confirmPasswordReset } from '../api/auth';
import { cn } from '../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'reset';
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [idType, setIdType] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetParams, setResetParams] = useState<{ uid: string; token: string } | null>(null);

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    email: '',
    new_password1: '',
    new_password2: '',
  });

  useEffect(() => {
    if (initialMode === 'reset') {
      const params = new URLSearchParams(window.location.search);
      const uid = params.get('uid');
      const token = params.get('token');
      if (uid && token) {
        setResetParams({ uid, token });
        setMode('reset');
      }
    }
  }, [initialMode]);

  if (!isOpen) return null;

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'login') {
        const data = await apiLogin(formData.identifier, formData.password);
        await login(data.access);
        onClose();
      } else if (mode === 'register') {
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
      } else if (mode === 'forgot') {
        await requestPasswordReset(formData.email);
        setSuccess('Si el email está registrado recibirás un mensaje en breve.');
      } else if (mode === 'reset') {
        if (!resetParams) return;
        if (formData.new_password1 !== formData.new_password2) {
          setError('Las contraseñas no coinciden.');
          return;
        }
        await confirmPasswordReset(resetParams.uid, resetParams.token, formData.new_password1, formData.new_password2);
        setSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
        setTimeout(() => { setMode('login'); setSuccess(null); }, 2000);
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
              {mode === 'login' && 'Bienvenida'}
              {mode === 'register' && 'Crear cuenta'}
              {mode === 'forgot' && 'Recuperar acceso'}
              {mode === 'reset' && 'Nueva contraseña'}
            </h2>
            <p className="text-stone-500 text-sm mt-1">
              {mode === 'login' && 'Accede a tus reservas y perfil.'}
              {mode === 'register' && 'Únete para gestionar tus citas.'}
              {mode === 'forgot' && 'Te enviaremos un enlace a tu email.'}
              {mode === 'reset' && 'Elige una nueva contraseña segura.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors self-start">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
              <CheckCircle size={16} /> {success}
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (<>
            <input
              required type="text" placeholder="Email o número de WhatsApp"
              className={inputClass} value={formData.identifier} onChange={set('identifier')}
            />
            <input required type="password" placeholder="Contraseña" className={inputClass} value={formData.password} onChange={set('password')} />
            <button disabled={loading} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              Iniciar sesión
            </button>
            <button type="button" onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
              className="w-full text-sm text-stone-400 hover:text-stone-700 transition-colors text-center pt-1">
              ¿Olvidaste tu contraseña?
            </button>
            <button type="button" onClick={() => { setMode('register'); setError(null); }}
              className="w-full text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center gap-1 pt-1">
              ¿No tienes cuenta? Regístrate <ArrowRight size={14} />
            </button>
          </>)}

          {/* REGISTER */}
          {mode === 'register' && (<>
            <div className="grid grid-cols-2 gap-4">
              <input required placeholder="Nombre" className={inputClass} value={formData.first_name} onChange={set('first_name')} />
              <input required placeholder="Apellido" className={inputClass} value={formData.last_name} onChange={set('last_name')} />
            </div>
            <div className="flex rounded-xl border border-stone-200 overflow-hidden">
              <button type="button" onClick={() => { setIdType('email'); setFormData(p => ({ ...p, identifier: '' })); }}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', idType === 'email' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50')}>
                <Mail size={15} /> Email
              </button>
              <button type="button" onClick={() => { setIdType('phone'); setFormData(p => ({ ...p, identifier: '' })); }}
                className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors', idType === 'phone' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50')}>
                <Phone size={15} /> WhatsApp
              </button>
            </div>
            <input required type={idType === 'email' ? 'email' : 'tel'}
              placeholder={idType === 'email' ? 'Correo electrónico' : 'Número de WhatsApp'}
              className={inputClass} value={formData.identifier} onChange={set('identifier')} />
            <input required type="password" placeholder="Contraseña" className={inputClass} value={formData.password} onChange={set('password')} />
            <input required type="password" placeholder="Confirmar contraseña" className={inputClass} value={formData.password2} onChange={set('password2')} />
            <button disabled={loading} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              Registrarme
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(null); }}
              className="w-full text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center gap-1 pt-2">
              ¿Ya tienes cuenta? Inicia sesión <ArrowRight size={14} />
            </button>
          </>)}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && (<>
            <input required type="email" placeholder="Tu correo electrónico"
              className={inputClass} value={formData.email} onChange={set('email')} />
            <button disabled={loading || !!success} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              Enviar enlace
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className="w-full text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center gap-1 pt-2">
              Volver al inicio de sesión <ArrowRight size={14} />
            </button>
          </>)}

          {/* RESET PASSWORD */}
          {mode === 'reset' && (<>
            <input required type="password" placeholder="Nueva contraseña"
              className={inputClass} value={formData.new_password1} onChange={set('new_password1')} />
            <input required type="password" placeholder="Confirmar nueva contraseña"
              className={inputClass} value={formData.new_password2} onChange={set('new_password2')} />
            <button disabled={loading || !!success} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              Restablecer contraseña
            </button>
          </>)}
        </form>
      </div>
    </div>
  );
};
