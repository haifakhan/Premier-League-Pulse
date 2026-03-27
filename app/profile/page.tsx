"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    router.replace(`/users/${user.id}`);
  }, [isLoading, router, user]);

  return <p className="text-sm text-slate-600">Loading profile...</p>;
}
