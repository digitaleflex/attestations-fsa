# Next.js Performance Audit Report
## 🚨 Top Performance Killers

| Impact | Issue | Location | Status |
| :--- | :--- | :--- | :--- |
| 🔴 **Critical** | **Bundle Bloat**: `html2pdf.js` (~150KB+) bundled in initial load. | `app/admin/attestations/[id]/page.tsx` | ✅ **FIXED** (Lazy Loaded) |
| 🟢 **Fixed** | **Bundle Bloat**: `@techstark/opencv-js` & `jsqr` (~5MB+). | `src/components/ui/qr-scanner.tsx` | ✅ **FIXED** (Removed unused component). |
| 🟠 **High** | **Layout Re-render**: `RootLayout` was a Client Component. | `app/layout.tsx` | ✅ **FIXED** (Refactored to Server) |
| 🟡 **Medium** | **Fonts**: System fonts used, potential Layout Shift (CLS). | `app/layout.tsx` | ✅ **FIXED** (Added `next/font/google` Inter) |
| 🟡 **Medium** | **Icons**: `lucide-react` loaded as standard. | Global | ℹ️ **Note** (Ensure tree-shaking works). |

## 🛠️ Applied Fixes

### 1. Root Layout Refactor
**Problem**: The entire application was wrapped in `'use client'`, causing full client-side hydration for static shells.
**Fix**:
- Extracted `QueryClientProvider` and `Toaster` to `app/providers.tsx`.
- Converted `app/layout.tsx` to a Server Component.
- Added **Next.js Font Optimization** (Inter) to prevent CLS.

### 2. Dynamic Import for PDF Generation
**Problem**: `html2pdf.js`, `html2canvas`, and `jspdf` were imported statically in the attestation detail page, slowing down the load time even for users just viewing the details.
**Fix**:
```typescript
// app/admin/attestations/[id]/page.tsx
const handleDownloadPDF = async () => {
  const html2pdf = (await import('html2pdf.js')).default; // Lazy load on click
  await html2pdf()...
}
```

## 🔍 Recommendations

1.  **OpenCV.js**: This is an extremely heavy library. If the QR scanner is not the primary feature, ensure it is *strictly* only loaded when the user opens the camera. The current implementation uses dynamic import, which is good, but consider a lighter alternative like `zxing-js` or usage of the native `BarcodeDetector` API (which you have generic support for).
2.  **Auth in Layout**: `app/admin/layout.tsx` performs `router.push('/admin/login')` inside `useEffect`. This causes a "flash of content" or "flash of unauthorized" state. **Recommendation**: Move this logic to `middleware.ts` for server-side redirection.
