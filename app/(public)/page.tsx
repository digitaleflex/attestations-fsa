import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ArrowRight, CheckCircle, Eye } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full">
      <div className="max-w-xl mx-auto flex flex-col items-center gap-6">
        <ShieldCheck className="w-16 h-16 text-green-600 mb-2" />
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Vérifiez l’authenticité d’une attestation FSA</h1>
        <p className="text-lg text-gray-600 mb-4">Un service simple, rapide et sécurisé pour garantir la confiance et la transparence de vos documents officiels.</p>
        <Link href="/verifier" className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-black text-white font-semibold text-lg shadow-lg hover:bg-gray-900 transition mb-2">
          Vérifier une attestation <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Avantages */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center bg-white rounded-xl shadow p-6">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
          <div className="font-bold text-gray-900 mb-1">Simplicité</div>
          <div className="text-gray-600 text-sm">Vérification instantanée par code unique ou QR code.</div>
        </div>
        <div className="flex flex-col items-center bg-white rounded-xl shadow p-6">
          <ShieldCheck className="w-8 h-8 text-blue-500 mb-2" />
          <div className="font-bold text-gray-900 mb-1">Sécurité</div>
          <div className="text-gray-600 text-sm">Données protégées, aucune information sensible affichée.</div>
        </div>
        <div className="flex flex-col items-center bg-white rounded-xl shadow p-6">
          <Eye className="w-8 h-8 text-emerald-500 mb-2" />
          <div className="font-bold text-gray-900 mb-1">Transparence</div>
          <div className="text-gray-600 text-sm">Authenticité vérifiable par tous, à tout moment.</div>
        </div>
      </div>
    </div>
  );
}
