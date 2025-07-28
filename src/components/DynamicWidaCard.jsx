// FileName: src/components/DynamicWidaCard.jsx

import React from 'react';
import { Target } from 'lucide-react'; // A fitting icon for specific targets

const DynamicWidaCard = ({ data }) => {
  // data will look like: { title: "...", descriptors: ["...", "..."] }
  if (!data || !data.descriptors || data.descriptors.length === 0) {
    return null;
  }

  return (
    <div className="card bg-orange-50 border-orange-200">
      <h2 className="section-header text-orange-800 flex items-center gap-2">
        <Target className="w-6 h-6" />
        {data.title || "Lesson-Specific 'Can Do' Descriptors"}
      </h2>
      
      <div className="mt-2 text-sm">
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          {data.descriptors.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default DynamicWidaCard;
