export interface ReflectResponse {
  mood: string;
  modulation: {
    tone: number;
    lfoRate: number;
    filterShift: number;
  };
}

export const reflect = async (input: string, endpoint = "/reflect"): Promise<ReflectResponse> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    throw new Error(`Reflect request failed: ${response.status}`);
  }

  return (await response.json()) as ReflectResponse;
};
