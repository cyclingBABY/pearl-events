/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Instagram, 
  Facebook, 
  Mail, 
  Phone, 
  MapPin, 
  ChevronRight, 
  Star, 
  Menu, 
  X,
  Sparkles,
  Calendar,
  Camera,
  Layout,
  User,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Send,
  MessageCircle,
  Upload,
  Video,
  Link as LinkIcon,
  Image as ImageIcon
} from 'lucide-react';
import { 
  onSnapshot, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  getDoc,
  setDoc,
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import Markdown from 'react-markdown';
import { db, auth, storage, googleProvider, handleFirestoreError, OperationType } from './firebase';

// --- Types ---

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'editor' | 'client';
  name?: string;
}

interface EventEntry {
  id: string;
  title: string;
  description: string;
  type: 'Wedding' | 'Kwanjula' | 'Corporate' | 'Other';
  images: string[];
  videoUrl?: string;
  tags: string[];
  date?: string;
}

interface ServiceEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  image: string;
  videoUrl?: string;
  priceRange?: string;
}

interface TestimonialEntry {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  image?: string;
}

interface BlogPostEntry {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  image: string;
  tags: string[];
}

interface InquiryEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  eventDate: string;
  location?: string;
  guestCount?: number;
  interests: string[];
  status: 'pending' | 'contacted' | 'booked';
  createdAt: string;
  uid?: string;
}

interface MessageEntry {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  senderName?: string;
}

// --- Context ---

const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

const useAuth = () => useContext(AuthContext);

// --- Components ---

function ErrorBoundary({ children }: { children: ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setHasError(true);
      setErrorMsg(e.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pearl-cream p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-serif mb-4">Something went wrong</h2>
          <p className="text-pearl-dark/60 mb-6">We encountered an error. Please try refreshing the page.</p>
          <div className="text-left bg-red-50 p-4 rounded-xl text-xs font-mono text-red-700 overflow-auto max-h-40">
            {errorMsg}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full bg-pearl-dark text-white py-3 rounded-full uppercase tracking-widest text-xs font-bold"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          // Ensure stuartdonsms@gmail.com is always admin in DB
          if (firebaseUser.email === 'stuartdonsms@gmail.com' && data.role !== 'admin') {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
            setProfile({ ...data, role: 'admin' });
          } else {
            setProfile(data);
          }
        } else {
          // Create default profile
          const isAdminEmail = firebaseUser.email === 'stuartdonsms@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: isAdminEmail ? 'admin' : 'client',
            name: firebaseUser.displayName || '',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      <ErrorBoundary>
        <MainContent />
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}

function MainContent() {
  const { profile, loading } = useAuth();
  const [view, setView] = useState<'public' | 'admin' | 'client'>('public');
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!loading && profile && !hasRedirected) {
      if (profile.role === 'admin') {
        setView('admin');
      } else if (profile.role === 'client') {
        setView('public');
      }
      setHasRedirected(true);
    } else if (!loading && !profile) {
      setView('public');
      setHasRedirected(false);
    }
  }, [profile, loading, hasRedirected]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-pearl-cream">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 rounded-full border-2 border-pearl-gold border-t-transparent animate-spin"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pearl-cream">
      {view === 'public' && <PublicSite onEnterAdmin={() => setView('admin')} onEnterClient={() => setView('client')} />}
      {view === 'admin' && profile?.role === 'admin' && <AdminDashboard onBack={() => setView('public')} />}
      {view === 'client' && profile?.role === 'client' && <ClientPortal onBack={() => setView('public')} />}
      
      {/* Fallback for unauthorized access */}
      {view === 'admin' && profile?.role !== 'admin' && (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
          <h2 className="text-3xl font-serif mb-4">Unauthorized Access</h2>
          <p className="text-pearl-dark/60 mb-8">You do not have administrative privileges.</p>
          <button onClick={() => setView('public')} className="bg-pearl-dark text-white px-8 py-3 rounded-full uppercase tracking-widest text-xs font-bold">Return Home</button>
        </div>
      )}
    </div>
  );
}

// --- Public Site ---

