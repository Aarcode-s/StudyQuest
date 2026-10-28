export type User = {
  id: number;
  email: string;
  username: string;
  created_at: string;
  avatar_key: string | null;
  daily_goal_minutes: number;
  weekly_goal_minutes: number;
  monthly_goal_minutes: number;
  rest_day: number | null; // 0 = Monday
  hide_details: boolean;
};

export type ProfilePatch = Partial<
  Pick<
    User,
    | "avatar_key"
    | "daily_goal_minutes"
    | "weekly_goal_minutes"
    | "monthly_goal_minutes"
    | "rest_day"
    | "hide_details"
  >
>;

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Room = {
  id: number;
  name: string;
  invite_code: string;
  role: string;
  member_count: number;
  created_at: string;
  min_daily_minutes: number;
  weekly_goal_minutes: number | null;
  focusing_now: number;
  showed_up_today: number;
};

export type MemberState = "focusing" | "on_break" | "idle";

export type MemberStatus = {
  user_id: number;
  username: string;
  state: MemberState;
  elapsed_seconds: number;
  today_seconds: number;
  avatar_key: string | null;
  daily_goal_minutes: number;
  hidden: boolean;
};

export type Session = {
  id: number;
  room_id: number;
  status: string;
  focus_seconds: number;
  started_at: string;
  paused_at: string | null;
  ended_at: string | null;
  tag: string | null;
  rating: number | null;
};

export type PauseReason = "manual" | "left_app" | "pomodoro";

export type DayTotal = { day: string; seconds: number };

export type DailyStats = {
  days: DayTotal[];
  current_streak: number;
  longest_streak: number;
  active_days: number;
  total_seconds: number;
  streak_min_seconds: number;
};

export type Insights = {
  sessions: number;
  hours: number[];
  peak_hours: number[];
  avg_session_seconds: number;
  longest_session_seconds: number;
  breaks_per_hour: number | null;
  avg_break_seconds: number | null;
  left_app_count: number;
  best_weekday: number | null;
  focus_break_ratio: number | null;
  avg_rating: number | null;
  room: {
    breaks_per_hour: number | null;
    avg_session_seconds: number | null;
    members: number;
  };
};

export type WeekMember = {
  user_id: number;
  username: string;
  avatar_key: string | null;
  hidden: boolean;
  days: number[]; // 1 showed, 0 missed, -1 not yet, 2 rest
};

export type RoomWeek = {
  room_id: number;
  week_start: string;
  min_daily_minutes: number;
  weekly_goal_minutes: number | null;
  week_seconds: number;
  members: WeekMember[];
};

export type WeekReview = {
  week_start: string;
  week_end: string;
  iso_week: number;
  total_seconds: number;
  previous_seconds: number;
  change_percent: number | null;
  days: number[];
  active_days: number;
  sessions: number;
  best_day: number | null;
  best_day_seconds: number;
  top_tag: string | null;
};
