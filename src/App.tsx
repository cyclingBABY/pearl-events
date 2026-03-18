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
  Image as ImageIcon,
  Palette,
  Flower2,
  Utensils,
  Lightbulb,
  Layers,
  Armchair,
  CircleDot,
  Home,
  Grid3x3,
  Columns,
  Sofa,
  Square,
  Maximize,
  Briefcase,
  Store,
  Gift,
  Building2,
  Box,
  Ruler,
  Truck,
  ClipboardList
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
  limit,
  startAfter,
  getDocs,
  where,
  getDoc,
  setDoc,
  getDocFromServer,
  serverTimestamp,
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

interface GalleryItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  category?: string;
  title?: string;
  createdAt: Timestamp;
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
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
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

    const unsubGallery = onSnapshot(query(collection(db, 'gallery'), orderBy('createdAt', 'desc'), limit(20)), (snap) => {
      setGallery(snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'gallery'));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubEvents();
      unsubServices();
      unsubTestimonials();
      unsubBlog();
      unsubGallery();
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

      {/* Featured Grid */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[800px]">
            <div className="md:col-span-8 relative rounded-3xl overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=1200" alt="Featured" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-gradient-to-t from-pearl-dark/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-12">
                <div className="text-white">
                  <span className="text-pearl-gold uppercase tracking-widest text-[10px] mb-2 block">Signature Decor</span>
                  <h3 className="text-3xl font-serif">Floral Masterpieces</h3>
                </div>
              </div>
            </div>
            <div className="md:col-span-4 grid grid-rows-2 gap-4">
              <div className="relative rounded-3xl overflow-hidden group">
                <img src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800" alt="Featured" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" referrerPolicy="no-referrer" />
              </div>
              <div className="relative rounded-3xl overflow-hidden group">
                <img src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800" alt="Featured" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" referrerPolicy="no-referrer" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Slider */}
      <section id="services" className="py-32 px-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-20 gap-8">
            <div>
              <span className="text-pearl-gold uppercase tracking-[0.4em] text-[10px] font-bold mb-4 block">What We Offer</span>
              <h2 className="text-5xl md:text-7xl font-serif italic leading-tight">Our <span className="not-italic font-light">Exquisite</span> Services</h2>
            </div>
            <p className="max-w-md text-pearl-dark/50 text-sm leading-relaxed">
              From intimate gatherings to grand celebrations, we provide a comprehensive suite of services tailored to your unique vision.
            </p>
          </div>

          <ServiceSlider services={services} />
        </div>
      </section>

      {/* Brand Story */}
      <section className="py-32 px-6 bg-pearl-cream">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="relative">
            <div className="aspect-[3/4] rounded-[60px] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1510076857177-7470076d4098?auto=format&fit=crop&q=80&w=1000" alt="Brand Story" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-[40px] overflow-hidden border-8 border-pearl-cream hidden lg:block">
              <img src="https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&q=80&w=600" alt="Detail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          </div>
          <div className="space-y-8">
            <span className="text-pearl-gold uppercase tracking-[0.4em] text-xs font-bold">Our Philosophy</span>
            <h2 className="text-5xl md:text-6xl font-serif leading-tight">Where <span className="italic">Vision</span> Meets Reality.</h2>
            <p className="text-pearl-dark/70 leading-relaxed text-lg">
              At Pearl Events, we believe every celebration is a unique narrative waiting to be told. Our team of dedicated artisans and planners work tirelessly to transform your dreams into breathtaking realities, ensuring every detail reflects your personal style and elegance.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-pearl-dark/10">
              <div>
                <h4 className="text-3xl font-serif mb-2">15+</h4>
                <p className="text-[10px] uppercase tracking-widest opacity-50">Years of Excellence</p>
              </div>
              <div>
                <h4 className="text-3xl font-serif mb-2">500+</h4>
                <p className="text-[10px] uppercase tracking-widest opacity-50">Events Crafted</p>
              </div>
            </div>
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

      {/* Large Grid Gallery */}
      <GallerySection isAdmin={profile?.role === 'admin'} />

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

      {/* Instagram Feed */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-12 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-serif italic">Follow Our Journey</h2>
            <p className="text-pearl-dark/40 text-xs uppercase tracking-widest mt-2">@pearlevents_uganda</p>
          </div>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-widest font-bold border-b border-pearl-dark/20 pb-1">View Instagram</a>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar px-6">
          {[
            'https://images.unsplash.com/photo-1519225421980-715cb0215aed',
            'https://images.unsplash.com/photo-1511795409834-ef04bbd61622',
            'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
            'https://images.unsplash.com/photo-1519741497674-611481863552',
            'https://images.unsplash.com/photo-1510076857177-7470076d4098',
            'https://images.unsplash.com/photo-1520854221256-17451cc331bf'
          ].map((url, i) => (
            <div key={i} className="min-w-[250px] aspect-square rounded-2xl overflow-hidden group relative">
              <img src={`${url}?auto=format&fit=crop&q=80&w=500`} alt="Instagram" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 bg-pearl-dark/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Instagram className="w-6 h-6 text-white" />
              </div>
            </div>
          ))}
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

function ServiceIcon({ name, className = "w-6 h-6" }: { name: string, className?: string }) {
    const icons: { [key: string]: any } = {
      Palette, Flower2, Layout, Utensils, Lightbulb, Layers, Armchair, CircleDot,
      Home, Grid3x3, Columns, Sofa, Square, Maximize, Briefcase, Store, Gift,
      Building2, Box, Ruler, Truck, ClipboardList, Sparkles
    };
  const Icon = icons[name] || Sparkles;
  return <Icon className={className} />;
}

function ServiceSlider({ services }: { services: ServiceEntry[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const paginate = (newDirection: number) => {
    if (services.length === 0) return;
    setDirection(newDirection);
    setIndex((prev) => (prev + newDirection + services.length) % services.length);
  };

  if (services.length === 0) {
    return <p className="text-center opacity-30 italic w-full">No services listed yet.</p>;
  }

  const current = services[index];

  const IconComponent = (current.icon && (window as any).Lucide[current.icon]) || Sparkles;

  return (
    <div className="relative h-[600px] w-full group">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={index}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
          className="absolute inset-0 grid md:grid-cols-2 gap-12 items-center"
        >
          <div className="relative aspect-[4/5] md:aspect-square rounded-[40px] overflow-hidden shadow-2xl">
            <img 
              src={current.image} 
              alt={current.title} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-pearl-dark/40 to-transparent" />
          </div>
          
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <span className="w-12 h-[1px] bg-pearl-gold" />
              <span className="text-pearl-gold uppercase tracking-widest text-xs font-bold">Service {index + 1} of {services.length}</span>
            </div>
            <div className="flex items-center gap-4">
               <div className="p-3 bg-pearl-gold/10 rounded-2xl text-pearl-gold">
                  {/* We'll use a dynamic icon renderer here */}
                  <ServiceIcon name={current.icon} />
               </div>
               <h3 className="text-4xl md:text-6xl font-serif">{current.title}</h3>
            </div>
            <p className="text-pearl-dark/60 text-lg leading-relaxed max-w-lg">
              {current.description}
            </p>
            <div className="pt-8">
              <button className="px-8 py-3 bg-pearl-dark text-white rounded-full text-xs uppercase tracking-widest hover:bg-pearl-gold transition-all">
                Learn More
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute bottom-0 right-0 flex gap-4 z-20">
        <button 
          onClick={() => paginate(-1)}
          className="w-14 h-14 rounded-full border border-pearl-dark/10 flex items-center justify-center hover:bg-pearl-dark hover:text-white transition-all bg-white/80 backdrop-blur-sm"
        >
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
        <button 
          onClick={() => paginate(1)}
          className="w-14 h-14 rounded-full border border-pearl-dark/10 flex items-center justify-center hover:bg-pearl-dark hover:text-white transition-all bg-white/80 backdrop-blur-sm"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Progress Dots */}
      <div className="absolute -bottom-12 left-0 flex gap-2">
        {services.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > index ? 1 : -1);
              setIndex(i);
            }}
            className={`h-1 transition-all duration-500 rounded-full ${i === index ? 'w-12 bg-pearl-gold' : 'w-4 bg-pearl-dark/10'}`}
          />
        ))}
      </div>
    </div>
  );
}

