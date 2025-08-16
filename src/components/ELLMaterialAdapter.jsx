import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FileText, Users, BookOpen, ClipboardList, Download, Upload, File, AlertCircle, Book, Target, CheckCircle, XCircle, Palette } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { materialTypes, subjects, gradeLevels, proficiencyLevels, commonLanguages } from '../constants/options';
import { extractTextFromPDF, adaptMaterialWithClaude } from '../services/claudeService';
import { getWidaDescriptors } from '../constants/widaData';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';
import WidaCard from './WidaCard';
import DynamicWidaCard from './DynamicWidaCard';
import ImageGenerator from './ImageGenerator';
import AdminDashboard from './AdminDashboard';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useContentCache } from '../hooks/useContentCache';

// Enhanced status indicator component
const StatusIndicator = ({ processingStep, error, success }) => {
  if (error) {
    return (
      <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md text-sm font-medium flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {error}
      </div>
    );
  }
  
  if (success) {
    return (
      <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md text-sm font-medium flex items-center gap-2">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        {success}
      </div>
    );
  }
  
  if (processingStep) {
    return (
      <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md text-sm font-medium flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0"></div>
        {processingStep}
      </div>
    );
  }
  
  return null;
};

// Enhanced copy button with better feedback
const CopyButton = ({ onClick, label, isLoading, className = "" }) => {
  const [copied, setCopied] = useState(false);
  
  const handleClick = async () => {
    try {
      await onClick();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 text-white text-sm rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {copied ? (
        <>
          <CheckCircle className="w-4 h-4" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardList className="w-4 h-4" />
          Copy {label}
        </>
      )}
    </button>
  );
};

// Enhanced action buttons with better UX
const ActionButtons = ({ adaptMaterial, clearAll, isLoading, isFormValid, hasResults }) => {
  return (
    <div className="mt-6 space-y-4">
      <button
        onClick={adaptMaterial}
        disabled={isLoading || !isFormValid}
        className="w-full btn-primary text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Target className="w-5 h-5" />
            {hasResults ? 'Re-Adapt Material' : 'Adapt Material'}
          </span>
        )}
      </button>
      <button
        onClick={clearAll}
        disabled={isLoading}
        className="w-full btn-danger px-6 py-2 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <XCircle className="w-4 h-4" />
        Clear All Fields
      </button>
    </div>
  );
};

