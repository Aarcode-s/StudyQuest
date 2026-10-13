export type User = {
  id: number;
  email: string;
  username: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type Room = {
  id: number;
  name: string;
  invite_code: string;
  role: string; // "owner" or "member"
  member_count: number;
  created_at: string;
};

export type MemberState = "focusing" | "on_break" | "idle";

export type MemberStatus = {
  user_id: number;
  username: string;
  state: MemberState;
  elapsed_seconds: number;
  today_seconds: number;
};

export type Session = {
  id: number;
  room_id: number;
  status: string;
  focus_seconds: number;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
};