function GallerySection({ isAdmin }: { isAdmin?: boolean }) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<GalleryItem>>({});

  const fetchItems = async (isFirst = false, category = 'All') => {
    setLoading(true);
    try {
      let q;
      if (category === 'All') {
        q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'), limit(24));
        if (!isFirst && lastDoc) {
          q = query(collection(db, 'gallery'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(24));
        }
      } else {
        q = query(collection(db, 'gallery'), where('category', '==', category), orderBy('createdAt', 'desc'), limit(24));
        if (!isFirst && lastDoc) {
          q = query(collection(db, 'gallery'), where('category', '==', category), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(24));
        }
      }
      
      const snap = await getDocs(q);
      const newItems = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as GalleryItem));
      if (isFirst) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...newItems]);
      }
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 24);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems(true, activeCategory);
  }, [activeCategory]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setLastDoc(null);
    setItems([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'gallery', id));
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'gallery');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await updateDoc(doc(db, 'gallery', editingItem.id), {
        ...editFormData,
        updatedAt: new Date().toISOString()
      });
      setItems(prev => prev.map(item => item.id === editingItem.id ? { ...item, ...editFormData } as GalleryItem : item));
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'gallery');
    }
  };

  return (
    <section id="gallery" className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-serif italic mb-4">The Grand Gallery</h2>
          <p className="text-pearl-dark/50 uppercase tracking-widest text-xs mb-12">A collection of thousands of moments</p>
          
          <div className="flex flex-wrap justify-center gap-4">
            {['All', 'Decor', 'Floral', 'Lighting', 'Furniture', 'Venue'].map(cat => (
              <button 
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${activeCategory === cat ? 'bg-pearl-dark text-white' : 'bg-pearl-cream text-pearl-dark hover:bg-pearl-dark/10'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
          {items.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: (index % 6) * 0.05 }}
              viewport={{ once: true }}
              className="aspect-square rounded-lg md:rounded-xl overflow-hidden relative group cursor-pointer bg-pearl-cream/30"
            >
              {item.type === 'video' ? (
                <video 
                  src={item.url} 
                  className="w-full h-full object-cover" 
                  muted 
                  loop 
                  onMouseOver={e => e.currentTarget.play()} 
                  onMouseOut={e => e.currentTarget.pause()} 
                />
              ) : (
                <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
              )}
              
              <div className="absolute inset-0 bg-pearl-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="flex justify-end gap-2">
                  {isAdmin && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem(item);
                          setEditFormData(item);
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 bg-white/90 rounded-full text-pearl-dark hover:bg-pearl-gold hover:text-white transition-all"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-2 bg-white/90 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-white text-[8px] uppercase tracking-widest font-bold">{item.category || 'Decor'}</p>
              </div>
            </motion.div>
          ))}
        </div>
        
        {hasMore && (
          <div className="mt-16 text-center">
            <button 
              onClick={() => fetchItems()}
              disabled={loading}
              className="px-12 py-4 border border-pearl-dark rounded-full text-xs uppercase tracking-widest hover:bg-pearl-dark hover:text-white transition-all disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More Moments'}
            </button>
          </div>
        )}
      </div>

      {/* Quick Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-pearl-dark/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-serif">Edit Gallery Item</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-pearl-cream rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Category</label>
                <select 
                  value={editFormData.category || ''}
                  onChange={e => setEditFormData({...editFormData, category: e.target.value})}
                  className="w-full bg-pearl-cream/50 px-4 py-3 rounded-xl outline-none focus:ring-1 ring-pearl-gold"
                >
                  <option value="Decor">Decor</option>
                  <option value="Floral">Floral</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Venue">Venue</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Title</label>
                <input 
                  type="text" 
                  value={editFormData.title || ''}
                  onChange={e => setEditFormData({...editFormData, title: e.target.value})}
                  className="w-full bg-pearl-cream/50 px-4 py-3 rounded-xl outline-none focus:ring-1 ring-pearl-gold"
                />
              </div>
              <button type="submit" className="w-full bg-pearl-dark text-white py-4 rounded-xl text-xs uppercase tracking-widest font-bold hover:bg-pearl-gold transition-colors">
                Save Changes
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </section>
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
  const [activeTab, setActiveTab] = useState<'inquiries' | 'events' | 'services' | 'blog' | 'messages' | 'gallery'>('inquiries');
  const [inquiries, setInquiries] = useState<InquiryEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPostEntry[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadType, setUploadType] = useState<'link' | 'file'>('link');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
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
    const unsubGallery = onSnapshot(query(collection(db, 'gallery'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setGallery(snap.docs.map(d => ({ id: d.id, ...d.data() } as GalleryItem)));
    });
    return () => { unsubInq(); unsubEvents(); unsubServices(); unsubBlog(); unsubGallery(); };
  }, []);

  const seedServices = async () => {
    if (!confirm('This will add all the predefined services. Continue?')) return;
    setUploading(true);
    setUploadStatus('Seeding services...');
    
    const servicesToSeed = [
      // Event & Wedding Decor
      { title: "Concept & Theme Design", description: "Visual storytelling and color palette selection.", icon: "Palette", image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed" },
      { title: "Floral Artistry", description: "Fresh/silk arrangements, centerpieces, and bridal bouquets.", icon: "Flower2", image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622" },
      { title: "Backdrops & Stages", description: "Custom photo booths, flower walls, and main stage setups.", icon: "Layout", image: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3" },
      { title: "Tablescaping", description: "Premium linens, charger plates, cutlery, and napkin styling.", icon: "Utensils", image: "https://images.unsplash.com/photo-1519741497674-611481863552" },
      { title: "Lighting Design", description: "Mood lighting, fairy lights, chandeliers, and neon signs.", icon: "Lightbulb", image: "https://images.unsplash.com/photo-1510076857177-7470076d4098" },
      { title: "Draping", description: "Wall masking and ceiling fabric installations.", icon: "Layers", image: "https://images.unsplash.com/photo-1520854221256-17451cc331bf" },
      { title: "Furniture Rental", description: "Specialty chairs (Chiavari, Dior), lounge sets, and props.", icon: "Armchair", image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3" },
      { title: "Balloon Art", description: "Organic arches, columns, and branded balloon decor.", icon: "CircleDot", image: "https://images.unsplash.com/photo-1530103043960-ef38714abb15" },
      // Interior & Home Styling
      { title: "Home Staging", description: "Decorating spaces to maximize appeal for real estate sales.", icon: "Home", image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7" },
      { title: "Wall Treatments", description: "Wallpaper installation, 3D panels, and textured painting.", icon: "Grid3x3", image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6" },
      { title: "Window Dressing", description: "Custom curtains, drapes, and motorized blinds.", icon: "Columns", image: "https://images.unsplash.com/photo-1513694203232-719a280e022f" },
      { title: "Soft Furnishings", description: "Custom cushions, rugs, and upholstery.", icon: "Sofa", image: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7" },
      { title: "Floor Finishes", description: "Carpeting, laminate flooring, and decorative rugs.", icon: "Square", image: "https://images.unsplash.com/photo-1581850518616-bcb8186c443e" },
      { title: "Gypsum Works", description: "Decorative ceilings and integrated lighting troughs.", icon: "Maximize", image: "https://images.unsplash.com/photo-1505691938895-1758d7eaa511" },
      // Corporate & Seasonal
      { title: "Brand Activations", description: "Themed decor for product launches and gala dinners.", icon: "Briefcase", image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678" },
      { title: "Exhibition Booths", description: "Custom stall design and styling for trade shows.", icon: "Store", image: "https://images.unsplash.com/photo-1497366216548-37526070297c" },
      { title: "Holiday Decor", description: "Christmas, Eid, or seasonal setups for malls and offices.", icon: "Gift", image: "https://images.unsplash.com/photo-1512389142860-9c449e58a543" },
      { title: "Office Styling", description: "Enhancing reception areas and boardrooms with plants and art.", icon: "Building2", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2" },
      // Technical & Support Services
      { title: "3D Visualisation", description: "Digital mock-ups of designs before execution.", icon: "Box", image: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e" },
      { title: "Site Surveys", description: "Space measurement and floor planning.", icon: "Ruler", image: "https://images.unsplash.com/photo-1503387762-592dee58c460" },
      { title: "Full Setup & Strike", description: "Professional installation and post-event teardown.", icon: "Truck", image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d" },
      { title: "Logistics Management", description: "Transport and coordination of decor inventory.", icon: "ClipboardList", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d" },
    ];

    try {
      for (const service of servicesToSeed) {
        await addDoc(collection(db, 'services'), {
          ...service,
          createdAt: serverTimestamp()
        });
      }
      setUploadStatus('Services seeded successfully!');
      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'services');
      setUploading(false);
    }
  };

  const seedGallery = async () => {
    if (!confirm('This will add sample images to the gallery. Continue?')) return;
    setUploading(true);
    setUploadStatus('Seeding gallery...');

    const galleryToSeed = [
      { url: "https://images.unsplash.com/photo-1519225421980-715cb0215aed", type: "image", category: "Decor", title: "Luxury Wedding Setup" },
      { url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622", type: "image", category: "Floral", title: "Elegant Table Centerpiece" },
      { url: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3", type: "image", category: "Lighting", title: "Ambient Event Lighting" },
      { url: "https://images.unsplash.com/photo-1519741497674-611481863552", type: "image", category: "Decor", title: "Outdoor Reception" },
      { url: "https://images.unsplash.com/photo-1510076857177-7470076d4098", type: "image", category: "Lighting", title: "Fairy Light Canopy" },
      { url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf", type: "image", category: "Decor", title: "Modern Stage Design" },
      { url: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3", type: "image", category: "Furniture", title: "Premium Lounge Area" },
      { url: "https://images.unsplash.com/photo-1530103043960-ef38714abb15", type: "image", category: "Decor", title: "Organic Balloon Arch" },
      { url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7", type: "image", category: "Furniture", title: "Contemporary Home Staging" },
      { url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6", type: "image", category: "Decor", title: "Textured Wall Treatment" },
      { url: "https://images.unsplash.com/photo-1513694203232-719a280e022f", type: "image", category: "Decor", title: "Custom Window Dressing" },
      { url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7", type: "image", category: "Furniture", title: "Bespoke Soft Furnishings" },
    ];

    try {
      for (const item of galleryToSeed) {
        await addDoc(collection(db, 'gallery'), {
          ...item,
          createdAt: serverTimestamp()
        });
      }
      setUploadStatus('Gallery seeded successfully!');
      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'gallery');
      setUploading(false);
    }
  };

  const seedEvents = async () => {
    if (!confirm('This will add sample events to the portfolio. Continue?')) return;
    setUploading(true);
    setUploadStatus('Seeding portfolio...');

    const eventsToSeed = [
      {
        title: 'Royal Garden Wedding',
        description: 'A stunning outdoor ceremony with ceiling drapes and chandeliers. We transformed a private estate into a fairy-tale garden with over 5,000 fresh blooms.',
        type: 'Wedding',
        images: ['https://images.unsplash.com/photo-1519225421980-715cb0215aed', 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622'],
        tags: ['Gold', 'Luxury', 'Floral'],
        date: '2025-06-15'
      },
      {
        title: 'Modern Corporate Gala',
        description: 'Sleek, minimalist design for a high-profile tech conference after-party. Featuring interactive LED walls and custom-built furniture.',
        type: 'Corporate',
        images: ['https://images.unsplash.com/photo-1464366400600-7168b8af9bc3', 'https://images.unsplash.com/photo-1510076857177-7470076d4098'],
        tags: ['Tech', 'Minimalist', 'Lighting'],
        date: '2025-09-22'
      },
      {
        title: 'Luxury Birthday Celebration',
        description: 'An intimate but extravagant 50th birthday party with a "Midnight in Paris" theme. Deep velvets and gold accents throughout.',
        type: 'Social',
        images: ['https://images.unsplash.com/photo-1519741497674-611481863552', 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3'],
        tags: ['Velvet', 'Gold', 'Intimate'],
        date: '2025-11-05'
      }
    ];

    try {
      for (const event of eventsToSeed) {
        await addDoc(collection(db, 'events'), {
          ...event,
          createdAt: serverTimestamp()
        });
      }
      setUploadStatus('Portfolio seeded successfully!');
      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'events');
      setUploading(false);
    }
  };

  const seedBlog = async () => {
    if (!confirm('This will add sample blog posts. Continue?')) return;
    setUploading(true);
    setUploadStatus('Seeding blog...');

    const blogToSeed = [
      {
        title: 'Planning the Perfect 2026 Wedding',
        excerpt: 'Discover the upcoming trends in luxury weddings, from sustainable decor to immersive guest experiences.',
        content: 'Full blog post content about wedding planning trends...',
        image: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed',
        author: 'Stuart Don',
        date: '2026-03-01',
        tags: ['Weddings', 'Trends', 'Planning']
      },
      {
        title: 'The Art of Event Lighting',
        excerpt: 'How the right lighting can transform a simple venue into an extraordinary atmosphere.',
        content: 'Detailed guide on event lighting techniques...',
        image: 'https://images.unsplash.com/photo-1510076857177-7470076d4098',
        author: 'Stuart Don',
        date: '2026-02-15',
        tags: ['Lighting', 'Design', 'Atmosphere']
      }
    ];

    try {
      for (const post of blogToSeed) {
        await addDoc(collection(db, 'blog'), {
          ...post,
          createdAt: serverTimestamp()
        });
      }
      setUploadStatus('Blog seeded successfully!');
      setTimeout(() => {
        setUploading(false);
        setUploadStatus('');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'blog');
      setUploading(false);
    }
  };

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

  const handleEdit = (item: any) => {
    setEditingItem(item);
    // Map specific fields for the modal
    const mappedData = { ...item };
    if (activeTab === 'gallery') {
      mappedData.image = item.url;
    }
    if (activeTab === 'events') {
      mappedData.image = item.images?.[0] || '';
    }
    setFormData(mappedData);
    setUploadType('link');
    setIsModalOpen(true);
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
    setUploading(true);
    setUploadProgress(0);
    setIndividualProgress({});
    
    try {
      const collectionName = activeTab === 'blog' ? 'blogPosts' : activeTab;
      
      // Handle Bulk Gallery Upload
      if (activeTab === 'gallery' && bulkFiles.length > 0) {
        setUploadStatus(`Uploading ${bulkFiles.length} items...`);
        const uploadPromises = bulkFiles.map(async (file, idx) => {
          const fileType = file.type.startsWith('video/') ? 'video' : 'image';
          const storageRef = ref(storage, `gallery/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          return new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
              (snap) => {
                const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
                setIndividualProgress(prev => ({ ...prev, [file.name]: progress }));
              },
              reject,
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, 'gallery'), {
                  url,
                  type: fileType,
                  category: formData.category || 'Decor',
                  title: file.name,
                  createdAt: new Date().toISOString()
                });
                resolve(url);
              }
            );
          });
        });
        await Promise.all(uploadPromises);
      } else {
        // Handle Single Item (Add or Edit)
        let data = { ...formData };
        
        if (uploadType === 'file') {
          const filesToUpload = [];
          if (imageFile) filesToUpload.push({ file: imageFile, field: 'image' as const });
          if (videoFile) filesToUpload.push({ file: videoFile, field: 'videoUrl' as const });

          if (filesToUpload.length > 0) {
            setUploadStatus(`Uploading ${filesToUpload.length} file(s)...`);
            const uploadPromises = filesToUpload.map(({ file, field }) => uploadFile(file, field));
            const urls = await Promise.all(uploadPromises);
            
            filesToUpload.forEach(({ field }, index) => {
              data[field] = urls[index];
            });
          }
        }

        if (activeTab === 'events') {
          data.images = [data.image];
          data.tags = data.tags?.split(',').map((t: string) => t.trim()) || [];
        }
        if (activeTab === 'blog') {
          data.date = data.date || new Date().toISOString().split('T')[0];
          data.author = data.author || 'Pearl Admin';
        }
        if (activeTab === 'gallery') {
          data.url = data.image || data.url;
          data.type = videoFile || data.videoUrl ? 'video' : 'image';
          delete data.image;
        }

        if (editingItem) {
          await updateDoc(doc(db, collectionName, editingItem.id), {
            ...data,
            updatedAt: Timestamp.now()
          });
        } else {
          await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        }
      }

      setUploadProgress(100);
      setUploadStatus('Success!');
      
      setTimeout(() => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
        setImageFile(null);
        setVideoFile(null);
        setBulkFiles([]);
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
      handleFirestoreError(err, OperationType.WRITE, activeTab);
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
              { id: 'gallery', icon: Camera, label: 'Gallery' },
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
          <div className="flex items-center gap-4">
            {activeTab === 'services' && (
              <button 
                onClick={seedServices}
                disabled={uploading}
                className="bg-pearl-gold/10 text-pearl-gold px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-pearl-gold hover:text-white transition-all disabled:opacity-50"
              >
                Seed Services
              </button>
            )}
            {activeTab === 'gallery' && (
              <button 
                onClick={seedGallery}
                disabled={uploading}
                className="bg-pearl-gold/10 text-pearl-gold px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-pearl-gold hover:text-white transition-all disabled:opacity-50"
              >
                Seed Gallery
              </button>
            )}
            {activeTab === 'events' && (
              <button 
                onClick={seedEvents}
                disabled={uploading}
                className="bg-pearl-gold/10 text-pearl-gold px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-pearl-gold hover:text-white transition-all disabled:opacity-50"
              >
                Seed Portfolio
              </button>
            )}
            {activeTab === 'blog' && (
              <button 
                onClick={seedBlog}
                disabled={uploading}
                className="bg-pearl-gold/10 text-pearl-gold px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-pearl-gold hover:text-white transition-all disabled:opacity-50"
              >
                Seed Blog
              </button>
            )}
            <button 
              onClick={() => {
                setEditingItem(null);
                setFormData({});
                setUploadType('link');
                setIsModalOpen(true);
              }}
              className="bg-pearl-dark text-white px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-pearl-gold transition-all flex items-center gap-2"
            >
              <Plus className="w-3 h-3" /> Add {
                activeTab === 'blog' ? 'Post' : 
                activeTab === 'gallery' ? 'Item' :
                activeTab === 'inquiries' ? 'Inquiry' :
                activeTab.slice(0, -1)
              }
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
                <h3 className="text-3xl font-serif">{editingItem ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}</h3>
                <button onClick={() => { setIsModalOpen(false); setEditingItem(null); setFormData({}); }} className="p-2 hover:bg-pearl-cream rounded-full transition-colors"><X className="w-6 h-6" /></button>
              </div>
              
              <form onSubmit={handleAdd} className="space-y-6">
                {activeTab === 'gallery' && !editingItem && (
                  <div className="p-12 border-2 border-dashed border-pearl-dark/10 rounded-3xl text-center bg-pearl-cream/20">
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,video/*" 
                      onChange={e => e.target.files && setBulkFiles(Array.from(e.target.files))}
                      className="hidden" 
                      id="bulk-upload" 
                    />
                    <label htmlFor="bulk-upload" className="cursor-pointer group">
                      <Upload className="w-12 h-12 text-pearl-gold mx-auto mb-4 group-hover:scale-110 transition-transform" />
                      <p className="text-sm font-bold uppercase tracking-widest">Select Multiple Photos/Videos</p>
                      <p className="text-[10px] text-pearl-dark/40 mt-2">Drag and drop or click to browse</p>
                      {bulkFiles.length > 0 && (
                        <div className="mt-4 p-3 bg-pearl-gold/10 rounded-xl text-pearl-gold text-[10px] font-bold uppercase tracking-widest">
                          {bulkFiles.length} files selected
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {(activeTab !== 'gallery' || editingItem) && (
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
                )}

                {activeTab === 'services' && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Icon Name (Lucide)</label>
                    <input 
                      required
                      type="text" 
                      value={formData.icon || ''}
                      onChange={e => setFormData({...formData, icon: e.target.value})}
                      className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all"
                      placeholder="Palette, Flower2, etc."
                    />
                  </div>
                )}

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

                {activeTab === 'gallery' && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Category</label>
                    <select 
                      required
                      value={formData.category || 'Decor'}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-pearl-cream/50 px-6 py-4 rounded-2xl outline-none focus:ring-1 ring-pearl-gold transition-all"
                    >
                      <option value="Decor">Decor</option>
                      <option value="Floral">Floral</option>
                      <option value="Lighting">Lighting</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Planning">Planning</option>
                    </select>
                  </div>
                )}

                {(activeTab !== 'gallery' || editingItem) && (
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
                )}

                {(activeTab !== 'gallery' || editingItem) && (
                  <>
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
                          value={formData.image || formData.url || ''}
                          onChange={e => setFormData({...formData, [activeTab === 'gallery' ? 'url' : 'image']: e.target.value})}
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
                        {(formData.image || formData.url || imagePreview) && (
                          <div className="mt-4 relative group">
                            <img src={imagePreview || formData.image || formData.url} alt="Preview" className="w-full h-48 object-cover rounded-2xl border border-pearl-dark/5" referrerPolicy="no-referrer" />
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
                  </>
                )}

                {uploading && (
                  <div className="space-y-4">
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
                    {Object.keys(individualProgress).length > 1 && (
                      <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                        {Object.entries(individualProgress).map(([name, prog]) => (
                          <div key={name} className="flex items-center gap-3">
                            <span className="text-[8px] uppercase tracking-widest opacity-40 truncate flex-grow">{name}</span>
                            <div className="w-24 h-1 bg-pearl-cream rounded-full overflow-hidden">
                              <div className="h-full bg-pearl-gold" style={{ width: `${prog}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                  ) : `${editingItem ? 'Update' : 'Save'} ${activeTab.slice(0, -1)}`}
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
                    <button onClick={() => handleEdit(e)} className="p-3 bg-white rounded-full text-pearl-dark hover:bg-pearl-gold hover:text-white transition-colors"><Edit className="w-5 h-5" /></button>
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

        {activeTab === 'gallery' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {gallery.map(item => (
              <div key={item.id} className="aspect-square relative group rounded-2xl overflow-hidden border border-pearl-dark/5 bg-white">
                {item.type === 'video' ? (
                  <video src={item.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )}
                <div className="absolute inset-0 bg-pearl-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => handleEdit(item)} className="p-2 bg-white rounded-full text-pearl-dark hover:bg-pearl-gold hover:text-white transition-colors"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => deleteItem('gallery', item.id)} className="p-2 bg-white rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-[8px] uppercase tracking-widest font-bold">
                  {item.category}
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
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(p)} className="p-3 hover:bg-pearl-cream text-pearl-dark rounded-full transition-colors"><Edit className="w-6 h-6" /></button>
                  <button onClick={() => deleteItem('blogPosts', p.id)} className="p-3 hover:bg-red-50 text-red-600 rounded-full transition-colors"><Trash2 className="w-6 h-6" /></button>
                </div>
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