const ELLMaterialAdapter = () => {
  // Form state
  const [inputMethod, setInputMethod] = useState('text');
  const [materialType, setMaterialType] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [originalMaterial, setOriginalMaterial] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState('');
  
  // Bilingual support state
  const [includeBilingualSupport, setIncludeBilingualSupport] = useState(false);
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [translateSummary, setTranslateSummary] = useState(false);
  const [translateInstructions, setTranslateInstructions] = useState(false);
  const [listCognates, setListCognates] = useState(false);
  
  // IEP accommodation state
  const [worksheetLength, setWorksheetLength] = useState('Medium');
  const [addStudentChecklist, setAddStudentChecklist] = useState(false);
  const [useMultipleChoice, setUseMultipleChoice] = useState(false);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  
  // Processing state
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Results state
  const [studentWorksheet, setStudentWorksheet] = useState('');
  const [teacherGuide, setTeacherGuide] = useState('');
  const [widaDescriptors, setWidaDescriptors] = useState(null);
  const [dynamicDescriptors, setDynamicDescriptors] = useState(null);
  const [imagePrompts, setImagePrompts] = useState(null);
  
  // TOGGLE FOR IMAGE FEATURES - Change this to true/false to show/hide
  const [showImageFeatures, setShowImageFeatures] = useState(false); // Set to false to hide, true to show

  // Performance monitoring
  const { startTimer, endTimer } = usePerformanceMonitor();

  // Content caching
  const { generateCacheKey, getCachedResult, setCachedResult, clearCache } = useContentCache();
  
  // Refs for copying content
  const worksheetRef = useRef(null);
  const teacherGuideRef = useRef(null);
  
  // Auto-clear messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (processingStep && !isLoading) {
      const timer = setTimeout(() => setProcessingStep(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [processingStep, isLoading]);

  // Enhanced bilingual support handler
  const handleBilingualSupportChange = useCallback((isChecked) => {
    setIncludeBilingualSupport(isChecked);
    if (isChecked) {
      setNativeLanguage('Spanish');
    } else {
      setNativeLanguage('');
      setTranslateSummary(false);
      setTranslateInstructions(false);
      setListCognates(false);
    }
  }, []);

  // Form validation with detailed feedback
  const validationStatus = useMemo(() => {
    const missingFields = [];
    
    if (!originalMaterial.trim()) missingFields.push('Material Content');
    if (!materialType) missingFields.push('Material Type');
    if (!subject) missingFields.push('Subject');
    if (!proficiencyLevel) missingFields.push('WIDA Proficiency Level');
    if (includeBilingualSupport && !nativeLanguage) missingFields.push('Native Language');
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }, [originalMaterial, materialType, subject, proficiencyLevel, includeBilingualSupport, nativeLanguage]);

  // Enhanced file upload with better error handling
  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError('PDF file is too large. Please upload a file smaller than 10MB.');
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
      setSuccessMessage('PDF text extracted successfully!');
      setProcessingStep('');
    } catch (error) {
      console.error('Error processing PDF:', error);
      setError(`Failed to process PDF: ${error.message}`);
      setUploadedFile(null);
      setProcessingStep('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Enhanced material adaptation with caching
  /*const adaptMaterial = useCallback(async () => {
    // START TIMER
    startTimer('material_adaptation');
    
    // Clear previous messages
    setError('');
    setSuccessMessage('');
    
    // Validate form
    if (!validationStatus.isValid) {
      setError(`Please fill in required fields: ${validationStatus.missingFields.join(', ')}`);
      endTimer('material_adaptation', { success: false, reason: 'validation_failed' });
      return;
    }

    // Generate cache key
    const cacheParams = {
      subject,
      proficiencyLevel,
      materialType,
      includeBilingualSupport,
      nativeLanguage,
      worksheetLength,
      addStudentChecklist,
      useMultipleChoice
    };
    const cacheKey = generateCacheKey(originalMaterial, cacheParams);
    
    // Check cache first
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      // Use cached result
      setStudentWorksheet(cachedResult.studentWorksheet);
      setTeacherGuide(cachedResult.teacherGuide);
      setDynamicDescriptors(cachedResult.dynamicWidaDescriptors);
      setImagePrompts(cachedResult.imagePrompts);

      const generalDescriptors = getWidaDescriptors(proficiencyLevel, subject, gradeLevel);
      setWidaDescriptors(generalDescriptors);

      setSuccessMessage('Material loaded from cache! (Instant result)');
      
      endTimer('material_adaptation', {
        success: true,
        cached: true,
        contentLength: originalMaterial.length,
        proficiencyLevel,
        subject,
        materialType
      });

      // Scroll to results
      setTimeout(() => {
        worksheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
      
      return;
    }

    // No cache hit, proceed with API call
    setIsLoading(true);
    setProcessingStep('Preparing material adaptation...');

    try {
      const adaptedData = await adaptMaterialWithClaude({
        contentToAdapt: originalMaterial,
        materialType,
        subject,
        gradeLevel,
        proficiencyLevel,
        learningObjectives,
        includeBilingualSupport,
        nativeLanguage,
        translateSummary,
        translateInstructions,
        listCognates,
        worksheetLength,
        addStudentChecklist,
        useMultipleChoice
      }, setProcessingStep);

      // Cache the result
      setCachedResult(cacheKey, adaptedData);

      setStudentWorksheet(adaptedData.studentWorksheet);
      setTeacherGuide(adaptedData.teacherGuide);
      setDynamicDescriptors(adaptedData.dynamicWidaDescriptors);
      setImagePrompts(adaptedData.imagePrompts);

      const generalDescriptors = getWidaDescriptors(proficiencyLevel, subject, gradeLevel);
      setWidaDescriptors(generalDescriptors);

      setSuccessMessage('Material successfully adapted for ELL students!');
      setProcessingStep('');

      endTimer('material_adaptation', {
        success: true,
        cached: false,
        contentLength: originalMaterial.length,
        proficiencyLevel,
        subject,
        materialType
      });

      // Scroll to results
      setTimeout(() => {
        worksheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);

    } catch (error) {
      console.error('Error adapting material:', error);
      setError(error.message || 'Sorry, there was an error adapting your material. Please try again.');
      setProcessingStep('');
      
      endTimer('material_adaptation', {
        success: false,
        error: error.message,
        contentLength: originalMaterial.length,
        proficiencyLevel,
        subject
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    validationStatus.isValid, 
    validationStatus.missingFields, 
    originalMaterial, 
    materialType, 
    subject, 
    gradeLevel, 
    proficiencyLevel, 
    learningObjectives, 
    includeBilingualSupport, 
    nativeLanguage,
    translateSummary, 
    translateInstructions, 
    listCognates, 
    worksheetLength,
    addStudentChecklist, 
    useMultipleChoice, 
    startTimer, 
    endTimer,
    generateCacheKey,
    getCachedResult,
    setCachedResult
  ] );*/

  // Enhanced clear all with confirmation for non-empty forms
  const clearAll = useCallback(() => {
    const hasContent = originalMaterial || studentWorksheet || teacherGuide;
    
    if (hasContent && !window.confirm('Are you sure you want to clear all fields and results? This action cannot be undone.')) {
      return;
    }

    // Reset all state
    setOriginalMaterial('');
    setLearningObjectives('');
    setStudentWorksheet('');
    setTeacherGuide('');
    setWidaDescriptors(null);
    setDynamicDescriptors(null);
    setImagePrompts(null);
    setMaterialType('');
    setSubject('');
    setGradeLevel('');
    setProficiencyLevel('');
    setUploadedFile(null);
    setExtractedText('');
    setInputMethod('text');
    
    // Reset bilingual support
    setIncludeBilingualSupport(false);
    setNativeLanguage('');
    setTranslateSummary(false);
    setTranslateInstructions(false);
    setListCognates(false);
    
    // Reset accommodations
    setWorksheetLength('Medium');
    setAddStudentChecklist(false);
    setUseMultipleChoice(false);
    
    // Clear messages
    setProcessingStep('');
    setError('');
    setSuccessMessage('All fields cleared successfully!');
  }, [originalMaterial, studentWorksheet, teacherGuide]);

  // Enhanced copy functions with better error handling
  const createCopyFunction = useCallback((ref, contentName) => {
    return async () => {
      if (!ref.current) {
        throw new Error(`${contentName} content not found`);
      }

      try {
        const htmlContent = ref.current.innerHTML;
        const styles = `
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #1f2937; }
            h2 { font-size: 18px; font-weight: bold; font-style: italic; margin-top: 24px; margin-bottom: 12px; color: #374151; }
            h3 { font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #4b5563; }
            p, li { font-size: 14px; line-height: 1.5; margin-bottom: 8px; }
            ul, ol { margin-left: 20px; }
            strong { font-weight: bold; }
            em { font-style: italic; }
          </style>
        `;
        const fullHtml = `<html><head>${styles}</head><body>${htmlContent}</body></html>`;
        
        const blob = new Blob([fullHtml], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        
        setSuccessMessage(`${contentName} copied to clipboard with formatting!`);
      } catch (err) {
        // Fallback to plain text if HTML copy fails
        try {
          const textContent = ref.current.textContent;
          await navigator.clipboard.writeText(textContent);
          setSuccessMessage(`${contentName} copied as plain text to clipboard!`);
        } catch (textErr) {
          throw new Error(`Failed to copy ${contentName}. Please try selecting and copying manually.`);
        }
      }
    };
  }, []);

  const copyStudentWorksheet = useMemo(() => createCopyFunction(worksheetRef, 'Student Worksheet'), [createCopyFunction]);
  const copyTeacherGuide = useMemo(() => createCopyFunction(teacherGuideRef, "Teacher's Guide"), [createCopyFunction]);

  // Enhanced file removal
  const removeFile = useCallback(() => {
    setUploadedFile(null);
    setExtractedText('');
    if (originalMaterial === extractedText) {
      setOriginalMaterial('');
    }
    setSuccessMessage('File removed successfully');
  }, [extractedText, originalMaterial]);

  const hasResults = Boolean(studentWorksheet || teacherGuide);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ELLift</h1>
        <p className="text-gray-600 mb-6">Transform your classroom materials to support English Language Learners</p>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <div className="card bg-blue-50 border-blue-200 sticky top-6">
            <h2 className="section-header text-blue-800">ELL Adaptation Settings</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Material Type *
                {!materialType && <span className="text-red-500 text-xs ml-1">(Required)</span>}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {materialTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setMaterialType(type.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        materialType === type.value
                          ? 'border-blue-500 bg-blue-100 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      <IconComponent className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-xs font-medium">{type.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                  {!subject && <span className="text-red-500 text-xs ml-1">(Required)</span>}
                </label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field">
                  <option value="">Select Subject</option>
                  {subjects.map(subj => ( <option key={subj} value={subj}>{subj}</option> ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="input-field">
                  <option value="">Select Grade</option>
                  {gradeLevels.map(grade => ( <option key={grade} value={grade}>{grade}</option> ))}
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Learning Objectives
                <span className="text-xs text-gray-500 block mt-1">What should students learn? (Optional)</span>
              </label>
              <textarea
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
                placeholder="e.g., Students will solve linear equations..."
                className="input-field h-20 resize-none custom-scrollbar"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WIDA Proficiency Level *
                {!proficiencyLevel && <span className="text-red-500 text-xs ml-1">(Required)</span>}
              </label>
              <select value={proficiencyLevel} onChange={(e) => setProficiencyLevel(e.target.value)} className="input-field">
                <option value="">Select Level</option>
                {proficiencyLevels.map(level => ( <option key={level.value} value={level.value}>{level.label}</option> ))}
              </select>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="bilingual-support"
                  checked={includeBilingualSupport}
                  onChange={(e) => handleBilingualSupportChange(e.target.checked)}
                  className="mr-3 w-4 h-4 text-blue-600"
                />
                <label htmlFor="bilingual-support" className="text-sm font-medium text-gray-700">
                  Include bilingual vocabulary support
                </label>
              </div>
              
              {includeBilingualSupport && (
                <div className="space-y-3 pt-3 border-t mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student's Native Language *
                      {!nativeLanguage && <span className="text-red-500 text-xs ml-1">(Required when bilingual support is enabled)</span>}
                    </label>
                    <select value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)} className="input-field">
                      <option value="">Select Language</option>
                      {commonLanguages.map(lang => ( <option key={lang} value={lang}>{lang}</option> ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center">
                    <input type="checkbox" id="translate-summary" checked={translateSummary} onChange={(e) => setTranslateSummary(e.target.checked)} className="mr-3 w-4 h-4 text-blue-600" />
                    <label htmlFor="translate-summary" className="text-sm text-gray-700">Add bilingual background summary</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="translate-instructions" checked={translateInstructions} onChange={(e) => setTranslateInstructions(e.target.checked)} className="mr-3 w-4 h-4 text-blue-600" />
                    <label htmlFor="translate-instructions" className="text-sm text-gray-700">Translate activity instructions</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="list-cognates" checked={listCognates} onChange={(e) => setListCognates(e.target.checked)} className="mr-3 w-4 h-4 text-blue-600" />
                    <label htmlFor="list-cognates" className="text-sm text-gray-700">List cognates in Teacher's Guide</label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-medium text-gray-800 mb-3">Additional Accommodations</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Worksheet Length</label>
                  <select value={worksheetLength} onChange={(e) => setWorksheetLength(e.target.value)} className="input-field text-sm">
                    <option value="Short">Short (5-10 min)</option>
                    <option value="Medium">Medium (15-25 min)</option>
                    <option value="Long">Long (30+ min)</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="add-checklist" checked={addStudentChecklist} onChange={(e) => setAddStudentChecklist(e.target.checked)} className="mr-3 w-4 h-4 text-blue-600" />
                  <label htmlFor="add-checklist" className="text-sm text-gray-700">Add student checklist</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="use-mcq" checked={useMultipleChoice} onChange={(e) => setUseMultipleChoice(e.target.checked)} className="mr-3 w-4 h-4 text-blue-600" />
                  <label htmlFor="use-mcq" className="text-sm text-gray-700">Convert questions to multiple choice</label>
                </div>
              </div>
            </div>
            
            <StatusIndicator 
              processingStep={processingStep}
              error={null}
              success={successMessage}
            />
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="card bg-gray-50 border-gray-200">
            <h2 className="section-header text-gray-800">Original Material</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">How would you like to add your material?</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    inputMethod === 'text'
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}
                >
                  <FileText className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Type/Paste Text</div>
                </button>
                <button
                  onClick={() => setInputMethod('upload')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    inputMethod === 'upload'
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}
                >
                  <Upload className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Upload PDF</div>
                </button>
              </div>
            </div>
            
            {inputMethod === 'upload' && (
              <div className="mb-4">
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center bg-blue-50">
                  {uploadedFile ? (
                    <div className="space-y-2">
                      <File className="w-8 h-8 text-green-500 mx-auto" />
                      <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-600">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button onClick={removeFile} className="text-xs text-red-600 hover:text-red-800">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-blue-400 mx-auto" />
                      <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" id="pdf-upload" disabled={isLoading} />
                      <label htmlFor="pdf-upload" className="inline-flex items-center btn-primary cursor-pointer text-sm py-2 px-3">
                        Choose PDF
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        Maximum file size: 10MB
                      </p>
                    </div>
                  )}
                </div>
                {uploadedFile && extractedText && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-xs text-green-800 font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Text extracted and added below
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material Content *
                {uploadedFile && extractedText && (
                  <span className="text-blue-600 text-xs ml-2">(from PDF)</span>
                )}
                {!originalMaterial.trim() && <span className="text-red-500 text-xs ml-1">(Required)</span>}
              </label>
              <textarea
                value={originalMaterial}
                onChange={(e) => setOriginalMaterial(e.target.value)}
                placeholder={
                  inputMethod === 'upload' 
                    ? "Upload a PDF above to extract text here..." 
                    : "Enter your lesson material, quiz questions, worksheet content..."
                }
                className="input-field h-96 resize-none custom-scrollbar"
              />
              <div className="mt-2 text-xs text-gray-500">
                Character count: {originalMaterial.length}
                {originalMaterial.length > 10000 && (
                  <span className="text-amber-600 ml-2">
                    ⚠️ Large content may take longer to process
                  </span>
                )}
              </div>
            </div>

            {!validationStatus.isValid && validationStatus.missingFields.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-amber-800 text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Missing required fields: {validationStatus.missingFields.join(', ')}
                </p>
              </div>
            )}
          </div>
         
          <ActionButtons 
            adaptMaterial={adaptMaterial}
            clearAll={clearAll}
            isLoading={isLoading}
            isFormValid={validationStatus.isValid}
            hasResults={hasResults}
          />

          {studentWorksheet && (
            <>
              <div className="card bg-green-50 border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-header text-green-800 flex items-center gap-2">
                    <BookOpen className="w-6 h-6" />
                    Adapted Student Material
                  </h2>
                  <CopyButton
                    onClick={copyStudentWorksheet}
                    label="Worksheet"
                    isLoading={isLoading}
                    className="bg-green-600 hover:bg-green-700"
                  />
                </div>
                <div ref={worksheetRef} className="bg-white p-6 rounded-md border border-green-200 h-96 overflow-y-auto custom-scrollbar prose max-w-full">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{studentWorksheet}</ReactMarkdown>
                </div>
              </div>

              <div className="card bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="section-header text-slate-800 flex items-center gap-2">
                    <Book className="w-6 h-6"/>
                    Teacher's Guide
                  </h2>
                  <CopyButton
                    onClick={copyTeacherGuide}
                    label="Guide"
                    isLoading={isLoading}
                    className="bg-slate-600 hover:bg-slate-700"
                  />
                </div>
                <div ref={teacherGuideRef} className="bg-white p-6 rounded-md border border-slate-200 max-h-96 overflow-y-auto custom-scrollbar prose max-w-full">
                   <ReactMarkdown rehypePlugins={[rehypeRaw]}>{teacherGuide}</ReactMarkdown>
                </div>
              </div>

              {dynamicDescriptors && (
                <DynamicWidaCard data={dynamicDescriptors} />
              )}
              {widaDescriptors && (
                <WidaCard descriptors={widaDescriptors} />
              )}
            </>
          )}
        </div>

        {/* Tips Section */}
        <div className="xl:col-span-3">
          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
              💡 Tips for Best Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              <div className="text-sm text-yellow-700 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-yellow-800">📄 PDF uploads:</span>
                  <span>Works best with text-based PDFs (not scanned images)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-yellow-800">🎯 Learning objectives:</span>
                  <span>Be specific about what students should learn for better adaptation</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-yellow-800">📊 WIDA levels:</span>
                  <span>Choose the level that best matches your students' current abilities</span>
                </div>
              </div>
              <div className="text-sm text-yellow-700 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-yellow-800">🌍 Bilingual support:</span>
                  <span>Optional translations help bridge language gaps</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-yellow-800">✏️ Edit text:</span>
                  <span>You can modify extracted PDF text before adapting</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-yellow-800">🔍 Review output:</span>
                  <span>Always check adapted content for accuracy and appropriateness</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Toggle for Image Features */}
        <div className="xl:col-span-3">
          <div className="card bg-gray-50 border-gray-200 mb-4">
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-medium">🧪 Developer Mode: Image Features</span>
              <button
                onClick={() => setShowImageFeatures(!showImageFeatures)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  showImageFeatures 
                    ? 'bg-green-100 text-green-800 border border-green-300' 
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {showImageFeatures ? 'Hide' : 'Show'} Image Features
              </button>
            </div>
          </div>
        </div>

        {/* Image Generator Section for results */}
        {hasResults && showImageFeatures && (
          <div className="xl:col-span-3">
            <ImageGenerator 
              subject={subject} 
              proficiencyLevel={proficiencyLevel} 
            />
          </div>
        )}

        {/* Image Generator Section for no results */}
        {!hasResults && showImageFeatures && (
          <div className="xl:col-span-3">
            <ImageGenerator 
              subject={subject} 
              proficiencyLevel={proficiencyLevel} 
            />
          </div>
        )}
      </div>
    </div>

    {/* Admin Dashboard - Hidden by default */}
    <AdminDashboard />
  </div>
  );
};

export default ELLMaterialAdapter;
