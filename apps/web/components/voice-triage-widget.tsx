'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface VoiceTriageWidgetProps {
  patientId?: string;
  patientName?: string;
  onTriageComplete?: (result: TriageResult) => void;
  onResult?: (transcript: string, analysis: any) => void;
  onError?: (error: Error) => void;
  language?: string;
  className?: string;
}

interface TriageResult {
  success: boolean;
  transcript?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  symptoms?: string[];
  red_flags?: string[];
  case_id?: string;
  error?: string;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'complete' | 'error';

export function VoiceTriageWidget({
  patientId = 'guest',
  patientName = 'Patient',
  onTriageComplete,
  onResult,
  onError,
  language = 'en-IN',
  className
}: VoiceTriageWidgetProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nidaan-api.25r5a6g2yvmy.eu-de.codeengine.appdomain.cloud/api/v1';

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      // Audio visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
        }
        animationRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        await processRecording();
      };

      mediaRecorder.start(1000); // Collect data every second
      setState('recording');
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setState('error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setState('processing');
    }
  };

  const processRecording = async () => {
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('patient_id', patientId);
    formData.append('patient_name', patientName);
    formData.append('language', language);

    try {
      const response = await fetch(`${API_URL}/triage/voice`, {
        method: 'POST',
        body: formData,
      });

      const data: TriageResult = await response.json();
      
      if (data.success !== false) {
        setTranscript(data.transcript || '');
        setResult(data);
        setState('complete');
        if (onTriageComplete) {
          onTriageComplete(data);
        }
        if (onResult && data.transcript) {
          onResult(data.transcript, { 
            severity: data.severity,
            symptoms: data.symptoms,
            entities: data.symptoms?.map(s => ({ type: 'symptom', value: s, confidence: 0.9 }))
          });
        }
      } else {
        setState('error');
        setResult({ success: false, error: data.error || 'Processing failed' });
        if (onError) {
          onError(new Error(data.error || 'Processing failed'));
        }
      }
    } catch (err) {
      console.error('Error processing recording:', err);
      setState('error');
      setResult({ success: false, error: 'Failed to process recording' });
      if (onError) {
        onError(err instanceof Error ? err : new Error('Failed to process recording'));
      }
    }
  };

  const reset = () => {
    setState('idle');
    setDuration(0);
    setTranscript('');
    setLiveTranscript('');
    setResult(null);
    setAudioLevel(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'HIGH': return 'text-red-500 bg-red-500/10 border-red-500';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
      case 'LOW': return 'text-green-500 bg-green-500/10 border-green-500';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500';
    }
  };

  return (
    <div className={cn("bg-gray-900 rounded-xl border border-gray-700 p-6", className)}>
      <div className="text-center">
        {/* Recording visualization */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          {/* Outer rings */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-300",
              state === 'recording' 
                ? 'bg-red-500/20 animate-pulse' 
                : state === 'processing'
                ? 'bg-blue-500/20 animate-pulse'
                : 'bg-gray-800'
            )}
            style={{
              transform: state === 'recording' ? `scale(${1 + audioLevel * 0.3})` : 'scale(1)'
            }}
          />
          
          {/* Inner circle */}
          <div 
            className={cn(
              "absolute inset-4 rounded-full flex items-center justify-center transition-all duration-300",
              state === 'recording' 
                ? 'bg-red-500' 
                : state === 'processing'
                ? 'bg-blue-500'
                : state === 'complete'
                ? 'bg-green-500'
                : state === 'error'
                ? 'bg-red-600'
                : 'bg-gray-700'
            )}
          >
            {state === 'idle' && (
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
            {state === 'recording' && (
              <div className="text-white">
                <div className="text-2xl font-bold">{formatDuration(duration)}</div>
                <div className="text-xs mt-1">Recording...</div>
              </div>
            )}
            {state === 'processing' && (
              <svg className="w-12 h-12 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {state === 'complete' && (
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {state === 'error' && (
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>

        {/* Status text */}
        <h3 className="text-lg font-semibold text-white mb-2">
          {state === 'idle' && 'Ready to Record'}
          {state === 'recording' && 'Listening...'}
          {state === 'processing' && 'Processing with AI...'}
          {state === 'complete' && 'Triage Complete'}
          {state === 'error' && 'Error Occurred'}
        </h3>

        <p className="text-gray-400 text-sm mb-6">
          {state === 'idle' && 'Tap the microphone and describe your symptoms'}
          {state === 'recording' && 'Speak clearly about your symptoms, medications, and concerns'}
          {state === 'processing' && 'Analyzing symptoms with IBM Watson NLU...'}
          {state === 'complete' && 'Your case has been submitted to the medical team'}
          {state === 'error' && (result?.error || 'Please try again')}
        </p>

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          {state === 'idle' && (
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              </svg>
              Start Recording
            </button>
          )}
          
          {state === 'recording' && (
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
              Stop Recording
            </button>
          )}

          {(state === 'complete' || state === 'error') && (
            <button
              onClick={reset}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              Record Again
            </button>
          )}
        </div>

        {/* Results */}
        {state === 'complete' && result && (
          <div className="mt-6 text-left">
            {/* Severity badge */}
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4",
              getSeverityColor(result.severity)
            )}>
              <span className="w-2 h-2 rounded-full bg-current"></span>
              <span className="font-medium">{result.severity} Priority</span>
            </div>

            {/* Transcript */}
            {result.transcript && (
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Transcript</h4>
                <p className="text-white">{result.transcript}</p>
              </div>
            )}

            {/* Detected symptoms */}
            {result.symptoms && result.symptoms.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Detected Symptoms</h4>
                <div className="flex flex-wrap gap-2">
                  {result.symptoms.map((symptom, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Red flags */}
            {result.red_flags && result.red_flags.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Red Flags Detected
                </h4>
                <ul className="space-y-1">
                  {result.red_flags.map((flag, idx) => (
                    <li key={idx} className="text-red-300 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VoiceTriageWidget;
