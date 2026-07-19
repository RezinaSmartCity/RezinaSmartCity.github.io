import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { Camera, MapPin, Loader2, Plus, CheckCircle } from 'lucide-react';
import {
  useListReports,
  useCreateReport,
  useVoteResolved,
  getListReportsQueryKey,
  type Report,
  ReportCategory,
  type ReportInputCategory,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Map configuration
const REZINA_COORDS: [number, number] = [47.7478, 28.9628];
const DEFAULT_ZOOM = 14;

// Colors for marker categories
const CATEGORY_COLORS: Record<string, string> = {
  [ReportCategory.parking]: '#E53935',
  [ReportCategory.tree]: '#43A047',
  [ReportCategory.electricity]: '#FFB300',
  [ReportCategory.road]: '#757575',
  [ReportCategory.water]: '#1E88E5',
  [ReportCategory.garbage]: '#8D6E63',
  [ReportCategory.other]: '#AB47BC',
};

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  [ReportCategory.parking]: { label: 'Parcare neregulamentară', icon: '🚗' },
  [ReportCategory.tree]: { label: 'Copac/Crengi căzute', icon: '🌳' },
  [ReportCategory.electricity]: { label: 'Probleme electricitate', icon: '⚡' },
  [ReportCategory.road]: { label: 'Drum deteriorat', icon: '🕳️' },
  [ReportCategory.water]: { label: 'Probleme apă', icon: '💧' },
  [ReportCategory.garbage]: { label: 'Gunoi/Depozitare ilegală', icon: '🗑️' },
  [ReportCategory.other]: { label: 'Altele', icon: '❓' },
};

// Generate a random fingerprint for voting
const getFingerprint = () => {
  let fp = localStorage.getItem('voter_fingerprint');
  if (!fp) {
    fp = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('voter_fingerprint', fp);
  }
  return fp;
};

