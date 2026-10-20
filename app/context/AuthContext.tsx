"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "user";

type AuthResult = {
  error: string | null;
  role?: UserRole | null;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<AuthResult>;
  forgotPassword: (email: string) => Promise<AuthResult>;
  resetPassword: (password: string) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  async function loadRole(userId: string): Promise<UserRole | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Failed to load user role:", error?.message);
      setRole(null);
      return null;
    }

    if (data.role !== "admin" && data.role !== "user") {
      console.error("Invalid role returned for user:", userId);
      setRole(null);
      return null;
    }

    setRole(data.role);
    return data.role;
  }

  async function recordLoginActivity(
    currentSession: Session
  ): Promise<void> {
    try {
      const response = await fetch("/api/auth/activity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (!response.ok) {
        console.error(
          "Could not record login activity:",
          response.status
        );
      }
    } catch (error) {
      console.error("Login activity request failed:", error);
    }
  }

  async function recordFailedLogin(): Promise<void> {
    try {
      const response = await fetch("/api/auth/failed-login", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        console.error(
          "Could not record failed login:",
          response.status
        );
      }
    } catch (error) {
      console.error("Failed-login monitoring request failed:", error);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("Failed to load session:", error.message);
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await loadRole(currentSession.user.id);
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("Authentication initialization failed:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setRole(null);
        setLoading(false);
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        setLoading(true);

        setTimeout(() => {
          if (!mounted) return;

          void loadRole(currentSession.user.id).finally(() => {
            if (mounted) {
              setLoading(false);
            }
          });
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function login(
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Do not block the login error while recording the failed attempt.
        void recordFailedLogin();
        return { error: error.message };
      }

      if (!data.user || !data.session) {
        return { error: "Unable to identify your account." };
      }

      const userRole = await loadRole(data.user.id);

      if (!userRole) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);

        return {
          error:
            "Your profile or role could not be verified. Please contact an administrator.",
        };
      }

      setUser(data.user);
      setSession(data.session);
      setRole(userRole);

      // Successful-login monitoring should not prevent sign-in.
      void recordLoginActivity(data.session);

      return {
        error: null,
        role: userRole,
      };
    } catch (error) {
      console.error("Login request failed:", error);
      return { error: "Login failed. Please try again." };
    }
  }

  async function register(
    name: string,
    email: string,
    password: string
  ): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      return { error: error?.message ?? null };
    } catch (error) {
      console.error("Registration request failed:", error);
      return { error: "Registration failed. Please try again." };
    }
  }

  async function forgotPassword(email: string): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      return { error: error?.message ?? null };
    } catch (error) {
      console.error("Password reset request failed:", error);
      return {
        error: "Could not request a password reset. Please try again.",
      };
    }
  }

  async function resetPassword(password: string): Promise<AuthResult> {
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        return {
          error:
            "Your recovery session is invalid or expired. Request a new reset link.",
        };
      }

      const { error } = await supabase.auth.updateUser({ password });

      return { error: error?.message ?? null };
    } catch (error) {
      console.error("Password update failed:", error);
      return { error: "Could not update your password. Please try again." };
    }
  }

  async function logout(): Promise<AuthResult> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error: error.message };
      }

      setUser(null);
      setSession(null);
      setRole(null);

      return { error: null };
    } catch (error) {
      console.error("Logout failed:", error);
      return { error: "Logout failed. Please try again." };
    }
  }

  async function refreshRole(): Promise<void> {
    if (!user) {
      setRole(null);
      return;
    }

    await loadRole(user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        login,
        register,
        forgotPassword,
        resetPassword,
        logout,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}