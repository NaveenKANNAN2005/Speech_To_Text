// App.tsx

import React, { useState, useCallback, useEffect } from 'react';
import { Mic, Upload, List, Radio, Copy, Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Button } from './components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { api, type TranscriptionOptions, type TranscriptionResult } from './lib/api';

const SUPPORTED_INPUT_LANGUAGES = {
  auto: "Auto-detect",
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian"
};

const SUPPORTED_OUTPUT_LANGUAGES = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi"
};

const MODEL_SIZES = ["tiny", "base", "small", "medium", "large"];

function App() {
  const [selectedTab, setSelectedTab] = useState('file');

  // Separate transcription states for each tab
  const [fileTranscription, setFileTranscription] = useState('');
  const [micTranscription, setMicTranscription] = useState('');
  const [batchTranscription, setBatchTranscription] = useState('');
  const [liveTranscription, setLiveTranscription] = useState('');

  // Common settings
  const [inputLang, setInputLang] = useState('auto');
  const [outputLang, setOutputLang] = useState('en');
  const [modelSize, setModelSize] = useState('medium');

  // State for recording and processing
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Build the transcription options
  const getTranscriptionOptions = (): TranscriptionOptions => ({
    modelSize,
    inputLanguage: inputLang,
    outputLanguage: outputLang,
    format: 'txt',
    preprocess: true,
    highPass: true,
    hpCutoff: 80.0,
    hpOrder: 4,
    temperature: 0.0
  });

  // 1) File Upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setError(null);
      const result = await api.transcribeFile(file, getTranscriptionOptions());
      // Update only the file transcription state
      setFileTranscription(
        result.segments.map(segment => segment.text).join('\n')
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2) Batch Upload
  const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      setIsProcessing(true);
      setError(null);
      const results = await api.transcribeBatch(files, getTranscriptionOptions());
      const combinedTranscription = Object.values(results)
        .map(result => result.segments.map(segment => segment.text).join('\n'))
        .join('\n\n');
      // Update only the batch transcription state
      setBatchTranscription(combinedTranscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3) Microphone (Start/Stop)
  const handleRecordToggle = async () => {
    if (isRecording) {
      // STOP recording
      if (currentSessionId) {
        try {
          const result = await api.stopRecording(currentSessionId);
          // Update only the mic transcription state
          setMicTranscription(
            result.segments.map(segment => segment.text).join('\n')
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to stop recording');
        }
      }
      setIsRecording(false);
      setCurrentSessionId(null);
    } else {
      // START recording
      try {
        const sessionId = await api.startRecording(getTranscriptionOptions());
        setCurrentSessionId(sessionId);
        setIsRecording(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start recording');
      }
    }
  };

  // 4) Live Captioning
  const handleLiveCaptioning = useCallback(() => {
    let cleanup: (() => void) | null = null;

    const start = () => {
      setIsRecording(true);
      setError(null);
      cleanup = api.startLiveCaptioning(getTranscriptionOptions(), (text) => {
        // Append incoming text to the live transcription state
        setLiveTranscription(prev => prev + '\n' + text);
      });
    };

    const stop = () => {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
      setIsRecording(false);
    };

    if (isRecording) {
      stop();
    } else {
      start();
    }
  }, [isRecording, modelSize, inputLang, outputLang]);

  // Copy & Download
  const handleCopyTranscription = async (tab: string) => {
    try {
      let textToCopy = '';
      if (tab === 'file') textToCopy = fileTranscription;
      else if (tab === 'mic') textToCopy = micTranscription;
      else if (tab === 'batch') textToCopy = batchTranscription;
      else if (tab === 'live') textToCopy = liveTranscription;

      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleDownloadTranscription = (tab: string) => {
    let textToDownload = '';
    if (tab === 'file') textToDownload = fileTranscription;
    else if (tab === 'mic') textToDownload = micTranscription;
    else if (tab === 'batch') textToDownload = batchTranscription;
    else if (tab === 'live') textToDownload = liveTranscription;

    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Cleanup on unmount if still recording
  useEffect(() => {
    return () => {
      if (currentSessionId) {
        api.stopRecording(currentSessionId).catch(console.error);
      }
    };
  }, [currentSessionId]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Speech Recognition System
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload size={18} />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="mic" className="flex items-center gap-2">
              <Mic size={18} />
              Microphone
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <List size={18} />
              Batch Process
            </TabsTrigger>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Radio size={18} />
              Live Captioning
            </TabsTrigger>
          </TabsList>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            {/* Language & Model Settings */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Input Language
                </label>
                <Select value={inputLang} onValueChange={setInputLang}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select input language" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUPPORTED_INPUT_LANGUAGES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Output Language
                </label>
                <Select value={outputLang} onValueChange={setOutputLang}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select output language" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SUPPORTED_OUTPUT_LANGUAGES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model Size
                </label>
                <Select value={modelSize} onValueChange={setModelSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model size" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* FILE UPLOAD TAB */}
            <TabsContent value="file" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer flex flex-col items-center ${isProcessing ? 'opacity-50' : ''}`}
                >
                  <Upload size={48} className="text-gray-400 mb-4" />
                  <span className="text-sm text-gray-600">
                    {isProcessing ? 'Processing...' : 'Click to upload or drag and drop'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Audio files (MP3, WAV, etc.)
                  </span>
                </label>
              </div>

              {fileTranscription && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      File Transcription
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyTranscription('file')}
                        className="flex items-center gap-2"
                      >
                        <Copy size={16} />
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTranscription('file')}
                        className="flex items-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                      {fileTranscription}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* MICROPHONE TAB */}
            <TabsContent value="mic" className="space-y-4">
              <div className="text-center">
                <Button
                  onClick={handleRecordToggle}
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className="w-32"
                  disabled={isProcessing}
                >
                  {isRecording ? "Stop" : "Record"}
                </Button>
                {isRecording && (
                  <p className="text-sm text-red-500 mt-2">Recording...</p>
                )}
              </div>

              {micTranscription && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      Microphone Transcription
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyTranscription('mic')}
                        className="flex items-center gap-2"
                      >
                        <Copy size={16} />
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTranscription('mic')}
                        className="flex items-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                      {micTranscription}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* BATCH PROCESS TAB */}
            <TabsContent value="batch" className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="batch-upload"
                  className="hidden"
                  accept="audio/*"
                  multiple
                  onChange={handleBatchUpload}
                  disabled={isProcessing}
                />
                <label
                  htmlFor="batch-upload"
                  className={`cursor-pointer flex flex-col items-center ${isProcessing ? 'opacity-50' : ''}`}
                >
                  <List size={48} className="text-gray-400 mb-4" />
                  <span className="text-sm text-gray-600">
                    {isProcessing ? 'Processing files...' : 'Select multiple audio files'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Process multiple files at once
                  </span>
                </label>
              </div>

              {batchTranscription && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      Batch Transcription
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyTranscription('batch')}
                        className="flex items-center gap-2"
                      >
                        <Copy size={16} />
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTranscription('batch')}
                        className="flex items-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                      {batchTranscription}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* LIVE CAPTIONING TAB */}
            <TabsContent value="live" className="space-y-4">
              <div className="text-center">
                <Button
                  onClick={handleLiveCaptioning}
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className="w-48"
                  disabled={isProcessing}
                >
                  {isRecording ? "Stop Captioning" : "Start Live Captioning"}
                </Button>
              </div>

              {liveTranscription && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      Live Caption
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyTranscription('live')}
                        className="flex items-center gap-2"
                      >
                        <Copy size={16} />
                        {copySuccess ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTranscription('live')}
                        className="flex items-center gap-2"
                      >
                        <Download size={16} />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                      {liveTranscription}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
