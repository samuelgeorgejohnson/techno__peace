import json
import subprocess
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse

app = FastAPI(title="TechnoPeace API")

DEFAULT_AIR_RADIUS_KM = 80
DEFAULT_AIR_TIMEOUT_MS = 8_000
DEFAULT_AIR_LIMIT = 100
NODE_WORKER_PATH = Path(__file__).with_name("airTrafficSignalWorker.ts")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/signals")
def signals(
    lat: float = Query(..., description="Latitude for signal lookup."),
    lon: float = Query(..., description="Longitude for signal lookup."),
    radius_km: float = Query(
        DEFAULT_AIR_RADIUS_KM,
        gt=0,
        le=400,
        description="Search radius in kilometers for air traffic signal lookup.",
    ),
    timeout_ms: int = Query(
        DEFAULT_AIR_TIMEOUT_MS,
        gt=500,
        le=20_000,
        description="Air traffic provider timeout in milliseconds.",
    ),
    limit: int = Query(
        DEFAULT_AIR_LIMIT,
        gt=0,
        le=500,
        description="Optional provider-side aircraft row limit.",
    ),
):
    """
    Server-owned signal endpoint.

    Current scope (narrow): returns only the normalized man-made air signal,
    sourced through the typed @technopeace/codex-data adapter in a Node worker.
    """
    worker_payload = {
        "lat": lat,
        "lon": lon,
        "radiusKm": radius_km,
        "timeoutMs": timeout_ms,
        "limit": limit,
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
            "airConfig": {
                "radiusKm": radius_km,
                "timeoutMs": timeout_ms,
                "limit": limit,
            },
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
