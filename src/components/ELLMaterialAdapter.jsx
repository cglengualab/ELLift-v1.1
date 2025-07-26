import React, { useState, useCallback, useMemo } from 'react';
import { FileText, Users, BookOpen, ClipboardList, Download, Upload, File, AlertCircle } from 'lucide-react';
import { materialTypes, subjects, gradeLevels, proficiencyLevels, commonLanguages } from '../constants/options';
import { extractTextFromPDF, adaptMaterialWithClaude } from '../services/claudeService';
import LoadingSpinner from './LoadingSpinner';
import ErrorAlert from './ErrorAlert';

const ELLMaterialAdapter = () => {
  // Form state
  const [materialType, setMaterialType] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [originalMaterial, setOriginalMaterial] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [includeBilingualSupport, setIncludeBilingualSupport] = useState(false);
  const [proficiencyLevel, setProficiencyLevel] = useState('');
  
  // File handling state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [inputMethod, setInputMethod] = useState('text');
  
  // Processing state
  const [processingStep, setProcessingStep] = useState('');
  const [adaptedMaterial, setAdaptedMaterial] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Validation - simplified since we only use originalMaterial now
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
      // Extract text using PDF.js (client-side)
      const text = await extractTextFromPDF(file, setProcessingStep);
      
      // Put the extracted text into the main text area
      setOriginalMaterial(text);
      setExtractedText(text);
      
      // Switch to text mode to show the extracted content
      setInputMethod('text');
      
      setProcessingStep('PDF text extracted successfully! You can edit the text below if needed.');
      
      // Clear the success message after a few seconds
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
    if (!isFormValid) {
      setError('Please fill in all required fields including learning objectives');
      return;
    }

    const contentToAdapt = inputMethod === 'upload' ? extractedText : originalMaterial;
    setIsLoading(true);
    setError('');
    setProcessingStep('Adapting material for ELL students...');
    
    try {
      const adapted = await adaptMaterialWithClaude({
        contentToAdapt,
        materialType,
        subject,
        gradeLevel,
        proficiencyLevel,
        learningObjectives,
        includeBilingualSupport,
        nativeLanguage
      });

      setAdaptedMaterial(adapted);
      setProcessingStep('');
    } catch (error) {
      console.error('Error adapting material:', error);
      setError('Sorry, there was an error adapting your material. Please try again.');
      setProcessingStep('');
    }
    
    setIsLoading(false);
  }, [isFormValid, inputMethod, extractedText, originalMaterial, materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage]);

  const clearAll = useCallback(() => {
    setOriginalMaterial('');
    setLearningObjectives('');
    setNativeLanguage('');
    setIncludeBilingualSupport(false);
    setAdaptedMaterial('');
    setMaterialType('');
    setSubject('');
    setGradeLevel('');
    setProficiencyLevel('');
    setUploadedFile(null);
    setExtractedText('');
    setInputMethod('text'); // Default back to text mode
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">ELL Material Adapter</h1>
        <p className="text-gray-600 mb-6">Transform your classroom materials to support English Language Learners</p>
        <button
          onClick={clearAll}
          className="btn-danger px-6 py-2 shadow-md"
        >
          🗑️ Clear All Fields
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="card bg-blue-50 border-blue-200">
            <h2 className="section-header text-blue-800">Original Material</h2>
            
            {/* Input Method Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Input Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    inputMethod === 'text'
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}
                >
                  <FileText className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">Type/Paste Text</div>
                </button>
                <button
                  onClick={() => setInputMethod('upload')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    inputMethod === 'upload'
                      ? 'border-blue-500 bg-blue-100 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                  }`}
                >
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  <div className="font-medium">Upload PDF</div>
                </button>
              </div>
            </div>

            {/* Material Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">Material Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {materialTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setMaterialType(type.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        materialType === type.value
                          ? 'border-blue-500 bg-blue-100 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      <IconComponent className="w-6 h-6 mx-auto mb-2" />
                      <div className="text-sm font-medium">{type.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject and Grade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(subj => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select Grade</option>
                  {gradeLevels.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Learning Objectives */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Learning Objectives *
                <span className="text-xs text-gray-500 block mt-1">What should students know/be able to do after this lesson?</span>
              </label>
              <textarea
                value={learningObjectives}
                onChange={(e) => setLearningObjectives(e.target.value)}
                placeholder="e.g., Students will be able to solve linear equations using inverse operations..."
                className="input-field h-24 resize-none custom-scrollbar"
              />
            </div>

            {/* Proficiency Level */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Student English Proficiency Level (WIDA) *</label>
              <select
                value={proficiencyLevel}
                onChange={(e) => setProficiencyLevel(e.target.value)}
                className="input-field"
              >
                <option value="">Select Proficiency Level</option>
                {proficiencyLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>

            {/* Bilingual Support Options */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="bilingual-support"
                  checked={includeBilingualSupport}
                  onChange={(e) => setIncludeBilingualSupport(e.target.checked)}
                  className="mr-3 w-4 h-4 text-blue-600"
                />
                <label htmlFor="bilingual-support" className="text-sm font-medium text-gray-700">
                  Include bilingual vocabulary support
                </label>
              </div>
              
              {includeBilingualSupport && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Student's Native Language *
                  </label>
                  <select
                    value={nativeLanguage}
                    onChange={(e) => setNativeLanguage(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select Language</option>
                    {commonLanguages.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Bilingual support will focus on cognates, academic vocabulary, and key concepts
                  </p>
                </div>
              )}
            </div>

            {/* Material Input */}
            {inputMethod === 'text' ? (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Paste Your Original Material *</label>
                <textarea
                  value={originalMaterial}
                  onChange={(e) => setOriginalMaterial(e.target.value)}
                  placeholder="Enter your lesson material, quiz questions, worksheet content, etc..."
                  className="input-field h-64 resize-none custom-scrollbar"
                />
              </div>
            ) : (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF Material *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  {uploadedFile ? (
                    <div className="space-y-4">
                      <File className="w-16 h-16 text-green-500 mx-auto" />
                      <div>
                        <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                        <p className="text-sm text-gray-500">PDF uploaded successfully</p>
                      </div>
                      {uploadedFile && extractedText && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800 font-medium mb-2">
                            ✅ PDF text extracted successfully! 
                          </p>
                          <p className="text-xs text-green-700">
                            The extracted text has been added to the text area below. You can edit it if needed before adapting.
                          </p>
                        </div>
                      )}
                      <button
                        onClick={removeFile}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-gray-600 mb-2">Upload your PDF material</p>
                        <p className="text-sm text-gray-500">Drag and drop or click to select</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="pdf-upload"
                      />
                      <label
                        htmlFor="pdf-upload"
                        className="inline-flex items-center btn-primary cursor-pointer"
                      >
                        Choose PDF File
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={adaptMaterial}
                disabled={isLoading || !isFormValid}
                className="flex-1 btn-primary text-lg py-3"
              >
                {isLoading ? 'Processing...' : 'Adapt Material'}
              </button>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-6">
          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-header text-green-800">Adapted Material</h2>
              {adaptedMaterial && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Copy
                </button>
              )}
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <LoadingSpinner 
                  message={processingStep || 'Adapting your material...'}
                />
              </div>
            ) : adaptedMaterial ? (
              <div className="bg-white p-6 rounded-md border border-green-200 h-96 overflow-y-auto custom-scrollbar">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                  {adaptedMaterial}
                </pre>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-md border border-green-200 h-96 flex items-center justify-center">
                <p className="text-gray-500 text-center">
                  Your adapted material will appear here after processing
                </p>
              </div>
            )}

            {processingStep && !isLoading && (
              <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">
                {processingStep}
              </div>
            )}
          </div>

          {/* Tips Section */}
          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
              💡 Tips for Best Results
            </h3>
            <ul className="text-sm text-yellow-700 space-y-2">
              <li>• <strong>PDF uploads:</strong> Works best with text-based PDFs (not scanned images)</li>
              <li>• <strong>File size:</strong> Keep PDFs under 10MB for faster processing</li>
              <li>• <strong>Text input:</strong> Copy-paste works great for any content</li>
              <li>• Be specific about content learning objectives</li>
              <li>• Include any special instructions or context in your material</li>
              <li>• Review adapted content for subject-specific accuracy</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Clear All Button */}
      <div className="text-center mt-12">
        <button
          onClick={clearAll}
          className="btn-danger px-8 py-3 shadow-lg text-lg"
        >
          🗑️ Clear All Fields & Start Over
        </button>
        <p className="text-gray-500 text-sm mt-2">Reset all fields to begin with new material</p>
      </div>
    </div>
  );
};

export default ELLMaterialAdapter;
