'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface SurveyQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'scale';
  options?: string[];
  required: boolean;
  urgent?: boolean;
  min?: number;
  max?: number;
}

interface SurveyData {
  survey_id: string;
  patient_name: string;
  appointment_date: string;
  appointment_time: string;
  doctor_name: string;
  questions: SurveyQuestion[];
}

interface SubmissionResult {
  success: boolean;
  severity?: string;
  red_flags?: string[];
  message?: string;
  error?: string;
}

export default function PatientSurveyPage() {
  const params = useParams();
  const surveyId = params?.surveyId as string;

  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Default questions if not loaded from backend
  const defaultQuestions: SurveyQuestion[] = [
    {
      id: 'symptoms',
      question: 'What symptoms are you currently experiencing? Please describe in detail.',
      type: 'text',
      required: true
    },
    {
      id: 'symptom_duration',
      question: 'How long have you been experiencing these symptoms?',
      type: 'choice',
      options: ['Less than 24 hours', '1-3 days', '4-7 days', '1-2 weeks', 'More than 2 weeks'],
      required: true
    },
    {
      id: 'pain_level',
      question: 'On a scale of 1-10, how would you rate your pain or discomfort?',
      type: 'scale',
      min: 1,
      max: 10,
      required: true
    },
    {
      id: 'current_medications',
      question: 'Please list all medications you are currently taking (including over-the-counter drugs and supplements).',
      type: 'text',
      required: true
    },
    {
      id: 'allergies',
      question: 'Do you have any known allergies to medications, foods, or other substances?',
      type: 'text',
      required: true
    },
    {
      id: 'emergency_check',
      question: 'Are you experiencing any of the following RIGHT NOW: severe chest pain, difficulty breathing, sudden numbness, severe bleeding, or loss of consciousness?',
      type: 'choice',
      options: ['Yes - CALL EMERGENCY SERVICES IMMEDIATELY', 'No'],
      required: true,
      urgent: true
    }
  ];

  useEffect(() => {
    const loadSurvey = async () => {
      try {
        // In production, fetch survey data from API
        // const response = await fetch(`/api/v1/triage/surveys/${surveyId}`);
        // const data = await response.json();
        // setSurveyData(data);

        // For now, use mock data
        setSurveyData({
          survey_id: surveyId || 'demo_survey',
          patient_name: 'Patient',
          appointment_date: '2024-01-20',
          appointment_time: '10:00 AM',
          doctor_name: 'Dr. Smith',
          questions: defaultQuestions
        });
      } catch (err) {
        setError('Failed to load survey. Please refresh the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSurvey();
  }, [surveyId]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Check for emergency response
    if (answers['emergency_check']?.includes('Yes')) {
      setResult({
        success: true,
        severity: 'EMERGENCY',
        message: '🚨 EMERGENCY: Please call emergency services (911) immediately or go to the nearest emergency room.'
      });
      setSubmitted(true);
      setIsSubmitting(false);
      return;
    }

    // Compile all answers into response text
    const responseText = Object.entries(answers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n') + (additionalNotes ? `\n\nAdditional Notes: ${additionalNotes}` : '');

    try {
      const response = await fetch('/api/v1/triage/surveys/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          survey_id: surveyId,
          response_text: responseText,
          answers: answers
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({
          success: true,
          severity: data.severity,
          red_flags: data.red_flags || [],
          message: 'Thank you! Your response has been submitted successfully.'
        });
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit survey');
      }
    } catch (err) {
      setError('Failed to submit survey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    switch (question.type) {
      case 'text':
        return (
          <textarea
            value={answers[question.id] || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
            placeholder="Type your answer here..."
            required={question.required}
          />
        );

      case 'choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option, idx) => (
              <label
                key={idx}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors
                  ${answers[question.id] === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                  }
                  ${option.includes('EMERGENCY') ? 'border-red-300 hover:bg-red-50' : ''}
                `}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={answers[question.id] === option}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="mr-3"
                  required={question.required}
                />
                <span className={option.includes('EMERGENCY') ? 'text-red-700 font-semibold' : ''}>
                  {option}
                </span>
              </label>
            ))}
          </div>
        );

      case 'scale':
        return (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: (question.max || 10) - (question.min || 1) + 1 }, (_, i) => i + (question.min || 1)).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleAnswerChange(question.id, num.toString())}
                className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-colors
                  ${answers[question.id] === num.toString()
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                  ${num >= 7 ? 'border-2 border-orange-300' : ''}
                  ${num >= 9 ? 'border-2 border-red-300' : ''}
                `}
              >
                {num}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading survey...</p>
        </div>
      </div>
    );
  }

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            {result.severity === 'EMERGENCY' ? (
              <>
                <div className="text-6xl mb-4">🚨</div>
                <h1 className="text-3xl font-bold text-red-600 mb-4">EMERGENCY ALERT</h1>
                <p className="text-xl text-red-700 mb-6">{result.message}</p>
                <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                  <p className="text-red-800 font-semibold">
                    📞 Call emergency services immediately
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h1 className="text-3xl font-bold text-green-600 mb-4">Survey Submitted!</h1>
                <p className="text-gray-600 mb-6">{result.message}</p>
                
                {result.severity && (
                  <div className={`inline-block px-4 py-2 rounded-full mb-4 ${
                    result.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                    result.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Priority: {result.severity}
                  </div>
                )}

                {result.red_flags && result.red_flags.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4 text-left">
                    <p className="font-semibold text-orange-800 mb-2">⚠️ Important symptoms noted:</p>
                    <ul className="text-orange-700">
                      {result.red_flags.map((flag, idx) => (
                        <li key={idx}>• {flag}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-orange-600 mt-2">
                      Our medical team has been notified and will review your case promptly.
                    </p>
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-800">
                    <strong>What's next?</strong><br />
                    Our medical team will review your responses before your appointment.
                    If we have any urgent concerns, we will contact you directly.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl">
              🏥
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Pre-Visit Survey</h1>
              <p className="text-gray-500">Nidaan AI Medical Assistant</p>
            </div>
          </div>

          {surveyData && (
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-blue-800">
                <strong>Appointment with:</strong> {surveyData.doctor_name}<br />
                <strong>Date:</strong> {surveyData.appointment_date} at {surveyData.appointment_time}
              </p>
            </div>
          )}
        </div>

        {/* Emergency Notice */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700">
            <strong>⚠️ Emergency Notice:</strong> If you are experiencing a medical emergency 
            (severe chest pain, difficulty breathing, severe bleeding), please call emergency 
            services immediately or go to the nearest emergency room.
          </p>
        </div>

        {/* Survey Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {surveyData?.questions.map((question, idx) => (
            <div
              key={question.id}
              className={`bg-white rounded-xl shadow-lg p-6 ${
                question.urgent ? 'border-2 border-red-200' : ''
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <h3 className={`font-semibold ${question.urgent ? 'text-red-700' : 'text-gray-800'}`}>
                    {question.question}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </h3>
                  {question.urgent && (
                    <p className="text-red-600 text-sm mt-1">⚠️ Critical question</p>
                  )}
                </div>
              </div>
              {renderQuestion(question)}
            </div>
          ))}

          {/* Additional Notes */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="font-semibold text-gray-800 mb-4">
              📝 Additional Notes (Optional)
            </h3>
            <textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
              placeholder="Any additional information you'd like to share with your doctor..."
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-700">❌ {error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 bg-blue-500 text-white rounded-xl font-semibold text-lg
              hover:bg-blue-600 transition-colors shadow-lg
              ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {isSubmitting ? '🔄 Submitting...' : '📤 Submit Survey'}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Your responses are secure and confidential.</p>
          <p>© 2024 Nidaan AI Healthcare. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
