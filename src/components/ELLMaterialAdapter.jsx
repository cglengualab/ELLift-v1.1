import React, { useState, useCallback, useMemo, useRef } from 'react';

import { FileText, Users, BookOpen, ClipboardList, Download, Upload, File, AlertCircle, Book, Target } from 'lucide-react';

import ReactMarkdown from 'react-markdown';

import rehypeRaw from 'rehype-raw';

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

  const [studentWorksheet, setStudentWorksheet] = useState(''); 

  const [teacherGuide, setTeacherGuide] = useState('');         

  const [widaDescriptors, setWidaDescriptors] = useState(null);

  const [dynamicDescriptors, setDynamicDescriptors] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState('');

  const worksheetRef = useRef(null);

  const teacherGuideRef = useRef(null);

  const [translateSummary, setTranslateSummary] = useState(false);

  const [translateInstructions, setTranslateInstructions] = useState(false);

  const [listCognates, setListCognates] = useState(false);

  const [worksheetLength, setWorksheetLength] = useState('Medium');

  const [addStudentChecklist, setAddStudentChecklist] = useState(false);

  const [useMultipleChoice, setUseMultipleChoice] = useState(false);



  const handleBilingualSupportChange = (isChecked) => {

    setIncludeBilingualSupport(isChecked);

    if (isChecked) {

      setNativeLanguage('Spanish');

    } else {

      setNativeLanguage('');

      setTranslateSummary(false);

      setTranslateInstructions(false);

      setListCognates(false);

    }

  };



  const isFormValid = useMemo(() => {

    const basicFieldsValid = originalMaterial.trim() && materialType && subject && proficiencyLevel;

    const bilingualValid = !includeBilingualSupport || nativeLanguage;

    return basicFieldsValid && bilingualValid;

  }, [originalMaterial, materialType, subject, proficiencyLevel, includeBilingualSupport, nativeLanguage]);



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

    if (!contentToAdapt.trim() || !materialType || !subject || !proficiencyLevel) {

      setError('Please fill in all required fields');

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

        contentToAdapt, materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage,

        translateSummary,

        translateInstructions,

        listCognates,

        worksheetLength,

        addStudentChecklist,

        useMultipleChoice

      });

      setStudentWorksheet(adaptedData.studentWorksheet);

      setTeacherGuide(adaptedData.teacherGuide);

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

  }, [originalMaterial, materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates, worksheetLength, addStudentChecklist, useMultipleChoice]);



  const clearAll = useCallback(() => {

    setOriginalMaterial('');

    setLearningObjectives('');

    setNativeLanguage('');

    setIncludeBilingualSupport(false);

    setStudentWorksheet(''); 

    setTeacherGuide('');     

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

    setTranslateSummary(false);

    setTranslateInstructions(false);

    setListCognates(false);

    setWorksheetLength('Medium');

    setAddStudentChecklist(false);

    setUseMultipleChoice(false);

  }, []);

  

  const copyStudentWorksheet = useCallback(async () => {

    if (!worksheetRef.current) return;

    try {

      const htmlContent = worksheetRef.current.innerHTML;

      const styles = `<style>h1 { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; } h2 { font-size: 18px; font-weight: bold; font-style: italic; margin-top: 24px; margin-bottom: 12px; } p, li { font-size: 14px; line-height: 1.5; } strong { font-weight: bold; }</style>`;

      const fullHtml = `<html><head>${styles}</head><body>${htmlContent}</body></html>`;

      const blob = new Blob([fullHtml], { type: 'text/html' });

      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);

      setProcessingStep('Worksheet copied to clipboard!');

      setTimeout(() => setProcessingStep(''), 2000);

    } catch (err) {

      setError('Failed to copy formatted text.');

    }

  }, []);



  const copyTeacherGuide = useCallback(async () => {

    if (!teacherGuideRef.current) return;

    try {

      const htmlContent = teacherGuideRef.current.innerHTML;

      const styles = `<style>h1 { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; } h2 { font-size: 18px; font-weight: bold; font-style: italic; margin-top: 24px; margin-bottom: 12px; } p, li { font-size: 14px; line-height: 1.5; } strong { font-weight: bold; }</style>`;

      const fullHtml = `<html><head>${styles}</head><body>${htmlContent}</body></html>`;

      const blob = new Blob([fullHtml], { type: 'text/html' });

      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);

      setProcessingStep("Teacher's Guide copied to clipboard!");

      setTimeout(() => setProcessingStep(''), 2000);

    } catch (err) {

      setError('Failed to copy formatted text.');

    }

  }, []);



  const removeFile = useCallback(() => {

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

        <div className="xl:col-span-1">

          <div className="card bg-blue-50 border-blue-200 sticky top-6">

            <h2 className="section-header text-blue-800">ELL Adaptation Settings</h2>

            

            <div className="mb-6">

              <label className="block text-sm font-medium text-gray-700 mb-3">Material Type *</label>

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

                <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>

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

              <label className="block text-sm font-medium text-gray-700 mb-2">WIDA Proficiency Level *</label>

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

            

            {processingStep && (

              <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-md text-sm font-medium">

                {processingStep}

              </div>

            )}

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

                      <button onClick={removeFile} className="text-xs text-red-600 hover:text-red-800">

                        Remove

                      </button>

                    </div>

                  ) : (

                    <div className="space-y-2">

                      <Upload className="w-8 h-8 text-blue-400 mx-auto" />

                      <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" id="pdf-upload" />

                      <label htmlFor="pdf-upload" className="inline-flex items-center btn-primary cursor-pointer text-sm py-2 px-3">

                        Choose PDF

                      </label>

                    </div>

                  )}

                </div>

                {uploadedFile && extractedText && (

                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">

                    <p className="text-xs text-green-800 font-medium">✅ Text extracted and added below</p>

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

            </div>

          </div>

          

          <ActionButtons 

            adaptMaterial={adaptMaterial}

            clearAll={clearAll}

            isLoading={isLoading}

            isFormValid={isFormValid}

          />



          {studentWorksheet && (

            <>

              <div className="card bg-green-50 border-green-200">

                <div className="flex items-center justify-between mb-4">

                  <h2 className="section-header text-green-800">Adapted Student Material</h2>

                  <button

                    onClick={copyStudentWorksheet}

                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"

                  >

                    <ClipboardList className="w-4 h-4" />

                    Copy Formatted Text

                  </button>

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

                   <button

                    onClick={copyTeacherGuide}

                    className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white text-sm rounded-md hover:bg-slate-700 transition-colors"

                  >

                    <ClipboardList className="w-4 h-4" />

                    Copy Guide

                  </button>

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



        <div className="xl:col-span-3">

          <div className="card bg-yellow-50 border-yellow-200">

            <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">

              💡 Tips for Best Results

            </h3>

            <ul className="text-sm text-yellow-700 space-y-2 grid grid-cols-1 md:grid-cols-2 gap-x-6">

              <li>• <strong>PDF uploads:</strong> Works best with text-based PDFs</li>

              <li>• <strong>Learning objectives:</strong> (Optional) Be specific about what students should learn</li>

              <li>• <strong>WIDA levels:</strong> Choose the level that matches your students</li>

              <li>• <strong>Bilingual support:</strong> Optional translations for key vocabulary</li>

              <li>• <strong>Review output:</strong> Always check adapted content for accuracy</li>

              <li>• <strong>Edit text:</strong> You can modify extracted text before adapting</li>

            </ul>

          </div>

        </div>

      </div>

    </div>

  );

};



export default ELLMaterialAdapter;
