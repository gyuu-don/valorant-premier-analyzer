# Valorant Premier Team Performance Analyzer

A web app that analyzes a **Valorant Premier team's** match performance and turns it into
**actionable coaching insight** — entry duels, trades, site holds/retakes, an advanced
team MVP rating, attack/defense splits, and per-player utility usage.

- **Backend:** Python + FastAPI (async HenrikDev client, caching, analytics engine)
- **Frontend:** React + TypeScript (Vite, React Query, Recharts)
- **Data source:** the unofficial [HenrikDev API](https://docs.henrikdev.xyz) — see limitations below.

---

## Why HenrikDev and not the official Riot API?

Riot's **official** Valorant API (`developer.riotgames.com`) has **no Premier endpoints**
— there is no way to look up a Premier team, its roster, or its Premier match history —
and it blocks personal/developer keys for Valorant (production key + RSO required). It is
therefore not usable for a Premier team analyzer.

The **HenrikDev** unofficial API exposes dedicated Premier endpoints (team search, team
details + roster, match history, conferences, leaderboards) plus rich underlying match
data (kill events with timestamps, per-round plant/defuse + economy, per-player
K/D/A/score/headshots/damage, agents). This app is built on it.

> Not affiliated with or endorsed by Riot Games.

---

## Setup

### 1. Get a HenrikDev API key
Create a free key at <https://api.henrikdev.xyz/dashboard> (requires joining their Discord).

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in:
- `HENRIK_API_KEY` — your key
- `PREMIER_TEAM_NAME`, `PREMIER_TEAM_TAG` — your team's name and tag
- `PREMIER_REGION` — `na`, `eu`, `ap`, `kr`, `latam`, or `br`

### 3. Backend (Python 3.10+)
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```
Interactive API docs: <http://localhost:8000/docs>

### 4. Frontend
```bash
cd client
npm install
npm run dev                          # http://localhost:5173 (proxies /api to :8000)
```

### Run both together (optional)
From the repo root, after both installs and creating the venv:
```bash
npm install          # installs "concurrently"
npm run dev          # runs FastAPI + Vite together
```

---

## What it shows

| Page | Content |
|---|---|
| **Overview** | Record, recent form, **advanced team MVP** card, attack/defense & economy win rates |
| **Players** | ACS, K/D, ADR, KAST%, HS%, multikills, clutches + a per-player radar |
| **Maps & Agents** | Per-map win rate + attack/defense round split, agent usage |
| **Tactical** | Coaching callouts, entry duels, trades, holds/retakes, post-plant, utility |
| **Match Deep-Dive** | Scoreboard + round-by-round timeline for a single match |

### Advanced metrics
- **Advanced team MVP** — a composite *impact rating* (ACS, KAST, entry win rate, trade
  contribution, multikills, clutches, ADR; min-max normalized across the roster and
  weighted in `server/app/config.py`). Riot's raw-score MVP is shown alongside for contrast.
- **Attack/defense split** — round win rate by side + eco/force/full-buy win rates.
- **Entries / trades / site play** — opening-duel win %, deaths-traded %, defense
  holds vs retakes, attack post-plant conversion. Side per round is inferred from spike
  plant events + the standard 12/12 half structure.

---

## API limitations (read me)

- **No official Premier data.** Everything Premier-specific comes from HenrikDev.
- **Utility "effectiveness" is a proxy.** The match payload exposes ability casts only as
  per-match *aggregate* counts and does not timestamp casts against kills. The utility page
  reports **casts-per-round** and **assists-per-round** as proxies for utility impact — not
  a precise "utility that was followed up on" causation metric. This is labeled in the UI.
- **Clutches / side inference are heuristics** derived from kill order and plant events,
  not explicit API fields.
- **Roster source:** the `/premier/{name}/{tag}` endpoint often returns an empty roster,
  so the app identifies your team inside each match via `teams[].premier_roster.id` and
  reads the participating PUUIDs from there — no manual roster entry needed.
- **Analyzed record vs official standing:** the "Record (N analyzed)" card counts the
  league matches actually pulled and analyzed (there can be several per Premier match
  night). Your **official Premier standing** (W–L, division, points) is shown separately
  in the header. These two numbers are expected to differ.
- **Field names:** the analytics key off `server/app/models.py`. If HenrikDev changes its
  v4 schema, adjust the models there (confirm against a live sample or the OpenAPI spec at
  <https://api.henrikdev.xyz/docs>). Models are defensive (`extra="ignore"`, optional
  fields) so drift degrades gracefully rather than crashing.

---

## Tests
```bash
cd server && source .venv/bin/activate
pytest -q
```
Deterministic unit tests run against a saved sample match fixture (no network).

---

## Project layout
```
server/   FastAPI backend + analytics engine (app/analytics/*)
client/   React + Vite frontend
.env      your secrets (never committed)
```
