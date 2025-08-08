// FileName: src/components/DynamicWidaCard.jsx

import React from 'react';
import { Target } from 'lucide-react'; // A fitting icon for specific targets

const DynamicWidaCard = ({ data }) => {
  // Handle both old and new data structures
  if (!data) {
    return null;
  }

  // Check if we have any content to display
  const hasContent = data.descriptors || data.widaStandards || data.contentObjectives || data.languageObjectives;
  if (!hasContent) {
    return null;
  }

  return (
    <div className="card bg-orange-50 border-orange-200">
      <h2 className="section-header text-orange-800 flex items-center gap-2">
        <Target className="w-6 h-6" />
        {data.title || "Lesson-Specific 'Can Do' Descriptors"}
      </h2>
      
      {/* New: WIDA Standards (if present) */}
      {data.widaStandards && data.widaStandards.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-orange-700 mb-2">WIDA ELD Standards Addressed</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {data.widaStandards.map((std, index) => (
              <li key={index}>{std}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* New: Content Objectives (if present) */}
      {data.contentObjectives && data.contentObjectives.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-orange-700 mb-2">Content Objectives</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {data.contentObjectives.map((obj, index) => (
              <li key={index}>Students can {obj}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* New: Language Objectives (if present) */}
      {data.languageObjectives && data.languageObjectives.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-orange-700 mb-2">Language Objectives</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {data.languageObjectives.map((obj, index) => (
              <li key={index}>Students can {obj}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Keep existing descriptors - this ensures backward compatibility */}
      {data.descriptors && data.descriptors.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-orange-700 mb-2">Performance Descriptors</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {data.descriptors.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DynamicWidaCard;
