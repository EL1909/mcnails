import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ShoppingBag,
  Image as ImageIcon,
  Star,
  User,
  ChevronRight,
  ChevronDown,
  Instagram,
  Facebook,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  CreditCard,
  Menu,
  X,
  Settings,
  Plus,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { fetchProducts, fetchAdminProducts, fetchAdminCategories, createProduct, updateProduct, deleteProduct, createCategory, createOrder, type Product, type Category } from './api/store';
import { fetchUsers, adminCreateUser, adminUpdateUser, type ClientUser } from './api/auth';
import { fetchAvailability, createAppointment, createAppointmentAdmin, fetchAppointments, updateAppointment, deleteAppointment, type AppointmentPayload, type TimeSlot, type CalendarEvent } from './api/calendar';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';

// --- Types ---
type Section = 'home' | 'services' | 'gallery' | 'reviews' | 'admin' | 'booking';

// Service maps to Product from the API
type Service = {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
  image: string;
};

interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
  date: string;
}

const FALLBACK_IMAGE = 'https://picsum.photos/seed/nails-default/400/300';

function mapProductToService(p: Product): Service {
  return {
    id: String(p.id),
    name: p.name,
    price: parseFloat(p.price),
    duration: p.duration || '',
    description: p.description,
    image: p.image ?? FALLBACK_IMAGE,
  };
}

const REVIEWS: Review[] = [
  { id: '1', user: 'Valeria M.', rating: 5, comment: 'La mejor atención, mis uñas quedaron impecables y duraron muchísimo.', date: 'Hace 2 días' },
  { id: '2', user: 'Camila R.', rating: 5, comment: 'Excelente técnica, muy profesional y el lugar es hermoso.', date: 'Hace 1 semana' },
  { id: '3', user: 'Sofía G.', rating: 4, comment: 'Me encantó el diseño de Soft Gel, súper recomendado.', date: 'Hace 2 semanas' },
];

const GALLERY = [
  'https://picsum.photos/seed/g1/600/800',
  'https://picsum.photos/seed/g2/600/600',
  'https://picsum.photos/seed/g3/800/600',
  'https://picsum.photos/seed/g4/600/800',
  'https://picsum.photos/seed/g5/600/600',
  'https://picsum.photos/seed/g6/800/600',
];

// --- Components ---

const Navbar = ({ activeSection, setActiveSection, onOpenAuth }: { activeSection: Section, setActiveSection: (s: Section) => void, onOpenAuth: (mode: 'login' | 'register') => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  const navItems: { id: Section; label: string; icon: any }[] = [
    { id: 'home', label: 'Inicio', icon: null },
    { id: 'services', label: 'Servicios', icon: ShoppingBag },
    { id: 'gallery', label: 'Galería', icon: ImageIcon },
    { id: 'reviews', label: 'Reseñas', icon: Star },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveSection('home')}>
            <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center text-white font-serif text-xl italic">MC</div>
            <span className="text-2xl font-serif tracking-tight font-semibold">MC Nails</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-stone-900",
                  activeSection === item.id ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-500"
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => setActiveSection('booking')}
              className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
            >
              Reservar Cita
            </button>
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveSection('admin')}
                  className={cn("text-sm font-medium transition-colors hover:text-stone-900", activeSection === 'admin' ? "text-stone-900 border-b-2 border-stone-900" : "text-stone-500")}
                >
                  {user?.first_name || <KeyRound size={16} />}
                </button>
                <button onClick={logout} className="p-2 text-stone-400 hover:text-stone-900 transition-colors" title="Cerrar sesión">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button onClick={() => onOpenAuth('login')} className="p-2 text-stone-500 hover:text-stone-900 transition-colors" title="Iniciar sesión">
                <User size={20} />
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-stone-600">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-stone-200 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setIsOpen(false); }}
                  className={cn(
                    "block w-full text-left px-4 py-3 rounded-xl text-base font-medium",
                    activeSection === item.id ? "bg-stone-100 text-stone-900" : "text-stone-500"
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => { setActiveSection('booking'); setIsOpen(false); }}
                className="w-full bg-stone-900 text-white px-4 py-4 rounded-xl text-base font-medium mt-4"
              >
                Reservar Cita
              </button>
              {isAuthenticated ? (
                <div className="border-t border-stone-100 pt-3 mt-2 space-y-1">
                  <button onClick={() => { setActiveSection('admin'); setIsOpen(false); }} className="block w-full text-left px-4 py-3 rounded-xl text-base font-medium text-stone-500 hover:bg-stone-100">
                    <Settings size={16} className="inline mr-2" />{user?.first_name || <KeyRound size={14} className="inline" />} — Admin
                  </button>
                  <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-3 text-stone-400 text-sm">
                    <LogOut size={16} /> Cerrar sesión
                  </button>
                </div>
              ) : (
                <button onClick={() => { onOpenAuth('login'); setIsOpen(false); }} className="w-full border border-stone-200 px-4 py-3 rounded-xl text-base font-medium text-stone-600 mt-2">
                  Iniciar sesión
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </nav>
  );
};

const Hero = ({ onBooking }: { onBooking: () => void }) => (
  <section className="pt-32 pb-20 px-4">
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-block px-4 py-1.5 bg-stone-100 text-stone-600 rounded-full text-xs font-semibold uppercase tracking-widest mb-6">
          Arte en tus manos
        </span>
        <h1 className="text-6xl md:text-8xl font-serif leading-[0.9] mb-8 tracking-tight">
          Donde la <span className="italic text-stone-400">elegancia</span> encuentra el detalle.
        </h1>
        <p className="text-lg text-stone-500 mb-10 max-w-lg leading-relaxed">
          Especialista en manicura rusa, extensiones y nail art personalizado. Reserva tu espacio y déjanos cuidar de ti.
        </p>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={onBooking}
            className="bg-stone-900 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-stone-800 transition-all shadow-xl shadow-stone-200 flex items-center gap-2"
          >
            Reservar Ahora <ChevronRight size={20} />
          </button>
          <button className="border border-stone-200 px-8 py-4 rounded-full text-lg font-medium hover:bg-stone-50 transition-all">
            Ver Servicios
          </button>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        <div className="aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl">
          <img 
            src="https://picsum.photos/seed/hero-nails/800/1000" 
            alt="Nail Art Hero" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute -bottom-6 -left-6 glass p-6 rounded-2xl shadow-xl max-w-[200px]">
          <div className="flex gap-1 mb-2">
            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} className="fill-stone-900 text-stone-900" />)}
          </div>
          <p className="text-sm font-medium italic">"El mejor servicio de la ciudad, mis uñas nunca se vieron tan bien."</p>
          <p className="text-xs text-stone-400 mt-2">— María Paula</p>
        </div>
      </motion.div>
    </div>
  </section>
);

