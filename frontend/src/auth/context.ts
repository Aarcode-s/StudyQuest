import { createContext } from "react";
import type { User } from "../lib/types";

export type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);