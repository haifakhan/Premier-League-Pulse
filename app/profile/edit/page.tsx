"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading settings...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-slate-900">Edit Profile</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{user.username}</span>.
        </p>
      </div>
    </section>
  );
}
