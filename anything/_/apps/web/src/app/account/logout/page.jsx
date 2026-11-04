"use client";

import { useEffect } from "react";
import useAuth from "@/utils/useAuth";
import AccountLayout from "@/components/Theme/AccountLayout";

export default function Logout() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({
      callbackUrl: "/account/signin",
      redirect: true,
    });
  }, [signOut]);

  return (
    <AccountLayout
      title="Signing you out."
      description="You will be returned to the sign-in page."
    >
      <p role="status" className="text-sm text-[var(--st-muted)]">
        Signing you out…
      </p>
    </AccountLayout>
  );
}
