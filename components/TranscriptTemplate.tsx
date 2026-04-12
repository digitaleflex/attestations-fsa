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
      internshipScore?: number;
      finalScore?: number;
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
      month: "long",
      year: "numeric",
    });
  };

  const getStatusBadge = (score: number, totalPoints: number) => {
    const percentage = (score / totalPoints) * 100;
    const passed = percentage >= 65;
    return {
      label: passed ? "ADMIS" : "ÉCHEC",
      color: passed ? "#047857" : "#b91c1c",
      bg: passed ? "#f0fdf4" : "#fef2f2",
    };
  };

  const getMention = (average: number) => {
    if (average >= 18) return { label: "EXCELLENT", color: "#1e3a8a" };
    if (average >= 16) return { label: "TRÈS BIEN", color: "#6d28d9" };
    if (average >= 14) return { label: "BIEN", color: "#0369a1" };
    if (average >= 12) return { label: "ASSEZ BIEN", color: "#0e7490" };
    if (average >= 10) return { label: "PASSABLE", color: "#1e293b" };
    return { label: "INSUFFISANT", color: "#991b1b" };
  };

  // Récupérer le code de la première attestation disponible ou un placeholder
  const studentCode = data.attestations && data.attestations.length > 0 
    ? data.attestations[0].code 
    : "EN ATTENTE";

  const avg20 = (data.globalAverage / 100) * 20;
  const mention = getMention(avg20);

  return (
    <div
      id={id}
      style={{
        width: "794px",
        fontFamily: "'Segoe UI', Roboto, Helvetica, sans-serif",
        backgroundColor: "#ffffff",
        boxSizing: "border-box",
        margin: "0 auto",
        padding: "30px 40px",
        position: "relative",
        color: "#1e293b"
      }}
    >
      <div style={{ position: "absolute", inset: "25px", border: "1px solid #cbd5e1", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: "30px", border: "2px solid #1e3a8a", pointerEvents: "none" }} />

      <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          height: "400px",
          opacity: 0.03,
          pointerEvents: "none",
          zIndex: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
      }}>
          <img src="/logo-fsa.png" alt="Watermark" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(100%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        
        {/* ── EN-TÊTE ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", borderBottom: "2px solid #1e3a8a", paddingBottom: "12px" }}>
            <div style={{ width: "180px" }}>
                {/* Espace vide pour équilibrer le logo central */}
            </div>

            <div style={{ textAlign: "center", flex: 1, padding: "0 20px" }}>
                <div style={{ height: "60px", marginBottom: "10px", display: "flex", justifyContent: "center" }}>
                    <img src="/logo-fsa.png" alt="Logo FSA" style={{ width: "60px", height: "60px", objectFit: "contain", display: "block", margin: "0 auto 8px" }} />
                </div>
                <h1 style={{ fontSize: "24px", fontWeight: 900, margin: "0 0 5px", color: "#101b3d", letterSpacing: "1px" }}>RELEVÉ DE NOTES</h1>
                <p style={{ fontSize: "10px", fontWeight: 700, margin: 0, color: "#64748b", textTransform: "uppercase", letterSpacing: "2px" }}>Ferme Agro-Piscicole St André</p>
            </div>

            <div style={{ width: "180px", textAlign: "right", fontSize: "10px", color: "#000" }}>
                <p style={{ margin: 0, fontWeight: 700 }}>Version Electronique</p>
                <p style={{ margin: "2px 0", color: "#64748b", fontSize: "9px" }}>Authenticité Certifiée</p>
                <p style={{ margin: 0, fontWeight: 800, color: "#1e3a8a", fontSize: "11px", marginTop: "5px" }}>N° {studentCode.split('-').pop()}</p>
            </div>
        </div>

        {/* ── IDENTIFICATION ── */}
        <div style={{ marginBottom: "15px", backgroundColor: "#fcfdfe", padding: "10px 20px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <h2 style={{ fontSize: "12px", fontWeight: 900, color: "#1e3a8a", margin: "0 0 15px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Profil</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px 40px", fontSize: "11px" }}>
                <div>
                    <span style={{ color: "#64748b", textTransform: "uppercase", fontSize: "8px", fontWeight: 800 }}>Nom & Prénoms :</span>
                    <p style={{ margin: "2px 0", fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{(data.fullName || "Candidat").toUpperCase()}</p>
                </div>
                <div>
                    <span style={{ color: "#64748b", textTransform: "uppercase", fontSize: "8px", fontWeight: 800 }}>Code de Dossier :</span>
                    <p style={{ margin: "2px 0", fontWeight: 800, color: "#1e3a8a", fontSize: "12px" }}>{studentCode}</p>
                </div>
                <div>
                    <span style={{ color: "#64748b", textTransform: "uppercase", fontSize: "8px", fontWeight: 800 }}>Date & Lieu de naissance :</span>
                    <p style={{ margin: "2px 0", fontWeight: 700 }}>{formatDate(data.birthDate)} à {data.birthPlace}</p>
                </div>
                <div>
                    <span style={{ color: "#64748b", textTransform: "uppercase", fontSize: "8px", fontWeight: 800 }}>Adresse e-mail :</span>
                    <p style={{ margin: "2px 0", fontWeight: 700 }}>{data.email}</p>
                </div>
            </div>
        </div>

        {/* ── TABLEAU DES RÉSULTATS ── */}
        <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "11px", fontWeight: 900, color: "#1e3a8a", marginBottom: "15px", textTransform: "uppercase", letterSpacing: "1px" }}>
                ÉTAT RÉCAPITULATIF DES NOTES
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
                <thead>
                    <tr style={{ backgroundColor: "#1e3a8a", color: "#ffffff" }}>
                        <th style={{ textAlign: "left", padding: "12px 15px", fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>Unités de Formation</th>
                        <th style={{ textAlign: "center", padding: "12px", fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>Note Exam</th>
                        <th style={{ textAlign: "center", padding: "12px", fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>Note Stage</th>
                        <th style={{ textAlign: "center", padding: "12px", fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>Moyenne / 20</th>
                        <th style={{ textAlign: "center", padding: "12px", fontSize: "8px", fontWeight: 800, textTransform: "uppercase", width: "100px" }}>Verdict</th>
                    </tr>
                </thead>
                <tbody>
                    {data.examResults.map((exam, idx) => {
                        const scorePct = Math.round((exam.score / exam.totalPoints) * 100);
                        const final20 = exam.finalScore ? (exam.finalScore / 100) * 20 : (scorePct / 100) * 20;
                        const badge = getStatusBadge(exam.score, exam.totalPoints);
                        
                        return (
                            <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "10px 15px", fontSize: "10px" }}>
                                    <p style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>{exam.examName}</p>
                                    <p style={{ margin: "2px 0 0", fontSize: "7px", color: "#64748b", textTransform: "uppercase" }}>Session du {formatDate(exam.date)}</p>
                                </td>
                                <td style={{ textAlign: "center", padding: "10px", fontSize: "11px", fontWeight: 600 }}>{scorePct}%</td>
                                <td style={{ textAlign: "center", padding: "10px", fontSize: "11px", color: "#64748b" }}>{exam.internshipScore ? `${Math.round(exam.internshipScore)}%` : "N/A"}</td>
                                <td style={{ textAlign: "center", padding: "10px", fontSize: "12px", fontWeight: 900, color: "#1e3a8a" }}>{final20.toFixed(2)}</td>
                                <td style={{ textAlign: "center", padding: "10px" }}>
                                    <span style={{ 
                                        fontSize: "8px", 
                                        fontWeight: 900, 
                                        color: badge.color, 
                                        backgroundColor: badge.bg, 
                                        padding: "3px 8px", 
                                        borderRadius: "4px",
                                        border: `1px solid ${badge.color}`,
                                        display: "inline-block",
                                        minWidth: "60px",
                                        textAlign: "center"
                                    }}>
                                        {badge.label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* ── RÉSULTAT FINAL ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "30px" }}>
                <div style={{ backgroundColor: "#1e3a8a", padding: "20px", borderRadius: "8px", color: "#fff", boxShadow: "0 10px 15px -3px rgba(30, 58, 138, 0.2)" }}>
                    <h4 style={{ margin: "0 0 15px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "5px" }}>Résulat Global</h4>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <span style={{ fontSize: "10px", opacity: 0.85 }}>Moyenne Générale :</span>
                        <span style={{ fontSize: "18px", fontWeight: 900 }}>{avg20.toFixed(2)} / 20</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "10px", opacity: 0.85 }}>Mention :</span>
                        <span style={{ fontSize: "14px", fontWeight: 800, color: "#fbbf24" }}>{mention.label}</span>
                    </div>
                </div>

                <div style={{ textAlign: "center", paddingTop: "15px" }}>
                   <p style={{ fontSize: "11px", fontWeight: 800, margin: "0 0 30px" }}>Le Responsable de la Formation,</p>
                   <div style={{ width: "130px", height: "1px", background: "#1e293b", margin: "0 auto 10px" }} />
                   <p style={{ fontSize: "11px", fontWeight: 700, margin: 0 }}>FSA - St André</p>
                   <p style={{ fontSize: "8px", color: "#64748b", fontStyle: "italic" }}>(Validé électroniquement)</p>
                </div>
            </div>
        </div>

        {/* ── BAS DE PAGE ── */}
        <div style={{ marginTop: "15px", borderTop: "1px solid #e2e8f0", paddingTop: "15px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: "8px", color: "#94a3b8", lineHeight: 1.6 }}>
                <p style={{ margin: 0 }}>Code Doc : {studentCode.split('-').pop()}-{id.slice(-4)}</p>
                <p style={{ margin: 0 }}>Généré le {new Date().toLocaleString('fr-FR')}</p>
            </div>
            <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "10px", fontWeight: 900, color: "#1e3a8a", margin: 0 }}>FERME AGRO-PISCICOLE ST ANDRÉ</p>
            </div>
        </div>

      </div>
    </div>
  );
};

export default TranscriptTemplate;
