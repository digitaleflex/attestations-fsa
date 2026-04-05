"use client";
import React, { useEffect, useState } from "react";
import {
  Library,
  BookOpen,
  Video,
  FileText,
  Link as LinkIcon,
  Search,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  PlusCircle,
  FileUp,
  AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ResourceType = "BOOK" | "VIDEO" | "REVISION_FILE" | "OTHER";

type Resource = {
  id: string;
  title: string;
  description?: string;
  type: ResourceType;
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
    type: "BOOK" as ResourceType,
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
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
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
      toast.success("✨ Ressource ajoutée avec succès !");
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
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/resources?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast.success("🗑️ Ressource supprimée");
      setResources(resources.filter(r => r.id !== id));
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/resources?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !currentStatus })
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      toast.success(!currentStatus ? "👁️ Ressource publiée" : "🕵️ Ressource masquée");
      setResources(resources.map(r => r.id === id ? { ...r, isPublished: !currentStatus } : r));
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message);
    }
  };

  const filtered = resources.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
             <div className="p-2 bg-primary/10 rounded-lg">
                <Library className="w-5 h-5 text-primary" />
             </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Bibliothèque Numérique</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Ressources de Formation</h1>
          <p className="text-slate-500 font-medium">Gérez le savoir et les supports pédagogiques diffusés aux apprenants.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Rechercher un support..."
              className="pl-10 w-[280px] bg-white border-slate-200 shadow-sm rounded-xl h-12 focus:ring-primary/20 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold gap-2 shadow-xl shadow-slate-200">
                <PlusCircle className="w-5 h-5" /> Nouveau Support
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-slate-900 p-8 text-white">
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <FileUp className="w-6 h-6 text-emerald-400" />
                   </div>
                   Publier un Support
                </DialogTitle>
                <p className="text-slate-400 mt-2 font-medium">Ajoutez un lien vers un manuel, une vidéo ou une fiche.</p>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold text-slate-700">Titre du document</Label>
                    <Input
                      required
                      placeholder="Indiquez un titre clair..."
                      className="rounded-xl h-12"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Catégorie</Label>
                    <Select value={formData.type} onValueChange={(v: ResourceType) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger className="rounded-xl h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOOK">📖 Manuel de cours</SelectItem>
                        <SelectItem value="VIDEO">🎬 Vidéo de démonstration</SelectItem>
                        <SelectItem value="REVISION_FILE">📝 Fiche de révision</SelectItem>
                        <SelectItem value="OTHER">📂 Autre ressource</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-slate-700">Thématique</Label>
                    <Input
                      placeholder="ex: Pisciculture"
                      className="rounded-xl h-12"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label className="font-bold text-slate-700">Lien du document (OneDrive, GDrive, YT...)</Label>
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
                    <Label className="font-bold text-slate-700">Présentation rapide</Label>
                    <Textarea
                      placeholder="Décrivez brièvement le contenu..."
                      className="rounded-xl min-h-[100px] resize-none"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="rounded-xl h-12 font-bold">Annuler</Button>
                  <Button type="submit" className="rounded-xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100">
                    Mettre en ligne
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-white/70 p-1.5 rounded-2xl border border-slate-200/60 backdrop-blur-md h-auto flex flex-wrap md:inline-flex shadow-sm">
            <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary h-11 px-6 font-bold flex gap-2 transition-all">Tous</TabsTrigger>
            <TabsTrigger value="BOOK" className="rounded-xl data-[state=active]:bg-white h-11 px-6 font-bold flex gap-2 transition-all"><BookOpen className="w-4 h-4" /> Manuels</TabsTrigger>
            <TabsTrigger value="VIDEO" className="rounded-xl data-[state=active]:bg-white h-11 px-6 font-bold flex gap-2 transition-all"><Video className="w-4 h-4" /> Vidéos</TabsTrigger>
            <TabsTrigger value="REVISION_FILE" className="rounded-xl data-[state=active]:bg-white h-11 px-6 font-bold flex gap-2 transition-all"><FileText className="w-4 h-4" /> Fiches</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 outline-none">
            {loading ? (
                <>
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </>
            ) : (
                <>
                    {filtered.map(res => (
                    <ResourceCard key={res.id} resource={res} onDelete={handleDelete} onToggle={handleTogglePublish} />
                    ))}
                    {filtered.length === 0 && <EmptyState />}
                </>
            )}
          </TabsContent>

          {["BOOK", "VIDEO", "REVISION_FILE"].map(type => (
            <TabsContent key={type} value={type} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 outline-none">
              {filtered.filter(r => r.type === type).map(res => (
                <ResourceCard key={res.id} resource={res} onDelete={handleDelete} onToggle={handleTogglePublish} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}

function ResourceCard({
    resource,
    onDelete,
    onToggle
}: {
    resource: Resource,
    onDelete: (id: string) => void,
    onToggle: (id: string, status: boolean) => void
}) {
  const Icon = resource.type === 'BOOK' ? BookOpen : resource.type === 'VIDEO' ? Video : FileText;
  const cardColor = resource.type === 'BOOK' ? 'from-blue-500 to-indigo-600' :
                    resource.type === 'VIDEO' ? 'from-rose-500 to-red-600' :
                    'from-emerald-500 to-teal-600';

  return (
    <Card className="group overflow-hidden border-none shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col bg-white rounded-[2.5rem] ring-1 ring-slate-100">
      <div className={`aspect-[16/9] bg-gradient-to-br ${cardColor} flex items-center justify-center relative overflow-hidden`}>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Icon className="w-16 h-16 text-white/40 group-hover:scale-125 group-hover:rotate-6 transition-transform duration-700" />

        {!resource.isPublished && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[2px] flex items-center justify-center z-10">
             <div className="flex flex-col items-center gap-2">
                <EyeOff className="w-8 h-8 text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Masqué du public</span>
             </div>
          </div>
        )}

        <div className="absolute top-6 left-6 z-20">
          <Badge className="bg-white/20 backdrop-blur-xl text-white border-white/30 text-[10px] font-black uppercase tracking-widest px-3 py-1">
            {resource.type}
          </Badge>
        </div>
      </div>

      <div className="p-8 space-y-5 flex-1 flex flex-col relative bg-white">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{resource.category || "FORMATION FSA"}</span>
            <span className="text-[10px] font-bold text-slate-400 italic">#{resource.id.slice(-4)}</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800 leading-[1.1] group-hover:text-primary transition-colors min-h-[3rem]">{resource.title}</h3>
        </div>

        <p className="text-slate-500 text-sm font-medium leading-relaxed line-clamp-3 mb-4">{resource.description || "Ce support pédagogique est indispensable pour valider les compétences de cette thématique."}</p>

        <div className="pt-6 mt-auto border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Button
                onClick={() => onToggle(resource.id, resource.isPublished)}
                variant="ghost"
                size="sm"
                className={`rounded-xl font-bold text-[10px] uppercase gap-2 transition-all ${resource.isPublished ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
             >
               {resource.isPublished ? <><Eye className="w-3.5 h-3.5" /> En ligne</> : <><EyeOff className="w-3.5 h-3.5" /> Masqué</>}
             </Button>
          </div>

          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-rose-50 hover:text-rose-600 group/trash transition-all">
                  <Trash2 className="w-4 h-4 transition-transform group-hover/trash:scale-110" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem] bg-white border-none shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-rose-600" />
                     </div>
                     Confirmer la suppression
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-500 font-medium py-4">
                    Êtes-vous certain de vouloir supprimer <strong>{resource.title}</strong> ? Cette action effacera définitivement le lien vers cette ressource pour tous les étudiants.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-xl border-none font-bold">Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(resource.id)} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-100">
                    Oui, supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button asChild size="sm" className="rounded-2xl bg-slate-900 hover:bg-primary text-white font-black gap-2 shadow-lg hover:shadow-primary/20 px-5 transition-all">
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" /> Explorer
              </a>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CardSkeleton() {
    return (
        <div className="aspect-[16/9] w-full bg-slate-100 animate-pulse rounded-[2.5rem]" />
    );
}

function EmptyState() {
  return (
    <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white/40 border-2 border-dashed border-slate-200 rounded-[3rem] backdrop-blur-sm">
      <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8 animate-bounce delay-700">
        <Library className="w-12 h-12 text-slate-200" />
      </div>
      <h3 className="text-2xl font-black text-slate-800">Votre bibliothèque est vide</h3>
      <p className="text-slate-500 font-medium mt-2 max-w-sm text-center">Inscrivez cette plateforme dans l&apos;excellence en ajoutant vos premiers supports de cours.</p>
    </div>
  );
}
