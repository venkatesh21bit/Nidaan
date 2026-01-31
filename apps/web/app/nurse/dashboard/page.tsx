'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface TriageCase {
  case_id: string;
  patient_id: string;
  patient_name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  red_flags: string[];
  symptoms: string[];
  created_at: string;
  status: string;
  summary: string;
}

interface UrgentCasesResponse {
  count: number;
  cases: TriageCase[];
  retrieved_at: string;
}

export default function NurseDashboardPage() {
  const [urgentCases, setUrgentCases] = useState<TriageCase[]>([]);
  const [allCases, setAllCases] = useState<TriageCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchUrgentCases = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/triage/api/urgent-cases');
      const data: UrgentCasesResponse = await response.json();
      setUrgentCases(data.cases);
      setLastUpdated(data.retrieved_at);
    } catch (err) {
      console.error('Error fetching urgent cases:', err);
    }
  }, []);

  const fetchAllCases = useCallback(async (severity?: string) => {
    try {
      const url = severity && severity !== 'ALL' 
        ? `/api/v1/triage/api/cases?severity=${severity}`
        : '/api/v1/triage/api/cases?severity=HIGH';
      
      const response = await fetch(url);
      const data = await response.json();
      setAllCases(data.cases || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchUrgentCases(),
        fetchAllCases(filter)
      ]);
    } catch (err) {
      setError('Failed to load cases. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchUrgentCases, fetchAllCases, filter]);

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleMarkAsSeen = async (caseId: string) => {
    try {
      const response = await fetch(`/api/v1/triage/api/cases/${caseId}/seen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ case_id: caseId })
      });

      if (response.ok) {
        // Remove from urgent list
        setUrgentCases(prev => prev.filter(c => c.case_id !== caseId));
        setAllCases(prev => prev.map(c => 
          c.case_id === caseId ? { ...c, status: 'seen' } : c
        ));
      }
    } catch (err) {
      console.error('Error marking case as seen:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'LOW': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-50 border-red-200';
      case 'MEDIUM': return 'bg-yellow-50 border-yellow-200';
      case 'LOW': return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading && urgentCases.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading triage dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                👩‍⚕️
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Nurse Triage Dashboard</h1>
                <p className="text-gray-500 text-sm">Nidaan AI Medical Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated ? formatTime(lastUpdated) : '--:--'}
              </span>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-red-500 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Urgent Cases</p>
                <p className="text-4xl font-bold">{urgentCases.length}</p>
              </div>
              <div className="text-5xl opacity-80">🚨</div>
            </div>
          </div>
          <div className="bg-yellow-500 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100">Medium Priority</p>
                <p className="text-4xl font-bold">
                  {allCases.filter(c => c.severity === 'MEDIUM').length}
                </p>
              </div>
              <div className="text-5xl opacity-80">⚠️</div>
            </div>
          </div>
          <div className="bg-green-500 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100">Low Priority</p>
                <p className="text-4xl font-bold">
                  {allCases.filter(c => c.severity === 'LOW').length}
                </p>
              </div>
              <div className="text-5xl opacity-80">✅</div>
            </div>
          </div>
          <div className="bg-blue-500 text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Today</p>
                <p className="text-4xl font-bold">{urgentCases.length + allCases.length}</p>
              </div>
              <div className="text-5xl opacity-80">📊</div>
            </div>
          </div>
        </div>

        {/* Urgent Cases Section */}
        {urgentCases.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="animate-pulse">🚨</span>
              <h2 className="text-xl font-bold text-red-700">
                Urgent Cases Requiring Immediate Attention
              </h2>
            </div>
            <div className="grid gap-4">
              {urgentCases.map((triageCase) => (
                <div
                  key={triageCase.case_id}
                  className="bg-white border-2 border-red-300 rounded-xl shadow-lg overflow-hidden animate-pulse-slow"
                >
                  <div className="bg-red-500 text-white px-4 py-2 flex justify-between items-center">
                    <span className="font-bold">🚨 HIGH PRIORITY</span>
                    <span className="text-sm">
                      {formatDate(triageCase.created_at)} at {formatTime(triageCase.created_at)}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {triageCase.patient_name}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          ID: {triageCase.patient_id} | Case: {triageCase.case_id}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkAsSeen(triageCase.case_id)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        ✓ Mark as Seen
                      </button>
                    </div>

                    {/* Red Flags */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <p className="font-semibold text-red-800 mb-2">🔴 Red Flags:</p>
                      <div className="flex flex-wrap gap-2">
                        {triageCase.red_flags.map((flag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Symptoms */}
                    <div className="mb-4">
                      <p className="font-semibold text-gray-700 mb-2">Symptoms:</p>
                      <div className="flex flex-wrap gap-2">
                        {triageCase.symptoms.map((symptom, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-gray-600 italic">"{triageCase.summary}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Cases Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">All Triage Cases</h2>
            <div className="flex gap-2">
              {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setFilter(level as typeof filter);
                    fetchAllCases(level);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === level
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptoms
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Red Flags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allCases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No cases found matching the filter.
                    </td>
                  </tr>
                ) : (
                  allCases.map((triageCase) => (
                    <tr 
                      key={triageCase.case_id} 
                      className={`hover:bg-gray-50 ${getSeverityBgColor(triageCase.severity)}`}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{triageCase.patient_name}</p>
                          <p className="text-sm text-gray-500">{triageCase.patient_id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getSeverityColor(triageCase.severity)}`}>
                          {triageCase.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {triageCase.symptoms.slice(0, 3).map((symptom, idx) => (
                            <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-xs">
                              {symptom}
                            </span>
                          ))}
                          {triageCase.symptoms.length > 3 && (
                            <span className="px-2 py-1 bg-gray-200 rounded text-xs">
                              +{triageCase.symptoms.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {triageCase.red_flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {triageCase.red_flags.slice(0, 2).map((flag, idx) => (
                              <span key={idx} className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                                {flag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          triageCase.status === 'seen' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {triageCase.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatTime(triageCase.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {triageCase.status !== 'seen' && (
                          <button
                            onClick={() => handleMarkAsSeen(triageCase.case_id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                          >
                            Mark Seen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}
      </main>
    </div>
  );
}
