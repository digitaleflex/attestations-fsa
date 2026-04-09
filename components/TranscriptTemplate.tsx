"use client";

import React from "react";

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
      year: "numeric",
    });
  };

  const getStatusBadge = (score: number) => {
    const passed = score >= 60;
    return {
      label: passed ? "ADMIS" : "NON ADMIS",
      color: passed ? "#059669" : "#dc2626",
      bg: passed ? "#ecfdf5" : "#fef2f2",
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
      id={id}
      style={{
        width: "794px",
        height: "1122px",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        backgroundColor: "#ffffff",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Outer border frame */}
      <div
        style={{
          position: "absolute",
          inset: "10px",
          border: "2px solid #1e3a5f",
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "14px",
          border: "0.5px solid #93c5fd",
          boxSizing: "border-box",
        }}
      />

      {/* Content wrapper */}
      <div
        style={{
          position: "absolute",
          inset: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "0px",
          padding: "12px 24px 10px",
          boxSizing: "border-box",
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ textAlign: "center", borderBottom: "1.5px solid #1e3a5f", paddingBottom: "10px", marginBottom: "10px" }}>
          <p style={{ fontSize: "9px", letterSpacing: "0.35em", fontWeight: 700, color: "#2563eb", marginBottom: "4px", textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>
            Ferme Agro-Piscicole Cité St André
          </p>
          <h1 style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.5px", color: "#0f172a", margin: "0 0 6px", textTransform: "uppercase" }}>
            Relevé de <span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>Notes</span> Officiel
          </h1>
          <div style={{ width: "60px", height: "2px", background: "linear-gradient(to right, #2563eb, #059669)", margin: "0 auto" }} />
        </div>

        {/* ── INFORMATIONS CANDIDAT ── */}
        <div style={{ marginBottom: "10px" }}>
          <p style={{ fontSize: "9px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "5px", fontFamily: "Arial, sans-serif" }}>
            Informations du candidat
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 20px", fontSize: "10px", color: "#334155" }}>
            <div>
              <span style={{ color: "#64748b" }}>Nom complet : </span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{data.fullName}</span>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Email : </span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{data.email}</span>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Date de naissance : </span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{formatDate(data.birthDate)}</span>
            </div>
            <div>
              <span style={{ color: "#64748b" }}>Lieu de naissance : </span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{data.birthPlace}</span>
            </div>
          </div>
        </div>

        {/* ── RÉSULTATS D'EXAMENS ── */}
        <div style={{ marginBottom: "10px", flex: "1" }}>
          <p style={{ fontSize: "9px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px", fontFamily: "Arial, sans-serif" }}>
            Résultats d&apos;examens
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px" }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #1e3a5f" }}>
                <th style={{ textAlign: "left", padding: "4px 4px 4px 0", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Examen</th>
                <th style={{ textAlign: "center", padding: "4px", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Score</th>
                <th style={{ textAlign: "center", padding: "4px", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Partie 1</th>
                <th style={{ textAlign: "center", padding: "4px", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Partie 2</th>
                <th style={{ textAlign: "center", padding: "4px", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Partie 3</th>
                <th style={{ textAlign: "center", padding: "4px", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Statut</th>
                <th style={{ textAlign: "right", padding: "4px 0 4px 4px", fontWeight: 700, color: "#475569", fontFamily: "Arial, sans-serif", fontSize: "8.5px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.examResults.map((exam, idx) => {
                const badge = getStatusBadge(exam.score);
                return (
                  <tr key={idx} style={{ borderBottom: "0.5px solid #e2e8f0", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={{ padding: "5px 4px 5px 0", color: "#1e293b", fontWeight: 500, maxWidth: "220px" }}>
                      {exam.examName}
                      {exam.type === "MOCK" && (
                        <span style={{ fontSize: "7px", color: "#6366f1", fontWeight: 800, marginLeft: "4px" }}>(BLANC)</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 800, color: badge.color }}>
                      {exam.score}/{exam.totalPoints}
                    </td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: "#64748b" }}>{exam.part1Score ?? "–"}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: "#64748b" }}>{exam.part2Score ?? "–"}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px", color: "#64748b" }}>{exam.part3Score ?? "–"}</td>
                    <td style={{ textAlign: "center", padding: "5px 4px" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "1px 7px",
                        borderRadius: "3px",
                        fontSize: "8px",
                        fontWeight: 800,
                        fontFamily: "Arial, sans-serif",
                        backgroundColor: badge.bg,
                        color: badge.color,
                        letterSpacing: "0.05em",
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", padding: "5px 0 5px 4px", color: "#64748b" }}>
                      {formatDate(exam.date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── RÉSUMÉ GLOBAL ── */}
        <div style={{ marginBottom: "10px" }}>
          <p style={{ fontSize: "9px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px", fontFamily: "Arial, sans-serif" }}>
            Résumé global
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
            {[
              { label: "Examens passés", value: String(data.totalExams), color: "#1e293b" },
              { label: "Examens réussis", value: String(data.passedExams), color: "#059669" },
              { label: "Taux de réussite", value: `${data.successRate}%`, color: "#2563eb" },
              { label: "Mention globale", value: mention.label, color: mention.color },
            ].map((item, i) => (
              <div key={i} style={{ border: "0.5px solid #e2e8f0", borderRadius: "4px", padding: "8px 10px", backgroundColor: "#f8fafc" }}>
                <p style={{ fontSize: "8px", color: "#94a3b8", marginBottom: "4px", fontFamily: "Arial, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</p>
                <p style={{ fontSize: "18px", fontWeight: 900, color: item.color, lineHeight: 1 }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ borderTop: "0.5px solid #cbd5e1", paddingTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: "8px", color: "#94a3b8", fontFamily: "Arial, sans-serif" }}>
            Document généré le {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <p style={{ fontSize: "8.5px", fontWeight: 800, color: "#1e293b", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>
            © Ferme Saint André
          </p>
        </div>
      </div>
    </div>
  );
};

export default TranscriptTemplate;
