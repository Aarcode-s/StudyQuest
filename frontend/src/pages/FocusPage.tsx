import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Arc, DotText, RingClock } from "../components/Dots";
import Figure from "../components/Figure";
import Logo from "../components/Logo";
import TagChips from "../components/TagChips";
import { ErrorLine, Pill, RoundBtn, Sheet } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { api } from "../lib/api";
import { enterDock } from "../lib/dock";
import { formatClock, formatMinutes, percent } from "../lib/format";
import { setPrefs, usePrefs } from "../lib/prefs";
import type { DailyStats, MemberStatus, Room, Session } from "../lib/types";
import { useSession } from "../session/useSession";

function EndSheet({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const prefs = usePrefs();
  const [tag, setTag] = useState<string | null>(session.tag ?? prefs.tag);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${session.id}`, {
        method: "PATCH",
        body: { tag, rating },
      });
      if (tag) setPrefs({ tag });
      onClose();
    } catch {
      setError("Could not save. Try again or skip.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="mono muted c">Session complete</div>
      <div className="c" style={{ margin: "10px 0 28px" }}>
        <DotText size={76}>{formatClock(session.focus_seconds)}</DotText>
      </div>
      <div className="mono muted" style={{ marginBottom: 12 }}>What did you work on</div>
      <TagChips value={tag} onChange={setTag} />
      <div className="mono muted" style={{ margin: "28px 0 4px" }}>How focused did you feel</div>
      <div className="rds">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`rd ${rating !== null && n <= rating ? "on" : ""}`}
            aria-label={`${n} of 5`}
            onClick={() => setRating(rating === n ? null : n)}
          />
        ))}
      </div>
      <ErrorLine text={error} />
      <div style={{ height: 28 }} />
      <Pill onClick={save} disabled={busy}>Save</Pill>
      <button className="mono muted c" style={{ width: "100%", marginTop: 18 }} onClick={onClose}>
        Skip
      </button>
    </Sheet>
  );
}

export default function FocusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useSession();
  const prefs = usePrefs();
  const { session, running, onBreak, seconds, pomo } = t;

  const rooms = useFetch<Room[]>("/rooms", 30_000);
  const roomId =
    session?.room_id ??
    (rooms.data?.some((r) => r.id === prefs.lastRoomId)
      ? prefs.lastRoomId
      : (rooms.data?.[0]?.id ?? null));
  const room = rooms.data?.find((r) => r.id === roomId) ?? null;

  const status = useFetch<{ members: MemberStatus[] }>(
    roomId ? `/rooms/${roomId}/status` : null,
    5000,
  );
  const stats = useFetch<DailyStats>("/stats/daily?days=7");
  const reloadStats = stats.reload;
  const sessionAtFetch = useRef(0);
  const [pickRoom, setPickRoom] = useState(false);
  const [pickTag, setPickTag] = useState(false);
  const [ended, setEnded] = useState<Session | null>(null);

  useEffect(() => {
    sessionAtFetch.current = seconds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.data]);
  useEffect(() => {
    void reloadStats();
  }, [session?.id, session?.status, reloadStats]);

  const goalSec = (user?.daily_goal_minutes ?? 120) * 60;
  const todayBase = stats.data ? stats.data.days[stats.data.days.length - 1].seconds : 0;
  const today = session
    ? todayBase + Math.max(0, seconds - sessionAtFetch.current)
    : todayBase;
  const goalFrac = Math.min(1, today / goalSec);
  const goalPct = percent(today, goalSec);

  const swap = prefs.swap;
  const bigText = swap ? formatClock(pomo.remaining) : formatClock(seconds);
  const bigLabel = swap
    ? pomo.phase === "break"
      ? pomo.long ? "LONG BREAK" : "BREAK"
      : `POMODORO · ROUND ${pomo.round}/${pomo.rounds}`
    : "TOTAL FOCUS";
  const bigSub = swap
    ? `${prefs.focusMin} FOCUS · ${prefs.breakMin} BREAK`
    : `${goalPct}% OF ${formatMinutes(user?.daily_goal_minutes ?? 120).toUpperCase()} GOAL`;
  const ringFrac = swap ? pomo.frac : goalFrac;
  const smallText = swap ? formatClock(seconds) : formatClock(pomo.remaining);
  const smallLabel = swap
    ? "TOTAL"
    : pomo.phase === "break"
      ? "BREAK"
      : `POMO ${pomo.round}/${pomo.rounds}`;
  const smallFrac = swap ? goalFrac : pomo.frac;

  const label = !session
    ? "READY"
    : onBreak
      ? "ON BREAK"
      : running
        ? "FOCUSING"
        : "PAUSED";

  const others = (status.data?.members ?? []).filter(
    (m) => m.user_id !== user?.id && m.state === "focusing",
  );
  const names = others.map((m) => m.username);
  const whoText =
    names.length === 0
      ? "Nobody else is focusing"
      : names.length === 1
        ? `${names[0]} is focusing`
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} are focusing`;

  async function onStart() {
    if (!roomId) return;
    setPrefs({ lastRoomId: roomId });
    await t.start(roomId, prefs.tag);
  }
  async function onStop() {
    const done = await t.finish();
    if (done && done.focus_seconds > 0) setEnded(done);
  }

  return (
    <>
      <div className="top">
        <div className="brand">
          <Logo size={30} fg="var(--text)" />
          <b className="dot">studyquest</b>
        </div>
        <button
          className="roompill mono"
          disabled={!!session || !rooms.data?.length}
          onClick={() => setPickRoom(true)}
        >
          {room ? `${room.name} ▾` : "No room"}
        </button>
      </div>

      <div className="status">
        <i className={`live ${session && !running ? "" : ""}`} style={!session || !running ? { background: "var(--dot-off2)", boxShadow: "none" } : undefined} />
        <b className="mono">{label}</b>
        <button
          className="tag mono"
          disabled={!!session}
          onClick={() => setPickTag(true)}
        >
          # {(session?.tag ?? prefs.tag ?? "No tag")}
        </button>
      </div>

      <div className="clock">
        <RingClock frac={ringFrac} />
        <div className="cin">
          <DotText size={bigText.length > 5 ? 52 : 68}>{bigText}</DotText>
          <div className="mono">{bigLabel}</div>
          <div className="mono muted" style={{ fontSize: 9.5 }}>{bigSub}</div>
        </div>
        <button
          className="orb"
          aria-label="Swap the two clocks"
          onClick={() => setPrefs({ swap: !swap })}
        >
          <Arc frac={smallFrac} size={108} />
          <div className="oin">
            <DotText size={smallText.length > 5 ? 17 : 25}>{smallText}</DotText>
            <div className="mono muted ol">{smallLabel}</div>
          </div>
        </button>
      </div>

      <div className="ctl">
        {!session ? (
          <Pill icon="play" onClick={onStart} disabled={!roomId || t.busy}>
            Start focus
          </Pill>
        ) : (
          <>
            {onBreak ? (
              <Pill icon="skip" onClick={t.skipBreak} disabled={t.busy}>Skip break</Pill>
            ) : running ? (
              <Pill icon="pause" onClick={() => t.pause("manual")} disabled={t.busy}>Pause</Pill>
            ) : (
              <Pill icon="play" onClick={() => void t.resume()} disabled={t.busy}>Start</Pill>
            )}
            <RoundBtn icon="stop" label="Finish session" onClick={onStop} disabled={t.busy} />
            <RoundBtn icon="dock" label="Dock mode" onClick={() => {
                void enterDock();
                navigate("/dock");
              }} />
          </>
        )}
      </div>
      {!session && rooms.data && rooms.data.length === 0 && (
        <p className="mono muted c" style={{ marginTop: 18 }}>
          <Link to="/rooms" style={{ color: "var(--text)" }}>Create or join a room</Link> to start
        </p>
      )}
      <ErrorLine text={t.error} />
      {t.notice && <p className="okline">{t.notice}</p>}

      <div className="who">
        {others.length > 0 && (
          <span className="stack">
            {others.slice(0, 3).map((m) => (
              <Figure key={m.user_id} name={m.avatar_key} size={34} color="var(--text)" stroke={4} />
            ))}
          </span>
        )}
        <span className="mono muted">{whoText}</span>
      </div>

      <Sheet open={pickRoom} onClose={() => setPickRoom(false)}>
        <h2 className="dot">Room</h2>
        <div className="chs">
          {rooms.data?.map((r) => (
            <button
              key={r.id}
              className={`ch ${r.id === roomId ? "on" : ""}`}
              onClick={() => {
                setPrefs({ lastRoomId: r.id });
                setPickRoom(false);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={pickTag} onClose={() => setPickTag(false)}>
        <h2 className="dot">Tag</h2>
        <TagChips
          value={prefs.tag}
          onChange={(tag) => {
            setPrefs({ tag });
            setPickTag(false);
          }}
        />
      </Sheet>
      {ended && (
        <EndSheet
          session={ended}
          onClose={() => {
            setEnded(null);
            void reloadStats();
          }}
        />
      )}
    </>
  );
}
