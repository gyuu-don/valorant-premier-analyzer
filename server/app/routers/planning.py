"""Planning endpoints backed by Discord built-in polls."""
from __future__ import annotations

import random
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/api", tags=["planning"])

DISCORD_API = "https://discord.com/api/v10"
IGL_LOCK_THRESHOLD = 5
_igl_state: dict[str, dict[str, Any]] = {}
VALORANT_MAPS = [
    "Abyss",
    "Ascent",
    "Bind",
    "Breeze",
    "Fracture",
    "Haven",
    "Icebox",
    "Lotus",
    "Pearl",
    "Split",
    "Sunset",
]


def _poll_text(message: dict[str, Any]) -> str:
    poll = message.get("poll") or {}
    question = poll.get("question") or {}
    parts = [str(question.get("text") or "")]
    for answer in poll.get("answers") or []:
        media = answer.get("poll_media") or {}
        if media.get("text"):
            parts.append(str(media["text"]))
    return "\n".join(parts)


def _poll_question(message: dict[str, Any]) -> str:
    poll = message.get("poll") or {}
    question = poll.get("question") or {}
    return str(question.get("text") or "Discord poll")


def _find_map(text: str) -> str:
    for map_name in VALORANT_MAPS:
        if re.search(rf"\b{re.escape(map_name)}\b", text, flags=re.IGNORECASE):
            return map_name
    return "Map TBD"


def _find_match_time(message: dict[str, Any], answer_text: str) -> str | None:
    timestamp_match = re.search(r"<t:(\d+)(?::[tTdDfFR])?>", answer_text)
    if timestamp_match:
        dt = datetime.fromtimestamp(int(timestamp_match.group(1)), tz=timezone.utc)
        return dt.isoformat()
    return message.get("timestamp")


def _message_sort_key(message: dict[str, Any]) -> str:
    return str(message.get("timestamp") or message.get("id") or "")


def _display_user(user: dict[str, Any]) -> str:
    global_name = user.get("global_name")
    username = user.get("username")
    discriminator = user.get("discriminator")
    if global_name:
        return str(global_name)
    if discriminator and discriminator != "0" and username:
        return f"{username}#{discriminator}"
    return str(username or user.get("id") or "Unknown")


class IglSelection(BaseModel):
    player_id: str


def _sync_igl_state(slot_id: str, players: list[dict[str, str]]) -> dict[str, str] | None:
    """Keep the chosen IGL only while that player is still available."""
    if not players:
        _igl_state.pop(slot_id, None)
        return None

    player_ids = {p["id"] for p in players}
    voter_signature = ",".join(sorted(player_ids))
    current = _igl_state.get(slot_id)

    if current:
        igl = current.get("igl")
        current["available_players"] = players
        current["voter_signature"] = voter_signature
        if igl and igl.get("id") in player_ids:
            return igl
        current["igl"] = None
        return None

    _igl_state[slot_id] = {
        "available_players": players,
        "voter_signature": voter_signature,
        "igl": None,
        "locked": False,
    }
    return None


def _available_player(slot_id: str, player_id: str) -> dict[str, str]:
    current = _igl_state.get(slot_id)
    players = current.get("available_players") if current else None
    if not players:
        raise HTTPException(status_code=409, detail="Refresh planning before choosing an IGL.")
    for player in players:
        if player["id"] == player_id:
            return player
    raise HTTPException(status_code=400, detail="Selected IGL is not available for this option.")


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bot {token}", "User-Agent": "valorant-premier-analyzer/0.1"}


async def _discord_get(client: httpx.AsyncClient, path: str) -> Any:
    res = await client.get(f"{DISCORD_API}{path}")
    if res.status_code == 401:
        raise HTTPException(status_code=502, detail="Discord rejected DISCORD_BOT_TOKEN.")
    if res.status_code == 403:
        raise HTTPException(
            status_code=502,
            detail="Discord bot cannot read this channel or poll voters.",
        )
    if res.status_code == 404:
        raise HTTPException(status_code=502, detail="Discord channel or poll message not found.")
    res.raise_for_status()
    return res.json()


