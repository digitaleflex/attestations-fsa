 
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

"use client";
import React, { useRef, useEffect, useState } from "react";

interface QrScannerProps {
  onScan: (value: string) => void;
  onError?: (error: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

export const QrScanner: React.FC<QrScannerProps> = ({ onScan, onError, style, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detector: any = null;
    let running = true;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setFallback(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const scan = async () => {
          if (!running) return;
          if (videoRef.current && !videoRef.current.paused) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                setScanning(false);
                onScan(barcodes[0].rawValue);
                running = false;
                stream?.getTracks().forEach((track) => track.stop());
              } else {
                setTimeout(scan, 300);
              }
            } catch (e) {
              setError("Erreur lors de la détection du QR code.");
              onError?.("Erreur lors de la détection du QR code.");
            }
          }
        };
        scan();
      } catch (e) {
        setError("Erreur d'accès à la caméra.");
        onError?.("Erreur d'accès à la caméra.");
      }
    }
    if (scanning) start();
    return () => {
      running = false;
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScan, onError, scanning]);

  // Fallback: analyse d'image uploadée avec prétraitement IA léger
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      // Simule une progression fluide pendant l'analyse
      let prog = 0;
      const interval = setInterval(() => {
        prog = Math.min(prog + Math.random() * 20, 90);
        setProgress(Math.floor(prog));
      }, 150);
      // Chargement dynamique d'OpenCV.js et jsqr
      const cv = (await import("@techstark/opencv-js")).default;
      // @ts-ignore
      const jsQR = (await import("jsqr")).default || require("jsqr");
      setProgress(95);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProgress(98);
        const img = new window.Image();
        img.onload = () => {
          setProgress(99);
          // Création du canvas
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setError("Impossible de lire l'image.");
            setLoading(false);
            setProgress(0);
            clearInterval(interval);
            return;
          }
          ctx.drawImage(img, 0, 0);
          // OpenCV : prétraitement
          const src = cv.imread(canvas);
          const dst = new cv.Mat();
          cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
          cv.GaussianBlur(dst, dst, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
          cv.adaptiveThreshold(dst, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
          // Remettre dans le canvas
          cv.imshow(canvas, dst);
          // Extraction des données pour jsqr
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          src.delete(); dst.delete();
          setProgress(100);
          clearInterval(interval);
          setTimeout(() => setProgress(0), 500);
          if (code) {
            onScan(code.data);
          } else {
            setError("Aucun QR code détecté dans l'image.");
            onError?.("Aucun QR code détecté dans l'image.");
          }
          setLoading(false);
        };
        img.onerror = () => {
          setError("Impossible de charger l'image.");
          setLoading(false);
          setProgress(0);
          clearInterval(interval);
        };
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => {
        setError("Erreur de lecture du fichier.");
        setLoading(false);
        setProgress(0);
        clearInterval(interval);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setError("Erreur lors de l'analyse du QR code.");
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div style={style} className={className}>
      {!fallback ? (
        <>
          <video ref={videoRef} style={{ width: "100%", borderRadius: 8 }} />
          {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <p style={{ marginBottom: 8 }}>Votre navigateur ne supporte pas la détection live. Importez une image contenant un QR code :</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={loading}
            style={{ marginBottom: 8 }}
          />
          {loading && (
            <div className="w-full flex flex-col items-center gap-2 mb-2">
              <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-gray-600">Analyse en cours... {progress}%</div>
            </div>
          )}
          {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}; 