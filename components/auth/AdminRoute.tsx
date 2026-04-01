'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import * as React from "react"

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: sessionData, isPending } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isPending) return;

    if (!sessionData) {
      router.push('/admin/login');
      return;
    }

    // Role check - using Better Auth structure
    const user = sessionData.user as { role?: string };
    if (user.role !== 'ADMIN') {
      router.push('/unauthorized');
      return;
    }

    setIsAuthorized(true);
    setIsLoading(false);
  }, [sessionData, isPending, router]);

  if (isPending || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
