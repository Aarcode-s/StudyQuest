import { createContext } from "react";
import type { User } from "../lib/types";

export type AuthState = {
  user: User | null;
  loading: boolean;
  /** Why the user was signed out (for example "signed in on another device"). */
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  /** Permanently deletes the account. Throws ApiError (e.g. wrong password). */
  deleteAccount: (password: string) => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);
