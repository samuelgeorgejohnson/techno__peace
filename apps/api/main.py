import json
import os
import subprocess
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse

app = FastAPI(title="TechnoPeace API")

DEFAULT_AIR_RADIUS_KM = 80
DEFAULT_AIR_TIMEOUT_MS = 8_000
DEFAULT_AIR_LIMIT = 100
MAX_AIR_RADIUS_KM = 400
MIN_AIR_TIMEOUT_MS = 501
MAX_AIR_TIMEOUT_MS = 20_000
MAX_AIR_LIMIT = 500
NODE_WORKER_PATH = Path(__file__).with_name("airTrafficSignalWorker.ts")


def _resolve_bounded_int_env(
    name: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int | None = None,
) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default

    try:
        parsed = int(raw)
    except ValueError:
        return default

    if parsed < minimum:
        return default

    if maximum is not None and parsed > maximum:
        return maximum

    return parsed


def _build_air_runtime_overrides() -> dict[str, int]:
    return {
        "radiusKm": _resolve_bounded_int_env(
            "AIR_TRAFFIC_RADIUS_KM",
            DEFAULT_AIR_RADIUS_KM,
            maximum=MAX_AIR_RADIUS_KM,
        ),
        "timeoutMs": _resolve_bounded_int_env(
            "AIR_TRAFFIC_TIMEOUT_MS",
            DEFAULT_AIR_TIMEOUT_MS,
            minimum=MIN_AIR_TIMEOUT_MS,
            maximum=MAX_AIR_TIMEOUT_MS,
        ),
        "limit": _resolve_bounded_int_env(
            "AIR_TRAFFIC_LIMIT",
            DEFAULT_AIR_LIMIT,
            maximum=MAX_AIR_LIMIT,
        ),
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/signals")
def signals(
    lat: float = Query(..., description="Latitude for signal lookup."),
    lon: float = Query(..., description="Longitude for signal lookup."),
):
    """
    Server-owned signal endpoint.

    Current scope (narrow): returns only the normalized man-made air signal,
    sourced through the typed @technopeace/codex-data adapter in a Node worker.
    """
    air_runtime = _build_air_runtime_overrides()

    worker_payload = {
        "lat": lat,
        "lon": lon,
        **air_runtime,
    }

    air = None
    air_status: Literal["live", "unavailable"] = "unavailable"
    air_error = None

    try:
        worker_process = subprocess.run(
            [
                "node",
                "--experimental-strip-types",
                str(NODE_WORKER_PATH),
            ],
            input=json.dumps(worker_payload),
            capture_output=True,
            text=True,
            check=False,
        )

        stdout_payload = worker_process.stdout.strip() or "{}"
        parsed_worker_response = json.loads(stdout_payload)

        air = parsed_worker_response.get("air")
        air_error = parsed_worker_response.get("error")
        if air is not None:
            air_status = "live"
        elif not air_error:
            air_error = f"Air worker exited with status {worker_process.returncode}."
    except (json.JSONDecodeError, OSError, ValueError) as error:
        air_error = f"Air signal worker invocation failed: {error}"

    response = {
        "coordinates": {
            "lat": lat,
            "lon": lon,
        },
        "manMade": {
            "air": air,
        },
        "meta": {
            "airStatus": air_status,
            "airConfig": air_runtime,
        },
    }

    if air_error:
        response["meta"]["airError"] = air_error

    return response


@app.get("/")
def index():
    return HTMLResponse(
        """
        <html>
          <head><title>TechnoPeace API</title></head>
          <body style="font-family: Arial, sans-serif; padding: 40px;">
            <h1>TechnoPeace API</h1>
            <p>Signals and reflect-lite backend. Health check is available at <code>/health</code>.</p>
          </body>
        </html>
        """
    )
