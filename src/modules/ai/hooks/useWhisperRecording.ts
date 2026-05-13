import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/chatStore";
import { usePreferencesStore } from "../../settings/preferences";
import { AZURE_OPENAI_DEFAULT_ENDPOINT } from "../config";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

async function transcribeBlob(
  blob: Blob,
  apiKey: string,
  endpoint: string,
): Promise<string> {
  const base = endpoint.replace(/\/+$/, "");
  const url = `${base}/openai/deployments/whisper/audio/transcriptions?api-version=2024-06-01`;
  const form = new FormData();
  form.append("file", blob, "audio.webm");
  form.append("model", "whisper-1");
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper API ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as { text: string };
  return data.text;
}

type State = "idle" | "recording" | "transcribing";

export function useWhisperRecording({
  onResult,
}: {
  onResult: (text: string) => void;
}) {
  const apiKey = useChatStore((s) => s.apiKeys["azure-openai"]);
  const azureEndpoint = usePreferencesStore(
    (s) => s.azureOpenaiEndpoint || AZURE_OPENAI_DEFAULT_ENDPOINT,
  );
  const [state, setState] = useState<State>("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const teardownStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported || !apiKey || state !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        teardownStream();
        if (blob.size === 0) {
          setState("idle");
          return;
        }
        setState("transcribing");
        try {
          const text = await transcribeBlob(blob, apiKey, azureEndpoint);
          if (text.trim()) onResult(text.trim());
        } catch (e) {
          console.error("whisper.transcribe", e);
        } finally {
          setState("idle");
        }
      };
      recRef.current = rec;
      rec.start();
      setState("recording");
    } catch (e) {
      console.error("whisper.getUserMedia", e);
      teardownStream();
      setState("idle");
    }
  }, [apiKey, azureEndpoint, onResult, state, supported]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      teardownStream();
    };
  }, []);

  return {
    state,
    recording: state === "recording",
    transcribing: state === "transcribing",
    start,
    stop,
    supported,
    hasKey: !!apiKey,
  };
}
