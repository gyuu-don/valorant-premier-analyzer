import json
from pathlib import Path

import pytest

from app.analytics.common import build_context
from app.analytics.rounds import all_breakdowns
from app.models import MatchV4, PremierTeam

FIXTURE = Path(__file__).parent / "fixtures" / "sample_match.json"
ROSTER_PUUIDS = {"p1", "p2", "p3", "p4", "p5"}
TRADE_WINDOW = 4000


@pytest.fixture
def match() -> MatchV4:
    return MatchV4.parse(json.loads(FIXTURE.read_text()))


@pytest.fixture
def context(match):
    ctx = build_context(match, ROSTER_PUUIDS)
    assert ctx is not None
    return ctx


@pytest.fixture
def data(context):
    return all_breakdowns([context], TRADE_WINDOW)


@pytest.fixture
def team() -> PremierTeam:
    # Roster is resolved from teams[].premier_roster in the match, so only the id matters.
    return PremierTeam(id="team-123", name="TestTeam", tag="TST")
