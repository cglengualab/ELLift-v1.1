// src/hooks/useContentCache.js
import { useCallback } from 'react';

export const useContentCache = () => {
  const generateCacheKey = useCallback((content, params) => {
    // Create a simple hash from content + key parameters
    const cacheString = JSON.stringify({
      content: content.substring(0, 1000), // First 1000 chars to avoid huge keys
      subject: params.subject,
      proficiencyLevel: params.proficiencyLevel,
      materialType: params.materialType,
      includeBilingualSupport: params.includeBilingualSupport,
      nativeLanguage: params.nativeLanguage,
      worksheetLength: params.worksheetLength
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < cacheString.length; i++) {
      const char = cacheString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `ellift_cache_${Math.abs(hash)}`;
  }, []);

  const getCachedResult = useCallback((cacheKey) => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
      // Cache expires after 24 hours
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log('📦 Using cached result for:', cacheKey);
      return data.result;
    } catch (error) {
      console.error('Failed to retrieve cached result:', error);
      return null;
    }
  }, []);

  const setCachedResult = useCallback((cacheKey, result) => {
    try {
      const cacheData = {
        result,
        timestamp: Date.now()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log('💾 Cached result for:', cacheKey);
      
      // Clean old cache entries (keep only last 5 to save space)
      const allKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('ellift_cache_'))
        .sort();
      
      if (allKeys.length > 5) {
        const toRemove = allKeys.slice(0, allKeys.length - 5);
        toRemove.forEach(key => localStorage.removeItem(key));
        console.log('🧹 Cleaned old cache entries:', toRemove.length);
      }
      
    } catch (error) {
      console.error('Failed to cache result:', error);
    }
  }, []);

  const clearCache = useCallback(() => {
    const allKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('ellift_cache_')
    );
    allKeys.forEach(key => localStorage.removeItem(key));
    console.log('🗑️ Cleared all cache entries:', allKeys.length);
  }, []);

  return {
    generateCacheKey,
    getCachedResult,
    setCachedResult,
    clearCache
  };
};
