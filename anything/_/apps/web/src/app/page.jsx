"use client";

import { useEffect } from 'react';
import useUser from '@/utils/useUser';
import LandingPage from '@/components/Landing/LandingPage';

export default function HomePage() {
  const { data: user, loading } = useUser();
  useEffect(() => {
    if (!loading && user) window.location.href = '/dashboard';
  }, [user, loading]);
  // Public content does not wait on authentication; the existing signed-in redirect remains.
  return <LandingPage />;
}
