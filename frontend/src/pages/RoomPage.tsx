import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { DotText } from "../components/Dots";
import Figure from "../components/Figure";
import Icon from "../components/Icon";
import { Chip, ErrorLine, Header, Pill, Segmented, Sheet } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { ApiError, api } from "../lib/api";
import { formatClock, formatMinutes, formatTotal, WEEKDAY_LETTERS } from "../lib/format";
import { setPrefs, usePrefs } from "../lib/prefs";
import type { MemberStatus, RoomWeek } from "../lib/types";
import { useSession } from "../session/useSession";
import type { Room } from "../lib/types";

type Tab = "live" | "race" | "week";

function stateView(m: MemberStatus) {
  if (m.state === "focusing") return <span className="st f"><i className="live" />FOCUSING</span>;
  if (m.state === "on_break") return <span className="st">ON BREAK</span>;
  return <span className="st i">IDLE</span>;
}

export default function RoomPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useSession();
  const prefs = usePrefs();
  const [tab, setTab] = useState<Tab>("live");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [minDraft, setMinDraft] = useState(10);
  const [weeklyDraft, setWeeklyDraft] = useState<number | null>(null);

  const room = useFetch<Room>(`/rooms/${roomId}`, 15_000);
  const status = useFetch<{ members: MemberStatus[] }>(`/rooms/${roomId}/status`, 5000);
  const week = useFetch<RoomWeek>(tab === "week" || tab === "live" ? `/rooms/${roomId}/week` : null, 30_000);

  if (room.error && !room.data) {
    return (
      <main className="screen noNav">
        <Header title="Room" back="/rooms" />
        <p className="errline">{room.error}</p>
      </main>
    );
  }
  const r = room.data;
  const members = status.data?.members ?? [];
  const showed = r?.showed_up_today ?? 0;

  async function copy() {
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function saveSettings() {
    setError(null);
    try {
      await api(`/rooms/${roomId}`, {
        method: "PATCH",
        body: { min_daily_minutes: minDraft, weekly_goal_minutes: weeklyDraft },
      });
      setEditing(false);
      await room.reload();
      await week.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    }
  }

  async function start() {
    setError(null);
    setPrefs({ lastRoomId: Number(roomId) });
    await t.start(roomId, prefs.tag);
    navigate("/");
  }

  async function leave() {
    if (!window.confirm("Leave this room? Your history stays in your own stats.")) return;
    setLeaving(true);
    try {
      await api(`/rooms/${roomId}/leave`, { method: "POST" });
      navigate("/rooms");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setLeaving(false);
    }
  }

  const inThisRoom = t.session?.room_id === Number(roomId);

  return (
    <main className="screen noNav">
      <Header
        title={r?.name ?? "Room"}
        back="/rooms"
        right={
          r && (
            <button className="chip2" onClick={copy} aria-label="Copy invite code">
              <span className="mono">{copied ? "Copied" : r.invite_code}</span>
              <Icon name="copy" size={14} />
            </button>
          )
        }
      />
      <Segmented
        items={[
          { value: "live", label: "Live" },
          { value: "race", label: "Race" },
          { value: "week", label: "Week" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "live" && (
        <>
          {r && (
            <div className="mono muted sec">
              Min commitment · {r.min_daily_minutes} min / day · {showed} of {r.member_count} showed up
            </div>
          )}
          {r?.role === "owner" && (
            <button
              className="mono muted"
              style={{ margin: "-6px 6px 14px", textDecoration: "underline" }}
              onClick={() => {
                setMinDraft(r.min_daily_minutes);
                setWeeklyDraft(r.weekly_goal_minutes);
                setError(null);
                setEditing(true);
              }}
            >
              Change room settings
            </button>
          )}
          {members.map((m) => (
            <div className="mr" key={m.user_id}>
              <div className="fa"><Figure name={m.avatar_key} size={38} color="var(--text)" /></div>
              <div className="mm">
                <b>{m.username}{m.user_id === user?.id ? " (you)" : ""}</b>
                {stateView(m)}
              </div>
              <div className="mt">
                <DotText size={21}>{m.state === "idle" || m.hidden ? "—" : formatClock(m.elapsed_seconds)}</DotText>
                <span className="mono muted">{formatTotal(m.today_seconds)} today</span>
              </div>
            </div>
          ))}
          <ErrorLine text={error ?? t.error} />
          <div className="gap" />
          <Pill icon="play" onClick={start} disabled={t.busy || (!!t.session && !inThisRoom)}>
            {inThisRoom ? "Open timer" : "Start focus here"}
          </Pill>
          {inThisRoom && (
            <button className="mono muted c" style={{ marginTop: 14 }} onClick={() => navigate("/")}>
              You are focusing here
            </button>
          )}
          <button className="mono muted c" style={{ margin: "26px 0 0" }} disabled={leaving} onClick={leave}>
            Leave room
          </button>
        </>
      )}

      {tab === "race" && (
        <>
          <div className="mono muted sec">Today · race to each daily goal</div>
          <div className="racec">
            {members.map((m) => {
              const p = Math.min(1, m.today_seconds / (m.daily_goal_minutes * 60));
              const me = m.user_id === user?.id;
              return (
                <div className="lane" key={m.user_id}>
                  <div className="track">
                    <div className="rn" style={{ left: `calc(${p * 100}% - ${p * 30}px)` }}>
                      <Figure name="run" size={30} color={me ? "var(--red)" : "var(--text)"} stroke={4} />
                    </div>
                  </div>
                  <span className="mono muted nm">
                    {m.username} · {formatTotal(m.today_seconds)} / {formatMinutes(m.daily_goal_minutes)}
                  </span>
                </div>
              );
            })}
            <div className="flagl mono muted">GOAL</div>
          </div>
        </>
      )}

      {(tab === "week" || tab === "race") && week.data && (
        <>
          <div className="mono muted sec" style={{ marginTop: 20 }}>Who showed up this week</div>
          <div className="mat">
            <div className="mrow">
              <span className="nm2" />
              {WEEKDAY_LETTERS.map((d, i) => <span key={i} className="mono muted dh">{d}</span>)}
            </div>
            {week.data.members.map((m) => (
              <div className="mrow" key={m.user_id}>
                <span className="mono muted nm2">{m.username}</span>
                {m.days.map((d, i) => (
                  <i key={i} className={`cx ${d === 1 ? "" : d === 0 ? "off" : d === 2 ? "rest" : "fut"}`} />
                ))}
              </div>
            ))}
          </div>
          {week.data.weekly_goal_minutes && (
            <div className="goalbar">
              <div className="mono muted">
                Room weekly goal · {formatTotal(week.data.week_seconds)} of {formatMinutes(week.data.weekly_goal_minutes)}
              </div>
              <div className="bar" style={{ marginTop: 12 }}>
                <u style={{ width: `${Math.min(100, (week.data.week_seconds / (week.data.weekly_goal_minutes * 60)) * 100)}%` }} />
              </div>
            </div>
          )}
        </>
      )}
      <Sheet open={editing} onClose={() => setEditing(false)}>
        <h2 className="dot">Room settings</h2>
        <div className="mono muted" style={{ marginBottom: 10 }}>Daily minimum to “show up”</div>
        <div className="chs">
          {[10, 20, 30, 45, 60].map((m) => (
            <Chip key={m} on={minDraft === m} onClick={() => setMinDraft(m)}>{m} min</Chip>
          ))}
        </div>
        <div className="mono muted" style={{ margin: "26px 0 10px" }}>Room weekly goal</div>
        <div className="chs">
          {([["None", null], ["10h", 600], ["20h", 1200], ["40h", 2400]] as const).map(([label, v]) => (
            <Chip key={label} on={weeklyDraft === v} onClick={() => setWeeklyDraft(v)}>{label}</Chip>
          ))}
        </div>
        <p className="muted2" style={{ marginTop: 18 }}>Applies to this week and onwards, for everyone in the room.</p>
        <ErrorLine text={error} />
        <div style={{ height: 24 }} />
        <Pill onClick={saveSettings}>Save</Pill>
      </Sheet>
    </main>
  );
}