async def _load_recent_poll_messages(
    client: httpx.AsyncClient,
    channel_id: str,
    count: int = 3,
) -> list[dict[str, Any]]:
    settings = get_settings()
    scan_limit = max(count, settings.discord_poll_scan_limit)
    found: list[dict[str, Any]] = []
    before: str | None = None
    scanned = 0

    while scanned < scan_limit and len(found) < count:
        page_size = min(100, scan_limit - scanned)
        suffix = f"&before={before}" if before else ""
        messages = await _discord_get(client, f"/channels/{channel_id}/messages?limit={page_size}{suffix}")
        if not isinstance(messages, list) or not messages:
            break

        scanned += len(messages)
        for message in messages:
            if message.get("poll"):
                found.append(message)
                if len(found) == count:
                    break

        before = str(messages[-1].get("id"))
        if len(messages) < page_size:
            break

    found.sort(key=_message_sort_key, reverse=True)
    return found[:count]


async def _load_answer_voters(
    client: httpx.AsyncClient,
    channel_id: str,
    message_id: str,
    answer_id: int,
) -> list[dict[str, Any]]:
    users: list[dict[str, Any]] = []
    after: str | None = None
    while True:
        suffix = f"&after={after}" if after else ""
        body = await _discord_get(
            client,
            f"/channels/{channel_id}/polls/{message_id}/answers/{answer_id}?limit=100{suffix}",
        )
        page = body.get("users") if isinstance(body, dict) else []
        if not isinstance(page, list) or not page:
            break
        users.extend(page)
        if len(page) < 100:
            break
        after = str(page[-1].get("id"))
    return users


@router.get("/planning")
async def get_planning():
    settings = get_settings()
    missing = [
        name
        for name, value in {
            "DISCORD_BOT_TOKEN": settings.discord_bot_token,
            "DISCORD_CHANNEL_ID": settings.discord_channel_id,
        }.items()
        if not value
    ]
    if missing:
        return {
            "matches": [],
            "configured": False,
            "missing": missing,
            "source": "discord_poll",
        }

    async with httpx.AsyncClient(headers=_headers(settings.discord_bot_token), timeout=15) as client:
        messages = await _load_recent_poll_messages(client, settings.discord_channel_id)
        matches = []
        for message in messages:
            poll = message.get("poll") or {}
            poll_text = _poll_text(message)
            question = _poll_question(message)
            for idx, answer in enumerate(poll.get("answers") or [], start=1):
                answer_id = int(answer.get("answer_id") or idx)
                media = answer.get("poll_media") or {}
                choice = str(media.get("text") or f"Option {idx}")
                users = await _load_answer_voters(
                    client,
                    settings.discord_channel_id,
                    str(message["id"]),
                    answer_id,
                )
                available_players = [
                    {"id": str(user.get("id")), "name": _display_user(user)}
                    for user in users
                    if not user.get("bot")
                ]
                slot_id = f"{message['id']}:{answer_id}"
                igl = _sync_igl_state(slot_id, available_players)
                matches.append(
                    {
                        "id": slot_id,
                        "poll_id": str(message["id"]),
                        "poll_question": question,
                        "poll_created_at": message.get("timestamp"),
                        "option": str(answer_id),
                        "choice": choice,
                        "map": _find_map(poll_text),
                        "starts_at": _find_match_time(message, choice),
                        "poll_url": f"https://discord.com/channels/{settings.discord_guild_id or '@me'}/{settings.discord_channel_id}/{message['id']}",
                        "available_players": available_players,
                        "igl": igl,
                    }
                )

    return {
        "matches": matches,
        "configured": True,
        "missing": [],
        "source": "discord_poll",
    }


@router.post("/planning/{slot_id}/igl")
async def set_planning_igl(slot_id: str, selection: IglSelection):
    player = _available_player(slot_id, selection.player_id)
    current = _igl_state.setdefault(slot_id, {})
    current["igl"] = player
    current["locked"] = True
    return {"igl": player}


@router.post("/planning/{slot_id}/igl/shuffle")
async def shuffle_planning_igl(slot_id: str):
    current = _igl_state.get(slot_id)
    players = current.get("available_players") if current else None
    if not players:
        raise HTTPException(status_code=409, detail="Refresh planning before shuffling IGL.")
    if len(players) < IGL_LOCK_THRESHOLD:
        raise HTTPException(status_code=400, detail="Shuffle IGL requires at least 5 available players.")

    igl = random.choice(players)
    current["igl"] = igl
    current["locked"] = True
    return {"igl": igl}