// --- Custom Icons ---
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div class="user-location-pulse"></div><div class="user-location-dot"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const createReportIcon = (category: string, isResolved: boolean) => {
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return L.divIcon({
    className: 'custom-report-marker',
    html: `<div style="
      background-color: ${color}; 
      width: 24px; 
      height: 24px; 
      border-radius: 50%; 
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      opacity: ${isResolved ? 0.5 : 1};
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

export default function Home() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const reportMarkersRef = useRef<L.LayerGroup | null>(null);
  
  const [userLoc, setUserLoc] = useState<L.LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: reports, isLoading: isReportsLoading } = useListReports();
  const createReportMutation = useCreateReport();
  const voteResolvedMutation = useVoteResolved();

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Remove old maps if React strict mode double renders
    const container = L.DomUtil.get(mapRef.current);
    if (container != null && (container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    leafletMap.current = L.map(mapRef.current, {
      center: REZINA_COORDS,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMap.current);

    reportMarkersRef.current = L.layerGroup().addTo(leafletMap.current);

    // Geolocation Watch
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latlng = L.latLng(latitude, longitude);
        setUserLoc(latlng);
        setIsLocating(false);

        if (leafletMap.current) {
          if (!userMarkerRef.current) {
            userMarkerRef.current = L.marker(latlng, { icon: userLocationIcon }).addTo(leafletMap.current);
            // Center map on first fix only
            leafletMap.current.setView(latlng, 16);
          } else {
            userMarkerRef.current.setLatLng(latlng);
          }
        }
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setIsLocating(false);
        // Toast for permission denied
        if (err.code === err.PERMISSION_DENIED) {
          toast({
            description: "Permisiune GPS respinsă. Folosim locația generală.",
            variant: "default",
          });
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Sync Reports to Map
  useEffect(() => {
    if (!leafletMap.current || !reportMarkersRef.current || !reports) return;

    reportMarkersRef.current.clearLayers();

    reports.forEach((report) => {
      const isResolved = report.status === 'resolved';
      const marker = L.marker([report.latitude, report.longitude], {
        icon: createReportIcon(report.category, isResolved),
      });

      marker.on('click', () => {
        setSelectedReport(report);
      });

      if (reportMarkersRef.current) {
        marker.addTo(reportMarkersRef.current);
      }
    });
  }, [reports]);

  // Form State
  const [formCategory, setFormCategory] = useState<ReportInputCategory | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhoto, setFormPhoto] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategory || !formTitle || !formDesc) {
      toast({ description: "Completați câmpurile obligatorii.", variant: "destructive" });
      return;
    }
    if (formTitle.length < 3 || formDesc.length < 10) {
      toast({ description: "Titlul sau descrierea sunt prea scurte.", variant: "destructive" });
      return;
    }

    const lat = userLoc?.lat || REZINA_COORDS[0];
    const lng = userLoc?.lng || REZINA_COORDS[1];

    createReportMutation.mutate({
      data: {
        title: formTitle,
        description: formDesc,
        category: formCategory,
        latitude: lat,
        longitude: lng,
        photoBase64: formPhoto,
        reporterName: formName || undefined,
        reporterEmail: formEmail || undefined,
      }
    }, {
      onSuccess: () => {
        setIsDrawerOpen(false);
        setFormCategory(null);
        setFormTitle('');
        setFormDesc('');
        setFormPhoto(null);
        setFormName('');
        setFormEmail('');
        toast({ title: "Succes!", description: "Sesizarea a fost trimisă!" });
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Eroare", description: "Nu s-a putut trimite sesizarea.", variant: "destructive" });
      }
    });
  };

  const handleVoteResolved = (id: number) => {
    voteResolvedMutation.mutate({
      id,
      data: { voterFingerprint: getFingerprint() }
    }, {
      onSuccess: (updatedReport) => {
        setSelectedReport(updatedReport);
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() });
        toast({ description: "Vot înregistrat!" });
      },
      onError: () => {
        toast({ description: "Eroare la vot. Poate ai votat deja.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full z-0" />

      {/* FAB to report problem */}
      <div className="fixed bottom-[24px] right-[24px] z-[9999] flex items-center gap-2">
        {isLocating && (
          <div className="bg-background/80 text-foreground px-3 py-1 rounded-full text-xs flex items-center gap-2 backdrop-blur-sm shadow-md">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>GPS...</span>
          </div>
        )}
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="w-[60px] h-[60px] bg-[#E53935] hover:bg-[#E53935]/90 rounded-full flex items-center justify-center text-white shadow-[0_4px_16px_rgba(229,57,53,0.5)] transition-transform hover:scale-105 active:scale-95"
        >
          <Camera className="w-[28px] h-[28px] text-white" />
        </button>
      </div>

      {/* Report Form Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Raportează o problemă</DrawerTitle>
            <DrawerDescription>
              Informația va fi trimisă autorităților responsabile.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
            <form id="report-form" onSubmit={handleReportSubmit} className="space-y-6">
              
              <div className="space-y-3">
                <Label>Categoria (Obligatoriu)</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(CATEGORY_LABELS).map(([cat, { label, icon }]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat as ReportInputCategory)}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 border rounded-xl transition-all',
                        formCategory === cat
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border bg-card hover:bg-accent/10'
                      )}
                    >
                      <span className="text-2xl mb-1">{icon}</span>
                      <span className="text-xs text-center leading-tight line-clamp-2">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Titlu pe scurt (ex. Groapă periculoasă pe M. Eminescu)</Label>
                <Input 
                  id="title" 
                  value={formTitle} 
                  onChange={(e) => setFormTitle(e.target.value)} 
                  placeholder="Titlu sesizare..." 
                  required 
                  minLength={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Descriere detaliată</Label>
                <Textarea 
                  id="desc" 
                  value={formDesc} 
                  onChange={(e) => setFormDesc(e.target.value)} 
                  placeholder="Oferă mai multe detalii..." 
                  required 
                  minLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label>Adaugă o poză (Opțional)</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-accent/10 transition-colors">
                    {formPhoto ? (
                      <img src={formPhoto} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Plus className="w-8 h-8 text-muted-foreground" />
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {formPhoto && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormPhoto(null)}>
                      Șterge poza
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Locație</Label>
                <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 p-3 rounded-md border border-green-500/20">
                  <MapPin className="w-4 h-4" />
                  {userLoc ? "Locație GPS detectată ✓" : "Locație nedetectată. Vom folosi centrul orașului."}
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <p className="text-sm font-medium text-muted-foreground">Date de contact (Opțional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nume</Label>
                    <Input id="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ion Popescu" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="ion@exemplu.md" />
                  </div>
                </div>
              </div>

            </form>
          </div>
          <DrawerFooter className="pt-2">
            <Button 
              type="submit" 
              form="report-form" 
              className="w-full text-base font-semibold py-6"
              disabled={createReportMutation.isPending}
            >
              {createReportMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Trimite Sesizarea
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">Anulează</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Report Info Drawer / Bottom Sheet */}
      <Drawer open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DrawerContent className="max-h-[85vh]">
          {selectedReport && (
            <>
              <DrawerHeader className="text-left pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{CATEGORY_LABELS[selectedReport.category]?.icon}</span>
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {CATEGORY_LABELS[selectedReport.category]?.label}
                  </span>
                </div>
                <DrawerTitle className="text-xl">{selectedReport.title}</DrawerTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>{new Date(selectedReport.createdAt).toLocaleDateString('ro-MD')}</span>
                  {selectedReport.status === 'resolved' && (
                    <span className="bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-medium">Remediat</span>
                  )}
                </div>
              </DrawerHeader>
              <div className="p-4 overflow-y-auto">
                <div className="bg-accent/5 rounded-xl p-4 mb-4 text-sm leading-relaxed border border-border">
                  {selectedReport.description}
                </div>
                
                {selectedReport.photoBase64 && (
                  <div className="mb-6 rounded-xl overflow-hidden border border-border bg-black/20">
                    <img 
                      src={selectedReport.photoBase64} 
                      alt="Poză problemă" 
                      className="w-full h-auto max-h-64 object-contain"
                    />
                  </div>
                )}
                
                <div className="bg-card border rounded-xl p-4 flex flex-col items-center text-center space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm">
                      {selectedReport.resolvedVotes}/3 persoane au confirmat remedierea
                    </span>
                  </div>
                  
                  {selectedReport.status !== 'resolved' && (
                    <Button 
                      variant="secondary" 
                      className="w-full sm:w-auto"
                      onClick={() => handleVoteResolved(selectedReport.id)}
                      disabled={voteResolvedMutation.isPending}
                    >
                      {voteResolvedMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Confirmă remedierea ✓
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

    </div>
  );
}
