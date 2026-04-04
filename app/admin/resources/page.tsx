"use client";

import { useEffect, useState } from "react";
import { 
  Plus, 
  Library, 
  BookOpen, 
  Video, 
  FileText, 
  Link as LinkIcon,
  Search,
  MoreVertical,
  Trash2,
  ExternalLink,
  Tag,
  Eye,
  EyeOff,
  RefreshCcw,
  PlusCircle,
  FileUp,
  Image as ImageIcon
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Resource = {
  id: string;
  title: string;
  description?: string;
  type: "BOOK" | "VIDEO" | "REVISION_FILE" | "OTHER";
  url: string;
  thumbnail?: string;
  category?: string;
  isPublished: boolean;
  createdAt: string;
};

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "BOOK" as any,
    url: "",
    thumbnail: "",
    category: "",
    isPublished: true
  });

  const fetchResources = async () => {
    try {
      const res = await fetch("/api/admin/resources");
      if (!res.ok) throw new Error("Erreur lors de la récupération");
      const data = await res.json();
      setResources(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error("Erreur lors de la création");
      toast.success("Ressource ajoutée !");
      setIsAdding(false);
      setFormData({
        title: "",
        description: "",
        type: "BOOK",
        url: "",
        thumbnail: "",
        category: "",
        isPublished: true
      });
      fetchResources();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = resources.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Library className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Bibliothèque</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestion des Ressources</h1>
          <p className="text-slate-500 font-medium">Ajoutez et organisez les supports de formation pour les étudiants.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Rechercher une ressource..." 
              className="pl-10 w-[260px] bg-white border-slate-200 shadow-sm rounded-xl h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 shadow-xl shadow-slate-200">
                <PlusCircle className="w-5 h-5" /> Ajouter une ressource
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-slate-900 p-8 text-white">
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <FileUp className="w-6 h-6 text-emerald-400" />
                   </div>
                   Nouvelle Ressource
                </DialogTitle>
                <p className="text-slate-400 mt-2 font-medium">Diffusez un nouveau savoir dans la bibliothèque FSA.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold text-slate-700">Titre de la ressource</Label>
                    <Input 
                      required 
                      placeholder="Introduction à l'aquaponie..." 
                      className="rounded-xl h-12"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Type de média</Label>
                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                      <SelectTrigger className="rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOOK">Livre / Manuel</SelectItem>
                        <SelectItem value="VIDEO">Vidéo HD</SelectItem>
                        <SelectItem value="REVISION_FILE">Fiche de Révision</SelectItem>
                        <SelectItem value="OTHER">Autre document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Catégorie</Label>
                    <Input 
                      placeholder="ex: Pisciculture" 
                      className="rounded-xl h-12"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold text-slate-700">Lien URL (Google Drive, YouTube, Cloud...)</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        required 
                        placeholder="https://..." 
                        className="pl-10 rounded-xl h-12"
                        type="url"
                        value={formData.url}
                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold text-slate-700">Description courte</Label>
                    <Textarea 
                      placeholder="De quoi parle cette ressource ?" 
                      className="rounded-xl min-h-[100px] resize-none"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="rounded-xl h-12 font-bold">Annuler</Button>
                  <Button type="submit" className="rounded-xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100">
                    Publier la ressource
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-white/50 p-1.5 rounded-2xl border border-slate-200/60 backdrop-blur-sm h-auto flex flex-wrap md:inline-flex">
            <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary h-11 px-6 font-bold flex gap-2">Tous</TabsTrigger>
            <TabsTrigger value="BOOK" className="rounded-xl data-[state=active]:bg-white h-11 px-6 font-bold flex gap-2"><BookOpen className="w-4 h-4" /> Livres</TabsTrigger>
            <TabsTrigger value="VIDEO" className="rounded-xl data-[state=active]:bg-white h-11 px-6 font-bold flex gap-2"><Video className="w-4 h-4" /> Vidéos</TabsTrigger>
            <TabsTrigger value="REVISION_FILE" className="rounded-xl data-[state=active]:bg-white h-11 px-6 font-bold flex gap-2"><FileText className="w-4 h-4" /> Fiches</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 outline-none">
            {filtered.map(res => (
              <ResourceCard key={res.id} resource={res} onRefresh={fetchResources} />
            ))}
            {filtered.length === 0 && <EmptyState />}
          </TabsContent>
          
          {["BOOK", "VIDEO", "REVISION_FILE"].map(type => (
            <TabsContent key={type} value={type} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 outline-none">
              {filtered.filter(r => r.type === type).map(res => (
                <ResourceCard key={res.id} resource={res} onRefresh={fetchResources} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

function ResourceCard({ resource, onRefresh }: { resource: Resource, onRefresh: () => void }) {
  const Icon = resource.type === 'BOOK' ? BookOpen : resource.type === 'VIDEO' ? Video : FileText;
  
  return (
    <Card className="group overflow-hidden border-none shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col bg-white rounded-[2rem]">
      {/* Thumbnail Area */}
      <div className="aspect-[16/9] bg-slate-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Icon className="w-12 h-12 text-slate-300 group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute bottom-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
          <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 text-[10px] font-bold uppercase tracking-wider">
            {resource.type}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-4 flex-1 flex flex-col">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{resource.category || "Général"}</span>
            <div className="flex items-center gap-1">
              {resource.isPublished ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-rose-400" />}
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-primary transition-colors">{resource.title}</h3>
        </div>

        <p className="text-slate-500 text-sm font-medium line-clamp-2 flex-1">{resource.description || "Aucune description fournie."}</p>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
             <RefreshCcw className="w-3.5 h-3.5" />
             <span className="text-[10px] font-bold">Mis à jour le {new Date(resource.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button asChild size="sm" className="rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold gap-2">
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Ouvrir
              </a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/40 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
        <Library className="w-10 h-10 text-slate-200" />
      </div>
      <h3 className="text-xl font-bold text-slate-700">Aucune ressource pour le moment</h3>
      <p className="text-slate-400 font-medium">Commencez par ajouter votre premier cours ou manuel.</p>
    </div>
  );
}
