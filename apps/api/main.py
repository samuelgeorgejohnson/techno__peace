import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
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

TOMTOM_FLOW_ENDPOINT = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
TOMTOM_TIMEOUT_SECONDS = 10


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


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    if value < minimum:
        return minimum
    if value > maximum:
        return maximum
    return value


def _to_float(value: object, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return default

    return default


def _build_tomtom_traffic_signal(lat: float, lon: float):
    tomtom_key = os.environ.get("TOMTOM_API_KEY")
    if not tomtom_key:
        return None, "TomTom API key is not configured (TOMTOM_API_KEY)."

    params = urllib.parse.urlencode(
        {
            "key": tomtom_key,
            "point": f"{lat:.6f},{lon:.6f}",
            "unit": "mph",
        }
    )
    request_url = f"{TOMTOM_FLOW_ENDPOINT}?{params}"

    try:
        with urllib.request.urlopen(request_url, timeout=TOMTOM_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as error:
        return None, f"TomTom flow request failed: {error}"

    flow_segment_data = payload.get("flowSegmentData") if isinstance(payload, dict) else None
    if not isinstance(flow_segment_data, dict):
        return None, "TomTom flow response did not include flowSegmentData."

    current_speed_mph = _to_float(flow_segment_data.get("currentSpeed"), 0.0)
    free_flow_speed_mph = _to_float(flow_segment_data.get("freeFlowSpeed"), 0.0)
    current_travel_time_sec = _to_float(flow_segment_data.get("currentTravelTime"), 0.0)
    free_flow_travel_time_sec = _to_float(flow_segment_data.get("freeFlowTravelTime"), 0.0)
    confidence = _clamp(_to_float(flow_segment_data.get("confidence"), 0.0))
    road_closure = bool(flow_segment_data.get("roadClosure", False))

    flow = _clamp(
        current_speed_mph / free_flow_speed_mph if free_flow_speed_mph > 0 else 0.0,
    )
    delay = _clamp(
        ((current_travel_time_sec / free_flow_travel_time_sec) - 1.0) / 3.0
        if free_flow_travel_time_sec > 0
        else 0.0,
    )
    congestion = 1.0 - flow

    if road_closure:
        flow = 0.0
        congestion = 1.0

    signal = {
        "currentSpeedMph": round(current_speed_mph, 2),
        "freeFlowSpeedMph": round(free_flow_speed_mph, 2),
        "currentTravelTimeSec": round(current_travel_time_sec, 2),
        "freeFlowTravelTimeSec": round(free_flow_travel_time_sec, 2),
        "confidence": round(confidence, 4),
        "roadClosure": road_closure,
        "congestion": round(_clamp(congestion), 4),
        "flow": round(_clamp(flow), 4),
        "delay": round(delay, 4),
        "status": "live",
    }
    return signal, None


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

    Current scope (narrow): returns normalized man-made signals,
    sourcing air through a Node worker and road traffic through TomTom.
    """
    air_runtime = _build_air_runtime_overrides()

    worker_payload = {
        "lat": lat,
        "lon": lon,
        **air_runtime,
    }

    air = None
    road = None
    air_status: Literal["live", "unavailable"] = "unavailable"
    road_status: Literal["live", "unavailable"] = "unavailable"
    air_error = None
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

    road, road_error = _build_tomtom_traffic_signal(lat, lon)
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
