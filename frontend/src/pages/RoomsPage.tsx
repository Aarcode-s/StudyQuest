import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ApiError, api } from "../lib/api";
import type { Room } from "../lib/types";
import "./rooms.css";

type Panel = "create" | "join" | null;

const TILE_COLORS = [
  "var(--lime)",
  "var(--pink)",
  "var(--amber)",
  "var(--cyan)",
  "var(--lavender)",
];

function tileColor(id: number | string): string {
  const s = String(id);
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return TILE_COLORS[sum % TILE_COLORS.length];
}

function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong.";
}

export default function RoomsPage() {
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [panel, setPanel] = useState<Panel>(null);
  const [value, setValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchRooms = useCallback(() => api<Room[]>("/rooms"), []);

  useEffect(() => {
    let cancelled = false;
    fetchRooms()
      .then((r) => {
        if (!cancelled) setRooms(r);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorText(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRooms, reloadKey]);

  function retry() {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  }

  function togglePanel(next: Exclude<Panel, null>) {
    setPanel((p) => (p === next ? null : next));
    setValue("");
    setFormError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!panel) return;
    const text = value.trim();
    if (!text) {
      setFormError(
        panel === "create" ? "Enter a room name." : "Enter an invite code.",
      );
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (panel === "create") {
        await api("/rooms", { method: "POST", body: { name: text } });
      } else {
        await api("/rooms/join", {
          method: "POST",
          body: { invite_code: text.toUpperCase() },
        });
      }
      setRooms(await fetchRooms());
      setPanel(null);
      setValue("");
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(room: Room) {
    try {
      await navigator.clipboard.writeText(room.invite_code);
      setNotice(null);
      setCopiedId(room.id);
      setTimeout(() => setCopiedId((c) => (c === room.id ? null : c)), 1500);
    } catch {
      setNotice("Couldn't copy. Press and hold the code to copy it.");
    }
  }

  return (
    <main className="screen rooms">
      <header className="rooms__head">
        <div>
          <div className="rooms__welcome">Welcome back</div>
          <h1 className="title rooms__title">Your rooms</h1>
        </div>
        <div className="avatar" aria-hidden="true">
          {user?.username.charAt(0).toUpperCase()}
        </div>
      </header>

      <div className="rooms__actions">
        <button
          type="button"
          className="btn-gradient"
          aria-pressed={panel === "create"}
          onClick={() => togglePanel("create")}
        >
          + Create room
        </button>
        <button
          type="button"
          className="btn-outline"
          aria-pressed={panel === "join"}
          onClick={() => togglePanel("join")}
        >
          Join with code
        </button>
      </div>

      {panel && (
        <form className="panel" onSubmit={submit} noValidate>
          <div className="panel__row">
            <input
              aria-label={panel === "create" ? "Room name" : "Invite code"}
              placeholder={
                panel === "create" ? "Room name" : "Invite code, e.g. K7M2QX9D"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              autoCapitalize={panel === "join" ? "characters" : "words"}
              autoComplete="off"
            />
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "…" : panel === "create" ? "Create" : "Join"}
            </button>
          </div>
          {formError && (
            <div className="error-box" role="alert">
              {formError}
            </div>
          )}
        </form>
      )}

      {notice && <div className="notice">{notice}</div>}

      {loading ? (
        <div className="notice">Loading rooms…</div>
      ) : loadError ? (
        <div className="panel">
          <div className="error-box" role="alert">
            {loadError}
          </div>
          <button type="button" className="btn-outline" onClick={retry}>
            Try again
          </button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="empty">
          No rooms yet. Create one, or join a friend's room with their invite
          code.
        </div>
      ) : (
        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.id} className="room-card">
              <Link to={`/rooms/${room.id}`} className="room-card__top">
                <div
                  className="room-card__tile"
                  style={{ background: tileColor(room.id) }}
                  aria-hidden="true"
                >
                  {room.name.charAt(0).toUpperCase()}
                </div>
                <div className="room-card__info">
                  <div className="room-card__name">{room.name}</div>
                  <div className="room-card__members">
                    {room.member_count}{" "}
                    {room.member_count === 1 ? "member" : "members"}
                  </div>
                </div>
                <span
                  className={`badge ${room.role === "owner" ? "badge--owner" : ""}`}
                >
                  {room.role.charAt(0).toUpperCase() + room.role.slice(1)}
                </span>
              </Link>
              <div className="room-card__code">
                <div>
                  <small>Invite code</small>
                  <strong>{room.invite_code}</strong>
                </div>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => copyCode(room)}
                  aria-label={`Copy invite code for ${room.name}`}
                >
                  {copiedId === room.id ? "Copied" : "Copy"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="link-button" onClick={logout}>
        Log out
      </button>
    </main>
  );
}