const ServicesSection = ({ services, onSelect }: { services: Service[], onSelect: (s: Service) => void }) => (
  <section className="py-24 bg-stone-50">
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-serif mb-4">Nuestros Servicios</h2>
        <p className="text-stone-500 max-w-2xl mx-auto">Selecciona el tratamiento ideal para tus manos. Calidad premium garantizada.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {services.map((service, idx) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="h-48 overflow-hidden relative">
              <img src={service.image} alt={service.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold">
                ${service.price}
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-serif mb-2">{service.name}</h3>
              <div className="flex items-center gap-2 text-xs text-stone-400 mb-4 uppercase tracking-wider">
                <Clock size={14} /> {service.duration}
              </div>
              <p className="text-sm text-stone-500 mb-6 line-clamp-2">{service.description}</p>
              <button 
                onClick={() => onSelect(service)}
                className="w-full py-3 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-900 hover:text-white transition-all"
              >
                Reservar
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const GallerySection = () => (
  <section className="py-24">
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex justify-between items-end mb-16">
        <div>
          <h2 className="text-4xl md:text-5xl font-serif mb-4">Portafolio</h2>
          <p className="text-stone-500">Inspiración para tu próxima cita.</p>
        </div>
        <button className="text-stone-900 font-semibold flex items-center gap-2 hover:underline">
          Ver Instagram <Instagram size={20} />
        </button>
      </div>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
        {GALLERY.map((img, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl overflow-hidden shadow-md"
          >
            <img src={img} alt={`Gallery ${idx}`} className="w-full h-auto object-cover hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const ReviewsSection = () => (
  <section className="py-24 bg-stone-900 text-white overflow-hidden relative">
    <div className="absolute top-0 right-0 w-96 h-96 bg-stone-800 rounded-full blur-[100px] -mr-48 -mt-48 opacity-50"></div>
    <div className="max-w-7xl mx-auto px-4 relative z-10">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-serif mb-4">Lo que dicen nuestras clientas</h2>
        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map(i => <Star key={i} size={20} className="fill-white text-white" />)}
        </div>
        <p className="text-stone-400">Más de 500 citas exitosas este año.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {REVIEWS.map((review) => (
          <div key={review.id} className="bg-stone-800/50 p-8 rounded-3xl border border-stone-700">
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={14} className={cn(i <= review.rating ? "fill-white text-white" : "text-stone-600")} />
              ))}
            </div>
            <p className="text-lg italic mb-6">"{review.comment}"</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stone-700 rounded-full flex items-center justify-center font-bold text-sm">
                {review.user[0]}
              </div>
              <div>
                <p className="font-semibold text-sm">{review.user}</p>
                <p className="text-xs text-stone-500">{review.date}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const BookingFlow = ({ selectedService, onBack }: { selectedService: Service | null, onBack: () => void }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — date & slot
  const [dateStr, setDateStr] = useState(''); // YYYY-MM-DD
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 2 — customer info
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const handleDateChange = async (d: string) => {
    setDateStr(d);
    setSelectedSlot(null);
    setSlots([]);
    if (!d) return;
    setLoadingSlots(true);
    try {
      const res = await fetchAvailability(d, selectedService ? Number(selectedService.id) : undefined);
      setSlots(res.slots);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !form.name || !form.email) return;
    setSubmitting(true);
    setError(null);
    try {
      // Create appointment
      await createAppointment({
        product: selectedService ? Number(selectedService.id) : undefined,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
      });

      // Also create order so it shows in admin orders
      if (selectedService) {
        await createOrder({
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          booking_date: dateStr,
          booking_time: selectedSlot.label + ':00',
          items: [{ product_id: Number(selectedService.id), quantity: 1 }],
        });
      }

      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Error al confirmar la cita');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full p-4 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900 text-sm";

  return (
    <div className="pt-32 pb-20 px-4 max-w-4xl mx-auto">
      <button onClick={onBack} className="mb-8 flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors">
        <ChevronRight className="rotate-180" size={20} /> Volver
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-stone-100">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {/* Sidebar */}
          <div className="bg-stone-50 p-8 border-r border-stone-100">
            <h3 className="text-2xl font-serif mb-6">Tu Reserva</h3>
            {selectedService ? (
              <div className="space-y-4">
                <div className="aspect-video rounded-2xl overflow-hidden">
                  <img src={selectedService.image} alt={selectedService.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Servicio</p>
                  <p className="font-serif text-lg">{selectedService.name}</p>
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Duración</p>
                    <p className="text-sm">{selectedService.duration}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Precio</p>
                    <p className="text-sm font-bold">${selectedService.price}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-stone-400 italic text-sm">Selecciona un servicio para comenzar.</p>
            )}

            {selectedSlot && (
              <div className="mt-8 pt-8 border-t border-stone-200 space-y-1">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Fecha y Hora</p>
                <p className="text-sm font-medium">{dateStr}</p>
                <p className="text-sm">{selectedSlot.label}</p>
              </div>
            )}
          </div>

          {/* Main */}
          <div className="md:col-span-2 p-8 md:p-12">

            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h4 className="text-3xl font-serif mb-8">Elige una fecha</h4>

                <input
                  type="date"
                  min={todayStr}
                  value={dateStr}
                  onChange={e => handleDateChange(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-stone-200 focus:outline-none focus:border-stone-900 text-base mb-8"
                />

                {loadingSlots && (
                  <div className="flex items-center gap-2 text-stone-400 text-sm mb-6">
                    <span className="animate-spin border-2 border-stone-300 border-t-stone-700 rounded-full w-4 h-4" />
                    Consultando disponibilidad…
                  </div>
                )}

                {!loadingSlots && dateStr && slots.length === 0 && (
                  <p className="text-stone-400 italic text-sm mb-6">No hay horarios disponibles para esta fecha.</p>
                )}

                {slots.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h4 className="text-xl font-serif mb-4">Horarios disponibles</h4>
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      {slots.map(slot => (
                        <button
                          key={slot.start}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "py-3 rounded-xl border text-sm font-medium transition-all",
                            selectedSlot?.start === slot.start
                              ? "bg-stone-900 text-white border-stone-900"
                              : "border-stone-200 hover:border-stone-900"
                          )}
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                <button
                  disabled={!selectedSlot}
                  onClick={() => setStep(2)}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-stone-200"
                >
                  Continuar
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h4 className="text-3xl font-serif mb-8">Tus datos</h4>

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl mb-4">{error}</p>}

                <div className="space-y-4 mb-8">
                  <input
                    required
                    placeholder="Nombre completo"
                    className={inputClass}
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    required
                    type="email"
                    placeholder="Correo electrónico"
                    className={inputClass}
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  />
                  <input
                    placeholder="Teléfono (opcional)"
                    className={inputClass}
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>

                <div className="pt-6 border-t border-stone-100 mb-6">
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="text-stone-500">Servicio</span>
                    <span>{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="text-stone-500">Fecha</span>
                    <span>{dateStr} {selectedSlot?.label}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg mt-4">
                    <span>Total</span>
                    <span>${selectedService?.price}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 rounded-2xl border border-stone-200 font-medium text-stone-600 hover:bg-stone-50 transition-all"
                  >
                    Atrás
                  </button>
                  <button
                    disabled={!form.name || !form.email || submitting}
                    onClick={handleConfirm}
                    className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-stone-200 flex items-center justify-center gap-2"
                  >
                    {submitting
                      ? <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
                      : <CheckCircle2 size={18} />
                    }
                    Confirmar Cita
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 bg-stone-900 rounded-full flex items-center justify-center text-white mx-auto mb-8">
                  <CheckCircle2 size={40} />
                </div>
                <h4 className="text-4xl font-serif mb-4">¡Cita Confirmada!</h4>
                <p className="text-stone-500 mb-2">
                  <span className="font-medium">{dateStr}</span> a las <span className="font-medium">{selectedSlot?.label}</span>
                </p>
                <p className="text-stone-400 text-sm mb-8">Recibirás un correo con los detalles de tu reserva.</p>
                <button onClick={onBack} className="bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold">
                  Volver al Inicio
                </button>
              </motion.div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};


const ServiceForm = ({
  categories, token, onSaved, onClose,
}: {
  categories: Category[];
  token: string;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const [form, setForm] = useState({ name: '', description: '', price: '', duration: '', category: '', newCategory: '' });
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validar categoría antes de continuar
    if (!form.category) {
      setError('Selecciona o crea una categoría.');
      return;
    }
    if (form.category === '__new__' && !form.newCategory.trim()) {
      setError('Escribe el nombre de la nueva categoría.');
      return;
    }

    setLoading(true);
    try {
      let categoryId = form.category;
      if (form.category === '__new__') {
        const cat = await createCategory(token, form.newCategory.trim());
        categoryId = String(cat.id);
      }
      const data = new FormData();
      data.append('name', form.name);
      data.append('description', form.description);
      data.append('price', form.price);
      data.append('duration', form.duration);
      data.append('category', categoryId);
      data.append('is_active', 'true');
      if (image) data.append('image', image);
      await createProduct(token, data);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900 text-sm";

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center p-8 pb-4">
          <h3 className="text-2xl font-serif">Nuevo Servicio</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}

          <input required placeholder="Nombre del servicio" className={inputClass} value={form.name} onChange={set('name')} />
          <textarea required placeholder="Descripción" className={inputClass + ' resize-none'} rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />

          <div className="grid grid-cols-2 gap-4">
            <input required placeholder="Precio (ej: 35.00)" className={inputClass} value={form.price} onChange={set('price')} />
            <input required placeholder="Duración (ej: 60 min)" className={inputClass} value={form.duration} onChange={set('duration')} />
          </div>

          <select required className={inputClass} value={form.category} onChange={set('category')}>
            <option value="">Seleccionar categoría</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__new__">+ Nueva categoría</option>
          </select>

          {form.category === '__new__' && (
            <input required placeholder="Nombre de la nueva categoría" className={inputClass} value={form.newCategory} onChange={set('newCategory')} />
          )}

          <div>
            <label className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-2 block">Imagen</label>
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] ?? null)} className="text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200" />
          </div>

          <button disabled={loading} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all flex items-center justify-center gap-2">
            {loading ? <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" /> : <Plus size={18} />}
            Guardar Servicio
          </button>
        </form>
      </div>
    </div>
  );
};

const AppointmentsCalendar = ({ products }: { products: Product[] }) => {
  const { token } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<'detail' | 'new'>('detail');

  // New appointment form state
  const emptyForm = { customer_name: '', customer_email: '', customer_phone: '', product: '', date: '', start_time: '', end_time: '', notes: '', status: 'confirmed' };
  const [newForm, setNewForm] = useState(emptyForm);
  const [newError, setNewError] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  const reload = () => {
    if (!token) return;
    fetchAppointments(token).then(setEvents).catch(console.error);
  };

  useEffect(() => {
    if (!token) return;
    fetchAppointments(token)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEvent || !token) return;
    try {
      await updateAppointment(token, selectedEvent.id, { status: newStatus });
      const updated = await fetchAppointments(token);
      setEvents(updated);
      setSelectedEvent(prev => prev ? { ...prev, extendedProps: { ...prev.extendedProps, status: newStatus } } : null);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!selectedEvent || !token || !confirm('¿Eliminar esta cita?')) return;
    try {
      await deleteAppointment(token, selectedEvent.id);
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      setSelectedEvent(null);
    } catch (err) { console.error(err); }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setNewError(null);
    setSavingNew(true);
    try {
      const startISO = new Date(`${newForm.date}T${newForm.start_time}`).toISOString();
      const endISO = new Date(`${newForm.date}T${newForm.end_time}`).toISOString();
      const payload: AppointmentPayload = {
        customer_name: newForm.customer_name,
        customer_email: newForm.customer_email,
        customer_phone: newForm.customer_phone,
        start_time: startISO,
        end_time: endISO,
        notes: newForm.notes,
        ...(newForm.product ? { product: Number(newForm.product) } : {}),
      };
      await createAppointmentAdmin(token, payload);
      // also set status if not pending
      reload();
      setNewForm(emptyForm);
      setPanel('detail');
    } catch (err: any) {
      setNewError(err.message);
    } finally {
      setSavingNew(false);
    }
  };

  const setF = (k: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setNewForm(prev => ({ ...prev, [k]: e.target.value }));

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-stone-100 text-stone-600 border-stone-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  };
  const statusLabels: Record<string, string> = {
    pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Completado', cancelled: 'Cancelado',
  };

  const iClass = "w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Calendar */}
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-stone-400">Cargando citas…</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,listWeek',
            }}
            locale="es"
            buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' }}
            events={events.map(e => ({ ...e, id: String(e.id) }))}
            eventClick={info => {
              const ev = events.find(e => String(e.id) === info.event.id);
              if (ev) { setSelectedEvent(ev); setPanel('detail'); }
            }}
            slotMinTime="07:00:00"
            slotMaxTime="23:00:00"
            scrollTime="07:00:00"
            height="60vh"
            stickyHeaderDates
          />
        )}
      </div>

      {/* Side panel */}
      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8 overflow-y-auto max-h-[80vh]">
        {/* Panel toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setPanel('detail')}
            className={cn('flex-1 py-2 rounded-xl text-sm font-medium border transition-all', panel === 'detail' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-500 hover:border-stone-900')}
          >
            Detalle
          </button>
          <button
            onClick={() => setPanel('new')}
            className={cn('flex-1 py-2 rounded-xl text-sm font-medium border transition-all', panel === 'new' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-500 hover:border-stone-900')}
          >
            + Nueva Cita
          </button>
        </div>

        {panel === 'new' ? (
          <form onSubmit={handleCreateAppointment} className="space-y-3">
            <h3 className="text-lg font-serif mb-1">Nueva Cita</h3>
            {newError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{newError}</p>}

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Nombre cliente *</p>
              <input required className={iClass} placeholder="Nombre completo" value={newForm.customer_name} onChange={setF('customer_name')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Email</p>
                <input type="email" className={iClass} placeholder="—" value={newForm.customer_email} onChange={setF('customer_email')} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">WhatsApp</p>
                <input type="tel" className={iClass} placeholder="—" value={newForm.customer_phone} onChange={setF('customer_phone')} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Servicio</p>
              <select className={iClass} value={newForm.product} onChange={setF('product')}>
                <option value="">— Sin servicio —</option>
                {products.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Fecha *</p>
              <input required type="date" className={iClass} value={newForm.date} onChange={setF('date')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Inicio *</p>
                <input required type="time" className={iClass} value={newForm.start_time} onChange={setF('start_time')} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Fin *</p>
                <input required type="time" className={iClass} value={newForm.end_time} onChange={setF('end_time')} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Estado</p>
              <select className={iClass} value={newForm.status} onChange={setF('status')}>
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Notas</p>
              <textarea rows={2} className={cn(iClass, 'resize-none')} placeholder="Notas opcionales…" value={newForm.notes} onChange={setF('notes')} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={savingNew} className="flex-1 bg-stone-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50">
                {savingNew ? 'Guardando…' : 'Crear cita'}
              </button>
              <button type="button" onClick={() => { setNewForm(emptyForm); setNewError(null); }} className="px-4 py-2.5 rounded-xl text-sm text-stone-500 border border-stone-200 hover:border-stone-900 transition-colors">
                Limpiar
              </button>
            </div>
          </form>
        ) : !selectedEvent ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CalendarIcon size={32} className="text-stone-200 mb-4" />
            <p className="text-stone-400 font-serif text-lg">Selecciona una cita</p>
            <p className="text-stone-300 text-sm mt-1">Haz clic en el calendario</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-between items-start">
              <h3 className="text-xl font-serif">Detalle de Cita</h3>
              <button onClick={() => setSelectedEvent(null)} className="p-1 text-stone-300 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            <span className={cn('inline-block px-3 py-1 rounded-full text-xs font-semibold border', statusColors[selectedEvent.extendedProps.status] ?? 'bg-stone-100 text-stone-600')}>
              {statusLabels[selectedEvent.extendedProps.status] ?? selectedEvent.extendedProps.status}
            </span>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Cliente</p>
                <p className="font-medium">{selectedEvent.title}</p>
              </div>
              {selectedEvent.extendedProps.customer_email && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Email</p>
                  <p>{selectedEvent.extendedProps.customer_email}</p>
                </div>
              )}
              {selectedEvent.extendedProps.customer_phone && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Teléfono</p>
                  <p>{selectedEvent.extendedProps.customer_phone}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Inicio</p>
                <p>{new Date(selectedEvent.start).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Fin</p>
                <p>{new Date(selectedEvent.end).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              {selectedEvent.extendedProps.notes && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Notas</p>
                  <p className="italic text-stone-500">{selectedEvent.extendedProps.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-stone-100 space-y-2">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-2">Cambiar estado</p>
              {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map(s => (
                <button
                  key={s}
                  disabled={selectedEvent.extendedProps.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'w-full py-2 rounded-xl text-sm font-medium border transition-all',
                    selectedEvent.extendedProps.status === s
                      ? cn('cursor-default', statusColors[s])
                      : 'border-stone-200 text-stone-500 hover:border-stone-900 hover:text-stone-900'
                  )}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>

            <button onClick={handleDelete} className="w-full py-2 rounded-xl text-sm text-red-500 border border-red-100 hover:bg-red-50 transition-all">
              Eliminar cita
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminDashboard = ({ onServicesChanged }: { onServicesChanged: () => void }) => {
  const { token } = useAuth();
  const [adminTab, setAdminTab] = useState<'services' | 'calendar' | 'users' | 'billing'>('services');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState<Partial<ClientUser>>({});
  const [savingUser, setSavingUser] = useState(false);
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
  const [newUserError, setNewUserError] = useState<string | null>(null);
  const [savingNewUser, setSavingNewUser] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ name: '', description: '', price: '', duration: '', category: '', is_active: true });
  const [editImage, setEditImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadProducts = () => {
    if (!token) return;
    fetchAdminProducts(token).then(setProducts).catch(console.error);
  };

  useEffect(() => {
    if (!token) return;
    loadProducts();
    fetchAdminCategories(token).then(setCategories).catch(console.error);
    fetchUsers(token).then(setUsers).catch(console.error);
  }, [token]);

  const handleSelect = (p: Product) => {
    setSelected(p);
    setEditForm({ name: p.name, description: p.description, price: p.price, duration: p.duration, category: String(p.category), is_active: p.is_active });
    setEditImage(null);
    setEditError(null);
  };

  const handleSave = async () => {
    if (!token || !selected) return;
    setSaving(true);
    setEditError(null);
    try {
      const data = new FormData();
      data.append('name', editForm.name);
      data.append('description', editForm.description);
      data.append('price', editForm.price);
      data.append('duration', editForm.duration);
      data.append('category', editForm.category);
      data.append('is_active', String(editForm.is_active));
      if (editImage) data.append('image', editImage);
      const updated = await updateProduct(token, selected.id, data);
      setSelected(updated);
      loadProducts();
      onServicesChanged();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('¿Eliminar este servicio?')) return;
    try {
      await deleteProduct(token, id);
      if (selected?.id === id) setSelected(null);
      loadProducts();
      onServicesChanged();
    } catch (err) { console.error(err); }
  };

  const inputClass = "w-full p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900 text-sm";

  const cards: { id: 'services' | 'calendar' | 'users' | 'billing'; label: string; icon: React.ReactNode; value: string | number; sub: string }[] = [
    { id: 'services', label: 'Servicios', icon: <ShoppingBag size={20} />, value: products.length,                          sub: `${products.filter(p => p.is_active).length} activos` },
    { id: 'calendar', label: 'Agenda',    icon: <CalendarIcon size={20} />, value: '—',                                     sub: 'Citas del salón' },
    { id: 'users',    label: 'Clientes',  icon: <User size={20} />,         value: users.length,                            sub: `${users.filter(u => u.is_verified).length} verificados` },
    { id: 'billing',  label: 'Facturación', icon: <CreditCard size={20} />, value: '—',                                    sub: 'Próximamente' },
  ];

  return (
    <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-4xl font-serif mb-2">Panel de Administración</h2>
          <p className="text-stone-500">Gestiona tu agenda y servicios.</p>
        </div>
        {adminTab === 'services' && (
          <button onClick={() => setShowForm(true)} className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-stone-800 transition-all">
            <Plus size={18} /> Nuevo Servicio
          </button>
        )}
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => setAdminTab(card.id)}
            className={cn(
              'text-left p-6 rounded-3xl border transition-all shadow-sm',
              adminTab === card.id
                ? 'bg-stone-900 text-white border-stone-900 shadow-lg shadow-stone-200'
                : 'bg-white border-stone-100 hover:border-stone-300 hover:shadow-md'
            )}
          >
            <div className={cn('mb-4', adminTab === card.id ? 'text-white' : 'text-stone-400')}>
              {card.icon}
            </div>
            <p className={cn('text-3xl font-serif mb-1', adminTab === card.id ? 'text-white' : 'text-stone-900')}>{card.value}</p>
            <p className={cn('text-xs font-bold uppercase tracking-widest mb-0.5', adminTab === card.id ? 'text-stone-300' : 'text-stone-400')}>{card.label}</p>
            <p className={cn('text-xs', adminTab === card.id ? 'text-stone-400' : 'text-stone-400')}>{card.sub}</p>
          </button>
        ))}
      </div>

      {adminTab === 'calendar' && <AppointmentsCalendar products={products} />}

      {adminTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-serif">Clientes registrados</h3>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{users.length} total</span>
            </div>
            <button
              onClick={() => { setShowNewUser(v => !v); setNewUserError(null); }}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all', showNewUser ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-900')}
            >
              <Plus size={15} /> Nuevo cliente
            </button>
          </div>

          {showNewUser && (
            <div className="px-8 py-6 border-b border-stone-100 bg-stone-50">
              <h4 className="text-base font-serif mb-4">Crear cliente manualmente</h4>
              {newUserError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{newUserError}</p>}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Nombre</p>
                  <input className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" placeholder="Nombre" value={newUserForm.first_name} onChange={e => setNewUserForm(p => ({ ...p, first_name: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Apellido</p>
                  <input className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" placeholder="Apellido" value={newUserForm.last_name} onChange={e => setNewUserForm(p => ({ ...p, last_name: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Email</p>
                  <input type="email" className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" placeholder="—" value={newUserForm.email} onChange={e => setNewUserForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">WhatsApp</p>
                  <input type="tel" className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" placeholder="—" value={newUserForm.phone} onChange={e => setNewUserForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Notas internas</p>
                <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white resize-none" placeholder="Notas opcionales…" value={newUserForm.notes} onChange={e => setNewUserForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <button
                  disabled={savingNewUser}
                  onClick={async () => {
                    if (!token) return;
                    setNewUserError(null);
                    setSavingNewUser(true);
                    try {
                      const created = await adminCreateUser(token, newUserForm);
                      setUsers(prev => [created, ...prev]);
                      setNewUserForm({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
                      setShowNewUser(false);
                    } catch (err: any) {
                      setNewUserError(err.message);
                    } finally {
                      setSavingNewUser(false);
                    }
                  }}
                  className="bg-stone-900 text-white text-sm px-5 py-2 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
                >
                  {savingNewUser ? 'Guardando…' : 'Crear cliente'}
                </button>
                <button onClick={() => { setShowNewUser(false); setNewUserForm({ first_name: '', last_name: '', email: '', phone: '', notes: '' }); setNewUserError(null); }} className="text-sm text-stone-500 hover:text-stone-900 px-4 py-2 rounded-full transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400">
              <User size={28} className="mb-3 text-stone-200" />
              <p className="font-serif">Sin clientes aún</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-50">
              {users.map(u => {
                const isOpen = expandedUser === u.id;
                const isEditing = editingUser === u.id;
                const initial = u.first_name?.[0]?.toUpperCase() ?? (u.email?.[0]?.toUpperCase() ?? u.phone?.[0] ?? '?');

                const openEdit = () => {
                  setEditingUser(u.id);
                  setUserDraft({ first_name: u.first_name, last_name: u.last_name, email: u.email ?? '', phone: u.phone, notes: u.notes });
                };
                const cancelEdit = () => { setEditingUser(null); setUserDraft({}); };
                const saveEdit = async () => {
                  if (!token) return;
                  setSavingUser(true);
                  try {
                    const updated = await adminUpdateUser(token, u.id, userDraft);
                    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...updated } : x));
                    setEditingUser(null);
                    setUserDraft({});
                  } catch (e: any) {
                    alert(e.message);
                  } finally {
                    setSavingUser(false);
                  }
                };

                const field = (key: keyof typeof userDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  setUserDraft(prev => ({ ...prev, [key]: e.target.value }));

                const iClass = "w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white";

                return (
                  <div key={u.id}>
                    <button
                      onClick={() => { setExpandedUser(isOpen ? null : u.id); if (isEditing) cancelEdit(); }}
                      className="w-full flex items-center gap-4 px-8 py-4 hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-semibold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : <span className="text-stone-400 italic">Sin nombre</span>}
                        </p>
                        <p className="text-xs text-stone-400 truncate">{u.email ?? u.phone}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', u.is_verified ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400')}>
                          {u.is_verified ? 'Verificada' : 'Pendiente'}
                        </span>
                        <ChevronDown size={16} className={cn('text-stone-300 transition-transform', isOpen && 'rotate-180')} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-8 pb-6 pt-2 bg-stone-50 space-y-4">
                        {isEditing ? (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Nombre</p>
                                <input className={iClass} value={userDraft.first_name ?? ''} onChange={field('first_name')} placeholder="Nombre" />
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Apellido</p>
                                <input className={iClass} value={userDraft.last_name ?? ''} onChange={field('last_name')} placeholder="Apellido" />
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Email</p>
                                <input type="email" className={iClass} value={userDraft.email ?? ''} onChange={field('email')} placeholder="—" />
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">WhatsApp</p>
                                <input type="tel" className={iClass} value={userDraft.phone ?? ''} onChange={field('phone')} placeholder="—" />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Notas internas</p>
                              <textarea rows={3} className={cn(iClass, 'resize-none')} value={userDraft.notes ?? ''} onChange={field('notes')} placeholder="Notas sobre la cliente…" />
                            </div>
                            <div className="flex gap-3">
                              <button onClick={saveEdit} disabled={savingUser} className="bg-stone-900 text-white text-sm px-5 py-2 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50">
                                {savingUser ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button onClick={cancelEdit} className="text-sm text-stone-500 hover:text-stone-900 px-4 py-2 rounded-full transition-colors">
                                Cancelar
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Email</p>
                                <p className="text-stone-700">{u.email || <span className="text-stone-400 italic">—</span>}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">WhatsApp</p>
                                <p className="text-stone-700">{u.phone || <span className="text-stone-400 italic">—</span>}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Miembro desde</p>
                                <p className="text-stone-700">{new Date(u.date_joined).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Notas</p>
                                <p className="text-stone-700 whitespace-pre-wrap">{u.notes || <span className="text-stone-400 italic">Sin notas</span>}</p>
                              </div>
                            </div>
                            <button onClick={openEdit} className="text-xs font-medium text-stone-500 hover:text-stone-900 border border-stone-200 px-4 py-1.5 rounded-full transition-colors">
                              Editar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {adminTab === 'billing' && (
        <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400">
              <CreditCard size={22} />
            </div>
            <div>
              <h3 className="text-2xl font-serif">Facturación</h3>
              <p className="text-stone-400 text-sm">Historial de pagos y reportes</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { label: 'Ingresos del mes', value: '—', sub: 'Próximamente' },
              { label: 'Citas pagadas', value: '—', sub: 'Próximamente' },
              { label: 'Pendientes de cobro', value: '—', sub: 'Próximamente' },
            ].map((s, i) => (
              <div key={i} className="p-6 rounded-3xl border border-stone-100 bg-stone-50">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">{s.label}</p>
                <p className="text-3xl font-serif text-stone-300 mb-1">{s.value}</p>
                <p className="text-xs text-stone-300">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-stone-200 rounded-3xl">
            <CreditCard size={36} className="text-stone-200 mb-4" />
            <p className="font-serif text-lg text-stone-400 mb-2">Módulo en desarrollo</p>
            <p className="text-sm text-stone-300 max-w-xs">La integración de pagos y reportes de facturación estará disponible próximamente.</p>
          </div>
        </div>
      )}

      {adminTab === 'services' && (
      <>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Edit panel */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Settings size={32} className="text-stone-200 mb-4" />
              <p className="text-stone-400 font-serif text-lg">Selecciona un servicio</p>
              <p className="text-stone-300 text-sm mt-1">Haz clic en una tarjeta para editarla</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-2xl font-serif">Editar Servicio</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(selected.id)} className="p-2 text-stone-300 hover:text-red-500 transition-colors" title="Eliminar">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {editError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl mb-4">{editError}</p>}

              <div className="space-y-4">
                <input className={inputClass} placeholder="Nombre" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                <textarea className={inputClass + ' resize-none'} rows={3} placeholder="Descripción" value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-2 gap-4">
                  <input className={inputClass} placeholder="Precio" value={editForm.price} onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))} />
                  <input className={inputClass} placeholder="Duración" value={editForm.duration} onChange={e => setEditForm(p => ({ ...p, duration: e.target.value }))} />
                </div>
                <select className={inputClass} value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {/* is_active toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setEditForm(p => ({ ...p, is_active: !p.is_active }))}
                    className={cn('w-11 h-6 rounded-full transition-colors relative', editForm.is_active ? 'bg-stone-900' : 'bg-stone-200')}
                  >
                    <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform', editForm.is_active ? 'translate-x-6' : 'translate-x-1')} />
                  </div>
                  <span className="text-sm font-medium text-stone-600">{editForm.is_active ? 'Activo' : 'Inactivo'}</span>
                </label>

                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-2">Imagen</p>
                  {selected.image && !editImage && (
                    <img src={selected.image} alt="" className="w-24 h-24 rounded-xl object-cover mb-2" />
                  )}
                  <input type="file" accept="image/*" onChange={e => setEditImage(e.target.files?.[0] ?? null)} className="text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200" />
                </div>

                <button onClick={handleSave} disabled={saving} className="w-full bg-stone-900 text-white py-4 rounded-2xl font-semibold hover:bg-stone-800 transition-all flex items-center justify-center gap-2">
                  {saving ? <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" /> : <CheckCircle2 size={18} />}
                  Guardar Cambios
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Services list */}
        <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
          <h3 className="text-2xl font-serif mb-8">Servicios</h3>
          {products.length === 0 ? (
            <p className="text-stone-400 text-sm italic">No hay servicios aún.</p>
          ) : (
            <div className="space-y-3">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={cn(
                    'w-full flex items-center gap-4 p-3 rounded-2xl border transition-all text-left',
                    selected?.id === p.id ? 'border-stone-900 bg-stone-50' : 'border-stone-100 hover:border-stone-300'
                  )}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-100">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-stone-300"><ShoppingBag size={18} /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="text-xs text-stone-400">${p.price} · {p.duration}</p>
                  </div>
                  <div className={cn('w-2 h-2 rounded-full shrink-0', p.is_active ? 'bg-emerald-400' : 'bg-stone-200')} />
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowForm(true)} className="w-full mt-6 py-4 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 text-sm font-medium hover:border-stone-900 hover:text-stone-900 transition-all">
            + Añadir Servicio
          </button>
        </div>
      </div>

      {showForm && token && (
        <ServiceForm
          categories={categories}
          token={token}
          onSaved={() => { loadProducts(); onServicesChanged(); }}
          onClose={() => setShowForm(false)}
        />
      )}
      </>)}
    </div>
  );
};

const Footer = () => (
  <footer className="bg-stone-50 py-20 border-t border-stone-200">
    <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center text-white font-serif text-xl italic">MC</div>
          <span className="text-2xl font-serif tracking-tight font-semibold">MC Nails</span>
        </div>
        <p className="text-stone-500 max-w-sm mb-8">
          Elevando el estándar del cuidado de uñas con técnicas avanzadas y productos de alta gama.
        </p>
        <div className="flex gap-4">
          <button className="w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-900 hover:text-white transition-all"><Instagram size={18} /></button>
          <button className="w-10 h-10 rounded-full border border-stone-200 flex items-center justify-center hover:bg-stone-900 hover:text-white transition-all"><Facebook size={18} /></button>
        </div>
      </div>
      <div>
        <h4 className="font-bold text-sm uppercase tracking-widest mb-6">Contacto</h4>
        <ul className="space-y-4 text-stone-500 text-sm">
          <li className="flex items-center gap-2"><MapPin size={16} /> Calle 123 #45-67, Ciudad</li>
          <li className="flex items-center gap-2"><Phone size={16} /> +57 300 123 4567</li>
          <li className="flex items-center gap-2"><Clock size={16} /> Lun - Sáb: 9am - 7pm</li>
        </ul>
      </div>
      <div>
        <h4 className="font-bold text-sm uppercase tracking-widest mb-6">Legal</h4>
        <ul className="space-y-4 text-stone-500 text-sm">
          <li><button className="hover:text-stone-900">Términos de Servicio</button></li>
          <li><button className="hover:text-stone-900">Política de Privacidad</button></li>
          <li><button className="hover:text-stone-900">Política de Cancelación</button></li>
        </ul>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 pt-20 text-center text-xs text-stone-400">
      © 2026 MC Nails. Todos los derechos reservados. Diseñado con elegancia.
    </div>
  </footer>
);

const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated || !user?.is_staff) {
    return (
      <div className="pt-40 pb-20 text-center">
        <p className="text-stone-400 text-lg font-serif mb-4">Acceso restringido</p>
        <p className="text-stone-500 text-sm">Necesitas iniciar sesión como administrador.</p>
      </div>
    );
  }
  return <>{children}</>;
};

function AppContent() {
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const openAuth = (mode: 'login' | 'register') => { setAuthMode(mode); setShowAuth(true); };

  const loadServices = () => {
    fetchProducts()
      .then((products) => {
        console.log('[MCnails] products fetched:', products);
        setServices(products.map(mapProductToService));
      })
      .catch((err) => {
        console.error('[MCnails] fetchProducts failed:', err);
      });
  };

  useEffect(() => { loadServices(); }, []);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setActiveSection('booking');
  };

  return (
    <div className="min-h-screen">
      <Navbar activeSection={activeSection} setActiveSection={setActiveSection} onOpenAuth={openAuth} />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} initialMode={authMode} />

      <main>
        {activeSection === 'home' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Hero onBooking={() => setActiveSection('booking')} />
            <ServicesSection services={services} onSelect={handleServiceSelect} />
            <GallerySection />
            <ReviewsSection />
          </motion.div>
        )}

        {activeSection === 'services' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ServicesSection services={services} onSelect={handleServiceSelect} />
          </motion.div>
        )}

        {activeSection === 'gallery' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <GallerySection />
          </motion.div>
        )}

        {activeSection === 'reviews' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ReviewsSection />
          </motion.div>
        )}

        {activeSection === 'booking' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <BookingFlow
              selectedService={selectedService}
              onBack={() => { setActiveSection('home'); setSelectedService(null); }}
            />
          </motion.div>
        )}

        {activeSection === 'admin' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <AdminGuard>
              <AdminDashboard onServicesChanged={loadServices} />
            </AdminGuard>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
