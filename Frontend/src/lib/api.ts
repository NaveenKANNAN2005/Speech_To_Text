// api.ts

export type TranscriptionOptions = {
  modelSize: string;
  inputLanguage: string;
  outputLanguage: string;
  format: string;
  preprocess: boolean;
  highPass: boolean;
  hpCutoff: number;
  hpOrder: number;
  temperature: number;
};

export type TranscriptionSegment = {
  text: string;
  start: number;
  end: number;
};

export type TranscriptionResult = {
  original_language: string;
  output_language: string;
  language_probability: number;
  segments: TranscriptionSegment[];
  output_file: string;
};

const BASE_URL = "http://localhost:8000"; // Change to http://localhost:5000 for Flask

export const api = {
  // Upload a single file for transcription
  transcribeFile: async (
    file: File,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> => {
    const formData = new FormData();
    formData.append("file", file);
    // Append transcription options to FormData
    formData.append("model_size", options.modelSize);
    formData.append("input_lang", options.inputLanguage);
    formData.append("output_lang", options.outputLanguage);
    formData.append("out_format", options.format);
    // Add additional options if your backend supports them
    const response = await fetch(`${BASE_URL}/transcribe`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("Transcription failed");
    }
    return response.json();
  },

  // Upload multiple files for batch transcription
  transcribeBatch: async (
    files: File[],
    options: TranscriptionOptions
  ): Promise<Record<string, TranscriptionResult>> => {
    const formData = new FormData();
    files.forEach((file) => {
      // Assuming backend expects a field name "files" for multiple uploads
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

  // Start recording (returns a session ID)
  startRecording: async (
    options: TranscriptionOptions
  ): Promise<string> => {
    const formData = new FormData();
    formData.append("model_size", options.modelSize);
    formData.append("input_lang", options.inputLanguage);
    formData.append("output_lang", options.outputLanguage);
    //formData.append("out_format", options.format);
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

  // Stop recording using the session ID and get the transcription result
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

  // Start live captioning; assumes a WebSocket endpoint for streaming updates
  // onUpdate callback is called whenever new text is received.
  startLiveCaptioning: (
    options: TranscriptionOptions,
    onUpdate: (text: string) => void
  ): (() => void) => {
    // Convert HTTP URL to WebSocket URL
    const wsUrl = BASE_URL.replace(/^http/, "ws") + "/live-captioning";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send transcription options as JSON if needed
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

    // Return a cleanup function to close the WebSocket connection
    return () => ws.close();
  },
};
