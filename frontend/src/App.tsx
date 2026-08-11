import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ShoppingBag,
  Image as ImageIcon,
  Star,
  User,
  Users,
  ChevronRight,
  ChevronDown,
  Instagram,
  Facebook,
  Clock,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  CreditCard,
  Menu,
  X,
  Settings,
  Plus,
  LogOut,
  KeyRound,
  Loader,
  AlertCircle,
  Send,
  CheckSquare,
  Trash2,
  Filter,
  FileText,
  Upload,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { fetchProducts, fetchAdminProducts, fetchAdminCategories, createProduct, updateProduct, deleteProduct, createCategory, fetchOrders, updateOrderStatus, type Product, type Category, type Order } from './api/store';
import { fetchUsers, adminCreateUser, adminUpdateUser, fetchOrderCustomers, type ClientUser, type Customer } from './api/auth';
import { fetchAvailability, createAppointment, createAppointmentAdmin, fetchAppointments, fetchAppointmentsBilling, updateAppointment, deleteAppointment, fetchWeeklySchedule, saveWeeklyScheduleDay, fetchTimeBlocks, createTimeBlock, deleteTimeBlock, type AppointmentPayload, type TimeSlot, type CalendarEvent, type AppointmentBilling, type WeeklySchedule, type TimeBlock } from './api/calendar';
import { fetchTeamMembers, fetchMyTeamMember, fetchAllTeamMembers, createTeamMember, updateTeamMember, type TeamMemberPublic, type TeamMemberAdmin } from './api/business';
import { fetchBillingCounts, fetchReceipts, voidReceipt, issueReceipt } from './api/billing';
import { fetchMonthlyStats, fetchTransactions, syncToEVZ, createTransaction, fetchExpenseCategories, createExpenseCategory, updateTransactionCategory, recordOrderPayment, fetchYearlySummary, type ExpenseCategory, type Transaction, type YearlySummaryData } from './api/treasury';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BusinessProvider, useBusiness } from './context/BusinessContext';
import { AuthModal } from './components/AuthModal';

// Offset fijo del negocio (America/Caracas, UTC-4 sin DST). Se usa para
// construir timestamps con hora local del negocio sin depender de la zona
// horaria del navegador de quien administra el panel.
const BUSINESS_TZ_OFFSET = '-04:00';

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

/** Logo + nombre de la empresa, tomados del backend (BusinessProfile). */
const BusinessMark = () => {
  const { business } = useBusiness();
  const initials = (business.trade_name || 'MC')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {business.logo ? (
        <img
          src={business.logo}
          alt={business.trade_name}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center text-white font-serif text-xl italic">
          {initials}
        </div>
      )}
      <span className="text-2xl font-serif tracking-tight font-semibold">
        {business.trade_name}
      </span>
    </>
  );
};

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
            <BusinessMark />
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

