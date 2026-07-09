import type { CSSProperties } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import Overview from "./pages/Overview";
import Players from "./pages/Players";
import MapsAgents from "./pages/MapsAgents";
import Tactical from "./pages/Tactical";
import MatchDetail from "./pages/MatchDetail";
import { useSeason, stageLabel } from "./season";
import { useReport } from "./hooks";
import { StatParamsProvider } from "./statParams";

function bannerStyle(image: string, primary?: string | null): CSSProperties {
  return {
    backgroundImage: `url(${image})`,
    ["--team-primary" as string]: primary ?? "transparent",
  } as CSSProperties;
}

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/players", label: "Players" },
  { to: "/maps", label: "Maps & Agents" },
  { to: "/tactical", label: "Tactical" },
  { to: "/matches", label: "Match Analysis" },
];

export default function App() {
  const { season, setSeason, stages, loading } = useSeason();
  const { data: report } = useReport();
  const team = report?.team;
  return (
    <StatParamsProvider value={{ tradeWindowMs: report?.trade_window_ms ?? 3000 }}>
    <div className="app">
      {team?.image && (
        <>
          <div className="side-banner left" style={bannerStyle(team.image, team.colors?.primary)} />
          <div className="side-banner right" style={bannerStyle(team.image, team.colors?.primary)} />
        </>
      )}
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
        <div className="stage-filter" title="Filter all stats by Premier stage">
          <span className="stage-filter-label">Stage</span>
          <select value={season} onChange={(e) => setSeason(e.target.value)} disabled={loading}>
            <option value="all">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {stageLabel(s)} ({s.matches})
              </option>
            ))}
          </select>
        </div>
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
        Data via the unofficial HenrikDev API · Not affiliated with Riot Games · Claude Coded...
      </footer>
    </div>
    </StatParamsProvider>
  );
}
