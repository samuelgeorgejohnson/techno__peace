from fastapi import APIRouter
from pydantic import BaseModel
import json
from pathlib import Path

router = APIRouter()


class ReflectRequest(BaseModel):
  input: str


class Modulation(BaseModel):
  tone: float
  lfoRate: float
  filterShift: float


class ReflectResponse(BaseModel):
  mood: str
  modulation: Modulation


def load_map():
  map_path = Path(__file__).parent / "modulation_map.json"
  if not map_path.exists():
    return {}
  with map_path.open() as handle:
    return json.load(handle)


@router.post("/reflect", response_model=ReflectResponse)
async def reflect(payload: ReflectRequest):
  modulation_map = load_map()
  mood = "calm"
  for key in modulation_map.keys():
    if key.lower() in payload.input.lower():
      mood = key
      break

  modulation = modulation_map.get(
    mood,
    {"tone": 0.5, "lfoRate": 0.2, "filterShift": 0.4},
  )
  return {"mood": mood, "modulation": modulation}