const BookingFlow = ({ selectedService, allServices, onBack }: {
  selectedService: Service | null,
  allServices: Service[],
  onBack: () => void,
}) => {
  const { user: loggedInUser } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Servicios de la cita. Se puede reservar más de uno en la misma visita;
  // la duración del turno es la suma de todos.
  const [chosen, setChosen] = useState<Service[]>(selectedService ? [selectedService] : []);
  const [showPicker, setShowPicker] = useState(false);

  // Con quién reservar: por defecto "cualquiera disponible"; la clienta
  // puede en cambio elegir a alguien del equipo por nombre.
  const [teamMembers, setTeamMembers] = useState<TeamMemberPublic[]>([]);
  const [bookingMode, setBookingMode] = useState<'any' | 'choose'>('any');
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMemberPublic | null>(null);
  const [assignedTeamMemberName, setAssignedTeamMemberName] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMembers().then(setTeamMembers).catch(() => setTeamMembers([]));
  }, []);

  // Step 1 — date & slot
  const [dateStr, setDateStr] = useState(''); // YYYY-MM-DD
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [closed, setClosed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 2 — customer info
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Precarga los datos de quien está logueada — sigue siendo editable, por
  // si reserva a nombre de otra persona.
  useEffect(() => {
    if (loggedInUser && !form.name && !form.email) {
      setForm({
        name: `${loggedInUser.first_name} ${loggedInUser.last_name}`.trim(),
        email: loggedInUser.email || '',
        phone: loggedInUser.profile?.phone || '',
      });
    }
  }, [loggedInUser]);

  const todayStr = new Date().toISOString().split('T')[0];
  const chosenIds = chosen.map(s => Number(s.id));
  const totalPrice = chosen.reduce((sum, s) => sum + Number(s.price || 0), 0);

  const loadSlots = async (d: string, ids: number[], teamMemberId?: number) => {
    setSelectedSlot(null);
    setSlots([]);
    setClosed(false);
    if (!d) return;
    setLoadingSlots(true);
    try {
      const res = await fetchAvailability(d, ids.length ? ids : undefined, teamMemberId);
      setSlots(res.slots);
      setClosed(Boolean(res.closed));
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (d: string) => {
    setDateStr(d);
    loadSlots(d, chosenIds, selectedTeamMember?.id);
  };

  // Al cambiar los servicios cambia la duración, así que hay que volver a
  // pedir los turnos: los que servían para 60 min pueden no servir para 150.
  const toggleService = (service: Service) => {
    const yaEsta = chosen.some(s => s.id === service.id);
    const siguiente = yaEsta
      ? chosen.filter(s => s.id !== service.id)
      : [...chosen, service];
    setChosen(siguiente);
    if (dateStr) loadSlots(dateStr, siguiente.map(s => Number(s.id)), selectedTeamMember?.id);
  };

  const handleBookingModeChange = (mode: 'any' | 'choose') => {
    setBookingMode(mode);
    if (mode === 'any') {
      setSelectedTeamMember(null);
      if (dateStr) loadSlots(dateStr, chosenIds, undefined);
    }
  };

  const handleSelectTeamMember = (tm: TeamMemberPublic) => {
    setSelectedTeamMember(tm);
    if (dateStr) loadSlots(dateStr, chosenIds, tm.id);
  };

  const handleConfirm = async () => {
    if (!selectedSlot || !form.name || !form.email) return;
    setSubmitting(true);
    setError(null);
    try {
      // El backend crea la Order asociada automáticamente cuando la cita
      // trae servicios, así queda disponible para cobro y facturación.
      const appt = await createAppointment({
        products: chosenIds,
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        ...(selectedTeamMember ? { team_member: selectedTeamMember.id } : {}),
      });

      // En modo "cualquiera disponible" recién se sabe quién quedó asignada
      // al confirmar — se muestra en la pantalla de éxito, no antes.
      const asignada = teamMembers.find(tm => tm.id === appt.team_member);
      setAssignedTeamMemberName(asignada?.display_name ?? selectedTeamMember?.display_name ?? null);

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
            {chosen.length > 0 ? (
              <div className="space-y-4">
                <div className="aspect-video rounded-2xl overflow-hidden">
                  <img src={chosen[0].image} alt={chosen[0].name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-2">
                    {chosen.length > 1 ? `Servicios (${chosen.length})` : 'Servicio'}
                  </p>
                  <ul className="space-y-2">
                    {chosen.map(s => (
                      <li key={s.id} className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-serif text-base leading-tight truncate">{s.name}</p>
                          <p className="text-xs text-stone-400">{s.duration}</p>
                        </div>
                        <span className="text-sm whitespace-nowrap">${s.price}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {chosen.length > 1 && (
                  <div className="flex justify-between pt-3 border-t border-stone-200 font-bold">
                    <span className="text-sm">Total</span>
                    <span className="text-sm">${totalPrice}</span>
                  </div>
                )}
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
                <h4 className="text-3xl font-serif mb-6">Elige una fecha</h4>

                {/* Servicios: se puede sumar más de uno a la misma visita */}
                <div className="mb-8">
                  <button
                    type="button"
                    onClick={() => setShowPicker(v => !v)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-stone-200 hover:border-stone-900 transition-colors text-left"
                  >
                    <span className="text-sm">
                      {chosen.length === 0
                        ? 'Elegir servicios'
                        : chosen.map(s => s.name).join(' + ')}
                    </span>
                    <ChevronDown
                      size={18}
                      className={cn('transition-transform text-stone-400', showPicker && 'rotate-180')}
                    />
                  </button>

                  {showPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 border border-stone-200 rounded-2xl divide-y divide-stone-100 overflow-hidden"
                    >
                      {allServices.map(s => {
                        const activo = chosen.some(c => c.id === s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleService(s)}
                            className={cn(
                              'w-full flex items-center justify-between gap-3 p-4 text-left transition-colors',
                              activo ? 'bg-stone-900 text-white' : 'hover:bg-stone-50'
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm truncate">{s.name}</span>
                              <span className={cn('block text-xs', activo ? 'text-stone-300' : 'text-stone-400')}>
                                {s.duration}
                              </span>
                            </span>
                            <span className="text-sm whitespace-nowrap flex items-center gap-2">
                              ${s.price}
                              {activo && <CheckCircle2 size={16} />}
                            </span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}

                  {chosen.length > 1 && (
                    <p className="text-xs text-stone-400 mt-2">
                      Se reservará un turno continuo para los {chosen.length} servicios.
                    </p>
                  )}
                </div>

                {/* Con quién reservar — solo tiene sentido elegir si hay más
                    de una persona en el equipo. */}
                {teamMembers.length > 1 && (
                  <div className="mb-8">
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-3">
                      ¿Cómo prefieres reservar?
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => handleBookingModeChange('any')}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-colors',
                          bookingMode === 'any' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:border-stone-900'
                        )}
                      >
                        <span className="block text-sm font-medium">Cualquiera disponible</span>
                        <span className={cn('block text-xs mt-0.5', bookingMode === 'any' ? 'text-stone-300' : 'text-stone-400')}>
                          Te asignamos a quien tenga cupo
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBookingModeChange('choose')}
                        className={cn(
                          'p-4 rounded-2xl border text-left transition-colors',
                          bookingMode === 'choose' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 hover:border-stone-900'
                        )}
                      >
                        <span className="block text-sm font-medium">Elegir por nombre</span>
                        <span className={cn('block text-xs mt-0.5', bookingMode === 'choose' ? 'text-stone-300' : 'text-stone-400')}>
                          Reserva con alguien específico
                        </span>
                      </button>
                    </div>

                    {bookingMode === 'choose' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {teamMembers.map(tm => (
                          <button
                            key={tm.id}
                            type="button"
                            onClick={() => handleSelectTeamMember(tm)}
                            className={cn(
                              'p-3 rounded-2xl border text-center transition-colors',
                              selectedTeamMember?.id === tm.id ? 'border-stone-900 bg-stone-50' : 'border-stone-200 hover:border-stone-900'
                            )}
                          >
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-stone-100 mx-auto mb-2">
                              {tm.photo && (
                                <img src={tm.photo} alt={tm.display_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              )}
                            </div>
                            <span className="block text-xs font-medium truncate">{tm.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                  <p className="text-stone-400 italic text-sm mb-6">
                    {closed
                      ? 'Ese día no atendemos. Elige otra fecha.'
                      : chosen.length > 1
                        ? 'No hay un bloque libre suficientemente largo para esos servicios. Prueba otra fecha o reserva por separado.'
                        : 'No hay horarios disponibles para esta fecha.'}
                  </p>
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
                  disabled={!selectedSlot || (bookingMode === 'choose' && !selectedTeamMember)}
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
                  {chosen.map(s => (
                    <div key={s.id} className="flex justify-between mb-2 text-sm">
                      <span className="text-stone-500">{s.name}</span>
                      <span>${s.price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="text-stone-500">Fecha</span>
                    <span>{dateStr} {selectedSlot?.label}</span>
                  </div>
                  {selectedTeamMember && (
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-stone-500">Con</span>
                      <span>{selectedTeamMember.display_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg mt-4">
                    <span>Total</span>
                    <span>${totalPrice}</span>
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
                {assignedTeamMemberName && (
                  <p className="text-stone-500 mb-2">Te atenderá <span className="font-medium">{assignedTeamMemberName}</span></p>
                )}
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

const AppointmentsCalendar = ({ products, customers, onCustomerSaved, onAppointmentsChanged }: { products: Product[]; customers: Customer[]; onCustomerSaved?: () => void; onAppointmentsChanged?: () => void }) => {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<'detail' | 'new'>('detail');

  // Con quién: la dueña (superuser) ve/filtra el equipo completo; cada
  // team_member ve automáticamente solo lo suyo (el backend ya la aísla) y
  // no necesita elegir nada.
  const [myTeamMember, setMyTeamMember] = useState<TeamMemberAdmin | null>(null);
  const [teamRoster, setTeamRoster] = useState<TeamMemberAdmin[]>([]);
  const [viewTeamMemberId, setViewTeamMemberId] = useState<number | undefined>(undefined);

  // New appointment form state
  const emptyForm = { customer_name: '', customer_email: '', customer_phone: '', product: '', date: '', start_time: '', end_time: '', notes: '', status: 'confirmed', team_member: '' };
  const [newForm, setNewForm] = useState(emptyForm);
  const [newError, setNewError] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const customerSuggestions = newForm.customer_name.trim().length > 0
    ? customers.filter(c => c.name.toLowerCase().includes(newForm.customer_name.trim().toLowerCase())).slice(0, 6)
    : [];

  const selectCustomer = (c: Customer) => {
    setNewForm(prev => ({
      ...prev,
      customer_name: c.name,
      customer_email: c.email || prev.customer_email,
      customer_phone: c.phone || prev.customer_phone,
    }));
    setShowCustomerSuggestions(false);
  };

  const reload = () => {
    if (!token) return;
    fetchAppointments(token, viewTeamMemberId).then(setEvents).catch(console.error);
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchAppointments(token, viewTeamMemberId)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, viewTeamMemberId]);

  useEffect(() => {
    if (!token) return;
    fetchMyTeamMember(token).then(setMyTeamMember).catch(() => setMyTeamMember(null));
    if (user?.is_superuser) {
      fetchAllTeamMembers(token).then(setTeamRoster).catch(() => setTeamRoster([]));
    }
  }, [token, user?.is_superuser]);

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEvent || !token) return;
    try {
      await updateAppointment(token, selectedEvent.id, { status: newStatus });
      const updated = await fetchAppointments(token, viewTeamMemberId);
      setEvents(updated);
      setSelectedEvent(prev => prev ? { ...prev, extendedProps: { ...prev.extendedProps, status: newStatus } } : null);
      onAppointmentsChanged?.();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!selectedEvent || !token || !confirm('¿Eliminar esta cita?')) return;
    try {
      await deleteAppointment(token, selectedEvent.id);
      setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      onAppointmentsChanged?.();
    } catch (err) { console.error(err); }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setNewError(null);
    setSavingNew(true);
    try {
      // El horario de atención se valida en hora del negocio (America/Caracas,
      // UTC-4 fijo, sin DST). Si se interpreta con new Date() se usa la zona
      // horaria del navegador, que puede diferir y desplazar la hora fuera
      // del rango de atención al convertir a UTC.
      const startISO = `${newForm.date}T${newForm.start_time}:00${BUSINESS_TZ_OFFSET}`;
      const endISO = `${newForm.date}T${newForm.end_time}:00${BUSINESS_TZ_OFFSET}`;
      // Una team_member (no superuser) siempre agenda para sí misma, aunque
      // no haya picker en pantalla; la dueña elige o deja "cualquiera".
      const teamMemberId = !user?.is_superuser
        ? myTeamMember?.id
        : (newForm.team_member ? Number(newForm.team_member) : undefined);

      const payload: AppointmentPayload = {
        customer_name: newForm.customer_name,
        customer_email: newForm.customer_email,
        customer_phone: newForm.customer_phone,
        start_time: startISO,
        end_time: endISO,
        notes: newForm.notes,
        ...(newForm.product ? { product: Number(newForm.product) } : {}),
        ...(teamMemberId ? { team_member: teamMemberId } : {}),
      };
      await createAppointmentAdmin(token, payload);
      // also set status if not pending
      reload();
      onCustomerSaved?.();
      onAppointmentsChanged?.();
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
      <style>{`
        .fc .fc-daygrid-day:hover,
        .fc .fc-timegrid-slot:hover,
        .fc .fc-col-time-frame:hover {
          background-color: rgba(16, 185, 129, 0.05) !important;
          cursor: pointer !important;
        }
        .fc .fc-timegrid-slot {
          cursor: pointer;
        }
        .fc .fc-daygrid-day {
          cursor: pointer;
        }
      `}</style>

      {/* Calendar */}
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-6">
        {user?.is_superuser && teamRoster.length > 1 && (
          <div className="flex items-center gap-2 mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Ver agenda de</p>
            <select
              value={viewTeamMemberId ?? ''}
              onChange={e => setViewTeamMemberId(e.target.value ? Number(e.target.value) : undefined)}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
            >
              <option value="">Todas</option>
              {teamRoster.map(tm => (
                <option key={tm.id} value={tm.id}>{tm.display_name}</option>
              ))}
            </select>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-stone-400">Cargando citas…</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, momentTimezonePlugin]}
            timeZone="America/Caracas"
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
            dateClick={info => {
              // info.dateStr ya viene formateado en la zona del calendario
              // (America/Caracas vía el prop timeZone), no en la del
              // navegador — por eso se parsea el string, nunca info.date
              // con getHours()/getMinutes(), que reflejarían la hora local
              // de quien esté administrando el panel.
              const date = info.dateStr.slice(0, 10);
              const hasTime = info.dateStr.length > 10;
              const startTime = hasTime ? info.dateStr.slice(11, 16) : '10:00';
              const endTime = hasTime
                ? `${String(Number(info.dateStr.slice(11, 13)) + 1).padStart(2, '0')}:${info.dateStr.slice(14, 16)}`
                : '11:00';
              setNewForm(prev => ({ ...prev, date, start_time: startTime, end_time: endTime }));
              setPanel('new');
            }}
            select={info => {
              // Igual que dateClick: usar startStr/endStr (ya en hora de
              // Caracas) en vez de info.start/info.end, que son Date en
              // hora local del navegador.
              const date = info.startStr.slice(0, 10);
              const startTime = info.startStr.slice(11, 16);
              const endTime = info.endStr.slice(11, 16);
              setNewForm(prev => ({ ...prev, date, start_time: startTime, end_time: endTime }));
              setPanel('new');
            }}
            selectable={true}
            selectMinDistance={0}
            slotLabelInterval="00:30:00"
            slotLabelFormat={{ meridiem: 'short', hour: '2-digit', minute: '2-digit' }}
            slotMinTime="07:00:00"
            slotMaxTime="23:00:00"
            scrollTime="07:00:00"
            height="60vh"
            stickyHeaderDates
            editable={false}
            validRange={{
              start: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1),
              end: new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1),
            }}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-serif">Nueva Cita</h3>
              {newForm.date && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                  {new Date(newForm.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })} {newForm.start_time}
                </span>
              )}
            </div>
            {newError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{newError}</p>}

            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Nombre cliente *</p>
              <input
                required
                className={iClass}
                placeholder="Nombre completo"
                value={newForm.customer_name}
                onChange={e => { setF('customer_name')(e); setShowCustomerSuggestions(true); }}
                onFocus={() => setShowCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 150)}
                autoComplete="off"
              />
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {customerSuggestions.map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors flex flex-col gap-0.5 border-b border-stone-50 last:border-0"
                    >
                      <span className="text-sm font-medium text-stone-900">{c.name}</span>
                      {(c.email || c.phone) && (
                        <span className="text-xs text-stone-400">{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {newForm.customer_name.trim().length > 0 && customerSuggestions.length === 0 && showCustomerSuggestions && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg px-3 py-2">
                  <span className="text-xs text-stone-400">Cliente nuevo — se creará al guardar</span>
                </div>
              )}
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
            {user?.is_superuser && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Con</p>
                <select className={iClass} value={newForm.team_member} onChange={setF('team_member')}>
                  <option value="">Cualquiera disponible</option>
                  {teamRoster.filter(tm => tm.is_active).map(tm => (
                    <option key={tm.id} value={tm.id}>{tm.display_name}</option>
                  ))}
                </select>
              </div>
            )}
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
              {selectedEvent.extendedProps.team_member_name && (
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Atiende</p>
                  <p>{selectedEvent.extendedProps.team_member_name}</p>
                </div>
              )}
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
                <p>{new Date(selectedEvent.start).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' })}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mb-0.5">Fin</p>
                <p>{new Date(selectedEvent.end).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Caracas' })}</p>
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

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const DayScheduleRow = ({ label, day, saving, onSave }: {
  label: string;
  day?: WeeklySchedule;
  saving: boolean;
  onSave: (data: { is_open: boolean; opens_at: string; closes_at: string }) => void;
}) => {
  const [isOpen, setIsOpen] = useState(day?.is_open ?? true);
  const [opensAt, setOpensAt] = useState(day?.opens_at?.slice(0, 5) ?? '09:00');
  const [closesAt, setClosesAt] = useState(day?.closes_at?.slice(0, 5) ?? '19:00');

  useEffect(() => {
    setIsOpen(day?.is_open ?? true);
    setOpensAt(day?.opens_at?.slice(0, 5) ?? '09:00');
    setClosesAt(day?.closes_at?.slice(0, 5) ?? '19:00');
  }, [day?.id]);

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-stone-100">
      <span className="w-24 text-sm font-medium shrink-0">{label}</span>
      <label className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
        <input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} className="rounded" />
        Abierto
      </label>
      <input type="time" disabled={!isOpen} value={opensAt} onChange={e => setOpensAt(e.target.value)} className="px-2 py-1 rounded-lg border border-stone-200 text-sm disabled:opacity-40" />
      <span className="text-stone-300">—</span>
      <input type="time" disabled={!isOpen} value={closesAt} onChange={e => setClosesAt(e.target.value)} className="px-2 py-1 rounded-lg border border-stone-200 text-sm disabled:opacity-40" />
      <button
        disabled={saving}
        onClick={() => onSave({ is_open: isOpen, opens_at: opensAt, closes_at: closesAt })}
        className="ml-auto text-xs bg-stone-900 text-white px-3 py-1.5 rounded-lg hover:bg-stone-800 disabled:opacity-50"
      >
        {saving ? '…' : 'Guardar'}
      </button>
    </div>
  );
};

const TeamManagement = ({ teamRoster, onRosterChanged }: { teamRoster: TeamMemberAdmin[]; onRosterChanged: () => void }) => {
  const { token } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ email: '', password: '', display_name: '', bio: '' });
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = teamRoster.find(t => t.id === selectedId) || null;

  const [schedule, setSchedule] = useState<WeeklySchedule[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);

  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({ start: '', end: '', reason: 'vacation', note: '' });
  const [savingBlock, setSavingBlock] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const loadScheduleAndBlocks = (id: number) => {
    if (!token) return;
    setScheduleLoading(true);
    Promise.all([fetchWeeklySchedule(token, id), fetchTimeBlocks(token, id)])
      .then(([s, b]) => { setSchedule(s); setBlocks(b); })
      .catch(console.error)
      .finally(() => setScheduleLoading(false));
  };

  const handleSelect = (id: number) => {
    setSelectedId(id);
    loadScheduleAndBlocks(id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingNew(true);
    setNewError(null);
    try {
      await createTeamMember(token, { ...newForm, photo: newPhoto ?? undefined });
      setNewForm({ email: '', password: '', display_name: '', bio: '' });
      setNewPhoto(null);
      setShowNew(false);
      onRosterChanged();
    } catch (err: any) {
      setNewError(err.message);
    } finally {
      setSavingNew(false);
    }
  };

  const handleToggleActive = async (tm: TeamMemberAdmin) => {
    if (!token) return;
    await updateTeamMember(token, tm.id, { is_active: !tm.is_active });
    onRosterChanged();
  };

  const daySchedule = (weekday: number) => schedule.find(s => s.weekday === weekday);

  const handleSaveDay = async (weekday: number, data: { is_open: boolean; opens_at: string; closes_at: string }) => {
    if (!token || !selectedId) return;
    setSavingDay(weekday);
    try {
      const saved = await saveWeeklyScheduleDay(token, selectedId, daySchedule(weekday), { weekday, ...data });
      setSchedule(prev => [...prev.filter(s => s.weekday !== weekday), saved]);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDay(null);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId) return;
    setSavingBlock(true);
    setBlockError(null);
    try {
      const created = await createTimeBlock(token, { team_member: selectedId, ...newBlock });
      setBlocks(prev => [created, ...prev]);
      setNewBlock({ start: '', end: '', reason: 'vacation', note: '' });
      setShowNewBlock(false);
    } catch (err: any) {
      setBlockError(err.message);
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async (id: number) => {
    if (!token || !confirm('¿Eliminar este bloqueo?')) return;
    await deleteTimeBlock(token, id);
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Roster */}
      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif">Equipo</h3>
            <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{teamRoster.length} miembros</span>
          </div>
          <button
            onClick={() => setShowNew(v => !v)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all', showNew ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-900')}
          >
            <Plus size={15} /> Nuevo miembro
          </button>
        </div>

        {showNew && (
          <form onSubmit={handleCreate} className="px-8 py-6 border-b border-stone-100 bg-stone-50 space-y-3">
            {newError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{newError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Nombre *</p>
                <input required className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newForm.display_name} onChange={e => setNewForm(p => ({ ...p, display_name: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Email *</p>
                <input required type="email" className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Contraseña *</p>
                <input required type="password" minLength={8} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newForm.password} onChange={e => setNewForm(p => ({ ...p, password: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Foto</p>
                <input type="file" accept="image/*" onChange={e => setNewPhoto(e.target.files?.[0] ?? null)} className="text-sm text-stone-500 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-stone-100 file:text-stone-700" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Bio</p>
              <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white resize-none" value={newForm.bio} onChange={e => setNewForm(p => ({ ...p, bio: e.target.value }))} />
            </div>
            <button disabled={savingNew} className="bg-stone-900 text-white text-sm px-5 py-2 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50">
              {savingNew ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <div className="divide-y divide-stone-50">
          {teamRoster.map(tm => (
            <div key={tm.id} className={cn('p-6 flex items-center gap-4 cursor-pointer transition-colors', selectedId === tm.id ? 'bg-stone-50' : 'hover:bg-stone-50')} onClick={() => handleSelect(tm.id)}>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-100 shrink-0">
                {tm.photo && <img src={tm.photo} alt={tm.display_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900">{tm.display_name}</p>
                <p className="text-sm text-stone-400 truncate">{tm.email}</p>
              </div>
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', tm.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500')}>
                {tm.is_active ? 'Activa' : 'Inactiva'}
              </span>
              <button
                onClick={e => { e.stopPropagation(); handleToggleActive(tm); }}
                className="text-xs text-stone-500 hover:text-stone-900 px-3 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 transition-colors"
              >
                {tm.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Horario y bloqueos de la seleccionada */}
      {selected && (
        <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
          <h4 className="text-lg font-serif text-stone-900 mb-6">Horario de {selected.display_name}</h4>
          {scheduleLoading ? (
            <div className="flex justify-center py-8"><Loader size={20} className="text-stone-300 animate-spin" /></div>
          ) : (
            <div className="space-y-2 mb-8">
              {WEEKDAYS.map((label, weekday) => (
                <DayScheduleRow
                  key={weekday}
                  label={label}
                  day={daySchedule(weekday)}
                  saving={savingDay === weekday}
                  onSave={data => handleSaveDay(weekday, data)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-serif text-stone-900">Bloqueos</h4>
            <button
              onClick={() => setShowNewBlock(v => !v)}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all', showNewBlock ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-900')}
            >
              <Plus size={15} /> Nuevo bloqueo
            </button>
          </div>

          {showNewBlock && (
            <form onSubmit={handleCreateBlock} className="p-5 rounded-2xl border border-stone-100 bg-stone-50 mb-4 space-y-3">
              {blockError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{blockError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Desde</p>
                  <input required type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newBlock.start} onChange={e => setNewBlock(p => ({ ...p, start: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Hasta</p>
                  <input required type="datetime-local" className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newBlock.end} onChange={e => setNewBlock(p => ({ ...p, end: e.target.value }))} />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Motivo</p>
                <select className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newBlock.reason} onChange={e => setNewBlock(p => ({ ...p, reason: e.target.value }))}>
                  <option value="vacation">Vacaciones</option>
                  <option value="holiday">Feriado</option>
                  <option value="personal">Asunto personal</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Nota</p>
                <input className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white" value={newBlock.note} onChange={e => setNewBlock(p => ({ ...p, note: e.target.value }))} />
              </div>
              <button disabled={savingBlock} className="bg-stone-900 text-white text-sm px-5 py-2 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50">
                {savingBlock ? 'Guardando…' : 'Crear bloqueo'}
              </button>
            </form>
          )}

          {blocks.length === 0 ? (
            <p className="text-sm text-stone-400 italic">Sin bloqueos</p>
          ) : (
            <div className="space-y-2">
              {blocks.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-xl border border-stone-100">
                  <div>
                    <p className="text-sm font-medium">{b.reason_label}{b.note ? ` — ${b.note}` : ''}</p>
                    <p className="text-xs text-stone-400">{new Date(b.start).toLocaleString('es-ES')} → {new Date(b.end).toLocaleString('es-ES')}</p>
                  </div>
                  <button onClick={() => handleDeleteBlock(b.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ onServicesChanged }: { onServicesChanged: () => void }) => {
  const { token, user } = useAuth();
  const [adminTab, setAdminTab] = useState<'services' | 'calendar' | 'users' | 'billing' | 'team'>('services');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [teamRoster, setTeamRoster] = useState<TeamMemberAdmin[]>([]);
  const [appointments, setAppointments] = useState<CalendarEvent[]>([]);
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

  // Billing data
  const [billingData, setBillingData] = useState<{ quotations: number; receipts: number; pending_quotations: number } | null>(null);
  const [treasuryData, setTreasuryData] = useState<{ total_income: string; total_expenses: string; net_income: string } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Toggle Mes/Año del tab Resumen
  const [summaryView, setSummaryView] = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [yearlyData, setYearlyData] = useState<YearlySummaryData | null>(null);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyError, setYearlyError] = useState<string | null>(null);

  const loadYearlyData = async (year?: number) => {
    if (!token) return;
    setYearlyLoading(true);
    setYearlyError(null);
    try {
      const data = await fetchYearlySummary(token, year ?? selectedYear);
      setYearlyData(data);
    } catch (err: any) {
      setYearlyError(err.message);
    } finally {
      setYearlyLoading(false);
    }
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Desglose de citas del mes, desplegado desde la card "Ingresos"
  const [showIncomeDetail, setShowIncomeDetail] = useState(false);
  const [incomeAppointments, setIncomeAppointments] = useState<AppointmentBilling[]>([]);
  const [incomeDetailLoading, setIncomeDetailLoading] = useState(false);
  const [incomeDetailError, setIncomeDetailError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [issuingReceiptId, setIssuingReceiptId] = useState<number | null>(null);
  const [incomeActionError, setIncomeActionError] = useState<string | null>(null);

  const getMonthRange = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const firstDay = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    };
  };

  const getYearRange = (year: number) => ({
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  });

  // Rango del período activo en Resumen (Mes o Año) — Movimientos lo comparte
  // para que todo Facturación muestre el mismo recorte de tiempo.
  const activePeriodRange = () =>
    summaryView === 'year' ? getYearRange(selectedYear) : getMonthRange(selectedMonth);

  const loadIncomeDetail = async (month?: string) => {
    if (!token) return;
    setIncomeDetailLoading(true);
    setIncomeDetailError(null);
    try {
      const { start, end } = getMonthRange(month || selectedMonth);
      const data = await fetchAppointmentsBilling(token, start, end);
      setIncomeAppointments(data);
    } catch (err: any) {
      setIncomeDetailError(err.message);
    } finally {
      setIncomeDetailLoading(false);
    }
  };

  useEffect(() => {
    if (showIncomeDetail) loadIncomeDetail();
  }, [showIncomeDetail, selectedMonth, token]);

  const handleAppointmentStatusChange = async (apptId: number, newStatus: string) => {
    if (!token) return;
    setIncomeActionError(null);
    try {
      await updateAppointment(token, apptId, { status: newStatus });
      setIncomeAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status: newStatus } : a));
      refreshAppointments();
    } catch (err: any) {
      setIncomeActionError(err.message);
    }
  };

  const handleRegisterPayment = async (appt: AppointmentBilling) => {
    if (!token || !appt.order) return;
    setSavingPayment(true);
    setIncomeActionError(null);
    try {
      await recordOrderPayment(token, appt.order.id, paymentAmount || undefined);
      setPayingId(null);
      setPaymentAmount('');
      await Promise.all([loadIncomeDetail(), loadBillingData()]);
    } catch (err: any) {
      setIncomeActionError(err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleIssueReceipt = async (appt: AppointmentBilling) => {
    if (!token || !appt.order) return;
    setIssuingReceiptId(appt.id);
    setIncomeActionError(null);
    try {
      await issueReceipt(token, appt.order.id);
      await loadIncomeDetail();
    } catch (err: any) {
      setIncomeActionError(err.message);
    } finally {
      setIssuingReceiptId(null);
    }
  };

  // Desglose de gastos del mes, desplegado desde la card "Gastos"
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [expenseTransactions, setExpenseTransactions] = useState<Transaction[]>([]);
  const [expenseDetailLoading, setExpenseDetailLoading] = useState(false);
  const [expenseDetailError, setExpenseDetailError] = useState<string | null>(null);
  const [expenseActionError, setExpenseActionError] = useState<string | null>(null);
  const [addingCategoryForId, setAddingCategoryForId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIsDirect, setNewCategoryIsDirect] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  const emptyNewExpense = { amount: '', date: new Date().toISOString().split('T')[0], description: '', method: 'cash', category: '' };
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState(emptyNewExpense);
  const [savingNewExpense, setSavingNewExpense] = useState(false);
  const [newExpenseError, setNewExpenseError] = useState<string | null>(null);

  const loadExpenseDetail = async (month?: string) => {
    if (!token) return;
    setExpenseDetailLoading(true);
    setExpenseDetailError(null);
    try {
      const { start, end } = getMonthRange(month || selectedMonth);
      const data = await fetchTransactions(token, { direction: 'OUT', start, end });
      setExpenseTransactions(data);
    } catch (err: any) {
      setExpenseDetailError(err.message);
    } finally {
      setExpenseDetailLoading(false);
    }
  };

  useEffect(() => {
    if (showExpenseDetail) loadExpenseDetail();
  }, [showExpenseDetail, selectedMonth, token]);

  const handleExpenseCategoryChange = async (transactionId: number, categoryId: number) => {
    if (!token) return;
    setExpenseActionError(null);
    try {
      await updateTransactionCategory(token, transactionId, categoryId);
      setExpenseTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, category: categoryId } : t));
    } catch (err: any) {
      setExpenseActionError(err.message);
    }
  };

  const handleCreateCategoryAndAssign = async (transactionId: number) => {
    if (!token || !newCategoryName.trim()) return;
    setSavingCategory(true);
    setExpenseActionError(null);
    try {
      const category = await createExpenseCategory(token, newCategoryName.trim(), newCategoryIsDirect);
      setExpenseCategories(prev => [...prev, category]);
      await updateTransactionCategory(token, transactionId, category.id);
      setExpenseTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, category: category.id } : t));
      setAddingCategoryForId(null);
      setNewCategoryName('');
      setNewCategoryIsDirect(true);
    } catch (err: any) {
      setExpenseActionError(err.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newExpenseForm.amount) return;
    setSavingNewExpense(true);
    setNewExpenseError(null);
    try {
      await createTransaction(token, {
        direction: 'OUT',
        amount: newExpenseForm.amount,
        date: newExpenseForm.date,
        description: newExpenseForm.description,
        method: newExpenseForm.method,
        ...(newExpenseForm.category ? { category: Number(newExpenseForm.category) } : {}),
      });
      setNewExpenseForm(emptyNewExpense);
      setShowAddExpense(false);
      await Promise.all([loadExpenseDetail(), loadBillingData()]);
    } catch (err: any) {
      setNewExpenseError(err.message);
    } finally {
      setSavingNewExpense(false);
    }
  };

  // Phase 2: Detailed lists
  const [billingTab, setBillingTab] = useState<'overview' | 'transactions' | 'documents' | 'reports'>('overview');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [payingOrderId, setPayingOrderId] = useState<number | null>(null);
  const [orderPaymentAmount, setOrderPaymentAmount] = useState('');
  const [savingOrderPayment, setSavingOrderPayment] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Phase 3: EVZ Sync
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Create transaction form
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionForm, setTransactionForm] = useState({ direction: 'OUT', amount: '', date: new Date().toISOString().split('T')[0], description: '', method: 'cash', category: '' });
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);

  const loadBillingData = async (month?: string) => {
    if (!token) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const { start: startDate, end: endDate } = getMonthRange(month || selectedMonth);

      const [billing, orders] = await Promise.all([
        fetchBillingCounts(token),
        fetchOrders(token),
      ]);
      setAllOrders(orders);

      // Fetch treasury data for selected month
      const treasurySummary = await fetch(
        `/mcnails/api/treasury/summary/?start=${startDate}&end=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(async r => {
        if (!r.ok) throw new Error(`Treasury API error: ${r.status}`);
        return r.json();
      });

      setBillingData(billing);
      setTreasuryData({
        total_income: String(treasurySummary.income || treasurySummary.total_income || '0.00'),
        total_expenses: String(treasurySummary.expenses || treasurySummary.total_expenses || '0.00'),
        net_income: String(treasurySummary.balance || treasurySummary.net_income || '0.00'),
      });
    } catch (err: any) {
      setBillingError(err.message);
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'billing' && billingTab === 'overview' && summaryView === 'year') {
      loadYearlyData();
    }
  }, [adminTab, billingTab, summaryView, selectedYear, token]);

  const handleSelectMonthFromYear = (month: number) => {
    const monthStr = `${selectedYear}-${String(month).padStart(2, '0')}`;
    setSelectedMonth(monthStr);
    setSummaryView('month');
    loadBillingData(monthStr);
  };

  const loadDetailedData = async () => {
    if (!token) return;
    setDetailedLoading(true);
    try {
      const { start, end } = activePeriodRange();
      const [orders, recps, trans, cats] = await Promise.all([
        fetchOrders(token),
        fetchReceipts(token),
        fetchTransactions(token, { start, end }),
        fetchExpenseCategories(token),
      ]);
      setAllOrders(orders);
      setReceipts(recps);
      setTransactions(trans);
      setExpenseCategories(cats);
    } catch (err) {
      console.error('Error loading detailed data:', err);
    } finally {
      setDetailedLoading(false);
    }
  };

  const handleRegisterOrderPayment = async (order: Order) => {
    if (!token) return;
    setSavingOrderPayment(true);
    try {
      await recordOrderPayment(token, order.id, orderPaymentAmount || undefined);
      setPayingOrderId(null);
      setOrderPaymentAmount('');
      await loadDetailedData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingOrderPayment(false);
    }
  };

  const [closingOrderId, setClosingOrderId] = useState<number | null>(null);
  const handleCloseOrder = async (orderId: number) => {
    if (!token) return;
    setClosingOrderId(orderId);
    try {
      await updateOrderStatus(token, orderId, 'completed');
      await loadDetailedData();
    } catch (err) {
      console.error(err);
    } finally {
      setClosingOrderId(null);
    }
  };

  const loadProducts = () => {
    if (!token) return;
    fetchAdminProducts(token).then(setProducts).catch(console.error);
  };

  const loadTeamRoster = () => {
    if (!token || !user?.is_superuser) return;
    fetchAllTeamMembers(token).then(setTeamRoster).catch(console.error);
  };

  useEffect(() => {
    if (!token) return;
    loadProducts();
    fetchAdminCategories(token).then(setCategories).catch(console.error);
    fetchUsers(token).then(setUsers).catch(console.error);
    fetchOrderCustomers(token).then(setCustomers).catch(console.error);
    fetchAppointments(token).then(setAppointments).catch(console.error);
    loadTeamRoster();
  }, [token, user?.is_superuser]);

  const refreshAppointments = () => {
    if (!token) return;
    fetchAppointments(token).then(setAppointments).catch(console.error);
  };

  const upcomingAppointments = appointments
    .filter(e => e.extendedProps.status !== 'cancelled' && new Date(e.end) > new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Documentos: Órdenes sin pagar (no completadas) y Recibos (órdenes
  // cerradas), ambas acotadas al período activo de Facturación.
  const orderDateForFilter = (o: Order) => o.booking_date || o.created_at.slice(0, 10);
  const ordersInPeriod = (() => {
    const { start, end } = activePeriodRange();
    return allOrders.filter(o => {
      const d = orderDateForFilter(o);
      return d >= start && d <= end;
    });
  })();
  const unpaidOrders = ordersInPeriod.filter(o => o.status !== 'completed');
  const closedOrders = ordersInPeriod.filter(o => o.status === 'completed');
  const ordersNotFullyPaid = ordersInPeriod.filter(o => !o.is_fully_paid);

  useEffect(() => {
    if (adminTab === 'billing') {
      loadBillingData();
      if (token) fetchExpenseCategories(token).then(setExpenseCategories).catch(console.error);
    }
  }, [adminTab, token]);

  useEffect(() => {
    if (adminTab === 'billing' && (billingTab === 'transactions' || billingTab === 'documents' || billingTab === 'reports')) {
      loadDetailedData();
    }
  }, [billingTab, adminTab, token, summaryView, selectedMonth, selectedYear]);

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

  const cards: { id: 'services' | 'calendar' | 'users' | 'billing' | 'team'; label: string; icon: React.ReactNode; value: string | number; sub: string }[] = [
    { id: 'services', label: 'Servicios', icon: <ShoppingBag size={20} />, value: products.length,                          sub: `${products.filter(p => p.is_active).length} activos` },
    {
      id: 'calendar', label: 'Agenda', icon: <CalendarIcon size={20} />,
      value: upcomingAppointments.length,
      sub: upcomingAppointments[0]
        ? `Próxima: ${upcomingAppointments[0].title.split(' — ')[0]} · ${new Date(upcomingAppointments[0].start).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}`
        : 'Sin citas próximas',
    },
    { id: 'users',    label: 'Clientes',  icon: <User size={20} />,         value: customers.length,                            sub: customers.length > 0 ? `$${(customers.reduce((sum, c) => sum + parseFloat(c.total_spent), 0)).toLocaleString('es-ES', { maximumFractionDigits: 0 })} gastado` : 'Sin compras' },
    { id: 'billing',  label: 'Facturación', icon: <CreditCard size={20} />, value: treasuryData ? `$${(treasuryData.total_income ? parseFloat(treasuryData.total_income) : 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : '—', sub: treasuryData ? 'Ingresos del mes' : 'Cargando...' },
    ...(user?.is_superuser ? [{
      id: 'team' as const, label: 'Equipo', icon: <Users size={20} />,
      value: teamRoster.length,
      sub: `${teamRoster.filter(t => t.is_active).length} activas`,
    }] : []),
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

      {adminTab === 'calendar' && (
        <AppointmentsCalendar
          products={products}
          customers={customers}
          onCustomerSaved={() => token && fetchOrderCustomers(token).then(setCustomers).catch(console.error)}
          onAppointmentsChanged={refreshAppointments}
        />
      )}

      {adminTab === 'team' && user?.is_superuser && (
        <TeamManagement teamRoster={teamRoster} onRosterChanged={loadTeamRoster} />
      )}

      {adminTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-serif">Clientes</h3>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{customers.length} clientes únicos</span>
            </div>
            <button
              onClick={() => { setShowNewUser(v => !v); setNewUserError(null); }}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all', showNewUser ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-900')}
              style={{ display: 'none' }}
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

          {customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400">
              <User size={28} className="mb-3 text-stone-200" />
              <p className="font-serif">Sin clientes aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-3 px-4 font-medium text-stone-600">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium text-stone-600">Email</th>
                    <th className="text-center py-3 px-4 font-medium text-stone-600">Órdenes</th>
                    <th className="text-right py-3 px-4 font-medium text-stone-600">Gastado</th>
                    <th className="text-left py-3 px-4 font-medium text-stone-600">Primera orden</th>
                    <th className="text-left py-3 px-4 font-medium text-stone-600">Última orden</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, idx) => (
                    <tr key={idx} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-stone-900">{c.name}</td>
                      <td className="py-3 px-4 text-stone-600">{c.email || '—'}</td>
                      <td className="py-3 px-4 text-center text-stone-600">{c.order_count}</td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-700">${parseFloat(c.total_spent).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-stone-600 text-sm">{c.first_order_date ? new Date(c.first_order_date).toLocaleDateString('es-ES') : '—'}</td>
                      <td className="py-3 px-4 text-stone-600 text-sm">{c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('es-ES') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adminTab === 'billing' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-serif">Facturación</h3>
                  <p className="text-stone-400 text-sm">Resumen de ingresos, gastos y documentos</p>
                </div>
              </div>
              {billingTab === 'overview' && (
                <button
                  onClick={loadBillingData}
                  className="text-xs font-medium text-stone-500 hover:text-stone-900 px-3 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 transition-colors"
                >
                  Actualizar
                </button>
              )}
            </div>

            {/* Internal tabs */}
            <div className="flex gap-2 border-b border-stone-100 -mx-8 px-8 pb-0">
              {[
                { id: 'overview', label: 'Resumen' },
                { id: 'transactions', label: 'Movimientos' },
                { id: 'documents', label: 'Documentos' },
                { id: 'reports', label: 'Reportes' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setBillingTab(tab.id as any)}
                  className={cn(
                    'px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                    billingTab === tab.id
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {billingError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-900">{billingError}</p>
                <button onClick={loadBillingData} className="text-xs text-red-600 hover:text-red-700 mt-2 font-medium">
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Overview Tab */}
          {billingTab === 'overview' && (
            <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
              {billingLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader size={32} className="text-stone-300 mb-4 animate-spin" />
                  <p className="text-stone-400 font-serif text-lg">Cargando datos...</p>
                </div>
              ) : billingData && treasuryData ? (
                <div className="space-y-8">
                  {/* Toggle Mes/Año */}
                  <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                    <div>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Período</p>
                      {summaryView === 'month' ? (
                        <input
                          type="month"
                          value={selectedMonth}
                          onChange={e => {
                            setSelectedMonth(e.target.value);
                            loadBillingData(e.target.value);
                          }}
                          className="px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                        />
                      ) : (
                        <input
                          type="number"
                          value={selectedYear}
                          onChange={e => setSelectedYear(Number(e.target.value))}
                          className="w-28 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-full border border-stone-200 p-0.5">
                        <button
                          onClick={() => setSummaryView('month')}
                          className={cn('px-3 py-1 text-xs font-medium rounded-full transition-colors', summaryView === 'month' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')}
                        >
                          Mes
                        </button>
                        <button
                          onClick={() => setSummaryView('year')}
                          className={cn('px-3 py-1 text-xs font-medium rounded-full transition-colors', summaryView === 'year' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')}
                        >
                          Año
                        </button>
                      </div>
                      {summaryView === 'month' ? (
                        <button
                          onClick={() => {
                            const today = new Date();
                            const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                            setSelectedMonth(currentMonth);
                            loadBillingData(currentMonth);
                          }}
                          className="text-xs font-medium text-stone-500 hover:text-stone-900 px-3 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 transition-colors"
                        >
                          Mes actual
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedYear(new Date().getFullYear())}
                          className="text-xs font-medium text-stone-500 hover:text-stone-900 px-3 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 transition-colors"
                        >
                          Año actual
                        </button>
                      )}
                    </div>
                  </div>

                  {summaryView === 'year' ? (
                    <div className="space-y-6">
                      {yearlyLoading ? (
                        <div className="flex justify-center py-12">
                          <Loader size={24} className="text-stone-300 animate-spin" />
                        </div>
                      ) : yearlyError ? (
                        <p className="text-sm text-red-600">{yearlyError}</p>
                      ) : yearlyData && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-6 rounded-3xl border border-emerald-100 bg-emerald-50">
                              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Ingresos ({yearlyData.year})</p>
                              <p className="text-3xl font-serif text-emerald-900">${parseFloat(yearlyData.total_income).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="p-6 rounded-3xl border border-red-100 bg-red-50">
                              <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2">Gastos ({yearlyData.year})</p>
                              <p className="text-3xl font-serif text-red-900">${parseFloat(yearlyData.total_expenses).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="p-6 rounded-3xl border border-stone-200 bg-stone-50">
                              <p className="text-xs font-bold text-stone-600 uppercase tracking-widest mb-2">Ganancia neta</p>
                              <p className="text-3xl font-serif text-stone-900">${parseFloat(yearlyData.total_balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-stone-100">
                                  <th className="text-left py-3 px-4 font-medium text-stone-600">Mes</th>
                                  <th className="text-right py-3 px-4 font-medium text-stone-600">Ingresos</th>
                                  <th className="text-right py-3 px-4 font-medium text-stone-600">Gastos</th>
                                  <th className="text-right py-3 px-4 font-medium text-stone-600">Neto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {yearlyData.months.map(m => (
                                  <tr
                                    key={m.month}
                                    onClick={() => handleSelectMonthFromYear(m.month)}
                                    className="border-b border-stone-50 hover:bg-stone-50 transition-colors cursor-pointer"
                                  >
                                    <td className="py-3 px-4 font-medium text-stone-900">{monthNames[m.month - 1]}</td>
                                    <td className="py-3 px-4 text-right text-emerald-700">${parseFloat(m.income).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-3 px-4 text-right text-red-700">${parseFloat(m.expenses).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                                    <td className="py-3 px-4 text-right font-medium text-stone-900">${parseFloat(m.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-stone-400 -mt-2">Click en un mes para ver su detalle.</p>
                        </>
                      )}
                    </div>
                  ) : (
                  <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button
                      type="button"
                      onClick={() => setShowIncomeDetail(v => !v)}
                      className="text-left p-6 rounded-3xl border border-emerald-100 bg-emerald-50 hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Ingresos (mes)</p>
                        <ChevronDown size={16} className={cn('text-emerald-500 transition-transform', showIncomeDetail && 'rotate-180')} />
                      </div>
                      <p className="text-3xl font-serif text-emerald-900 mb-1">
                        ${(treasuryData.total_income ? parseFloat(treasuryData.total_income) : 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-emerald-600">Ver citas del mes</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowExpenseDetail(v => !v)}
                      className="text-left p-6 rounded-3xl border border-red-100 bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Gastos (mes)</p>
                        <ChevronDown size={16} className={cn('text-red-500 transition-transform', showExpenseDetail && 'rotate-180')} />
                      </div>
                      <p className="text-3xl font-serif text-red-900 mb-1">
                        ${(treasuryData.total_expenses ? parseFloat(treasuryData.total_expenses) : 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-red-600">Ver gastos del mes</p>
                    </button>

                    <div className="p-6 rounded-3xl border border-stone-200 bg-stone-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-stone-600 uppercase tracking-widest">Ganancia neta</p>
                        <CheckCircle2 size={16} className="text-stone-500" />
                      </div>
                      <p className="text-3xl font-serif text-stone-900 mb-1">
                        ${(treasuryData.net_income ? parseFloat(treasuryData.net_income) : 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-stone-600">Este mes</p>
                    </div>

                    <div className="p-6 rounded-3xl border border-amber-100 bg-amber-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Pendientes</p>
                        <Clock size={16} className="text-amber-500" />
                      </div>
                      <p className="text-3xl font-serif text-amber-900 mb-1">{ordersNotFullyPaid.length}</p>
                      <p className="text-xs text-amber-600">Órdenes aún no pagadas</p>
                    </div>
                  </div>

                  {/* Income detail: citas del mes */}
                  {showIncomeDetail && (
                    <div className="border-t border-stone-100 pt-8">
                      <h4 className="text-lg font-serif text-stone-900 mb-4">Citas de {new Date(selectedMonth + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h4>

                      {incomeActionError && (
                        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{incomeActionError}</p>
                      )}

                      {incomeDetailLoading ? (
                        <div className="flex justify-center py-12">
                          <Loader size={24} className="text-stone-300 animate-spin" />
                        </div>
                      ) : incomeDetailError ? (
                        <p className="text-sm text-red-600">{incomeDetailError}</p>
                      ) : incomeAppointments.length === 0 ? (
                        <div className="text-center py-12 text-stone-400">
                          <p className="font-serif">Sin citas este mes</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-stone-100">
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Cliente</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Servicio</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Fecha</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Estado</th>
                                <th className="text-right py-3 px-4 font-medium text-stone-600">Monto</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Pago</th>
                                <th className="text-right py-3 px-4 font-medium text-stone-600">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {incomeAppointments.map(appt => (
                                <tr key={appt.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors align-top">
                                  <td className="py-3 px-4 font-medium text-stone-900">{appt.customer_name}</td>
                                  <td className="py-3 px-4 text-stone-600">{appt.services.join(', ') || '—'}</td>
                                  <td className="py-3 px-4 text-stone-600 text-xs">
                                    {new Date(appt.start_time).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Caracas' })}
                                  </td>
                                  <td className="py-3 px-4">
                                    <select
                                      value={appt.status}
                                      onChange={e => handleAppointmentStatusChange(appt.id, e.target.value)}
                                      className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:border-stone-900 bg-white"
                                    >
                                      <option value="pending">Pendiente</option>
                                      <option value="confirmed">Confirmado</option>
                                      <option value="completed">Completado</option>
                                      <option value="cancelled">Cancelado</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-4 text-right font-medium">
                                    {appt.order ? `$${parseFloat(appt.order.total_amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '—'}
                                  </td>
                                  <td className="py-3 px-4">
                                    {!appt.order ? (
                                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100 text-stone-500">Sin orden</span>
                                    ) : appt.order.is_fully_paid ? (
                                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Pagado</span>
                                    ) : parseFloat(appt.order.amount_paid) > 0 ? (
                                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                                        Parcial ${parseFloat(appt.order.amount_paid).toLocaleString('es-ES', { minimumFractionDigits: 2 })} de ${parseFloat(appt.order.total_amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-600">Pendiente</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex flex-col items-end gap-1.5">
                                      {payingId === appt.id ? (
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            step="0.01"
                                            autoFocus
                                            placeholder={appt.order?.balance_due}
                                            value={paymentAmount}
                                            onChange={e => setPaymentAmount(e.target.value)}
                                            className="w-20 px-2 py-1 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                                          />
                                          <button
                                            disabled={savingPayment}
                                            onClick={() => handleRegisterPayment(appt)}
                                            className="text-xs bg-stone-900 text-white px-2.5 py-1 rounded-lg hover:bg-stone-800 disabled:opacity-50"
                                          >
                                            {savingPayment ? '…' : 'OK'}
                                          </button>
                                          <button
                                            onClick={() => { setPayingId(null); setPaymentAmount(''); }}
                                            className="text-xs text-stone-400 hover:text-stone-600 px-1"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          disabled={!appt.order || appt.order.is_fully_paid}
                                          onClick={() => { setPayingId(appt.id); setPaymentAmount(appt.order?.balance_due || ''); }}
                                          className="text-xs text-stone-600 hover:text-stone-900 px-2.5 py-1 rounded-full border border-stone-200 hover:border-stone-300 disabled:opacity-40 disabled:hover:border-stone-200 transition-colors whitespace-nowrap"
                                        >
                                          Registrar pago
                                        </button>
                                      )}
                                      <button
                                        disabled={!appt.order || appt.order.has_receipt || issuingReceiptId === appt.id}
                                        onClick={() => handleIssueReceipt(appt)}
                                        className="text-xs text-stone-600 hover:text-stone-900 px-2.5 py-1 rounded-full border border-stone-200 hover:border-stone-300 disabled:opacity-40 disabled:hover:border-stone-200 transition-colors whitespace-nowrap"
                                      >
                                        {issuingReceiptId === appt.id ? 'Emitiendo…' : appt.order?.has_receipt ? 'Recibo emitido' : 'Emitir recibo'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expense detail: gastos del mes */}
                  {showExpenseDetail && (
                    <div className="border-t border-stone-100 pt-8">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-serif text-stone-900">Gastos de {new Date(selectedMonth + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h4>
                        <button
                          type="button"
                          onClick={() => setShowAddExpense(v => !v)}
                          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', showAddExpense ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300')}
                        >
                          <Plus size={14} /> Registrar gasto
                        </button>
                      </div>

                      {showAddExpense && (
                        <form onSubmit={handleCreateExpense} className="mb-6 p-5 rounded-2xl border border-stone-100 bg-stone-50">
                          {newExpenseError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3">{newExpenseError}</p>}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Monto *</p>
                              <input
                                required type="number" step="0.01" placeholder="0.00"
                                value={newExpenseForm.amount}
                                onChange={e => setNewExpenseForm(p => ({ ...p, amount: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Fecha</p>
                              <input
                                type="date"
                                value={newExpenseForm.date}
                                onChange={e => setNewExpenseForm(p => ({ ...p, date: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Método</p>
                              <select
                                value={newExpenseForm.method}
                                onChange={e => setNewExpenseForm(p => ({ ...p, method: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                              >
                                <option value="cash">Efectivo</option>
                                <option value="transfer">Transferencia</option>
                                <option value="card">Tarjeta</option>
                                <option value="other">Otro</option>
                              </select>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Categoría</p>
                              <select
                                value={newExpenseForm.category}
                                onChange={e => setNewExpenseForm(p => ({ ...p, category: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                              >
                                <option value="">Sin categoría</option>
                                {expenseCategories.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Descripción</p>
                            <input
                              type="text" placeholder="Ej: Compra de insumos"
                              value={newExpenseForm.description}
                              onChange={e => setNewExpenseForm(p => ({ ...p, description: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={savingNewExpense || !newExpenseForm.amount}
                              className="bg-stone-900 text-white text-sm px-4 py-2 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
                            >
                              {savingNewExpense ? 'Guardando…' : 'Guardar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowAddExpense(false); setNewExpenseForm(emptyNewExpense); setNewExpenseError(null); }}
                              className="text-sm text-stone-500 hover:text-stone-900 px-4 py-2 rounded-full transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}

                      {expenseActionError && (
                        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{expenseActionError}</p>
                      )}

                      {expenseDetailLoading ? (
                        <div className="flex justify-center py-12">
                          <Loader size={24} className="text-stone-300 animate-spin" />
                        </div>
                      ) : expenseDetailError ? (
                        <p className="text-sm text-red-600">{expenseDetailError}</p>
                      ) : expenseTransactions.length === 0 ? (
                        <div className="text-center py-12 text-stone-400">
                          <p className="font-serif">Sin gastos este mes</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-stone-100">
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Fecha</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Descripción</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Método</th>
                                <th className="text-right py-3 px-4 font-medium text-stone-600">Monto</th>
                                <th className="text-left py-3 px-4 font-medium text-stone-600">Categoría</th>
                              </tr>
                            </thead>
                            <tbody>
                              {expenseTransactions.map(t => (
                                <tr key={t.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors align-top">
                                  <td className="py-3 px-4 text-stone-600">{new Date(t.date).toLocaleDateString('es-ES')}</td>
                                  <td className="py-3 px-4 text-stone-900 font-medium">{t.description || '—'}</td>
                                  <td className="py-3 px-4 text-stone-600 text-xs capitalize">{t.method}</td>
                                  <td className="py-3 px-4 text-right font-medium text-red-700">
                                    ${parseFloat(t.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3 px-4">
                                    {addingCategoryForId === t.id ? (
                                      <div className="flex flex-col gap-1.5 min-w-[180px]">
                                        <input
                                          autoFocus
                                          placeholder="Nombre de categoría"
                                          value={newCategoryName}
                                          onChange={e => setNewCategoryName(e.target.value)}
                                          className="px-2 py-1 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                                        />
                                        <label className="flex items-center gap-1.5 text-xs text-stone-500">
                                          <input
                                            type="checkbox"
                                            checked={newCategoryIsDirect}
                                            onChange={e => setNewCategoryIsDirect(e.target.checked)}
                                            className="rounded"
                                          />
                                          Gasto directo (atribuible)
                                        </label>
                                        <div className="flex gap-1.5">
                                          <button
                                            disabled={savingCategory || !newCategoryName.trim()}
                                            onClick={() => handleCreateCategoryAndAssign(t.id)}
                                            className="text-xs bg-stone-900 text-white px-2.5 py-1 rounded-lg hover:bg-stone-800 disabled:opacity-50"
                                          >
                                            {savingCategory ? '…' : 'Guardar'}
                                          </button>
                                          <button
                                            onClick={() => { setAddingCategoryForId(null); setNewCategoryName(''); setNewCategoryIsDirect(true); }}
                                            className="text-xs text-stone-400 hover:text-stone-600 px-1"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <select
                                        value={t.category ?? ''}
                                        onChange={e => {
                                          const v = e.target.value;
                                          if (v === '__new__') setAddingCategoryForId(t.id);
                                          else if (v) handleExpenseCategoryChange(t.id, Number(v));
                                        }}
                                        className="text-xs px-2 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:border-stone-900 bg-white"
                                      >
                                        <option value="" disabled>Sin categoría</option>
                                        {expenseCategories.map(cat => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                        <option value="__new__">+ Nueva categoría</option>
                                      </select>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  </>
                  )}

                  {/* Documents Summary */}
                  <div className="border-t border-stone-100 pt-8">
                    <h4 className="text-lg font-serif text-stone-900 mb-4">Documentos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-5 rounded-2xl border border-stone-100 hover:border-stone-300 transition-colors">
                        <p className="text-sm font-medium text-stone-600 mb-2">Cotizaciones</p>
                        <p className="text-2xl font-serif text-stone-900">{unpaidOrders.length}</p>
                        <p className="text-xs text-stone-400 mt-1">Órdenes abiertas este período</p>
                      </div>
                      <div className="p-5 rounded-2xl border border-stone-100 hover:border-stone-300 transition-colors">
                        <p className="text-sm font-medium text-stone-600 mb-2">Recibos</p>
                        <p className="text-2xl font-serif text-stone-900">{billingData.receipts}</p>
                        <p className="text-xs text-stone-400 mt-1">Total emitidos</p>
                      </div>
                      <div className="p-5 rounded-2xl border border-stone-100 hover:border-stone-300 transition-colors">
                        <p className="text-sm font-medium text-stone-600 mb-2">Tasa de conversión</p>
                        <p className="text-2xl font-serif text-stone-900">
                          {billingData.quotations > 0 ? ((billingData.receipts / billingData.quotations) * 100).toFixed(0) : 0}%
                        </p>
                        <p className="text-xs text-stone-400 mt-1">Cotizaciones aceptadas</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard size={36} className="text-stone-200 mb-4" />
                  <p className="font-serif text-lg text-stone-400 mb-2">Sin datos disponibles</p>
                  <p className="text-sm text-stone-300">Aún no hay movimientos de facturación registrados.</p>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {billingTab === 'transactions' && (
            <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h4 className="text-lg font-serif text-stone-900">Movimientos de Tesorería</h4>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full border border-stone-200 p-0.5">
                    <button
                      onClick={() => setSummaryView('month')}
                      className={cn('px-3 py-1 text-xs font-medium rounded-full transition-colors', summaryView === 'month' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')}
                    >
                      Mes
                    </button>
                    <button
                      onClick={() => setSummaryView('year')}
                      className={cn('px-3 py-1 text-xs font-medium rounded-full transition-colors', summaryView === 'year' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')}
                    >
                      Año
                    </button>
                  </div>
                  {summaryView === 'month' ? (
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                    />
                  ) : (
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={e => setSelectedYear(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                    />
                  )}
                </div>
              </div>

              <div className="flex justify-end mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransactionFilter('all')}
                    className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors', transactionFilter === 'all' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300')}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setTransactionFilter('income')}
                    className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors', transactionFilter === 'income' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-stone-200 text-stone-600 hover:border-stone-300')}
                  >
                    Ingresos
                  </button>
                  <button
                    onClick={() => setTransactionFilter('expense')}
                    className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition-colors', transactionFilter === 'expense' ? 'bg-red-600 text-white border-red-600' : 'border-stone-200 text-stone-600 hover:border-stone-300')}
                  >
                    Gastos
                  </button>
                </div>
              </div>

              {/* Create Transaction Form */}
              {!showTransactionForm ? (
                <button
                  onClick={() => setShowTransactionForm(true)}
                  className="mb-6 bg-stone-900 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  Nuevo movimiento
                </button>
              ) : (
                <div className="mb-6 p-6 rounded-2xl border border-stone-100 bg-stone-50">
                  <h5 className="text-sm font-serif text-stone-900 mb-4">Crear movimiento</h5>
                  {transactionError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3">{transactionError}</p>}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Tipo</p>
                      <select
                        value={transactionForm.direction}
                        onChange={e => setTransactionForm(p => ({ ...p, direction: e.target.value as 'IN' | 'OUT' }))}
                        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                      >
                        <option value="OUT">Gasto</option>
                        <option value="IN">Ingreso</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Monto</p>
                      <input
                        type="number"
                        step="0.01"
                        value={transactionForm.amount}
                        onChange={e => setTransactionForm(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Fecha</p>
                      <input
                        type="date"
                        value={transactionForm.date}
                        onChange={e => setTransactionForm(p => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Descripción</p>
                    <input
                      type="text"
                      value={transactionForm.description}
                      onChange={e => setTransactionForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Ej: Pago de servicios"
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                    />
                  </div>

                  {transactionForm.direction === 'OUT' && (
                    <div className="mb-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Categoría de gasto</p>
                      <select
                        value={transactionForm.category}
                        onChange={e => setTransactionForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                      >
                        <option value="">Sin categoría</option>
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} {cat.is_direct ? '(directo)' : '(general)'}
                          </option>
                        ))}
                      </select>
                      {transactionForm.category && (
                        <div className="mt-2 p-2 rounded bg-stone-50 border border-stone-100">
                          <label className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={expenseCategories.find(c => String(c.id) === transactionForm.category)?.is_direct || false}
                              disabled
                              className="rounded"
                            />
                            <span className="text-stone-600">
                              {expenseCategories.find(c => String(c.id) === transactionForm.category)?.is_direct ? 'Gasto directo (atribuible)' : 'Gasto general (fijo)'}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-1">Método de pago</p>
                    <select
                      value={transactionForm.method}
                      onChange={e => setTransactionForm(p => ({ ...p, method: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white mb-4"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!token || !transactionForm.amount) return;
                        setCreatingTransaction(true);
                        setTransactionError(null);
                        try {
                          await createTransaction(token, {
                            direction: transactionForm.direction,
                            amount: transactionForm.amount,
                            date: transactionForm.date,
                            description: transactionForm.description,
                            method: transactionForm.method,
                            category: transactionForm.category ? parseInt(transactionForm.category) : undefined,
                          });
                          setTransactionForm({ direction: 'OUT', amount: '', date: new Date().toISOString().split('T')[0], description: '', method: 'cash', category: '' });
                          setShowTransactionForm(false);
                          await Promise.all([loadDetailedData(), loadBillingData(selectedMonth)]);
                        } catch (err: any) {
                          setTransactionError(err.message);
                        } finally {
                          setCreatingTransaction(false);
                        }
                      }}
                      disabled={creatingTransaction || !transactionForm.amount}
                      className="bg-stone-900 text-white text-sm px-4 py-2 rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50"
                    >
                      {creatingTransaction ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => {
                        setShowTransactionForm(false);
                        setTransactionError(null);
                      }}
                      className="text-sm text-stone-500 hover:text-stone-900 px-4 py-2 rounded-full transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {detailedLoading ? (
                <div className="flex justify-center py-12">
                  <Loader size={24} className="text-stone-300 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <p className="font-serif">Sin movimientos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="text-left py-3 px-4 font-medium text-stone-600">Fecha</th>
                        <th className="text-left py-3 px-4 font-medium text-stone-600">Descripción</th>
                        <th className="text-left py-3 px-4 font-medium text-stone-600">Tipo</th>
                        <th className="text-left py-3 px-4 font-medium text-stone-600">Método</th>
                        <th className="text-right py-3 px-4 font-medium text-stone-600">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions
                        .filter(t => transactionFilter === 'all' || (transactionFilter === 'income' && t.direction === 'IN') || (transactionFilter === 'expense' && t.direction === 'OUT'))
                        .map(t => (
                          <tr key={t.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-4 text-stone-600">{new Date(t.date).toLocaleDateString('es-ES')}</td>
                            <td className="py-3 px-4 text-stone-900 font-medium">{t.description || '—'}</td>
                            <td className="py-3 px-4">
                              <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', t.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                                {t.direction === 'IN' ? 'Ingreso' : 'Gasto'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-stone-600 text-xs capitalize">{t.method}</td>
                            <td className="py-3 px-4 text-right font-medium">
                              <span className={t.direction === 'IN' ? 'text-emerald-700' : 'text-red-700'}>
                                {t.direction === 'IN' ? '+' : '−'}${parseFloat(t.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {billingTab === 'documents' && (
            <div className="space-y-6">
              {/* Period selector */}
              <div className="flex items-center justify-end gap-2">
                <div className="flex rounded-full border border-stone-200 p-0.5">
                  <button
                    onClick={() => setSummaryView('month')}
                    className={cn('px-3 py-1 text-xs font-medium rounded-full transition-colors', summaryView === 'month' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')}
                  >
                    Mes
                  </button>
                  <button
                    onClick={() => setSummaryView('year')}
                    className={cn('px-3 py-1 text-xs font-medium rounded-full transition-colors', summaryView === 'year' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900')}
                  >
                    Año
                  </button>
                </div>
                {summaryView === 'month' ? (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                  />
                ) : (
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                  />
                )}
              </div>

              {/* Órdenes sin pagar */}
              <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
                <h4 className="text-lg font-serif text-stone-900 mb-6">Órdenes sin pagar</h4>
                {detailedLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader size={24} className="text-stone-300 animate-spin" />
                  </div>
                ) : unpaidOrders.length === 0 ? (
                  <div className="text-center py-12 text-stone-400">
                    <p className="font-serif">Sin órdenes pendientes de pago</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-100">
                          <th className="text-left py-3 px-4 font-medium text-stone-600">Cliente</th>
                          <th className="text-left py-3 px-4 font-medium text-stone-600">Servicios</th>
                          <th className="text-left py-3 px-4 font-medium text-stone-600">Fecha</th>
                          <th className="text-right py-3 px-4 font-medium text-stone-600">Total</th>
                          <th className="text-right py-3 px-4 font-medium text-stone-600">Saldo</th>
                          <th className="text-right py-3 px-4 font-medium text-stone-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaidOrders.map(o => (
                          <tr key={o.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-4 font-medium text-stone-900">{o.customer_name}</td>
                            <td className="py-3 px-4 text-stone-600">{o.items.map(i => i.product_name).join(', ') || '—'}</td>
                            <td className="py-3 px-4 text-stone-600">{o.booking_date ? new Date(o.booking_date).toLocaleDateString('es-ES') : new Date(o.created_at).toLocaleDateString('es-ES')}</td>
                            <td className="py-3 px-4 text-right font-medium">${parseFloat(o.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 px-4 text-right font-medium text-amber-700">
                              ${parseFloat(o.balance_due).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                              {parseFloat(o.amount_paid) > 0 && (
                                <span className="block text-xs text-stone-400 font-normal">${parseFloat(o.amount_paid).toLocaleString('es-ES', { minimumFractionDigits: 2 })} abonado</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex flex-col items-end gap-1.5">
                                {payingOrderId === o.id ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      autoFocus
                                      placeholder={o.balance_due}
                                      value={orderPaymentAmount}
                                      onChange={e => setOrderPaymentAmount(e.target.value)}
                                      className="w-20 px-2 py-1 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-stone-900"
                                    />
                                    <button
                                      disabled={savingOrderPayment}
                                      onClick={() => handleRegisterOrderPayment(o)}
                                      className="text-xs bg-stone-900 text-white px-2.5 py-1 rounded-lg hover:bg-stone-800 disabled:opacity-50"
                                    >
                                      {savingOrderPayment ? '…' : 'OK'}
                                    </button>
                                    <button
                                      onClick={() => { setPayingOrderId(null); setOrderPaymentAmount(''); }}
                                      className="text-xs text-stone-400 hover:text-stone-600 px-1"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : o.is_fully_paid ? (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Pagado</span>
                                ) : (
                                  <button
                                    onClick={() => { setPayingOrderId(o.id); setOrderPaymentAmount(o.balance_due); }}
                                    className="text-xs text-stone-600 hover:text-stone-900 px-2.5 py-1 rounded-full border border-stone-200 hover:border-stone-300 transition-colors whitespace-nowrap"
                                  >
                                    Registrar pago
                                  </button>
                                )}
                                <button
                                  disabled={closingOrderId === o.id}
                                  onClick={() => handleCloseOrder(o.id)}
                                  className="text-xs text-stone-400 hover:text-stone-700 px-2.5 py-1 rounded-full border border-transparent hover:border-stone-200 transition-colors whitespace-nowrap disabled:opacity-50"
                                >
                                  {closingOrderId === o.id ? 'Cerrando…' : 'Cerrar orden'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recibos: órdenes cerradas (status = completed) */}
              <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
                <h4 className="text-lg font-serif text-stone-900 mb-6">Recibos</h4>
                {detailedLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader size={24} className="text-stone-300 animate-spin" />
                  </div>
                ) : closedOrders.length === 0 ? (
                  <div className="text-center py-12 text-stone-400">
                    <p className="font-serif">Sin órdenes cerradas este período</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-100">
                          <th className="text-left py-3 px-4 font-medium text-stone-600">Cliente</th>
                          <th className="text-left py-3 px-4 font-medium text-stone-600">Servicios</th>
                          <th className="text-left py-3 px-4 font-medium text-stone-600">Fecha</th>
                          <th className="text-right py-3 px-4 font-medium text-stone-600">Total</th>
                          <th className="text-right py-3 px-4 font-medium text-stone-600">Pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedOrders.map(o => (
                          <tr key={o.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                            <td className="py-3 px-4 font-medium text-stone-900">{o.customer_name}</td>
                            <td className="py-3 px-4 text-stone-600">{o.items.map(i => i.product_name).join(', ') || '—'}</td>
                            <td className="py-3 px-4 text-stone-600">{o.booking_date ? new Date(o.booking_date).toLocaleDateString('es-ES') : new Date(o.created_at).toLocaleDateString('es-ES')}</td>
                            <td className="py-3 px-4 text-right font-medium">${parseFloat(o.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3 px-4 text-right">
                              {o.is_fully_paid ? (
                                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">Pagado</span>
                              ) : (
                                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                                  Saldo ${parseFloat(o.balance_due).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {billingTab === 'reports' && (
            <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm p-8">
              <h4 className="text-lg font-serif text-stone-900 mb-6">Reportes</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Customers */}
                <div>
                  <h5 className="text-sm font-medium text-stone-600 mb-4">Clientes principales</h5>
                  {detailedLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader size={20} className="text-stone-300 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {receipts
                        .reduce((acc, r) => {
                          const existing = acc.find(x => x.name === r.customer_name);
                          if (existing) {
                            existing.amount = (parseFloat(existing.amount) + parseFloat(r.total)).toString();
                            existing.count++;
                          } else {
                            acc.push({ name: r.customer_name, amount: r.total, count: 1 });
                          }
                          return acc;
                        }, [] as any[])
                        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
                        .slice(0, 5)
                        .map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-stone-100 hover:border-stone-300 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-900 truncate">{c.name}</p>
                              <p className="text-xs text-stone-400">{c.count} {c.count === 1 ? 'recibo' : 'recibos'}</p>
                            </div>
                            <p className="text-sm font-medium text-emerald-700 ml-2">
                              ${parseFloat(c.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Sync Section */}
                <div>
                  <h5 className="text-sm font-medium text-stone-600 mb-4">Sincronización</h5>
                  <div className="p-4 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50">
                    {syncMessage && (
                      <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-sm text-emerald-700 font-medium">{syncMessage}</p>
                      </div>
                    )}
                    <p className="text-sm text-stone-600 mb-4">
                      Envía un resumen de tus facturas y movimientos a EsfuerzoVZ para mantener sincronizados tus datos financieros.
                    </p>
                    <button
                      onClick={async () => {
                        if (!token) return;
                        setSyncing(true);
                        try {
                          const today = new Date();
                          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                          const periodStart = firstDay.toISOString().split('T')[0];
                          const periodEnd = today.toISOString().split('T')[0];

                          const result = await syncToEVZ(token, periodStart, periodEnd);
                          setSyncMessage(`✓ ${result.status || 'Datos sincronizados'} exitosamente con EsfuerzoVZ`);
                          setTimeout(() => setSyncMessage(null), 5000);
                        } catch (err: any) {
                          setSyncMessage(`✗ Error: ${err.message}`);
                        } finally {
                          setSyncing(false);
                        }
                      }}
                      disabled={syncing}
                      className="w-full bg-stone-900 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {syncing ? (
                        <>
                          <Loader size={16} className="animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Sincronizar con EsfuerzoVZ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
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

const Footer = () => {
  const { business } = useBusiness();
  const location = [business.address, business.city, business.country]
    .filter(Boolean)
    .join(', ');

  return (
  <footer className="bg-stone-50 py-20 border-t border-stone-200">
    <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 mb-6">
          <BusinessMark />
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
          {location && (
            <li className="flex items-center gap-2"><MapPin size={16} /> {location}</li>
          )}
          {business.phone && (
            <li className="flex items-center gap-2"><Phone size={16} /> {business.phone}</li>
          )}
          {business.email && (
            <li className="flex items-center gap-2"><Mail size={16} /> {business.email}</li>
          )}
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
      © {new Date().getFullYear()} {business.legal_name || business.trade_name}.
      Todos los derechos reservados.
    </div>
  </footer>
  );
};

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
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');

  const openAuth = (mode: 'login' | 'register') => { setAuthMode(mode); setShowAuth(true); };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('uid') && params.get('token')) {
      setAuthMode('reset');
      setShowAuth(true);
    }
  }, []);

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
              allServices={services}
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
      <BusinessProvider>
        <AppContent />
      </BusinessProvider>
    </AuthProvider>
  );
}
