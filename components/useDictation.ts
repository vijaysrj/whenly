"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal types for the browser's Web Speech API (not in the TS DOM lib everywhere).
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speech to text in the browser. While listening, `onText` gets the text so far
 * (what was in the box before, plus what has been said). Stops on a pause.
 */
export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => rec.current?.abort();
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback((currentText: string) => {
    const Ctor = getCtor();
    if (!Ctor) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = navigator.language || "en-IN";
    r.continuous = false;
    r.interimResults = true;
    const base = currentText.trim();
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      const spoken = (finalText + interim).trim();
      const said = spoken ? spoken.charAt(0).toUpperCase() + spoken.slice(1) : "";
      onTextRef.current([base, said].filter(Boolean).join(" "));
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Allow microphone access to speak a memory.");
      else if (e.error === "no-speech") setError("Didn't catch that. Tap the mic and try again.");
      else if (e.error !== "aborted") setError("Couldn't use the microphone. Try typing instead.");
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
    };
    setError("");
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn't use the microphone. Try typing instead.");
    }
  }, []);

  return { supported, listening, error, start, stop };
}
