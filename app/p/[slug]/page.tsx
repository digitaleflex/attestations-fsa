import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Award, 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Share2, 
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Mail
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentUrl = `https://fsa-portal.vercel.app/p/${slug}`; // Replace with your domain logic

  const user = await prisma.user.findFirst({
    where: { 
      portfolioSlug: slug,
      portfolioEnabled: true 
    },
    include: {
      attestations: {
        where: { status: 'VALIDATED' },
        include: { formation: true },
        orderBy: { issuedAt: 'desc' }
      },
      formation: true
    }
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header / Banner */}
      <div className="h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-32 relative z-10 pb-20">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Profile Sidebar */}
          <aside className="w-full md:w-80 space-y-6">
            <Card className="p-8 border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] bg-white text-center">
              <div className="relative inline-block mb-6">
                <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-tr from-emerald-100 to-blue-50 flex items-center justify-center text-4xl font-black text-emerald-600 border-4 border-white shadow-xl">
                  {user.name?.charAt(0)}
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100">
                   <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
              </div>

              <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">{user.name}</h1>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-4 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest mb-6">
                 Profil Vérifié FSA
              </Badge>

              <div className="space-y-4 text-left pt-6 border-t border-slate-50">
                 <div className="flex items-center gap-3 text-slate-500">
                    <MapPin className="w-4 h-4 text-slate-300" />
                    <span className="text-sm font-medium">{user.address || "Cameroun"}</span>
                 </div>
                 <div className="flex items-center gap-3 text-slate-500">
                    <Calendar className="w-4 h-4 text-slate-300" />
                    <span className="text-sm font-medium italic">Inscrit en {format(new Date(user.createdAt), 'MMMM yyyy', { locale: fr })}</span>
                 </div>
                 {user.formation && (
                   <div className="flex items-center gap-3 text-slate-500">
                      <GraduationCap className="w-4 h-4 text-slate-300" />
                      <span className="text-sm font-bold text-slate-700">{user.formation.name}</span>
                   </div>
                 )}
              </div>

              <div className="flex flex-col gap-3 mt-8">
                <button className="w-full bg-slate-900 text-white rounded-2xl py-3 font-bold text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                   <Share2 className="w-4 h-4" /> Partager le profil
                </button>
                <Link href={`mailto:${user.email}?subject=Opportunité professionnelle via FSA&body=Bonjour ${user.name},`} className="w-full">
                  <button className="w-full bg-emerald-500 text-white rounded-2xl py-3 font-bold text-sm shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                     <Mail className="w-4 h-4" /> Contacter ce talent
                  </button>
                </Link>
              </div>
            </Card>

            <Card className="p-6 border-none shadow-xl shadow-slate-200/30 rounded-3xl bg-indigo-600 text-white">
               <div className="flex items-center gap-3 mb-4">
                  <Award className="w-6 h-6 text-indigo-200" />
                  <h3 className="font-black text-sm uppercase tracking-widest">Certification</h3>
               </div>
               <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                  Ce candidat a validé son parcours de formation à la Ferme Agro-Piscicole Cité St André. Toutes les attestations listées sont authentifiées.
               </p>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1 space-y-10 w-full">
            <section>
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    Récompenses & Diplômes
                  </h2>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">
                    {user.attestations.length} Attestation{user.attestations.length > 1 ? 's' : ''}
                  </span>
               </div>

               <div className="grid gap-6">
                  {user.attestations.length > 0 ? (
                    user.attestations.map((att: any) => (
                      <Card key={att.id} className="p-6 border-none shadow-xl shadow-slate-200/40 rounded-[2rem] bg-white group hover:translate-x-2 transition-all duration-300 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-50 opacity-50 rounded-bl-full pointer-events-none -z-10 group-hover:scale-110 transition-transform" />
                        
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                          <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:rotate-6 transition-transform">
                             {att.type === 'STAGE' ? <Briefcase className="w-10 h-10" /> : <GraduationCap className="w-10 h-10" />}
                          </div>
                          
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                               <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] font-black uppercase tracking-tighter">
                                  {att.type === 'FORMATION' ? 'Certification' : 'Stage Professionnel'}
                               </Badge>
                               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Vérifié
                               </span>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{att.formation?.name || "Formation Agro-Piscicole"}</h3>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-slate-500 text-xs font-bold uppercase tracking-wide">
                               <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Décerné le {format(new Date(att.issuedAt), 'dd MMMM yyyy', { locale: fr })}</div>
                               <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {att.location}</div>
                            </div>
                          </div>

                          <div className="sm:text-right w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-50">
                             <Link href={`/verify?code=${att.code}`} target="_blank">
                                <button className="w-full sm:w-auto px-6 py-2.5 bg-slate-50 hover:bg-emerald-500 hover:text-white text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                  Vérifier <ExternalLink className="w-3 h-3" />
                                </button>
                             </Link>
                             <p className="mt-2 text-[10px] font-mono text-slate-300">REF: {att.code}</p>
                          </div>
                        </div>
                      </Card>
                    ))
                  ) : (
                    <div className="p-20 text-center bg-white rounded-[2rem] shadow-inner border-2 border-dashed border-slate-100">
                       <Award className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                       <h3 className="text-slate-400 font-bold uppercase tracking-widest">En cours d'acquisition</h3>
                       <p className="text-xs text-slate-300 mt-2 font-medium">Le candidat n'a pas encore de diplômes publics validés.</p>
                    </div>
                  )}
               </div>
            </section>

            {/* Verification Section */}
            <section className="bg-emerald-950 rounded-[3rem] p-10 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
               <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                  <div className="flex-1 space-y-4">
                     <h3 className="text-3xl font-black tracking-tight leading-tight">Garantie d'Authenticité</h3>
                     <p className="text-emerald-100/70 text-sm font-medium leading-relaxed">
                        Toutes les informations présentées ici sont générées automatiquement par le système central de la Ferme Agro-Piscicole Cité St André. 
                        Chaque attestation dispose d'un code unique infalsifiable.
                     </p>
                  </div>
                  <div className="w-48 h-48 bg-white p-2 rounded-3xl shadow-2xl rotate-3 flex flex-col items-center justify-center">
                     <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center overflow-hidden">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}`} 
                          alt="Verification QR Code" 
                          className="w-full h-full object-contain"
                        />
                     </div>
                     <p className="text-[8px] font-black text-slate-800 uppercase tracking-widest mt-1 opacity-50">Scanner pour vérifier</p>
                  </div>
               </div>
            </section>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 text-center border-t border-slate-200">
         <Link href="/">
            <div className="inline-flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
               <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">FSA</div>
               <span className="text-xs font-black uppercase tracking-widest text-slate-900">Ferme Agro-Piscicole St André</span>
            </div>
         </Link>
      </footer>
    </div>
  );
}
