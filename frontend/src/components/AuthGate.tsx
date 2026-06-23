"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Workspace from "@/components/Workspace";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth-status");
        if (!response.ok) throw new Error("auth fetch failed");
        const data = await response.json();
        if (data.authenticated) {
          setUsername(data.username ?? null);
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      } catch {
        setStatus("unauthenticated");
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] text-[var(--gray-text)]">
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return <Workspace username={username} />;
}
