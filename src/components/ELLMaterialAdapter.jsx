import React, { useState, useCallback, useMemo } from 'react';
import { FileText, Users, BookOpen, ClipboardList, Download, Upload, File, AlertCircle, Book, Target } from 'lucide-react'; // Added Book icon
import { materialTypes, subjects, gradeLevels, proficiencyLevels, commonLanguages } from '../constants/options';
import { extractTextFromPDF, adaptMaterialWithClaude } from '../services/claudeService';
import { getWidaDescriptors } from '../constants/widaData';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import WidaCard from './WidaCard';
import DynamicWidaCard from './DynamicWidaCard';

// This reusable component is for the single set of action buttons
const ActionButtons = ({ adaptMaterial, clearAll, isLoading, isFormValid }) => {
  return (
    <div className="mt-6 space-y-4">
      <button
        onClick={adaptMaterial}
        disabled={isLoading || !isFormValid}
        className="w-full btn-primary text-lg py-3 disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Processing...
          </span>
        ) : (
          'Adapt Material'
        )}
      </button>
      <button
        onClick={clearAll}
        className="w-full btn-danger px-6 py-2 shadow-md flex items-center justify-center gap-2"
      >
        🗑️ Clear All Fields
      </button>
    </div>
  );
};

const ELLMaterialAdapter = () => {
  // State declarations
  const [inputMethod, setInputMethod] = useState('text');
  const [materialType, setMaterialType] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [originalMaterial, setOriginalMaterial] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [includeBilingualSupport, setIncludeBilingualSupport] = useState(false);
  const [proficiencyLevel, setProficiencyLevel] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  
  // Processing and output state
  const [processingStep, setProcessingStep] = useState('');
  const [studentWorksheet, setStudentWorksheet] = useState(''); // <-- MODIFIED: Renamed from adaptedMaterial for clarity
  const [teacherGuide, setTeacherGuide] = useState('');         // <-- NEW: State for the teacher's guide
  const [widaDescriptors, setWidaDescriptors] = useState(null);
  const [dynamicDescriptors, setDynamicDescriptors] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = useMemo(() => {
    const basicFieldsValid = originalMaterial.trim() && materialType && subject && proficiencyLevel && learningObjectives.trim();
    const bilingualValid = !includeBilingualSupport || nativeLanguage;
    return basicFieldsValid && bilingualValid;
  }, [originalMaterial, materialType, subject, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage]);

  const handleFileUpload = useCallback(async (event) => {
    // This function is unchanged
    const file = event.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }
    setUploadedFile(file);
    setIsLoading(true);
    setError('');
    setProcessingStep('Starting PDF processing...');
    try {
      const text = await extractTextFromPDF(file, setProcessingStep);
      setOriginalMaterial(text);
      setExtractedText(text);
      setProcessingStep('PDF text extracted successfully! You can edit the text below if needed.');
      setTimeout(() => setProcessingStep(''), 3000);
    } catch (error) {
      console.error('Error processing PDF:', error);
      setError(`${error.message}`);
      setUploadedFile(null);
      setProcessingStep('');
    }
    setIsLoading(false);
  }, []);

  const adaptMaterial = useCallback(async () => {
    // <-- MODIFIED: This function is updated to handle the new JSON structure
    const contentToAdapt = originalMaterial;
    if (!contentToAdapt.trim() || !materialType || !subject || !proficiencyLevel || !learningObjectives.trim()) {
      setError('Please fill in all required fields including learning objectives');
      return;
    }
    if (includeBilingualSupport && !nativeLanguage) {
      setError('Please select the student\'s native language for bilingual support');
      return;
    }
    setIsLoading(true);
    setError('');
    setProcessingStep('Adapting material for ELL students...');
    try {
      const adaptedData = await adaptMaterialWithClaude({
        contentToAdapt, materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage
      });

      // Unpack the new, structured response into our state variables
      setStudentWorksheet(adaptedData.studentWorksheet);
      setTeacherGuide(adaptedData.teacherGuide);
      setDynamicDescriptors(adaptedData.dynamicWidaDescriptors);

      // The general descriptors logic remains the same
      const generalDescriptors = getWidaDescriptors(proficiencyLevel, subject, gradeLevel);
      setWidaDescriptors(generalDescriptors);
      
      setProcessingStep('');
    } catch (error) {
      console.error('Error adapting material:', error);
      setError(error.message || 'Sorry, there was an error adapting your material. Please try again.');
      setProcessingStep('');
    }
    setIsLoading(false);
  }, [originalMaterial, materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage]);

  const clearAll = useCallback(() => {
    // <-- MODIFIED: This function is updated to clear the new state
    setOriginalMaterial('');
    setLearningObjectives('');
    setNativeLanguage('');
    setIncludeBilingualSupport(false);
    setStudentWorksheet(''); // <-- MODIFIED
    setTeacherGuide('');     // <-- NEW
    setWidaDescriptors(null);
    setDynamicDescriptors(null);
    setMaterialType('');
    setSubject('');
    setGradeLevel('');
    setProficiencyLevel('');
    setUploadedFile(null);
    setExtractedText('');
    setInputMethod('text');
    setProcessingStep('');
    setError('');
  }, []);

  const copyToClipboard = useCallback(async () => {
    // <-- MODIFIED: Now copies the student worksheet specifically
    try {
      await navigator.clipboard.writeText(studentWorksheet);
      setProcessingStep('Copied to clipboard!');
      setTimeout(() => setProcessingStep(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  }, [studentWorksheet]);

  const removeFile = useCallback(() => {
    // This function is unchanged
    setUploadedFile(null);
    setExtractedText('');
    setOriginalMaterial('');
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ELLift</h1>
        <p className="text-gray-600 mb-6">Transform your classroom materials to support English Language Learners</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: ELL Settings (Unchanged) */}
        <div className="xl:col-span-1">
            <div className="card bg-blue-50 border-blue-200 sticky top-6">
                {/* All the form content is here and unchanged */}
            </div>
        </div>

        {/* Right Column: Original Material & Adapted Material */}
        <div className="xl:col-span-2 space-y-6">
          <div className="card bg-gray-50 border-gray-200">
            {/* The Original Material card is unchanged */}
          </div>
          
          <ActionButtons 
            adaptMaterial={adaptMaterial}
            clearAll={clearAll}
            isLoading={isLoading}
            isFormValid={isFormValid}
          />

          {/* <-- MODIFIED: The result cards are now driven by the new state variables --> */}
          {studentWorksheet && (
            <>
              {/* This is the green card for the student's printable worksheet */}
              <div className="card bg-green-50 border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-header text-green-800">Adapted Student Material</h2>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Copy Worksheet
                  </button>
                </div>
                <div className="bg-white p-6 rounded-md border border-green-200 h-96 overflow-y-auto custom-scrollbar">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                    {studentWorksheet}
                  </pre>
                </div>
              </div>

              {/* <-- NEW: This is the gray card for the Teacher's Guide --> */}
              <div className="card bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-header text-slate-800 flex items-center gap-2">
                    <Book className="w-6 h-6"/>
                    Teacher's Guide
                  </h2>
                </div>
                <div className="bg-white p-6 rounded-md border border-slate-200 max-h-96 overflow-y-auto custom-scrollbar">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                    {teacherGuide}
                  </pre>
                </div>
              </div>

              {/* The WIDA cards appear after the main content */}
              {dynamicDescriptors && (
                <DynamicWidaCard data={dynamicDescriptors} />
              )}
              {widaDescriptors && (
                <WidaCard descriptors={widaDescriptors} />
              )}
            </>
          )}
        </div>

        {/* The Tips card is unchanged */}
        <div className="xl:col-span-3">
          <div className="card bg-yellow-50 border-yellow-200">{/* ... */}</div>
        </div>
      </div>
    </div>
  );
};

export default ELLMaterialAdapter;
