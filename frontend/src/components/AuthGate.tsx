"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/KanbanBoard";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth-status");
        if (!response.ok) throw new Error("auth fetch failed");
        const data = await response.json();
        if (data.authenticated) {
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      } catch (error) {
        setStatus("unauthenticated");
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return <KanbanBoard />;
}
