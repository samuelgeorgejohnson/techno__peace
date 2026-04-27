import { fetchAirTrafficSignal, resolveAirTrafficRuntimeConfig } from "../../packages/codex-data/src/adapters/airTraffic.ts";

interface WorkerRequest {
  lat: number;
  lon: number;
  radiusKm: number;
  timeoutMs: number;
  limit?: number;
}

interface WorkerResponse {
  air: Awaited<ReturnType<typeof fetchAirTrafficSignal>> | null;
  error?: string;
}

const readRequest = async (): Promise<WorkerRequest> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new Error("Missing worker request payload.");
  }

  const parsed = JSON.parse(raw) as Partial<WorkerRequest>;
  if (
    typeof parsed.lat !== "number" ||
    typeof parsed.lon !== "number" ||
    typeof parsed.radiusKm !== "number" ||
    typeof parsed.timeoutMs !== "number"
  ) {
    throw new Error("Invalid worker request payload.");
  }

  return {
    lat: parsed.lat,
    lon: parsed.lon,
    radiusKm: parsed.radiusKm,
    timeoutMs: parsed.timeoutMs,
    ...(typeof parsed.limit === "number" ? { limit: parsed.limit } : {}),
  };
};

const run = async (): Promise<void> => {
  const request = await readRequest();
  const runtimeConfig = resolveAirTrafficRuntimeConfig();

  try {
    const air = await fetchAirTrafficSignal(
      {
        lat: request.lat,
        lon: request.lon,
        radiusKm: request.radiusKm,
        ...(typeof request.limit === "number" ? { limit: request.limit } : {}),
      },
      {
        ...runtimeConfig,
        timeoutMs: request.timeoutMs,
      },
    );

    const response: WorkerResponse = { air };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown air-traffic failure";
    const response: WorkerResponse = { air: null, error: message };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown worker failure";
  const response: WorkerResponse = { air: null, error: message };
  process.stdout.write(`${JSON.stringify(response)}\n`);
  process.exitCode = 1;
});
