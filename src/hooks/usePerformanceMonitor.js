// src/hooks/usePerformanceMonitor.js
import { useCallback, useRef } from 'react';

export const usePerformanceMonitor = () => {
  const timers = useRef(new Map());

  const startTimer = useCallback((operationName) => {
    const startTime = performance.now();
    timers.current.set(operationName, startTime);
    
    console.log(`⏱️ Started: ${operationName}`);
    return startTime;
  }, []);

  const endTimer = useCallback((operationName, additionalData = {}) => {
    const startTime = timers.current.get(operationName);
    if (!startTime) {
      console.warn(`No timer found for operation: ${operationName}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    timers.current.delete(operationName);

    const performanceData = {
      operation: operationName,
      duration: Math.round(duration),
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    // Log performance data
    console.log(`✅ Completed: ${operationName} in ${performanceData.duration}ms`);

    // Alert for slow operations
    if (duration > 30000) { // More than 30 seconds
      console.warn(`🐌 Slow operation detected: ${operationName} took ${performanceData.duration}ms`);
    }

    // In production, you could send this data to analytics
    if (process.env.NODE_ENV === 'production') {
      recordPerformanceMetric(performanceData);
    }

    return performanceData;
  }, []);

  const recordPerformanceMetric = useCallback((data) => {
    // Simple localStorage-based analytics
    try {
      const existing = JSON.parse(localStorage.getItem('ellift_performance') || '[]');
      existing.push(data);
      
      // Keep only last 50 entries to avoid filling up storage
      const recent = existing.slice(-50);
      localStorage.setItem('ellift_performance', JSON.stringify(recent));
    } catch (error) {
      console.error('Failed to record performance metric:', error);
    }
  }, []);

  const getPerformanceReport = useCallback(() => {
    try {
      const data = JSON.parse(localStorage.getItem('ellift_performance') || '[]');
      return {
        totalOperations: data.length,
        averageDuration: data.reduce((sum, item) => sum + item.duration, 0) / data.length || 0,
        slowestOperation: data.reduce((slowest, item) => 
          !slowest || item.duration > slowest.duration ? item : slowest, null),
        recentOperations: data.slice(-10)
      };
    } catch (error) {
      console.error('Failed to get performance report:', error);
      return null;
    }
  }, []);

  return {
    startTimer,
    endTimer,
    getPerformanceReport
  };
};
