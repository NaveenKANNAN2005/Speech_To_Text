// api copy.tsx

import { TranscriptionOptions, TranscriptionResult } from './types';

const BASE_URL = "http://localhost:8000";

export const api = {
  // Transcribe a single file
  transcribeFile: async (
    file: File,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model_size", options.modelSize);
    formData.append("input_lang", options.inputLanguage);
    formData.append("output_lang", options.outputLanguage);
    formData.append("out_format", options.format);

    const response = await fetch(`${BASE_URL}/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Transcription failed");
    }
    return response.json();
  },

  // Transcribe multiple files in a batch
  transcribeBatch: async (
    files: File[],
    options: TranscriptionOptions
  ): Promise<Record<string, TranscriptionResult>> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file, file.name);
    });
    formData.append("model_size", options.modelSize);
    formData.append("input_lang", options.inputLanguage);
    formData.append("output_lang", options.outputLanguage);
    formData.append("out_format", options.format);

    const response = await fetch(`${BASE_URL}/transcribe-batch`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Batch transcription failed");
    }
    return response.json();
  },

  // Start recording audio for transcription
  startRecording: async (
    options: TranscriptionOptions
  ): Promise<string> => {
    const formData = new FormData();
    formData.append("model_size", options.modelSize);
    formData.append("input_lang", options.inputLanguage);
    formData.append("output_lang", options.outputLanguage);

    const response = await fetch(`${BASE_URL}/start-recording`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to start recording");
    }
    const data = await response.json();
    return data.sessionId;
  },

  // Stop recording and get transcription result
  stopRecording: async (
    sessionId: string
  ): Promise<TranscriptionResult> => {
    const response = await fetch(`${BASE_URL}/stop-recording`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error("Failed to stop recording");
    }
    return response.json();
  },

  // Start live captioning with WebSocket
  startLiveCaptioning: (
    options: TranscriptionOptions,
    onUpdate: (text: string) => void
  ): (() => void) => {
    const wsUrl = BASE_URL.replace(/^http/, "ws") + "/live-captioning";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify(options));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.text) {
          onUpdate(data.text);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (err) => {
      console.error("Live captioning error:", err);
    };

    return () => ws.close();
  },
};