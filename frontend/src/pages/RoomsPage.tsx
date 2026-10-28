import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorLine, Chip, Field, Header, Pill, RoundBtn, Sheet } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { ApiError, api } from "../lib/api";
import type { Room } from "../lib/types";

const MINS = [10, 20, 30, 45, 60];
const WEEKLY: { label: string; value: number | null }[] = [
  { label: "None", value: null },
  { label: "10h", value: 600 },
  { label: "20h", value: 1200 },
  { label: "40h", value: 2400 },
];

function RoomCard({ room, onOpen }: { room: Room; onOpen: () => void }) {
  return (
    <button className="rc" onClick={onOpen}>
      <div className="rct">
        <div className="rav dot">{room.name.slice(0, 1).toUpperCase()}</div>
        <div className="rcm">
          <b>{room.name}</b>
          <span className="mono muted">
            {room.member_count} {room.member_count === 1 ? "member" : "members"} · min {room.min_daily_minutes} min
          </span>
        </div>
      </div>
      <div className="rcb">
        {room.focusing_now > 0 ? (
          <span className="lv"><i className="live" />{room.focusing_now} FOCUSING</span>
        ) : (
          <span className="lv q">QUIET</span>
        )}
        <span className="showed">
          <span className="mono muted">SHOWED UP</span>
          {Array.from({ length: Math.min(room.member_count, 8) }, (_, i) => (
            <i key={i} className={`sd ${i < room.showed_up_today ? "on" : ""}`} />
          ))}
        </span>
      </div>
    </button>
  );
}

export default function RoomsPage() {
  const navigate = useNavigate();
  const rooms = useFetch<Room[]>("/rooms", 10_000);
  const [create, setCreate] = useState(false);
  const [join, setJoin] = useState(false);
  const [name, setName] = useState("");
  const [min, setMin] = useState(10);
  const [weekly, setWeekly] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<Room>("/rooms", {
        method: "POST",
        body: { name: name.trim(), min_daily_minutes: min, weekly_goal_minutes: weekly },
      });
      setCreate(false);
      setName("");
      navigate(`/rooms/${r.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submitJoin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<Room>("/rooms/join", { method: "POST", body: { invite_code: code } });
      setJoin(false);
      setCode("");
      navigate(`/rooms/${r.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title="Rooms"
        right={<RoundBtn small icon="plus" label="New room" onClick={() => { setError(null); setCreate(true); }} />}
      />
      {rooms.error && <ErrorLine text={rooms.error} />}
      {rooms.data?.map((r) => (
        <RoomCard key={r.id} room={r} onOpen={() => navigate(`/rooms/${r.id}`)} />
      ))}
      {rooms.data?.length === 0 && (
        <p className="mono muted c" style={{ margin: "30px 0" }}>No rooms yet · create one or join with a code</p>
      )}
      <div style={{ marginTop: 8 }}>
        <Pill kind="ghost" onClick={() => { setError(null); setJoin(true); }}>Join with a code</Pill>
      </div>

      <Sheet open={create} onClose={() => setCreate(false)}>
        <form onSubmit={submitCreate}>
          <h2 className="dot">New room</h2>
          <Field label="Room name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="DSA grind" />
          <div className="mono muted" style={{ margin: "26px 6px 10px" }}>Daily minimum to “show up”</div>
          <div className="chs">
            {MINS.map((m) => (
              <Chip key={m} on={min === m} onClick={() => setMin(m)}>{m} min</Chip>
            ))}
          </div>
          <div className="mono muted" style={{ margin: "26px 6px 10px" }}>Room weekly goal (optional)</div>
          <div className="chs">
            {WEEKLY.map((w) => (
              <Chip key={w.label} on={weekly === w.value} onClick={() => setWeekly(w.value)}>{w.label}</Chip>
            ))}
          </div>
          <ErrorLine text={error} />
          <div style={{ height: 28 }} />
          <Pill type="submit" disabled={busy || !name.trim()}>Create room</Pill>
        </form>
      </Sheet>

      <Sheet open={join} onClose={() => setJoin(false)}>
        <form onSubmit={submitJoin}>
          <h2 className="dot">Join a room</h2>
          <Field label="Invite code" required maxLength={16} autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7QX2M" />
          <ErrorLine text={error} />
          <div style={{ height: 28 }} />
          <Pill type="submit" disabled={busy || !code.trim()}>Join</Pill>
        </form>
      </Sheet>
    </>
  );
}
