import { NavLink, Route, Routes } from "react-router-dom";
import Overview from "./pages/Overview";
import Players from "./pages/Players";
import MapsAgents from "./pages/MapsAgents";
import Tactical from "./pages/Tactical";
import MatchDetail from "./pages/MatchDetail";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/players", label: "Players" },
  { to: "/maps", label: "Maps & Agents" },
  { to: "/tactical", label: "Tactical" },
  { to: "/matches", label: "Match Deep-Dive" },
];

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▲</span> Valorant Premier Analyzer
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/players" element={<Players />} />
          <Route path="/maps" element={<MapsAgents />} />
          <Route path="/tactical" element={<Tactical />} />
          <Route path="/matches" element={<MatchDetail />} />
        </Routes>
      </main>
      <footer className="footer">
        Data via the unofficial HenrikDev API · Not affiliated with Riot Games
      </footer>
    </div>
  );
}
