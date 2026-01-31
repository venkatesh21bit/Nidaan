'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface UrgentCase {
  id: string;
  patient_name: string;
  age?: number;
  gender?: string;
  symptoms: string[];
  severity_score: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  vitals?: {
    heart_rate?: number;
    blood_pressure?: string;
    temperature?: number;
    oxygen_level?: number;
  };
  ai_assessment?: string;
  recommended_action?: string;
  status: 'pending' | 'in_progress' | 'seen' | 'resolved';
}

interface UrgentCaseCardProps {
  case_data: UrgentCase;
  onMarkSeen?: (caseId: string) => void;
  onViewDetails?: (caseId: string) => void;
  onAssign?: (caseId: string) => void;
  isExpanded?: boolean;
  className?: string;
}

export function UrgentCaseCard({
  case_data,
  onMarkSeen,
  onViewDetails,
  onAssign,
  isExpanded: initialExpanded = false,
  className
}: UrgentCaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [isProcessing, setIsProcessing] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'border-red-500 bg-red-500/5';
      case 'MEDIUM':
        return 'border-yellow-500 bg-yellow-500/5';
      case 'LOW':
        return 'border-green-500 bg-green-500/5';
      default:
        return 'border-gray-500 bg-gray-500/5';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return <Badge variant="danger" className="animate-pulse">🚨 HIGH PRIORITY</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">⚠️ MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="success">✓ LOW</Badge>;
      default:
        return <Badge>UNKNOWN</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500">Pending Review</Badge>;
      case 'in_progress':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500">In Progress</Badge>;
      case 'seen':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500">Seen</Badge>;
      case 'resolved':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500">Resolved</Badge>;
      default:
        return null;
    }
  };

  const handleMarkSeen = async () => {
    setIsProcessing(true);
    try {
      await onMarkSeen?.(case_data.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "rounded-xl border-2 transition-all duration-300",
        getSeverityColor(case_data.severity_score),
        isExpanded ? 'shadow-lg' : 'hover:shadow-md',
        className
      )}
    >
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getSeverityBadge(case_data.severity_score)}
              {getStatusBadge(case_data.status)}
              <span className="text-xs text-gray-500">{formatTime(case_data.timestamp)}</span>
            </div>
            
            <h3 className="text-lg font-semibold text-white">
              {case_data.patient_name}
              {case_data.age && (
                <span className="text-gray-400 font-normal ml-2">
                  {case_data.age}y {case_data.gender?.charAt(0).toUpperCase()}
                </span>
              )}
            </h3>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {case_data.symptoms.slice(0, isExpanded ? undefined : 3).map((symptom, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-full"
                >
                  {symptom}
                </span>
              ))}
              {!isExpanded && case_data.symptoms.length > 3 && (
                <span className="px-2 py-1 text-gray-500 text-xs">
                  +{case_data.symptoms.length - 3} more
                </span>
              )}
            </div>
          </div>

          <button className="text-gray-500 hover:text-white transition-colors">
            <svg
              className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-180")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
          {/* Vitals */}
          {case_data.vitals && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Vitals</h4>
              <div className="grid grid-cols-4 gap-3">
                {case_data.vitals.heart_rate && (
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-red-400 text-lg font-bold">{case_data.vitals.heart_rate}</div>
                    <div className="text-xs text-gray-500">Heart Rate</div>
                  </div>
                )}
                {case_data.vitals.blood_pressure && (
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-blue-400 text-lg font-bold">{case_data.vitals.blood_pressure}</div>
                    <div className="text-xs text-gray-500">BP</div>
                  </div>
                )}
                {case_data.vitals.temperature && (
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-yellow-400 text-lg font-bold">{case_data.vitals.temperature}°F</div>
                    <div className="text-xs text-gray-500">Temp</div>
                  </div>
                )}
                {case_data.vitals.oxygen_level && (
                  <div className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-green-400 text-lg font-bold">{case_data.vitals.oxygen_level}%</div>
                    <div className="text-xs text-gray-500">SpO2</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Assessment */}
          {case_data.ai_assessment && (
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI Assessment
              </h4>
              <p className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3">
                {case_data.ai_assessment}
              </p>
            </div>
          )}

          {/* Recommended Action */}
          {case_data.recommended_action && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-400 mb-1">Recommended Action</h4>
              <p className="text-sm text-gray-300">{case_data.recommended_action}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {case_data.status === 'pending' && (
              <>
                <button
                  onClick={handleMarkSeen}
                  disabled={isProcessing}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg font-medium transition-colors",
                    "bg-green-600 hover:bg-green-500 text-white",
                    isProcessing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    '✓ Mark as Seen'
                  )}
                </button>
                <button
                  onClick={() => onAssign?.(case_data.id)}
                  className="flex-1 py-2 px-4 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  Assign to Doctor
                </button>
              </>
            )}
            <button
              onClick={() => onViewDetails?.(case_data.id)}
              className="py-2 px-4 rounded-lg font-medium border border-gray-600 hover:bg-gray-800 text-gray-300 transition-colors"
            >
              View Full Record
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Real-time case list component
interface UrgentCaseListProps {
  cases: UrgentCase[];
  onMarkSeen?: (caseId: string) => void;
  onViewDetails?: (caseId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function UrgentCaseList({
  cases,
  onMarkSeen,
  onViewDetails,
  isLoading,
  className
}: UrgentCaseListProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-32" />
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-1">All Clear!</h3>
        <p className="text-gray-400">No urgent cases requiring attention</p>
      </div>
    );
  }

  // Sort by severity: HIGH first, then MEDIUM, then LOW
  const sortedCases = [...cases].sort((a, b) => {
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return severityOrder[a.severity_score] - severityOrder[b.severity_score];
  });

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          Urgent Cases
        </h2>
        <span className="text-sm text-gray-400">
          {cases.filter(c => c.severity_score === 'HIGH').length} critical,{' '}
          {cases.filter(c => c.severity_score === 'MEDIUM').length} medium,{' '}
          {cases.filter(c => c.severity_score === 'LOW').length} low
        </span>
      </div>

      {sortedCases.map((caseItem) => (
        <UrgentCaseCard
          key={caseItem.id}
          case_data={caseItem}
          onMarkSeen={onMarkSeen}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}

export default UrgentCaseCard;
