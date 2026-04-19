import { createServerFn } from "@tanstack/react-start";

interface TokenResult {
  token: string | null;
  agentId: string | null;
  error?: string;
}

interface SignedUrlResult {
  signedUrl: string | null;
  agentId: string | null;
  error?: string;
}

function getCreds() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.VITE_ELEVENLABS_AGENT_ID || process.env.ELEVENLABS_AGENT_ID;
  return { apiKey, agentId };
}

export const getElevenLabsToken = createServerFn({ method: "POST" }).handler(
  async (): Promise<TokenResult> => {
    const { apiKey, agentId } = getCreds();
    if (!apiKey || !agentId) {
      return { token: null, agentId: agentId ?? null, error: "ElevenLabs credentials not configured" };
    }
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (!res.ok) {
        const body = await res.text();
        return { token: null, agentId, error: `ElevenLabs ${res.status}: ${body.slice(0, 200)}` };
      }
      const json = await res.json();
      return { token: json.token, agentId };
    } catch (e) {
      return { token: null, agentId, error: e instanceof Error ? e.message : String(e) };
    }
  },
);

export const getElevenLabsSignedUrl = createServerFn({ method: "POST" }).handler(
  async (): Promise<SignedUrlResult> => {
    const { apiKey, agentId } = getCreds();
    if (!apiKey || !agentId) {
      return { signedUrl: null, agentId: agentId ?? null, error: "ElevenLabs credentials not configured" };
    }
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (!res.ok) {
        const body = await res.text();
        return { signedUrl: null, agentId, error: `ElevenLabs ${res.status}: ${body.slice(0, 200)}` };
      }
      const json = await res.json();
      return { signedUrl: json.signed_url ?? null, agentId };
    } catch (e) {
      return { signedUrl: null, agentId, error: e instanceof Error ? e.message : String(e) };
    }
  },
);
