import { useState } from "react";
import { DEFAULT_TAGS, setPrefs, usePrefs } from "../lib/prefs";
import { Chip } from "./ui";

/** Session tags: the four defaults plus tags the person added. */
export default function TagChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (tag: string | null) => void;
}) {
  const prefs = usePrefs();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const tags = [...DEFAULT_TAGS, ...prefs.customTags];

  function add() {
    const t = draft.trim().slice(0, 20);
    setAdding(false);
    setDraft("");
    if (!t) return;
    if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setPrefs({ customTags: [...prefs.customTags, t].slice(-8) });
    }
    onChange(t);
  }

  return (
    <div className="chs">
      {tags.map((t) => (
        <Chip key={t} on={value === t} onClick={() => onChange(value === t ? null : t)}>
          {t}
        </Chip>
      ))}
      {adding ? (
        <input
          className="field"
          style={{ height: 44, width: 150, borderRadius: 22, padding: "0 16px" }}
          autoFocus
          maxLength={20}
          value={draft}
          placeholder="New tag"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
      ) : (
        <Chip onClick={() => setAdding(true)}>+ New</Chip>
      )}
    </div>
  );
}
