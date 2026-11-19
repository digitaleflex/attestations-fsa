'use client';

import * as React from 'react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 1,
      },
    },
  });

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
