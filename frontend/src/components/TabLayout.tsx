import { Outlet } from "react-router-dom";
import Nav from "./Nav";

/** Pages that show the floating bottom navigation. */
export default function TabLayout() {
  return (
    <>
      <main className="screen">
        <Outlet />
      </main>
      <Nav />
    </>
  );
}
