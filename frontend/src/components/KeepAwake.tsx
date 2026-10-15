import { useWakeLock } from "../hooks/useWakeLock";
import { useSession } from "../session/useSession";

/** Keeps the phone screen on on every page while a timer is running. */
export default function KeepAwake() {
  const { running } = useSession();
  useWakeLock(running);
  return null;
}
