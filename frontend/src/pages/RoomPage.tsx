import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { DotText } from "../components/Dots";
import Figure from "../components/Figure";
import Icon from "../components/Icon";
import DurationInput, { clampMinutes } from "../components/DurationInput";
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
  const [customDraft, setCustomDraft] = useState(false);
  const [askLeave, setAskLeave] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [picked, setPicked] = useState<MemberStatus | null>(null);

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
        body: { min_daily_minutes: minDraft, weekly_goal_minutes: weeklyDraft === null ? null : clampMinutes(weeklyDraft, 60, 6000) },
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

  async function deleteRoom() {
    setLeaving(true);
    try {
      await api(`/rooms/${roomId}`, { method: "DELETE" });
      navigate("/rooms");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setLeaving(false);
      setAskDelete(false);
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await api(`/rooms/${roomId}/leave`, { method: "POST" });
      navigate("/rooms");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setLeaving(false);
    }
  }

  function openSettings() {
    if (!r) return;
    setMinDraft(r.min_daily_minutes);
    setWeeklyDraft(r.weekly_goal_minutes);
    setCustomDraft(![null, 600, 1200, 2400].includes(r.weekly_goal_minutes));
    setError(null);
    setEditing(true);
  }

  const ranked = [...members].sort((a, b) => b.today_seconds - a.today_seconds);
  const lead = Math.max(1, ranked[0]?.today_seconds ?? 0);
  const inThisRoom = t.session?.room_id === Number(roomId);

  return (
    <main className="screen noNav">
      <Header
        title={r?.name ?? "Room"}
        back="/rooms"
        right={
          r && (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              {r.role === "owner" && (
                <button className="chip2" style={{ padding: 9 }} onClick={openSettings} aria-label="Room settings">
                  <Icon name="gear" size={18} />
                </button>
              )}
              <button className="chip2" onClick={copy} aria-label="Copy invite code">
                <span className="mono">{copied ? "Copied" : r.invite_code}</span>
                <Icon name="copy" size={14} />
              </button>
            </span>
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
            <div className="rinfo">
              <div><span className="mono muted">MINIMUM</span><b className="dot">{r.min_daily_minutes}m / day</b></div>
              <div><span className="mono muted">SHOWED UP</span><b className="dot">{showed} / {r.member_count}</b></div>
            </div>
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
          <Pill
            icon="play"
            onClick={inThisRoom ? () => navigate("/") : start}
            disabled={t.busy || (!!t.session && !inThisRoom)}
          >
            {inThisRoom ? "Open timer" : "Start focus here"}
          </Pill>
          {t.session && !inThisRoom && (
            <p className="mono muted c" style={{ marginTop: 14 }}>
              You are focusing in another room · finish that session first
            </p>
          )}
          <button className="mono muted c" style={{ margin: "26px 0 0" }} disabled={leaving} onClick={() => setAskLeave(true)}>
            Leave room
          </button>
        </>
      )}

      {tab === "race" && (
        <>
          <div className="mono muted sec">Today · who focused the most · tap a name</div>
          {ranked.map((m, i) => {
            const me = m.user_id === user?.id;
            const w = m.hidden ? 0 : (m.today_seconds / lead) * 100;
            return (
              <button type="button" className="rk" key={m.user_id} onClick={() => setPicked(m)}>
                <span className="dot rkn">{i + 1}</span>
                <div className="rkm">
                  <div className="rkt">
                    <b>{m.username}{me ? " (you)" : ""}</b>
                    <span className="mono muted">{m.hidden ? "Hidden" : formatTotal(m.today_seconds)}</span>
                  </div>
                  <div className={`bar ${me ? "" : "g"}`}><u style={{ width: `${w}%` }} /></div>
                </div>
              </button>
            );
          })}
        </>
      )}

      {tab === "week" && week.data && (
        <>
          <div className="mono muted sec">Who showed up this week</div>
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
      <Sheet open={askLeave} onClose={() => setAskLeave(false)}>
        <h2 className="dot">Leave room?</h2>
        <p className="muted2" style={{ marginBottom: 24 }}>You will stop appearing in this room. Your focus history stays in your own stats, and you can rejoin with the invite code.</p>
        <Pill kind="danger" disabled={leaving} onClick={leave}>Leave room</Pill>
        <div style={{ height: 12 }} />
        <Pill kind="ghost" onClick={() => setAskLeave(false)}>Stay</Pill>
      </Sheet>
      <Sheet open={!!picked} onClose={() => setPicked(null)}>
        {picked && (() => {
          const g = picked.daily_goal_minutes * 60;
          const pc = Math.min(100, Math.round((picked.today_seconds / g) * 100));
          return (
            <>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
                <div className="fa"><Figure name={picked.avatar_key} size={38} color="var(--text)" /></div>
                <h2 className="dot" style={{ margin: 0 }}>{picked.username}</h2>
              </div>
              {picked.hidden ? (
                <p className="mono muted">This member keeps their stats private.</p>
              ) : (
                <>
                  <div className="mono muted">PERSONAL DAILY GOAL</div>
                  <div style={{ margin: "14px 0" }}><DotText size={54}>{`${pc}%`}</DotText></div>
                  <div className="bar"><u style={{ width: `${pc}%` }} /></div>
                  <p className="mono muted" style={{ marginTop: 14 }}>
                    {formatTotal(picked.today_seconds)} of {formatMinutes(picked.daily_goal_minutes)} today
                  </p>
                </>
              )}
              <div style={{ height: 24 }} />
              <Pill kind="ghost" onClick={() => setPicked(null)}>Close</Pill>
            </>
          );
        })()}
      </Sheet>
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
            <Chip key={label} on={!customDraft && weeklyDraft === v} onClick={() => { setCustomDraft(false); setWeeklyDraft(v); }}>{label}</Chip>
          ))}
          <Chip on={customDraft} onClick={() => { setCustomDraft(true); setWeeklyDraft(weeklyDraft ?? 900); }}>Custom</Chip>
        </div>
        {customDraft && (
          <div style={{ marginTop: 14 }}>
            <DurationInput minutes={weeklyDraft ?? 900} onChange={setWeeklyDraft} />
          </div>
        )}
        <p className="muted2" style={{ marginTop: 18 }}>Applies to this week and onwards, for everyone in the room.</p>
        <ErrorLine text={error} />
        <div style={{ height: 24 }} />
        <Pill onClick={saveSettings}>Save</Pill>
        <button type="button" className="mono muted c" style={{ margin: "22px 0 0", width: "100%", color: "var(--red)" }} onClick={() => { setEditing(false); setAskDelete(true); }}>
          Delete room
        </button>
      </Sheet>
      <Sheet open={askDelete} onClose={() => setAskDelete(false)}>
        <h2 className="dot">Delete room?</h2>
        <p className="muted2" style={{ marginBottom: 24 }}>
          “{r?.name}” is removed for everyone, and all focus time recorded in it is deleted for every member too. This cannot be undone.
        </p>
        <Pill kind="danger" disabled={leaving} onClick={deleteRoom}>Delete for everyone</Pill>
        <div style={{ height: 12 }} />
        <Pill kind="ghost" onClick={() => setAskDelete(false)}>Keep room</Pill>
      </Sheet>
    </main>
  );
}
