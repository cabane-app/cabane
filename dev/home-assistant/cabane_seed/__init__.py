"""Seed portable projects into the local dev server's Cabane workspace store."""

import json
import logging
import os
import time
from pathlib import Path

from custom_components.cabane.storage import ConflictError

_LOGGER = logging.getLogger(__name__)


def _load_projects(directory):
    return [
        json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(directory.glob("*.project.json"))
    ]


async def async_setup(hass, _config):
    store = hass.data["cabane"]
    origin = os.environ["CABANE_HA_DEV_URL"]
    projects = await hass.async_add_executor_job(
        _load_projects, Path(hass.config.path("cabane-dev-workspaces"))
    )
    now = time.time_ns() // 1_000_000
    for project in projects:
        home = project["home"]
        document = {
            "format": "cabane-workspace",
            "version": 1,
            "workspace": {
                "name": home["name"],
                "homeAssistantUrl": origin,
                "hasPublished": True,
            },
            "record": {
                "schemaVersion": 2,
                "homeId": home["id"],
                "seedRevision": project["seedRevision"],
                "revision": 0,
                "draft": project,
                "published": project,
                "bindings": {},
                "draftUpdatedAt": now,
                "publishedAt": now,
            },
        }
        try:
            # A version also exists for deleted workspaces, so they stay deleted.
            await store.put(home["id"], json.dumps(document), expected_version=None)
        except ConflictError:
            continue
        _LOGGER.info("Seeded Cabane workspace %s", home["name"])
    return True
