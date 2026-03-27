"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AuthUser, getCurrentUser, logout as logoutRequest } from "@/lib/api/auth";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function resolveUserFromToken(token: string) {
  return getCurrentUser(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeTokenRef = useRef<string | null>(null);

  useEffect(() => {
    activeTokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");

    if (!storedToken) {
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    const initialToken = storedToken;
    let cancelled = false;

    async function hydrateAuth() {
      setToken(initialToken);

      try {
        const currentUser = await resolveUserFromToken(initialToken);

        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
        localStorage.removeItem("token");

        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    hydrateAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(nextToken: string) {
    localStorage.setItem("token", nextToken);
    activeTokenRef.current = nextToken;
    setToken(nextToken);
    setIsLoading(true);

    try {
      const currentUser = await resolveUserFromToken(nextToken);
      setUser(currentUser);
    } catch {
      localStorage.removeItem("token");
      activeTokenRef.current = null;
      setToken(null);
      setUser(null);
      throw new Error("Unable to load current user");
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    const currentToken = activeTokenRef.current;

    await logoutRequest(currentToken);
    activeTokenRef.current = null;
    setToken(null);
    setUser(null);
    setIsLoading(false);
    router.push("/login");
  }

  async function refreshUser() {
    const currentToken = activeTokenRef.current;

    if (!currentToken) {
      setUser(null);
      return;
    }

    const currentUser = await resolveUserFromToken(currentToken);
    setUser(currentUser);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
