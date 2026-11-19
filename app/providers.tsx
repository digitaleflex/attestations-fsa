'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Memoize the provider tree to prevent static generation issues
    const providersTree = useMemo(() => (
        <QueryProvider>
            {mounted && <Toaster richColors position="top-center" closeButton />}
            {children}
        </QueryProvider>
    ), [mounted, children]);

    return providersTree;
}
