import React, { useState, useCallback, useMemo } from 'react';
import { FileText, Users, BookOpen, ClipboardList, Download, Upload, File, AlertCircle } from 'lucide-react';
import { materialTypes, subjects, gradeLevels, proficiencyLevels, commonLanguages } from '../constants/options';
import { extractTextFromPDF, adaptMaterialWithClaude } from '../services/claudeService';
import { getWidaDescriptors } from '../constants/widaData';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import WidaCard from './WidaCard';
import DynamicWidaCard from './DynamicWidaCard';

// --- NEW REUSABLE COMPONENT FOR THE ACTION BUTTONS ---
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
  // All state declarations remain the same
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
  const [processingStep, setProcessingStep] = useState('');
  const [adaptedMaterial, setAdaptedMaterial] = useState('');
  const [widaDescriptors, setWidaDescriptors] = useState(null);
  const [dynamicDescriptors, setDynamicDescriptors] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // All functions (isFormValid, handleFileUpload, adaptMaterial, etc.) remain the same
  const isFormValid = useMemo(() => {
    const basicFieldsValid = originalMaterial.trim() && materialType && subject && proficiencyLevel && learningObjectives.trim();
    const bilingualValid = !includeBilingualSupport || nativeLanguage;
    return basicFieldsValid && bilingualValid;
  }, [originalMaterial, materialType, subject, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage]);

  const handleFileUpload = useCallback(async (event) => {
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
      setAdaptedMaterial(adaptedData.adaptedMaterial);
      setDynamicDescriptors(adaptedData.dynamicWidaDescriptors);
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
    setOriginalMaterial('');
    setLearningObjectives('');
    setNativeLanguage('');
    setIncludeBilingualSupport(false);
    setAdaptedMaterial('');
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
    try {
      await navigator.clipboard.writeText(adaptedMaterial);
      setProcessingStep('Copied to clipboard!');
      setTimeout(() => setProcessingStep(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  }, [adaptedMaterial]);

  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setExtractedText('');
    setOriginalMaterial('');
  }, []);

  // The JSX layout is the main part that has changed
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ELLift</h1>
        <p className="text-gray-600 mb-6">Transform your classroom materials to support English Language Learners</p>
        {/* --- REMOVED: Top "Clear All Fields" button is now in the ActionButtons component --- */}
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column: ELL Settings */}
        <div className="xl:col-span-1">
          <div className="card bg-blue-50 border-blue-200 sticky top-6">
            <h2 className="section-header text-blue-800">ELL Adaptation Settings</h2>
            
            {/* The entire settings form is unchanged */}
            <div className="mb-6">{/* Material Type */}</div>
            <div className="grid grid-cols-1 gap-4 mb-6">{/* Subject and Grade */}</div>
            <div className="mb-6">{/* Learning Objectives */}</div>
            <div className="mb-6">{/* Proficiency Level */}</div>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">{/* Bilingual Support */}</div>

            {/* --- NEW: First set of action buttons --- */}
            <ActionButtons 
              adaptMaterial={adaptMaterial}
              clearAll={clearAll}
              isLoading={isLoading}
              isFormValid={isFormValid}
            />

            {/* Processing Status */}
            {processingStep && (
              <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
                {processingStep}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Original Material & Adapted Material */}
        <div className="xl:col-span-2 space-y-6">
          {/* Original Material Section (unchanged) */}
          <div className="card bg-gray-50 border-gray-200">
            {/* ... all the content for the original material card ... */}
          </div>

          {/* --- NEW: Second set of action buttons --- */}
          <ActionButtons 
            adaptMaterial={adaptMaterial}
            clearAll={clearAll}
            isLoading={isLoading}
            isFormValid={isFormValid}
          />
          
          {/* Adapted Material Section (unchanged, appears below the new buttons) */}
          {adaptedMaterial && (
            <div className="card bg-green-50 border-green-200">
              {/* ... all the content for the adapted material card ... */}
            </div>
          )}

          {/* The Lesson-Specific (teal/orange) card now comes FIRST */}
          {dynamicDescriptors && (
            <DynamicWidaCard data={dynamicDescriptors} />
          )}

          {/* The General (purple) card now comes SECOND */}
          {widaDescriptors && (
            <WidaCard descriptors={widaDescriptors} />
          )}
        </div>

        {/* Tips Section and Bottom Button (unchanged, but bottom button is now removed) */}
        <div className="xl:col-span-3">
          {/* ... Tips card ... */}
        </div>
      </div>

      {/* --- REMOVED: The bottom "Clear All Fields" button is now handled by ActionButtons --- */}
    </div>
  );
};

export default ELLMaterialAdapter;
