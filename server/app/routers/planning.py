"""Planning endpoints backed by Discord built-in polls."""
from __future__ import annotations

import random
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

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


def _pick_igl(slot_id: str, players: list[dict[str, str]]) -> dict[str, str] | None:
    """Pick IGLs predictably between refreshes, but reshuffle while a slot is not full.

    Under 5 voters, any change to the voter set triggers a new random pick. Once a slot
    reaches 5 voters, keep the current IGL unless that user is no longer available.
    """
    if not players:
        _igl_state.pop(slot_id, None)
        return None

    player_ids = {p["id"] for p in players}
    voter_signature = ",".join(sorted(player_ids))
    current = _igl_state.get(slot_id)

    if len(players) < IGL_LOCK_THRESHOLD:
        if current and current.get("voter_signature") == voter_signature:
            igl = current.get("igl")
            if igl and igl.get("id") in player_ids:
                return igl
        igl = random.choice(players)
        _igl_state[slot_id] = {"voter_signature": voter_signature, "igl": igl, "locked": False}
        return igl

    if current:
        igl = current.get("igl")
        if igl and igl.get("id") in player_ids:
            _igl_state[slot_id] = {"voter_signature": voter_signature, "igl": igl, "locked": True}
            return igl

    igl = random.choice(players)
    _igl_state[slot_id] = {"voter_signature": voter_signature, "igl": igl, "locked": True}
    return igl


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
                igl = _pick_igl(slot_id, available_players)
                matches.append(
                    {
                        "id": slot_id,
                        "poll_id": str(message["id"]),
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
