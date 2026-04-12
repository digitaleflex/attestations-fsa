'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "sonner";

// Create queryClient outside to avoid recreation on every render
const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(createQueryClient);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Memoize the provider tree to prevent static generation issues
    const providersTree = useMemo(() => (
        <QueryClientProvider client={queryClient}>
            {mounted && <Toaster richColors position="top-center" closeButton />}
            {children}
        </QueryClientProvider>
    ), [queryClient, mounted, children]);

    return providersTree;
}
