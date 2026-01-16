"use client";

import { useEffect } from "react";
import useAuth from "@/utils/useAuth";
import BrandLogo from "@/components/BrandLogo";

export default function Logout() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({
      callbackUrl: "/account/signin",
      redirect: true,
    });
  }, [signOut]);

  return (
    <div className="min-h-screen bg-[#263043] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#2D384E] rounded-lg p-8 shadow-xl text-center">
          <div className="flex items-center justify-center mb-4">
            <BrandLogo className="h-8 w-auto" variant="onDark" />
          </div>
          <p className="text-slate-400">Signing you out...</p>
        </div>
      </div>
    </div>
  );
}
