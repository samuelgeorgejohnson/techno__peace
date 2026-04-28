import json
import os
import subprocess
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

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
TOMTOM_FLOW_BASE_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"


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


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _fetch_tomtom_road_signal(
    *,
    lat: float,
    lon: float,
) -> tuple[dict | None, str | None]:
    tomtom_key = os.environ.get("TOMTOM_API_KEY")
    if not tomtom_key:
        return None, "Missing TOMTOM_API_KEY"

    query = urlencode(
        {
            "key": tomtom_key,
            "point": f"{lat},{lon}",
        }
    )
    request = Request(f"{TOMTOM_FLOW_BASE_URL}?{query}", method="GET")

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        return None, f"TomTom traffic request failed: {error}"

    flow = payload.get("flowSegmentData")
    if not isinstance(flow, dict):
        return None, "TomTom traffic payload missing flowSegmentData"

    current_speed = float(flow.get("currentSpeed") or 0.0)
    free_flow_speed = float(flow.get("freeFlowSpeed") or 0.0)
    current_travel_time = float(flow.get("currentTravelTime") or 0.0)
    free_flow_travel_time = float(flow.get("freeFlowTravelTime") or 0.0)
    confidence = float(flow.get("confidence") or 0.0)
    road_closure = bool(flow.get("roadClosure"))

    relative_flow = _clamp01(current_speed / free_flow_speed) if free_flow_speed > 0 else 0.0
    congestion_ratio = (
        _clamp01(free_flow_travel_time / current_travel_time) if current_travel_time > 0 else relative_flow
    )
    density = _clamp01((1 - relative_flow) * 0.7 + (1 - congestion_ratio) * 0.3)
    motion = _clamp01(relative_flow)
    tension = _clamp01(0.65 * (1 - relative_flow) + 0.35 * (1 - confidence))
    brightness = _clamp01(0.25 + 0.6 * motion + 0.15 * confidence)
    pulse_rate = 0.35 + 1.1 * tension
    congested = road_closure or relative_flow < 0.6

    road_signal = {
        "nearestRoadDistanceM": None,
        "currentSpeedKph": current_speed,
        "freeFlowSpeedKph": free_flow_speed,
        "relativeFlow": relative_flow,
        "congested": congested,
        "normalized": {
            "density": density,
            "proximity": 1.0,
            "motion": motion,
            "tension": tension,
            "brightness": brightness,
            "pulseRate": pulse_rate,
        },
    }

    return road_signal, None


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
    road = None
    road_status: Literal["live", "unavailable"] = "unavailable"
    road_error = None

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

    road, road_error = _fetch_tomtom_road_signal(lat=lat, lon=lon)
    if road is not None:
        road_status = "live"

    response = {
        "coordinates": {
            "lat": lat,
            "lon": lon,
        },
        "manMade": {
            "air": air,
            "road": road,
        },
        "meta": {
            "airStatus": air_status,
            "roadStatus": road_status,
            "airConfig": air_runtime,
        },
    }

    if air_error:
        response["meta"]["airError"] = air_error
    if road_error:
        response["meta"]["roadError"] = road_error

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
