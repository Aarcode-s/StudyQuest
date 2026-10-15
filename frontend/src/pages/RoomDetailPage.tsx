import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ApiError, api } from "../lib/api";
import { avatarColor, formatClock, formatTotal } from "../lib/format";
import type { MemberState, MemberStatus, Room } from "../lib/types";
import "./room.css";
import Leaderboard from "../components/Leaderboard";
import TimerCard from "../components/TimerCard";

const POLL_MS = 5000;
const MAX_DRIFT_SECONDS = 15; // never extrapolate far past the last server value

const STATE_LABEL: Record<MemberState, string> = {
  focusing: "Focusing",
  on_break: "On break",
  idle: "Idle",
};
const STATE_ORDER: Record<MemberState, number> = {
  focusing: 0,
  on_break: 1,
  idle: 2,
};

type StatusResponse = MemberStatus[] | { members: MemberStatus[] };

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<MemberStatus[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [fatal, setFatal] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Room header (name, invite code)
  useEffect(() => {
    let cancelled = false;
    api<Room>(`/rooms/${roomId}`)
      .then((r) => {
        if (!cancelled) setRoom(r);
      })
      .catch((e) => {
        if (!cancelled)
          setFatal(
            e instanceof ApiError && e.status === 404
              ? "Room not found, or you are not a member."
              : e instanceof ApiError
                ? e.message
                : "Something went wrong.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Poll who-is-in every 5 seconds (paused while the tab is hidden)
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const data = await api<StatusResponse>(`/rooms/${roomId}/status`);
        if (cancelled) return;
        setMembers(Array.isArray(data) ? data : data.members);
        setFetchedAt(Date.now());
        setStale(false);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setFatal("Room not found, or you are not a member.");
        } else {
          setStale(true);
        }
      } finally {
        inFlight = false;
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId]);

  // 1-second tick so Focusing members count up between polls
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function leave() {
    if (!window.confirm("Leave this room?")) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      await api(`/rooms/${roomId}/leave`, { method: "POST" });
      navigate("/rooms", { replace: true });
    } catch (e) {
      setLeaveError(e instanceof ApiError ? e.message : "Something went wrong.");
      setLeaving(false);
    }
  }

  if (fatal) {
    return (
      <main className="screen room">
        <div className="error-box" role="alert">
          {fatal}
        </div>
        <Link to="/rooms" className="btn-outline" style={linkBtn}>
          Back to rooms
        </Link>
      </main>
    );
  }

  const drift = Math.min(
    MAX_DRIFT_SECONDS,
    Math.max(0, Math.floor((now - fetchedAt) / 1000)),
  );

  const sorted = members
    ? [...members].sort((a, b) => {
        const aMe = a.user_id === user?.id ? 0 : 1;
        const bMe = b.user_id === user?.id ? 0 : 1;
        if (aMe !== bMe) return aMe - bMe;
        if (STATE_ORDER[a.state] !== STATE_ORDER[b.state])
          return STATE_ORDER[a.state] - STATE_ORDER[b.state];
        return a.username.localeCompare(b.username);
      })
    : null;

  return (
    <main className="screen room">
      <header className="room__head">
        <Link to="/rooms" className="icon-btn" aria-label="Back to rooms">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="room__titles">
          <h1 className="title room__name">{room?.name ?? "Room"}</h1>
          {room && <div className="room__code">Invite code {room.invite_code}</div>}
        </div>
      </header>

      <TimerCard roomId={roomId ?? ""} />

      <section aria-label="Who is in" style={{ display: "contents" }}>
        <div className="section-head">
          <h2>Who is in</h2>
          <span>Updates every 5 seconds</span>
        </div>

        {stale && (
          <div className="stale" role="status">
            Connection problem. Retrying...
          </div>
        )}

        {sorted === null ? (
          <div className="notice">Loading...</div>
        ) : (
          <ul className="members">
            {sorted.map((m) => {
              const live = m.state === "focusing" ? drift : 0;
              const isMe = m.user_id === user?.id;
              return (
                <li key={m.user_id} className="member">
                  <div
                    className="member__avatar"
                    style={{ background: avatarColor(m.user_id) }}
                    aria-hidden="true"
                  >
                    {m.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="member__main">
                    <div className="member__name">
                      {m.username}
                      {isMe ? " (you)" : ""}
                    </div>
                    <div className="member__state">
                      <span className={`state-badge state-badge--${m.state}`}>
                        {STATE_LABEL[m.state]}
                      </span>
                      {m.state !== "idle" && (
                        <span className="member__elapsed">
                          {formatClock(m.elapsed_seconds + live)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="member__today">
                    <strong>{formatTotal(m.today_seconds + live)}</strong>
                    <small>today</small>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Leaderboard roomId={roomId ?? ""} />

      <Link to="/stats" className="stats-link">
        <span>
          <strong>Your streak and daily grid</strong>
          <small>See how many days in a row you have focused</small>
        </span>
        <span aria-hidden="true">&rsaquo;</span>
      </Link>

      <p className="footnote">
        Times are recorded timer time. They show when a timer ran, not
        verified productivity.
      </p>

      {leaveError && (
        <div className="error-box" role="alert">
          {leaveError}
        </div>
      )}
      <button
        type="button"
        className="link-button"
        onClick={leave}
        disabled={leaving}
      >
        {leaving ? "Leaving..." : "Leave room"}
      </button>
    </main>
  );
}

const linkBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};
