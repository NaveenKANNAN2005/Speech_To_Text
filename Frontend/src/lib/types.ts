// api copy.tsx

import { TranscriptionOptions, TranscriptionResult } from './types';

const BASE_URL = "http://localhost:8000";

export const api = {
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
  // ... other functions ...
};