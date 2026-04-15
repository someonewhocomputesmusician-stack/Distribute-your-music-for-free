import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  Upload, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Globe, 
  LogOut, 
  ChevronRight,
  Image as ImageIcon,
  FileAudio,
  LayoutDashboard,
  Send,
  ExternalLink,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { Release, Track, PLATFORMS } from './types';

const CustomSwitch = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: () => void }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onCheckedChange();
    }}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-accent' : 'bg-border'}`}
  >
    <span
      className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`}
    />
  </button>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<Release[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCreating, setIsCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const trackInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Form State
  const [newRelease, setNewRelease] = useState<Partial<Release>>({
    title: '',
    artist: '',
    genre: '',
    releaseDate: '',
    tracks: [],
    platforms: [],
    status: 'draft',
    artworkUrl: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'releases'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Release));
      setReleases(docs);
    }, (error) => {
      console.error("Firestore Error:", error);
      toast.error("Failed to load releases");
    });

    return unsubscribe;
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Logged in successfully");
    } catch (error) {
      console.error(error);
      toast.error("Login failed");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(prev => ({ ...prev, artwork: true }));
    try {
      const storageRef = ref(storage, `users/${user.uid}/artwork/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setNewRelease(prev => ({ ...prev, artworkUrl: url }));
      toast.success("Artwork uploaded");
    } catch (error) {
      console.error(error);
      toast.error("Artwork upload failed");
    } finally {
      setUploading(prev => ({ ...prev, artwork: false }));
    }
  };

  const handleTrackFileUpload = async (trackId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(prev => ({ ...prev, [trackId]: true }));
    try {
      const storageRef = ref(storage, `users/${user.uid}/tracks/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setNewRelease(prev => ({
        ...prev,
        tracks: prev.tracks?.map(t => t.id === trackId ? { ...t, fileName: file.name, fileUrl: url } : t)
      }));
      toast.success(`Track "${file.name}" uploaded`);
    } catch (error) {
      console.error(error);
      toast.error("Track upload failed");
    } finally {
      setUploading(prev => ({ ...prev, [trackId]: false }));
    }
  };

  const handleCreateRelease = async () => {
    if (!user) return;
    if (!newRelease.title || !newRelease.artist) {
      toast.error("Title and Artist are required");
      return;
    }
    if (!newRelease.artworkUrl) {
      toast.error("Please upload cover artwork");
      return;
    }
    if (!newRelease.tracks || newRelease.tracks.length === 0) {
      toast.error("Please add at least one track");
      return;
    }
    if (newRelease.tracks.some(t => !t.fileUrl)) {
      toast.error("Please upload all audio files");
      return;
    }

    try {
      await addDoc(collection(db, 'releases'), {
        ...newRelease,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'submitted'
      });
      toast.success("Release submitted successfully");
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit release");
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setIsSubmitted(false);
    setCurrentStep(0);
    setNewRelease({
      title: '',
      artist: '',
      genre: '',
      releaseDate: '',
      tracks: [],
      platforms: [],
      status: 'draft',
      artworkUrl: ''
    });
  };

  const handleDeleteRelease = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'releases', id));
      toast.success("Release deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete release");
    }
  };

  const addTrack = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setNewRelease(prev => ({
      ...prev,
      tracks: [...(prev.tracks || []), { id, title: '', fileName: '' }]
    }));
  };

  const removeTrack = (id: string) => {
    setNewRelease(prev => ({
      ...prev,
      tracks: prev.tracks?.filter(t => t.id !== id)
    }));
  };

  const updateTrack = (id: string, field: keyof Track, value: string) => {
    setNewRelease(prev => ({
      ...prev,
      tracks: prev.tracks?.map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };

  const togglePlatform = (platformId: string) => {
    setNewRelease(prev => {
      const platforms = prev.platforms || [];
      if (platforms.includes(platformId)) {
        return { ...prev, platforms: platforms.filter(p => p !== platformId) };
      } else {
        return { ...prev, platforms: [...platforms, platformId] };
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Music className="w-12 h-12 text-orange-500" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-md"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-orange-500/10 rounded-full">
              <Music className="w-16 h-16 text-orange-500" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tighter text-white">NetPie Distro</h1>
            <p className="text-zinc-400 text-lg">Professional music distribution for independent creators.</p>
          </div>
          <Button 
            onClick={handleLogin}
            size="lg" 
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-6 text-lg rounded-xl transition-all hover:scale-105"
          >
            Get Started with Google
          </Button>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">Secure • Fast • Global</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text font-sans flex flex-col overflow-hidden h-screen">
      <Toaster position="top-center" theme="dark" />
      {/* Header */}
      <header className="h-[60px] px-4 md:px-6 border-b border-border flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-accent" />
          <span className="font-extrabold text-[16px] md:text-[18px] tracking-wider text-accent uppercase truncate">NetPie Distro</span>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden lg:flex items-center gap-5 text-[11px] uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
              <span>Firebase Cloud: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-dim">Session:</span>
              <span className="font-mono">NP-{user.uid.slice(0, 4).toUpperCase()}-{Math.floor(Math.random() * 9000) + 1000}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4 md:pl-6 md:border-l md:border-border">
            <div className="flex items-center gap-2">
              <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full border border-border" />
              <span className="text-xs font-medium hidden sm:inline">{user.displayName?.split(' ')[0]}</span>
            </div>
            <button onClick={handleLogout} className="text-text-dim hover:text-white transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {isSubmitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-8"
            >
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Release Submitted!</h2>
                <p className="text-text-dim">Your assets are stored on NetPie Cloud. Now, proceed to manually upload to your selected platforms.</p>
              </div>

              <div className="w-full grid grid-cols-1 gap-3">
                {PLATFORMS.filter(p => newRelease.platforms?.includes(p.id)).map(platform => (
                  <a 
                    key={platform.id}
                    href={platform.uploadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg hover:border-accent transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-accent" />
                      <span className="font-bold uppercase tracking-wider text-sm">{platform.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Go to Upload <ExternalLink className="w-3 h-3" />
                    </div>
                  </a>
                ))}
              </div>

              <Button 
                onClick={resetForm}
                variant="outline" 
                className="border-border hover:bg-surface uppercase tracking-widest text-xs h-12 px-8"
              >
                Return to Dashboard
              </Button>
            </motion.div>
          ) : isCreating ? (
            <motion.div
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              {/* Step Indicator */}
              <div className="flex items-center justify-center gap-4 py-4 border-b border-border bg-surface/30 shrink-0 overflow-x-auto px-4">
                {[0, 1, 2].map(s => (
                  <div key={s} className="flex items-center gap-2 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${currentStep >= s ? 'bg-accent text-white' : 'bg-border text-text-dim'}`}>
                      {s + 1}
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest font-bold transition-colors hidden sm:inline ${currentStep >= s ? 'text-white' : 'text-text-dim'}`}>
                      {s === 0 ? 'Metadata' : s === 1 ? 'Assets' : 'Distribution'}
                    </span>
                    {s < 2 && <div className={`w-4 sm:w-8 h-[1px] mx-1 sm:mx-2 transition-colors ${currentStep > s ? 'bg-accent' : 'bg-border'}`} />}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {currentStep === 0 && (
                    <motion.section 
                      key="step0"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full high-density-section max-w-2xl mx-auto w-full"
                    >
                      <h2>Release Metadata</h2>
                      <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                          <Label>Release Title</Label>
                          <Input 
                            placeholder="e.g. Midnight Echoes" 
                            value={newRelease.title}
                            onChange={(e) => setNewRelease(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Primary Artist</Label>
                          <Input 
                            placeholder="e.g. DJ Pie" 
                            value={newRelease.artist}
                            onChange={(e) => setNewRelease(prev => ({ ...prev, artist: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Label</Label>
                          <Input 
                            placeholder="NetPie Records" 
                            defaultValue="Independent - NetPie Records"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <Label>Genre</Label>
                            <Select 
                              value={newRelease.genre}
                              onValueChange={(v) => setNewRelease(prev => ({ ...prev, genre: v }))}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent className="bg-surface border-border text-white">
                                <SelectItem value="electronic">Electronic</SelectItem>
                                <SelectItem value="hiphop">Hip Hop</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="rock">Rock</SelectItem>
                                <SelectItem value="jazz">Jazz</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Release Date</Label>
                            <Input 
                              type="date" 
                              className="h-9"
                              value={newRelease.releaseDate}
                              onChange={(e) => setNewRelease(prev => ({ ...prev, releaseDate: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>ISRC Code</Label>
                          <Input 
                            readOnly 
                            className="font-mono text-[10px] text-text-dim bg-surface/50" 
                            value={`QM-GHL-24-${Math.floor(Math.random() * 90000) + 10000}`}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>UPC/EAN</Label>
                          <Input 
                            readOnly 
                            className="font-mono text-[10px] text-text-dim bg-surface/50" 
                            value={`5060${Math.floor(Math.random() * 90000000) + 10000000}`}
                          />
                        </div>
                      </div>
                    </motion.section>
                  )}

                  {currentStep === 1 && (
                    <motion.section 
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full high-density-section max-w-2xl mx-auto w-full"
                    >
                      <h2>Assets & Uploads</h2>
                      <div className="space-y-6">
                        <input 
                          type="file" 
                          accept="*/*" 
                          className="hidden" 
                          ref={artworkInputRef}
                          onChange={handleArtworkUpload}
                        />
                        <div 
                          onClick={() => !uploading.artwork && artworkInputRef.current?.click()}
                          className="aspect-square max-w-[300px] mx-auto border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 bg-surface hover:border-accent/50 transition-colors cursor-pointer group overflow-hidden relative"
                        >
                          {newRelease.artworkUrl ? (
                            <img src={newRelease.artworkUrl} alt="Artwork" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center">
                              {uploading.artwork ? (
                                <Loader2 className="w-8 h-8 text-accent mx-auto mb-2 animate-spin" />
                              ) : (
                                <ImageIcon className="w-8 h-8 text-text-dim mx-auto mb-2 group-hover:text-accent transition-colors" />
                              )}
                              <div className="text-[11px] font-bold uppercase tracking-wider">
                                {uploading.artwork ? 'Uploading...' : 'Cover Artwork'}
                              </div>
                              <div className="text-[10px] text-text-dim mt-1 text-center">Any image format supported</div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h2>Tracks ({newRelease.tracks?.length || 0})</h2>
                            <Button onClick={addTrack} size="sm" variant="outline" className="h-7 text-[10px] uppercase tracking-wider border-border hover:bg-surface">
                              <Plus className="w-3 h-3 mr-1" /> Add Track
                            </Button>
                          </div>
                          
                          <div className="space-y-2">
                            {newRelease.tracks?.map((track, idx) => (
                              <div key={track.id} className="bg-surface p-3 rounded border border-border/50 grid grid-cols-[24px_1fr_60px] items-center gap-3">
                                <div className="font-mono text-[11px] text-text-dim">{(idx + 1).toString().padStart(2, '0')}</div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      className="bg-transparent border-none p-0 text-[12px] font-medium w-full focus:ring-0"
                                      placeholder="Track Title"
                                      value={track.title}
                                      onChange={(e) => updateTrack(track.id, 'title', e.target.value)}
                                    />
                                    <input 
                                      type="file" 
                                      accept="*/*" 
                                      className="hidden" 
                                      ref={el => trackInputRefs.current[track.id] = el}
                                      onChange={(e) => handleTrackFileUpload(track.id, e)}
                                    />
                                    <button 
                                      onClick={() => !uploading[track.id] && trackInputRefs.current[track.id]?.click()}
                                      className={`transition-colors ${track.fileUrl ? 'text-green-500' : 'text-text-dim hover:text-accent'}`}
                                    >
                                      {uploading[track.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                    </button>
                                    <button onClick={() => removeTrack(track.id)} className="text-text-dim hover:text-red-500">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="h-1 bg-border rounded-full mt-2 overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-500 ${track.fileUrl ? 'bg-green-500 w-full' : 'bg-accent w-0'}`}
                                      style={{ width: track.fileUrl ? '100%' : uploading[track.id] ? '50%' : '0%' }}
                                    ></div>
                                  </div>
                                </div>
                                <div className={`text-right text-[11px] font-bold ${track.fileUrl ? 'text-green-500' : 'text-accent'}`}>
                                  {track.fileUrl ? '100%' : uploading[track.id] ? '...' : '0%'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.section>
                  )}

                  {currentStep === 2 && (
                    <motion.section 
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="h-full high-density-section max-w-2xl mx-auto w-full"
                    >
                      <h2>Select Platforms</h2>
                      <ScrollArea className="flex-1 -mx-2 px-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PLATFORMS.map(platform => (
                            <div 
                              key={platform.id} 
                              className={`relative flex flex-col p-2.5 rounded border transition-all cursor-pointer group ${
                                newRelease.platforms?.includes(platform.id) 
                                  ? 'bg-accent/5 border-accent' 
                                  : 'bg-surface border-border hover:border-text-dim/50'
                              }`}
                              onClick={() => togglePlatform(platform.id)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold truncate pr-2">{platform.name}</span>
                                <CustomSwitch 
                                  checked={newRelease.platforms?.includes(platform.id) || false}
                                  onCheckedChange={() => togglePlatform(platform.id)}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between mt-auto">
                                <a 
                                  href={platform.uploadUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[9px] text-text-dim hover:text-accent flex items-center gap-1 transition-colors uppercase font-bold"
                                >
                                  Upload <ExternalLink className="w-2 h-2" />
                                </a>
                              </div>

                              <div className="absolute top-1 right-1 opacity-[0.03] pointer-events-none select-none">
                                <span className="text-xl font-black italic">{platform.name.split(' ')[0]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      
                      <div className="mt-auto p-3 bg-surface rounded border border-border text-[11px] leading-relaxed">
                        <span className="text-accent font-bold uppercase tracking-wider mr-1">ℹ Notification:</span>
                        <span className="text-text-dim">Manual distribution selected. Ensure you have owner access to artist dashboards for verification.</span>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <footer className="h-auto min-h-[70px] py-4 bg-surface border-t border-border px-6 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (currentStep === 0) setIsCreating(false);
                      else setCurrentStep(prev => prev - 1);
                    }}
                    className="border-border hover:bg-bg uppercase tracking-widest text-[10px] h-10 px-6"
                  >
                    {currentStep === 0 ? 'Cancel' : 'Back'}
                  </Button>
                  {currentStep > 0 && (
                    <span className="text-[10px] text-text-dim uppercase tracking-widest font-bold hidden sm:inline">
                      Step {currentStep + 1} of 3
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {currentStep < 2 ? (
                    <Button 
                      onClick={() => {
                        if (currentStep === 0) {
                          if (!newRelease.title || !newRelease.artist) {
                            toast.error("Please fill in title and artist");
                            return;
                          }
                        }
                        if (currentStep === 1) {
                          if (!newRelease.artworkUrl) {
                            toast.error("Please upload cover artwork");
                            return;
                          }
                          if (!newRelease.tracks || newRelease.tracks.length === 0) {
                            toast.error("Please add at least one track");
                            return;
                          }
                          const allUploaded = newRelease.tracks.every(t => t.fileUrl);
                          if (!allUploaded) {
                            toast.error("Please wait for all tracks to upload");
                            return;
                          }
                        }
                        setCurrentStep(prev => prev + 1);
                      }}
                      className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-bold h-11 px-10 rounded-sm text-[12px] uppercase tracking-widest"
                    >
                      Next Step <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleCreateRelease}
                      className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-bold h-11 px-10 rounded-sm text-[12px] uppercase tracking-widest"
                    >
                      Distribute Release
                    </Button>
                  )}
                </div>
              </footer>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full overflow-y-auto p-4 md:p-8 space-y-8 max-w-6xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Console / Dashboard</h1>
                  <p className="text-text-dim text-xs md:text-sm uppercase tracking-widest mt-1">Active Session: {user.displayName}</p>
                </div>
                <Button 
                  onClick={() => setIsCreating(true)}
                  className="w-full sm:w-auto bg-accent hover:bg-accent/90 rounded-sm px-8 h-12 font-bold uppercase tracking-widest"
                >
                  <Plus className="w-5 h-5 mr-2" /> New Release
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 bg-border border border-border">
                <div className="bg-bg p-6">
                  <p className="text-[10px] uppercase tracking-[2px] text-text-dim font-bold mb-1">Total Catalog</p>
                  <p className="text-4xl font-mono font-bold text-white">{releases.length.toString().padStart(2, '0')}</p>
                </div>
                <div className="bg-bg p-6">
                  <p className="text-[10px] uppercase tracking-[2px] text-text-dim font-bold mb-1">Pending Review</p>
                  <p className="text-4xl font-mono font-bold text-accent">
                    {releases.filter(r => r.status === 'submitted').length.toString().padStart(2, '0')}
                  </p>
                </div>
                <div className="bg-bg p-6 sm:col-span-2 lg:col-span-1">
                  <p className="text-[10px] uppercase tracking-[2px] text-text-dim font-bold mb-1">Live Assets</p>
                  <p className="text-4xl font-mono font-bold text-green-500">
                    {releases.filter(r => r.status === 'distributed').length.toString().padStart(2, '0')}
                  </p>
                </div>
              </div>

              {/* Catalog Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-[12px] uppercase tracking-[2px] text-text-dim font-bold">Recent Activity</h3>
                </div>

                {releases.length === 0 ? (
                  <div className="text-center py-24 bg-surface/30 border border-border rounded-sm">
                    <Music className="w-12 h-12 text-border mx-auto mb-4" />
                    <p className="text-text-dim text-sm uppercase tracking-widest">No assets found in current session</p>
                    <Button 
                      onClick={() => setIsCreating(true)}
                      variant="outline" 
                      className="mt-6 border-border hover:bg-surface text-[11px] uppercase tracking-widest"
                    >
                      Initialize First Release
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1 bg-border border border-border">
                    {releases.map(release => (
                       <div key={release.id} className="bg-bg p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 hover:bg-surface transition-colors group">
                         <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                           <div className="w-12 h-12 sm:w-16 sm:h-16 bg-surface rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden border border-border group-hover:border-accent/50 transition-colors">
                             {release.artworkUrl ? (
                               <img src={release.artworkUrl} alt="" className="w-full h-full object-cover" />
                             ) : (
                               <Music className="w-5 h-5 sm:w-6 sm:h-6 text-border" />
                             )}
                           </div>
                           
                           <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-[13px] sm:text-[14px] uppercase tracking-wide truncate">{release.title}</h4>
                             <p className="text-text-dim text-[10px] sm:text-[11px] uppercase tracking-wider truncate">{release.artist}</p>
                             <div className="flex items-center gap-3 sm:gap-4 mt-1.5 sm:mt-2">
                               <span className="text-[8px] sm:text-[9px] font-mono text-text-dim bg-surface px-1.5 py-0.5 rounded border border-border">
                                 {release.genre.toUpperCase()}
                               </span>
                               <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-text-dim uppercase font-bold">
                                 <Clock className="w-2.5 h-2.5" />
                                 {release.releaseDate}
                               </div>
                             </div>
                           </div>
                         </div>

                         <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 sm:gap-1.5 min-w-0 sm:min-w-[120px]">
                           <div className="flex items-center gap-2">
                             {release.status === 'draft' && <span className="text-[8px] sm:text-[9px] uppercase font-bold px-2 py-0.5 bg-border text-text-dim rounded-full">Draft</span>}
                             {release.status === 'submitted' && <span className="text-[8px] sm:text-[9px] uppercase font-bold px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Submitted</span>}
                             {release.status === 'processing' && <span className="text-[8px] sm:text-[9px] uppercase font-bold px-2 py-0.5 bg-accent/20 text-accent rounded-full">Processing</span>}
                             {release.status === 'distributed' && <span className="text-[8px] sm:text-[9px] uppercase font-bold px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Live</span>}
                           </div>
                           <p className="text-[8px] sm:text-[9px] text-text-dim uppercase font-bold tracking-tighter">{release.platforms.length} Platforms</p>
                         </div>

                         <div className="flex items-center justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity border-t sm:border-t-0 border-border pt-3 sm:pt-0">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => release.id && handleDeleteRelease(release.id)}
                            className="text-text-dim hover:text-red-500 h-8 w-8"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-text-dim hover:text-accent h-8 w-8">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
