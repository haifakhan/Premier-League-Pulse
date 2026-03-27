"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  if (isLoading) {
    return <p className="text-sm text-slate-600">Loading profile...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-slate-900">My Profile</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-slate-500">Username</dt>
            <dd className="text-lg text-slate-900">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Email</dt>
            <dd className="text-lg text-slate-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Role</dt>
            <dd className="text-lg text-slate-900">{user.role}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
