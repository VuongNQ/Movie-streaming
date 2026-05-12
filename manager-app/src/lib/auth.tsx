import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AuthContextState = {
  isAuthenticated: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
};

const AUTH_TOKEN_KEY = "manager_auth_token";

const AuthContext = createContext<AuthContextState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => localStorage.getItem(AUTH_TOKEN_KEY) ?? "");

  const value = useMemo<AuthContextState>(
    () => ({
      isAuthenticated: token.length > 0,
      signIn: (nextToken: string) => {
        localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
        setToken(nextToken);
      },
      signOut: () => {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setToken("");
      },
    }),
    [token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
