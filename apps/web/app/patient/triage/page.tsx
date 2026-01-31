'use client';

import React, { useState, useRef, useCallback } from 'react';

interface TriageResult {
  success: boolean;
  transcript?: string;
  transcription_confidence?: number;
  symptoms: string[];
  medications: string[];
  severity_score?: 'HIGH' | 'MEDIUM' | 'LOW';
  red_flags: string[];
  case_id?: string;
  nurse_alerted: boolean;
  ehr_updated: boolean;
  error?: string;
}

interface PatientInfo {
  patient_id: string;
  patient_name: string;
  language: string;
  appointment_id?: string;
}

export default function VoiceTriagePage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    patient_id: '',
    patient_name: '',
    language: 'en-IN',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setTriageResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (err) {
      setError('Failed to access microphone. Please allow microphone permissions.');
      console.error('Recording error:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const submitForTriage = useCallback(async () => {
    if (!audioBlob || !patientInfo.patient_id || !patientInfo.patient_name) {
      setError('Please fill in patient information and record audio first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('patient_id', patientInfo.patient_id);
      formData.append('patient_name', patientInfo.patient_name);
      formData.append('language', patientInfo.language);
      if (patientInfo.appointment_id) {
        formData.append('appointment_id', patientInfo.appointment_id);
      }

      const response = await fetch('/api/v1/triage/voice', {
        method: 'POST',
        body: formData,
      });

      const result: TriageResult = await response.json();
      setTriageResult(result);

      if (!result.success) {
        setError(result.error || 'Triage processing failed');
      }
    } catch (err) {
      setError('Failed to submit audio for triage. Please try again.');
      console.error('Submission error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [audioBlob, patientInfo]);

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'HIGH': return '🚨';
      case 'MEDIUM': return '⚠️';
      case 'LOW': return '✅';
      default: return '❓';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-900 mb-2">
            🏥 Nidaan Voice Triage
          </h1>
          <p className="text-gray-600">
            AI-Powered Patient Intake System
          </p>
        </div>

        {/* Patient Information Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📋 Patient Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient ID *
              </label>
              <input
                type="text"
                value={patientInfo.patient_id}
                onChange={(e) => setPatientInfo({ ...patientInfo, patient_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter patient ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Name *
              </label>
              <input
                type="text"
                value={patientInfo.patient_name}
                onChange={(e) => setPatientInfo({ ...patientInfo, patient_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter patient name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Language
              </label>
              <select
                value={patientInfo.language}
                onChange={(e) => setPatientInfo({ ...patientInfo, language: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="en-IN">English (India)</option>
                <option value="en-US">English (US)</option>
                <option value="hi-IN">Hindi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment ID (Optional)
              </label>
              <input
                type="text"
                value={patientInfo.appointment_id || ''}
                onChange={(e) => setPatientInfo({ ...patientInfo, appointment_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="If linked to appointment"
              />
            </div>
          </div>
        </div>

        {/* Recording Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            🎤 Voice Recording
          </h2>
          
          <div className="text-center">
            {/* Recording Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`
                w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl
                transition-all duration-300 shadow-lg hover:shadow-xl
                ${isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-indigo-500 hover:bg-indigo-600'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isRecording ? '⏹️' : '🎙️'}
            </button>
            
            <p className="mt-4 text-gray-600">
              {isRecording 
                ? '🔴 Recording... Click to stop' 
                : 'Click to start recording your symptoms'
              }
            </p>

            {/* Audio Preview */}
            {audioBlob && !isRecording && (
              <div className="mt-4">
                <audio 
                  controls 
                  src={URL.createObjectURL(audioBlob)} 
                  className="mx-auto"
                />
                <button
                  onClick={submitForTriage}
                  disabled={isProcessing}
                  className={`
                    mt-4 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold
                    hover:bg-green-600 transition-colors
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isProcessing ? '🔄 Processing...' : '🚀 Submit for Triage'}
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">📝 Instructions:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Describe your symptoms clearly</li>
              <li>• Mention any medications you are taking</li>
              <li>• State how long you have had these symptoms</li>
              <li>• Mention any allergies you have</li>
              <li>• Speak clearly for accurate transcription</li>
            </ul>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}

        {/* Triage Results */}
        {triageResult && triageResult.success && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📊 Triage Results
            </h2>

            {/* Severity Badge */}
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold mb-4 border ${getSeverityColor(triageResult.severity_score)}`}>
              {getSeverityIcon(triageResult.severity_score)} {triageResult.severity_score} SEVERITY
            </div>

            {/* Case ID */}
            {triageResult.case_id && (
              <p className="text-sm text-gray-500 mb-4">
                Case ID: <code className="bg-gray-100 px-2 py-1 rounded">{triageResult.case_id}</code>
              </p>
            )}

            {/* Red Flags Alert */}
            {triageResult.red_flags.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-red-800 mb-2">🚨 Red Flags Detected:</h3>
                <ul className="text-red-700">
                  {triageResult.red_flags.map((flag, idx) => (
                    <li key={idx}>• {flag}</li>
                  ))}
                </ul>
                {triageResult.nurse_alerted && (
                  <p className="mt-2 text-red-800 font-semibold">
                    ✓ Nurse station has been alerted
                  </p>
                )}
              </div>
            )}

            {/* Transcript */}
            {triageResult.transcript && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">📝 Transcript:</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700 italic">"{triageResult.transcript}"</p>
                  {triageResult.transcription_confidence && (
                    <p className="text-xs text-gray-500 mt-2">
                      Confidence: {(triageResult.transcription_confidence * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Extracted Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Symptoms */}
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-semibold text-orange-800 mb-2">🤒 Symptoms Detected:</h3>
                {triageResult.symptoms.length > 0 ? (
                  <ul className="text-orange-700">
                    {triageResult.symptoms.map((symptom, idx) => (
                      <li key={idx}>• {symptom}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-orange-600">No symptoms extracted</p>
                )}
              </div>

              {/* Medications */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">💊 Medications Mentioned:</h3>
                {triageResult.medications.length > 0 ? (
                  <ul className="text-purple-700">
                    {triageResult.medications.map((med, idx) => (
                      <li key={idx}>• {med}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-purple-600">No medications detected</p>
                )}
              </div>
            </div>

            {/* Status Indicators */}
            <div className="mt-4 flex gap-4">
              <span className={`px-3 py-1 rounded-full text-sm ${triageResult.ehr_updated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {triageResult.ehr_updated ? '✓ EHR Updated' : '○ EHR Not Updated'}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${triageResult.nurse_alerted ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                {triageResult.nurse_alerted ? '✓ Nurse Alerted' : '○ No Alert Needed'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
