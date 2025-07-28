import React from 'react';
import { BookCheck } from 'lucide-react'; // A fitting icon

// This component receives the descriptor object and displays it.
// It uses TailwindCSS classes consistent with your project's design.
const WidaCard = ({ descriptors }) => {
  if (!descriptors) return null;

  return (
    <div className="card bg-purple-50 border-purple-200">
      <h2 className="section-header text-purple-800 flex items-center gap-2">
        <BookCheck className="w-6 h-6" />
        Alignment with WIDA "Can Do" Descriptors
      </h2>
      
      <div className="mb-4 p-3 bg-white border-l-4 border-purple-300 rounded-r-md">
        <p className="text-sm font-medium text-gray-800">
          <strong>Proficiency Level:</strong> {descriptors.level} | 
          <strong> Grade Band:</strong> {descriptors.grade} | 
          <strong> Subject:</strong> {descriptors.subject}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <div>
          <h4 className="font-semibold text-purple-700 mb-1">Listening</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {descriptors.listening.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-purple-700 mb-1">Speaking</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {descriptors.speaking.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-purple-700 mb-1">Reading</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {descriptors.reading.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-purple-700 mb-1">Writing</h4>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {descriptors.writing.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WidaCard;
