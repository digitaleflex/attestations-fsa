'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/lib/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Memoize the provider tree to prevent static generation issues
    const providersTree = useMemo(() => (
        <ThemeProvider>
            <QueryProvider>
                {mounted && <Toaster richColors position="top-center" closeButton />}
                {children}
            </QueryProvider>
        </ThemeProvider>
    ), [mounted, children]);

    return providersTree;
}
