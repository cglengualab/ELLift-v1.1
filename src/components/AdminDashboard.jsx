// src/components/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, AlertTriangle, Users, X } from 'lucide-react';

const AdminDashboard = () => {
  const [performanceData, setPerformanceData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  // Show dashboard with secret key combination: Ctrl+Shift+A
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'A' && e.ctrlKey && e.shiftKey) {
        setIsVisible(!isVisible);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) {
      loadPerformanceData();
    }
  }, [isVisible]);

  const loadPerformanceData = () => {
    try {
      const data = JSON.parse(localStorage.getItem('ellift_performance') || '[]');
      
      const analysis = {
        totalOperations: data.length,
        averageDuration: data.reduce((sum, item) => sum + item.duration, 0) / data.length || 0,
        slowestOperation: data.reduce((slowest, item) => 
          !slowest || item.duration > slowest.duration ? item : slowest, null),
        recentOperations: data.slice(-10),
        successfulOperations: data.filter(item => item.success !== false).length,
        errorRate: data.length > 0 ? (data.filter(item => item.success === false).length / data.length * 100) : 0,
        subjectBreakdown: data.reduce((acc, item) => {
          const subject = item.subject || 'Unknown';
          acc[subject] = (acc[subject] || 0) + 1;
          return acc;
        }, {}),
        proficiencyBreakdown: data.reduce((acc, item) => {
          const level = item.proficiencyLevel || 'Unknown';
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        }, {})
      };
      
      setPerformanceData(analysis);
    } catch (error) {
      console.error('Failed to load performance data:', error);
      setPerformanceData({
        totalOperations: 0,
        averageDuration: 0,
        slowestOperation: null,
        recentOperations: [],
        successfulOperations: 0,
        errorRate: 0,
        subjectBreakdown: {},
        proficiencyBreakdown: {}
      });
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 text-xs text-gray-400 bg-white px-2 py-1 rounded shadow">
        Press Ctrl+Shift+A for admin
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            ELLift Analytics Dashboard
          </h2>
          <button 
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {performanceData ? (
          <div className="p-6 space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-blue-900">
                      {performanceData.totalOperations}
                    </div>
                    <div className="text-sm text-blue-600">Total Adaptations</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold text-green-900">
                      {Math.round(performanceData.averageDuration / 1000)}s
                    </div>
                    <div className="text-sm text-green-600">Avg. Duration</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {Math.round(performanceData.errorRate)}%
                    </div>
                    <div className="text-sm text-yellow-600">Error Rate</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold text-purple-900">
                      {performanceData.slowestOperation ? 
                        Math.round(performanceData.slowestOperation.duration / 1000) : 0}s
                    </div>
                    <div className="text-sm text-purple-600">Slowest Operation</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subject and Proficiency Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Subject Usage</h3>
                <div className="space-y-2">
                  {Object.entries(performanceData.subjectBreakdown).map(([subject, count]) => (
                    <div key={subject} className="flex justify-between items-center bg-white p-2 rounded">
                      <span className="text-sm text-gray-700">{subject}</span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
                  {Object.keys(performanceData.subjectBreakdown).length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">No data yet</div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Proficiency Levels</h3>
                <div className="space-y-2">
                  {Object.entries(performanceData.proficiencyBreakdown).map(([level, count]) => (
                    <div key={level} className="flex justify-between items-center bg-white p-2 rounded">
                      <span className="text-sm text-gray-700">{level}</span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
                  {Object.keys(performanceData.proficiencyBreakdown).length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">No data yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Operations */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Recent Operations</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {performanceData.recentOperations.length > 0 ? (
                  performanceData.recentOperations.map((op, index) => (
                    <div key={index} className="bg-white p-3 rounded text-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-block w-3 h-3 rounded-full ${
                          op.success !== false ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                        <div>
                          <div className="font-medium">
                            {op.subject || 'Unknown Subject'} - {op.proficiencyLevel || 'Unknown Level'}
                          </div>
                          {op.materialType && (
                            <div className="text-xs text-gray-500">{op.materialType}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-500">
                        {Math.round(op.duration / 1000)}s
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">No operations yet</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button 
                onClick={loadPerformanceData}
                className="btn-primary px-4 py-2 text-sm"
              >
                Refresh Data
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all performance data?')) {
                    localStorage.removeItem('ellift_performance');
                    loadPerformanceData();
                  }
                }}
                className="btn-danger px-4 py-2 text-sm"
              >
                Clear Data
              </button>
              <button 
                onClick={() => {
                  const data = localStorage.getItem('ellift_performance');
                  const blob = new Blob([data || '[]'], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ellift-analytics-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Export Data
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="text-gray-500">Loading performance data...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