function PublicSite({ onEnterAdmin, onEnterClient }: { onEnterAdmin: () => void, onEnterClient: () => void }) {
  const { user, profile, login, logout } = useAuth();
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialEntry[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPostEntry[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    
    const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as EventEntry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceEntry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'services'));

    const unsubTestimonials = onSnapshot(collection(db, 'testimonials'), (snap) => {
      setTestimonials(snap.docs.map(d => ({ id: d.id, ...d.data() } as TestimonialEntry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'testimonials'));

    const unsubBlog = onSnapshot(query(collection(db, 'blogPosts'), orderBy('date', 'desc')), (snap) => {
      setBlogPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPostEntry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'blogPosts'));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubEvents();
      unsubServices();
      unsubTestimonials();
      unsubBlog();
    };
  }, []);

  return (
    <div className="relative">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-pearl-cream/90 backdrop-blur-md py-4 shadow-sm' : 'bg-transparent py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full border border-pearl-dark flex items-center justify-center font-serif text-xl">P</div>
            <span className="font-serif text-2xl tracking-widest uppercase hidden sm:block">Pearl Events</span>
          </div>
          
          <div className="hidden md:flex gap-12 items-center">
            {['Services', 'Portfolio', 'Blog', 'Contact'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-xs uppercase tracking-[0.2em] font-medium hover:text-pearl-gold transition-colors">{item}</a>
            ))}
            {user ? (
              <div className="flex items-center gap-4">
                {profile?.role === 'admin' && (
                  <button onClick={onEnterAdmin} className="text-xs uppercase tracking-widest font-bold text-pearl-gold flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Admin
                  </button>
                )}
                {profile?.role === 'client' && (
                  <button onClick={onEnterClient} className="text-xs uppercase tracking-widest font-bold text-pearl-gold flex items-center gap-2">
                    <User className="w-4 h-4" /> My Portal
                  </button>
                )}
                <button onClick={logout} className="text-pearl-dark/40 hover:text-pearl-dark transition-colors"><LogOut className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={login} className="px-6 py-2 border border-pearl-dark rounded-full text-xs uppercase tracking-widest hover:bg-pearl-dark hover:text-white transition-all">
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-pearl-dark">
        <div className="absolute inset-0 opacity-40">
          <img src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=1920" alt="Hero" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-pearl-dark/80" />
        <div className="relative z-10 text-center px-6 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <span className="text-pearl-gold uppercase tracking-[0.4em] text-sm font-medium mb-6 block">Luxury Event CMS</span>
            <h1 className="text-white text-6xl md:text-8xl font-serif font-light leading-tight mb-8">
              Crafting <span className="italic">Excellence</span>
            </h1>
            <a href="#booking" className="bg-pearl-gold text-white px-10 py-4 rounded-full text-sm uppercase tracking-widest hover:bg-white hover:text-pearl-dark transition-all duration-500 inline-block">
              Start Planning
            </a>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-20">
            <div>
              <h2 className="text-5xl font-serif italic mb-4">Our Services</h2>
              <p className="text-pearl-dark/50 uppercase tracking-widest text-xs">Exquisite Planning & Decor</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('services-track');
                  if (el) el.scrollBy({ left: -400, behavior: 'smooth' });
                }}
                className="w-12 h-12 rounded-full border border-pearl-dark/10 flex items-center justify-center hover:bg-pearl-dark hover:text-white transition-all"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('services-track');
                  if (el) el.scrollBy({ left: 400, behavior: 'smooth' });
                }}
                className="w-12 h-12 rounded-full border border-pearl-dark/10 flex items-center justify-center hover:bg-pearl-dark hover:text-white transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div 
            id="services-track"
            className="flex gap-8 overflow-x-auto pb-12 snap-x snap-mandatory no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {services.map(s => (
              <motion.div 
                key={s.id} 
                className="min-w-[300px] md:min-w-[400px] group snap-start"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-6 relative group">
                  {s.videoUrl ? (
                    <video 
                      src={s.videoUrl} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      loop 
                      muted 
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => e.currentTarget.pause()}
                    />
                  ) : (
                    <img src={s.image} alt={s.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-0 bg-pearl-dark/20" />
                  {s.videoUrl && (
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-2 rounded-full">
                      <Video className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-2xl font-serif mb-2">{s.title}</h3>
                <p className="text-pearl-dark/60 text-sm leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
            {services.length === 0 && <p className="text-center opacity-30 italic w-full">No services listed yet.</p>}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section id="portfolio" className="py-32 bg-pearl-dark text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-end mb-20">
            <div>
              <h2 className="text-5xl font-serif italic mb-4">The Gallery</h2>
              <p className="text-pearl-gold uppercase tracking-widest text-[10px]">Luxury Event Showcase</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('portfolio-track');
                  if (el) el.scrollBy({ left: -500, behavior: 'smooth' });
                }}
                className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-pearl-gold transition-all"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('portfolio-track');
                  if (el) el.scrollBy({ left: 500, behavior: 'smooth' });
                }}
                className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-pearl-gold transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div 
            id="portfolio-track"
            className="flex gap-8 overflow-x-auto pb-12 snap-x snap-mandatory no-scrollbar"
          >
            {events.map(e => (
              <motion.div 
                key={e.id} 
                className="min-w-[320px] md:min-w-[500px] space-y-4 snap-start"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
              >
                <div className="aspect-video rounded-xl overflow-hidden relative group">
                  {e.videoUrl ? (
                    <video 
                      src={e.videoUrl} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" 
                      controls
                      poster={e.images[0]}
                    />
                  ) : (
                    <img src={e.images[0]} alt={e.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                  )}
                  {e.videoUrl && !e.images[0] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-pearl-dark/40">
                      <Video className="w-12 h-12 text-white opacity-50" />
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center px-2">
                  <h4 className="font-serif text-2xl">{e.title}</h4>
                  <span className="text-[10px] uppercase tracking-widest text-pearl-gold font-bold">{e.type}</span>
                </div>
              </motion.div>
            ))}
            {events.length === 0 && <p className="text-center opacity-30 italic w-full">No gallery items yet.</p>}
          </div>
        </div>
      </section>

      {/* Blog */}
      <section id="blog" className="py-32 px-6 max-w-7xl mx-auto">
        <h2 className="text-5xl font-serif italic mb-20 text-center">Insights & Trends</h2>
        <div className="grid md:grid-cols-2 gap-16">
          {blogPosts.map(p => (
            <div key={p.id} className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-48 h-48 shrink-0 rounded-2xl overflow-hidden">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-widest text-pearl-gold mb-2 block">{p.date}</span>
                <h3 className="text-2xl font-serif mb-4">{p.title}</h3>
                <p className="text-pearl-dark/60 text-sm line-clamp-3 mb-4">{p.content}</p>
                <button className="text-xs uppercase tracking-widest font-bold border-b border-pearl-dark/20 pb-1">Read More</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Booking Form */}
      <section id="booking" className="py-32 bg-pearl-cream border-t border-pearl-dark/5">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-serif italic mb-4">Book Your Event</h2>
            <p className="text-pearl-dark/60">Let's start planning your luxury experience.</p>
          </div>
          <BookingForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 bg-pearl-dark text-white text-center">
        <div className="flex justify-center gap-8 mb-12">
          <Instagram className="w-6 h-6 opacity-40 hover:opacity-100 transition-opacity cursor-pointer" />
          <Facebook className="w-6 h-6 opacity-40 hover:opacity-100 transition-opacity cursor-pointer" />
          <Mail className="w-6 h-6 opacity-40 hover:opacity-100 transition-opacity cursor-pointer" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.4em] opacity-30">© 2026 Pearl Events & Decor • Kampala</p>
      </footer>
    </div>
  );
}

function BookingForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    eventDate: '',
    location: '',
    guestCount: 0,
    interests: [] as string[]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'inquiries'), {
        ...formData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        uid: user?.uid || null
      });
      setSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'inquiries');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl shadow-sm border border-pearl-gold/20">
        <CheckCircle className="w-16 h-16 text-pearl-gold mx-auto mb-6" />
        <h3 className="text-3xl font-serif mb-4">Inquiry Sent!</h3>
        <p className="text-pearl-dark/60 mb-8">Our team will contact you within 24 hours.</p>
        <button onClick={() => setSuccess(false)} className="bg-pearl-dark text-white px-8 py-3 rounded-full uppercase tracking-widest text-xs font-bold">Send Another</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-12 rounded-[40px] shadow-sm border border-pearl-dark/5">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Full Name</label>
          <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-b border-pearl-dark/10 py-2 focus:border-pearl-gold outline-none transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Email Address</label>
          <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-b border-pearl-dark/10 py-2 focus:border-pearl-gold outline-none transition-colors" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Event Date</label>
          <input required type="date" value={formData.eventDate} onChange={e => setFormData({...formData, eventDate: e.target.value})} className="w-full border-b border-pearl-dark/10 py-2 focus:border-pearl-gold outline-none transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Guest Count</label>
          <input type="number" value={formData.guestCount} onChange={e => setFormData({...formData, guestCount: parseInt(e.target.value)})} className="w-full border-b border-pearl-dark/10 py-2 focus:border-pearl-gold outline-none transition-colors" />
        </div>
      </div>
      <div className="space-y-4">
        <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Interests</label>
        <div className="flex flex-wrap gap-3">
          {['Ceiling Drapes', 'Floral Design', 'Luxury Furniture', 'Balloon Decor', 'Planning'].map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                const newInterests = formData.interests.includes(tag) 
                  ? formData.interests.filter(i => i !== tag)
                  : [...formData.interests, tag];
                setFormData({...formData, interests: newInterests});
              }}
              className={`px-4 py-2 rounded-full text-[10px] uppercase tracking-widest border transition-all ${formData.interests.includes(tag) ? 'bg-pearl-gold border-pearl-gold text-white' : 'border-pearl-dark/10 hover:border-pearl-gold'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <button disabled={loading} type="submit" className="w-full bg-pearl-dark text-white py-5 rounded-full uppercase tracking-[0.2em] text-xs font-bold hover:bg-pearl-gold transition-all duration-500 disabled:opacity-50">
        {loading ? 'Processing...' : 'Submit Booking Inquiry'}
      </button>
    </form>
  );
}

function MessagingSystem({ receiverId, senderName }: { receiverId: string, senderName: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as MessageEntry));
      // Filter client-side because Firestore doesn't support complex OR queries easily without composite indexes
      const filtered = allMsgs.filter(m => 
        (m.senderId === user.uid && m.receiverId === receiverId) ||
        (m.senderId === receiverId && m.receiverId === user.uid) ||
        (receiverId === 'admin' && m.receiverId === 'admin' && m.senderId === user.uid) ||
        (receiverId === user.uid && m.receiverId === user.uid && m.senderId === 'admin')
      );
      setMessages(filtered);
    });
    return unsub;
  }, [user, receiverId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: receiverId,
        content: newMessage,
        timestamp: new Date().toISOString(),
        read: false,
        senderName: senderName
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-3xl shadow-sm border border-pearl-dark/5 overflow-hidden">
      <div className="p-6 border-b border-pearl-dark/5 bg-pearl-cream/30 flex items-center gap-3">
        <MessageCircle className="w-5 h-5 text-pearl-gold" />
        <h4 className="font-serif text-lg">Direct Messages</h4>
      </div>
      
      <div className="flex-grow overflow-y-auto p-6 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${m.senderId === user?.uid ? 'bg-pearl-dark text-white rounded-tr-none' : 'bg-pearl-cream text-pearl-dark rounded-tl-none'}`}>
              <p>{m.content}</p>
              <span className="text-[8px] opacity-40 mt-2 block uppercase tracking-widest">{new Date(m.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-center opacity-30 italic py-12">No messages yet. Say hello!</p>}
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-pearl-dark/5 flex gap-2">
        <input 
          type="text" 
          value={newMessage} 
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow bg-pearl-cream/50 px-4 py-2 rounded-full text-sm outline-none focus:ring-1 ring-pearl-gold transition-all"
        />
        <button 
          disabled={loading}
          type="submit"
          className="w-10 h-10 bg-pearl-dark text-white rounded-full flex items-center justify-center hover:bg-pearl-gold transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// --- Admin Dashboard ---

function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'inquiries' | 'events' | 'services' | 'blog' | 'messages'>('inquiries');
  const [inquiries, setInquiries] = useState<InquiryEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPostEntry[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadType, setUploadType] = useState<'link' | 'file'>('link');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [individualProgress, setIndividualProgress] = useState<{[key: string]: number}>({});

  useEffect(() => {
    if (Object.keys(individualProgress).length > 0) {
      const total = Object.values(individualProgress).reduce((a, b) => a + b, 0);
      const count = Object.keys(individualProgress).length;
      setUploadProgress(total / count);
    }
  }, [individualProgress]);

  useEffect(() => {
    const unsubInq = onSnapshot(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')), (snap) => {
      setInquiries(snap.docs.map(d => ({ id: d.id, ...d.data() } as InquiryEntry)));
    });
    const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as EventEntry)));
    });
    const unsubServices = onSnapshot(collection(db, 'services'), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceEntry)));
    });
    const unsubBlog = onSnapshot(query(collection(db, 'blogPosts'), orderBy('date', 'desc')), (snap) => {
      setBlogPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPostEntry)));
    });
    return () => { unsubInq(); unsubEvents(); unsubServices(); unsubBlog(); };
  }, []);

  const updateInquiryStatus = async (id: string, status: InquiryEntry['status']) => {
    try {
      await updateDoc(doc(db, 'inquiries', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'inquiries');
    }
  };

  const deleteItem = async (col: string, id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    try {
      await deleteDoc(doc(db, col, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, col);
    }
  };

  const handleFileSelect = (file: File, field: 'image' | 'videoUrl') => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (field === 'image') {
      setImageFile(file);
      setImagePreview(previewUrl);
    } else {
      setVideoFile(file);
      setVideoPreview(previewUrl);
    }
  };

  const uploadFile = async (file: File, field: 'image' | 'videoUrl') => {
    const storageRef = ref(storage, `${activeTab}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<string>((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setIndividualProgress(prev => ({ ...prev, [field]: progress }));
        }, 
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        }, 
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const collectionName = activeTab === 'blog' ? 'blogPosts' : activeTab;
    setUploading(true);
    setUploadProgress(0);
    setIndividualProgress({});
    
    try {
      let data = { ...formData };
      
      // Handle file uploads if present
      if (uploadType === 'file') {
        const filesToUpload = [];
        if (imageFile) filesToUpload.push({ file: imageFile, field: 'image' as const });
        if (videoFile) filesToUpload.push({ file: videoFile, field: 'videoUrl' as const });

        if (filesToUpload.length > 0) {
          setUploadStatus(`Uploading ${filesToUpload.length} file(s) in parallel...`);
          const uploadPromises = filesToUpload.map(({ file, field }) => uploadFile(file, field));
          const urls = await Promise.all(uploadPromises);
          
          filesToUpload.forEach(({ field }, index) => {
            data[field] = urls[index];
          });
        }
      }

      setUploadStatus('Saving to database...');
      setUploadProgress(95);

      if (activeTab === 'events') {
        data.images = [data.image]; // Simple single image for now
        data.tags = data.tags?.split(',').map((t: string) => t.trim()) || [];
      }
      if (activeTab === 'blog') {
        data.date = new Date().toISOString().split('T')[0];
        data.author = 'Pearl Admin';
      }

      // Ensure required fields for Firestore
      if (!data.image && activeTab !== 'inquiries') {
        throw new Error('Image is required');
      }

      await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      setUploadProgress(100);
      setUploadStatus('Success!');
      
      setTimeout(() => {
        setIsModalOpen(false);
        setFormData({});
        setImageFile(null);
        setVideoFile(null);
        setImagePreview(null);
        setVideoPreview(null);
        setUploading(false);
        setUploadStatus('');
        setUploadProgress(0);
        setIndividualProgress({});
      }, 1000);

    } catch (err) {
      setUploading(false);
      setUploadStatus(err instanceof Error ? err.message : 'Error occurred');
      handleFirestoreError(err, OperationType.CREATE, collectionName);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-72 bg-pearl-dark text-white p-8 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-16">
          <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center font-serif">P</div>
          <span className="font-serif text-xl tracking-widest uppercase">Admin</span>
        </div>
        
        <nav className="space-y-2 flex-grow">
          {[
            { id: 'inquiries', icon: Mail, label: 'Inquiries' },
            { id: 'events', icon: ImageIcon, label: 'Portfolio' },
            { id: 'services', icon: Layout, label: 'Services' },
            { id: 'blog', icon: FileText, label: 'Blog' },
            { id: 'messages', icon: MessageCircle, label: 'Messages' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-xs uppercase tracking-widest font-bold transition-all ${activeTab === tab.id ? 'bg-pearl-gold text-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>

        <button onClick={onBack} className="mt-auto flex items-center gap-4 text-white/40 hover:text-white text-xs uppercase tracking-widest font-bold">
          <LogOut className="w-4 h-4" /> Exit Admin
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-12 overflow-auto">
        <header className="flex justify-between items-center mb-12">
          <h2 className="text-4xl font-serif capitalize">{activeTab}</h2>
          <div className="flex gap-4">
            <button 
              onClick={async () => {
                if (!confirm('Seed sample data?')) return;
                try {
                  await addDoc(collection(db, 'services'), {
                    title: 'Wedding Planning',
                    description: 'Full-service luxury wedding planning from concept to completion.',
                    icon: 'Calendar',
                    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800'
                  });
                  await addDoc(collection(db, 'events'), {
                    title: 'Royal Garden Wedding',
                    description: 'A stunning outdoor ceremony with ceiling drapes and chandeliers.',
                    type: 'Wedding',
                    images: ['https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=800'],
                    tags: ['Gold', 'Luxury', 'Floral']
                  });
                  alert('Sample data seeded!');
                } catch (err) {
                  handleFirestoreError(err, OperationType.CREATE, 'seed');
                }
              }}
              className="px-6 py-3 border border-pearl-dark rounded-full text-xs uppercase tracking-widest font-bold hover:bg-pearl-dark hover:text-white transition-colors"
            >
              Seed Data
            </button>
            <button 
              onClick={() => {
                setFormData({});
                setImageFile(null);
                setVideoFile(null);
                setImagePreview(null);
                setVideoPreview(null);
                setUploadType('link');
                setIsModalOpen(true);
              }}
              className="bg-pearl-dark text-white px-6 py-3 rounded-full flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:bg-pearl-gold transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New
            </button>
          </div>
        </header>

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-pearl-dark/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-2xl rounded-3xl p-12 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-serif">Add New {activeTab.slice(0, -1)}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-pearl-cream rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
              
              <form onSubmit={handleAdd} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Title</label>
                  <input 
                    required
                    type="text" 
                    value={formData.title || ''}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all"
                  />
                </div>

                {activeTab === 'events' && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Event Type</label>
                    <select 
                      required
                      value={formData.type || ''}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                      className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all"
                    >
                      <option value="">Select Type</option>
                      <option value="Wedding">Wedding</option>
                      <option value="Kwanjula">Kwanjula</option>
                      <option value="Corporate">Corporate</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Description</label>
                  <textarea 
                    required
                    rows={4}
                    value={formData.description || formData.content || ''}
                    onChange={e => setFormData({...formData, [activeTab === 'blog' ? 'content' : 'description']: e.target.value})}
                    className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4 mb-6">
                  <button 
                    type="button"
                    onClick={() => setUploadType('link')}
                    className={`flex-1 py-3 rounded-xl text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-all ${uploadType === 'link' ? 'bg-pearl-dark text-white' : 'bg-pearl-cream text-pearl-dark/40'}`}
                  >
                    <LinkIcon className="w-4 h-4" /> Use Link
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUploadType('file')}
                    className={`flex-1 py-3 rounded-xl text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-all ${uploadType === 'file' ? 'bg-pearl-dark text-white' : 'bg-pearl-cream text-pearl-dark/40'}`}
                  >
                    <Upload className="w-4 h-4" /> Upload File
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">
                    {activeTab === 'blog' ? 'Main Image' : 'Image/Thumbnail'}
                  </label>
                  {uploadType === 'link' ? (
                    <input 
                      required
                      type="url" 
                      value={formData.image || ''}
                      onChange={e => setFormData({...formData, image: e.target.value})}
                      className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all"
                      placeholder="https://images.unsplash.com/..."
                    />
                  ) : (
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'image')}
                        className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-pearl-dark file:text-white hover:file:bg-pearl-gold cursor-pointer"
                      />
                    </div>
                  )}
                    {(formData.image || imagePreview) && (
                      <div className="mt-4 relative group">
                        <img src={imagePreview || formData.image} alt="Preview" className="w-full h-48 object-cover rounded-2xl border border-pearl-dark/5" referrerPolicy="no-referrer" />
                        <div className="absolute top-4 left-4 bg-pearl-dark/60 text-white px-3 py-1 rounded-full text-[8px] uppercase tracking-widest font-bold backdrop-blur-md">
                          {imagePreview ? 'Local Preview' : 'Link Preview'}
                        </div>
                      </div>
                    )}
                </div>

                {(activeTab === 'events' || activeTab === 'services') && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Video (Optional)</label>
                    {uploadType === 'link' ? (
                      <input 
                        type="url" 
                        value={formData.videoUrl || ''}
                        onChange={e => setFormData({...formData, videoUrl: e.target.value})}
                        className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all"
                        placeholder="https://youtube.com/... or direct video link"
                      />
                    ) : (
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="video/*"
                          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'videoUrl')}
                          className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-pearl-dark file:text-white hover:file:bg-pearl-gold cursor-pointer"
                        />
                      </div>
                    )}
                      {(formData.videoUrl || videoPreview) && (
                        <div className="mt-4 p-4 bg-pearl-cream/30 rounded-2xl">
                          <div className="flex items-center gap-3 mb-4">
                            <Video className="w-5 h-5 text-pearl-gold" />
                            <span className="text-xs truncate opacity-60">{videoPreview ? 'Local Video Selected' : formData.videoUrl}</span>
                          </div>
                          {videoPreview && (
                            <video src={videoPreview} className="w-full rounded-xl" controls />
                          )}
                        </div>
                      )}
                  </div>
                )}

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                      <span className="text-pearl-gold">{uploadStatus}</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="h-2 bg-pearl-cream rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-pearl-gold"
                      />
                    </div>
                  </div>
                )}

                <button 
                  disabled={uploading}
                  type="submit" 
                  className="w-full bg-pearl-dark text-white py-5 rounded-2xl font-serif text-xl hover:bg-pearl-gold transition-all shadow-lg shadow-pearl-dark/10 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {uploading ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : `Save ${activeTab.slice(0, -1)}`}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {activeTab === 'inquiries' && (
          <div className="space-y-6">
            {inquiries.map(inq => (
              <div key={inq.id} className="bg-white p-8 rounded-3xl shadow-sm border border-pearl-dark/5 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xl font-serif">{inq.name}</h4>
                    <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-widest font-bold ${inq.status === 'booked' ? 'bg-green-100 text-green-700' : inq.status === 'contacted' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {inq.status}
                    </span>
                  </div>
                  <p className="text-pearl-dark/40 text-xs mb-4">{inq.email} • {inq.phone || 'No phone'}</p>
                  <div className="flex gap-6 text-xs">
                    <div className="flex items-center gap-2 opacity-60"><Calendar className="w-3 h-3" /> {inq.eventDate}</div>
                    <div className="flex items-center gap-2 opacity-60"><User className="w-3 h-3" /> {inq.guestCount} guests</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateInquiryStatus(inq.id, 'contacted')} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="Mark Contacted"><Clock className="w-5 h-5" /></button>
                  <button onClick={() => updateInquiryStatus(inq.id, 'booked')} className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors" title="Mark Booked"><CheckCircle className="w-5 h-5" /></button>
                  <button onClick={() => deleteItem('inquiries', inq.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="grid grid-cols-2 gap-8">
            {events.map(e => (
              <div key={e.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-pearl-dark/5 group">
                <div className="aspect-video relative">
                  {e.videoUrl ? (
                    <video src={e.videoUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={e.images[0]} alt={e.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-0 bg-pearl-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button className="p-3 bg-white rounded-full text-pearl-dark hover:bg-pearl-gold hover:text-white transition-colors"><Edit className="w-5 h-5" /></button>
                    <button onClick={() => deleteItem('events', e.id)} className="p-3 bg-white rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  {e.videoUrl && (
                    <div className="absolute top-4 right-4 bg-pearl-gold p-2 rounded-full shadow-lg">
                      <Video className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h4 className="text-xl font-serif mb-1">{e.title}</h4>
                  <p className="text-xs uppercase tracking-widest text-pearl-gold font-bold">{e.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'services' && (
          <div className="grid grid-cols-3 gap-8">
            {services.map(s => (
              <div key={s.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-pearl-dark/5 group">
                <div className="aspect-square relative">
                  {s.videoUrl ? (
                    <video src={s.videoUrl} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={s.image} alt={s.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-0 bg-pearl-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button onClick={() => deleteItem('services', s.id)} className="p-3 bg-white rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  {s.videoUrl && (
                    <div className="absolute top-4 right-4 bg-pearl-gold p-2 rounded-full shadow-lg">
                      <Video className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h4 className="text-xl font-serif mb-1">{s.title}</h4>
                  <p className="text-xs opacity-60 line-clamp-2">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'blog' && (
          <div className="space-y-6">
            {blogPosts.map(p => (
              <div key={p.id} className="bg-white p-8 rounded-3xl shadow-sm border border-pearl-dark/5 flex gap-8 items-center">
                <img src={p.image} alt={p.title} className="w-32 h-32 rounded-2xl object-cover shrink-0" referrerPolicy="no-referrer" />
                <div className="flex-grow">
                  <h4 className="text-2xl font-serif mb-2">{p.title}</h4>
                  <p className="text-xs opacity-40 uppercase tracking-widest font-bold">{p.date} • By {p.author}</p>
                </div>
                <button onClick={() => deleteItem('blogPosts', p.id)} className="p-3 hover:bg-red-50 text-red-600 rounded-full transition-colors"><Trash2 className="w-6 h-6" /></button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="grid md:grid-cols-3 gap-8 h-[600px]">
            <div className="bg-white rounded-3xl shadow-sm border border-pearl-dark/5 overflow-y-auto p-4">
              <h4 className="text-xs uppercase tracking-widest font-bold opacity-40 mb-4 px-4">Conversations</h4>
              {/* Unique senders list */}
              {Array.from(new Set(inquiries.map(i => i.uid).filter(Boolean))).map(uid => {
                const inq = inquiries.find(i => i.uid === uid);
                return (
                  <button 
                    key={uid} 
                    onClick={() => setSelectedUser(uid as string)}
                    className={`w-full text-left p-4 rounded-2xl transition-all mb-2 ${selectedUser === uid ? 'bg-pearl-gold text-white' : 'hover:bg-pearl-cream'}`}
                  >
                    <p className="font-serif">{inq?.name || 'Client'}</p>
                    <p className={`text-[10px] uppercase tracking-widest ${selectedUser === uid ? 'text-white/60' : 'opacity-40'}`}>{inq?.email}</p>
                  </button>
                );
              })}
              {inquiries.length === 0 && <p className="text-center opacity-30 italic py-8">No clients yet.</p>}
            </div>
            <div className="md:col-span-2">
              {selectedUser ? (
                <MessagingSystem receiverId={selectedUser} senderName="Admin" />
              ) : (
                <div className="h-full flex items-center justify-center bg-white rounded-3xl border border-pearl-dark/5 opacity-30 italic">
                  Select a client to start messaging
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Client Portal ---

function ClientPortal({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [myInquiries, setMyInquiries] = useState<InquiryEntry[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')), (snap) => {
      setMyInquiries(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as InquiryEntry))
        .filter(i => i.uid === user.uid)
      );
    });
    return unsub;
  }, [user]);

  return (
    <div className="min-h-screen bg-pearl-cream p-12">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-16">
          <div>
            <h2 className="text-5xl font-serif italic mb-2">Welcome, {user?.displayName?.split(' ')[0]}</h2>
            <p className="text-pearl-dark/40 uppercase tracking-widest text-xs">Your Event Dashboard</p>
          </div>
          <button onClick={onBack} className="text-xs uppercase tracking-widest font-bold border-b border-pearl-dark/20 pb-1">Back to Site</button>
        </header>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-pearl-dark/5">
            <Clock className="w-8 h-8 text-pearl-gold mb-4" />
            <h4 className="text-2xl font-serif mb-1">{myInquiries.length}</h4>
            <p className="text-[10px] uppercase tracking-widest opacity-40">Total Inquiries</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-pearl-dark/5">
            <CheckCircle className="w-8 h-8 text-green-500 mb-4" />
            <h4 className="text-2xl font-serif mb-1">{myInquiries.filter(i => i.status === 'booked').length}</h4>
            <p className="text-[10px] uppercase tracking-widest opacity-40">Confirmed Events</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-pearl-dark/5">
            <Sparkles className="w-8 h-8 text-blue-500 mb-4" />
            <h4 className="text-2xl font-serif mb-1">Active</h4>
            <p className="text-[10px] uppercase tracking-widest opacity-40">Account Status</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="md:col-span-2">
            <h3 className="text-3xl font-serif mb-8">My Event Inquiries</h3>
            <div className="space-y-6">
              {myInquiries.map(inq => (
                <div key={inq.id} className="bg-white p-8 rounded-3xl shadow-sm border border-pearl-dark/5 flex justify-between items-center">
                  <div>
                    <h4 className="text-xl font-serif mb-1">{inq.eventDate}</h4>
                    <p className="text-xs text-pearl-dark/40 mb-4">{inq.interests.join(', ')}</p>
                    <div className={`inline-block px-4 py-1 rounded-full text-[8px] uppercase tracking-widest font-bold ${inq.status === 'booked' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {inq.status}
                    </div>
                  </div>
                  <button className="text-pearl-gold hover:text-pearl-dark transition-colors"><ChevronRight className="w-6 h-6" /></button>
                </div>
              ))}
              {myInquiries.length === 0 && (
                <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-pearl-dark/10">
                  <p className="opacity-40 italic">You haven't made any inquiries yet.</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-serif mb-8">Chat with Admin</h3>
            <MessagingSystem receiverId="admin" senderName={user?.displayName || 'Client'} />
          </div>
        </div>
      </div>
    </div>
  );
}
