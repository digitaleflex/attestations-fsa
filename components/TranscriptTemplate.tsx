"use client";

import React from "react";
import { Award, CheckCircle, TrendingUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface TranscriptTemplateProps {
  data: {
    fullName: string;
    birthDate: string;
    birthPlace: string;
    email: string;
    examResults: {
      examName: string;
      score: number;
      totalPoints: number;
      status: string;
      date: string;
      part1Score?: number;
      part2Score?: number;
      part3Score?: number;
      type?: string;
    }[];
    attestations: {
      formationName: string;
      type: string;
      code: string;
      issuedAt: string;
      score?: number;
    }[];
    globalAverage: number;
    totalExams: number;
    passedExams: number;
    successRate: number;
  };
  id?: string;
}

const TranscriptTemplate = ({ data, id = "transcript-content" }: TranscriptTemplateProps) => {
  const formatDate = (d: string) => {
    if (!d) return "--/--/----";
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const getStatusBadge = (status: string, score: number) => {
    const passingScore = 60;
    const passed = score >= passingScore;
    return {
      label: passed ? "ADMIS" : "NON ADMIS",
      color: passed ? "#059669" : "#dc2626",
      bg: passed ? "#ecfdf5" : "#fef2f2"
    };
  };

  const getMention = (average: number) => {
    if (average >= 90) return { label: "EXCELLENCE", color: "#7c3aed" };
    if (average >= 80) return { label: "TRÈS BIEN", color: "#059669" };
    if (average >= 70) return { label: "BIEN", color: "#2563eb" };
    if (average >= 60) return { label: "ASSEZ BIEN", color: "#0891b2" };
    return { label: "PASSABLE", color: "#d97706" };
  };

  const mention = getMention(data.globalAverage);

  return (
    <div
      style={{ width: "794px", minHeight: "1123px", fontFamily: "'Times New Roman', Times, serif", backgroundColor: "#ffffff" }}
      id={id}
      className="relative"
    >
      <div className="w-full h-full p-12 relative flex flex-col border-2" style={{ borderColor: "#1e293b" }}>
        {/* Bordure décorative */}
        <div className="absolute inset-6 border" style={{ borderColor: "#94a3b8" }}></div>

        {/* Header */}
        <div className="text-center mb-8 pb-6 border-b-2" style={{ borderColor: "#1e293b" }}>
          <p className="text-sm uppercase tracking-[0.3em] font-bold mb-2" style={{ color: "#2563eb" }}>
            Ferme Agro-Piscicole Cité St André
          </p>
          <h1 className="text-4xl font-black tracking-tight uppercase mb-2" style={{ color: "#0f172a" }}>
            Relevé de Notes Officiel
          </h1>
          <div className="w-24 h-1 mx-auto" style={{ backgroundColor: "#2563eb" }}></div>
        </div>

        {/* Informations du candidat */}
        <div className="px-8 mb-8">
          <h2 className="text-lg font-bold mb-4 uppercase tracking-wider" style={{ color: "#2563eb" }}>
            Informations du candidat
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Nom complet :</span>
              <span className="ml-2 font-bold text-slate-800">{data.fullName}</span>
            </div>
            <div>
              <span className="text-slate-500">Email :</span>
              <span className="ml-2 font-bold text-slate-800">{data.email}</span>
            </div>
            <div>
              <span className="text-slate-500">Date de naissance :</span>
              <span className="ml-2 font-bold text-slate-800">{formatDate(data.birthDate)}</span>
            </div>
            <div>
              <span className="text-slate-500">Lieu de naissance :</span>
              <span className="ml-2 font-bold text-slate-800">{data.birthPlace}</span>
            </div>
          </div>
        </div>

        {/* Résultats des examens */}
        <div className="px-8 mb-8 flex-1">
          <h2 className="text-lg font-bold mb-4 uppercase tracking-wider" style={{ color: "#2563eb" }}>
            Résultats d'examens
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2" style={{ borderColor: "#1e293b" }}>
                <th className="text-left py-2 font-bold text-slate-700">Examen</th>
                <th className="text-center py-2 font-bold text-slate-700">Score</th>
                <th className="text-center py-2 font-bold text-slate-700">Partie 1</th>
                <th className="text-center py-2 font-bold text-slate-700">Partie 2</th>
                <th className="text-center py-2 font-bold text-slate-700">Partie 3</th>
                <th className="text-center py-2 font-bold text-slate-700">Statut</th>
                <th className="text-right py-2 font-bold text-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.examResults.map((exam, idx) => {
                const badge = getStatusBadge(exam.status, exam.score);
                return (
                  <tr key={idx} className="border-b" style={{ borderColor: "#e2e8f0" }}>
                    <td className="py-2.5 font-medium text-slate-800">
                      {exam.examName} {exam.type === 'MOCK' ? <span style={{ fontSize: '8px', color: '#6366f1', fontWeight: 'bold' }}>(BLANC)</span> : ''}
                    </td>
                    <td className="py-2.5 text-center font-bold" style={{ color: badge.color }}>
                      {exam.score}/{exam.totalPoints}
                    </td>
                    <td className="py-2.5 text-center text-slate-600">{exam.part1Score ?? "-"}</td>
                    <td className="py-2.5 text-center text-slate-600">{exam.part2Score ?? "-"}</td>
                    <td className="py-2.5 text-center text-slate-600">{exam.part3Score ?? "-"}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{formatDate(exam.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Attestations obtenues */}
        {data.attestations.length > 0 && (
          <div className="px-8 mb-8">
            <h2 className="text-lg font-bold mb-4 uppercase tracking-wider" style={{ color: "#2563eb" }}>
              Attestations obtenues
            </h2>
            <div className="space-y-2">
              {data.attestations.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded border"
                  style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
                >
                  <div>
                    <p className="font-bold text-sm text-slate-800">{att.formationName}</p>
                    <p className="text-xs text-slate-500">
                      {att.type === "FORMATION" ? "Formation" : att.type === "STAGE" ? "Stage" : "Certification"}
                      {att.score ? ` • Score: ${att.score}/100` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-slate-600">{att.code}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(att.issuedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Résumé global */}
        <div className="px-8 mb-8">
          <h2 className="text-lg font-bold mb-4 uppercase tracking-wider" style={{ color: "#2563eb" }}>
            Résumé global
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <p className="text-xs text-slate-500 mb-1">Examens passés</p>
              <p className="text-2xl font-black text-slate-800">{data.totalExams}</p>
            </div>
            <div className="p-4 rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <p className="text-xs text-slate-500 mb-1">Examens réussis</p>
              <p className="text-2xl font-black" style={{ color: "#059669" }}>{data.passedExams}</p>
            </div>
            <div className="p-4 rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <p className="text-xs text-slate-500 mb-1">Taux de réussite</p>
              <p className="text-2xl font-black" style={{ color: "#2563eb" }}>{data.successRate}%</p>
            </div>
            <div className="p-4 rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}>
              <p className="text-xs text-slate-500 mb-1">Mention globale</p>
              <p className="text-2xl font-black" style={{ color: mention.color }}>{mention.label}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pt-6 border-t" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-mono">
              Document généré le {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#1e293b" }}>
                © FERME SAINT ANDRÉ
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptTemplate;
