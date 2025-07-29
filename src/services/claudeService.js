// FileName: src/services/claudeService.js (Final version with correct sequential logic)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// ... (callClaudeAPI, extractTextFromPDF, and all prompt helper functions are unchanged) ...
const callClaudeAPI = async (messages, maxTokens = 4000) => {
  const formattedMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    }
    return msg;
  });
  
  const response = await fetch(`${API_BASE_URL}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: formattedMessages, max_tokens: maxTokens })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `API request failed: ${response.status}`);
  }
  
  return response.json();
};

export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    return await extractPDFText(file, setProcessingStep);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

const buildBilingualInstructions = (params) => { /* ... unchanged ... */ };
const getProficiencyAdaptations = (proficiencyLevel) => { /* ... unchanged ... */ };
const getSubjectAwareInstructions = (subject, proficiencyLevel) => { /* ... unchanged ... */ };
const getIepAccommodationInstructions = (params) => { /* ... unchanged ... */ };

const createStudentWorksheetPrompt = (details) => {
  const { materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, contentToAdapt, bilingualInstructions, proficiencyAdaptations, subjectAwareInstructions, iepInstructions } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate ONLY a student-facing worksheet.
  
  **DETAILS:**
  - Material Type: ${materialType}
  - Subject: ${subject}
  - Grade Level: ${gradeLevel || 'not specified'}
  - WIDA Level: ${proficiencyLevel}
  - Learning Objectives: ${learningObjectives}

  ${subjectAwareInstructions}
  ${iepInstructions}

  **ORIGINAL MATERIAL:**
  \`\`\`
  ${contentToAdapt}
  \`\`\`

  **TASK:**
  Generate a complete student worksheet formatted in simple GitHub Flavored Markdown.
  - Structure the worksheet with sections like Title, Background Knowledge, Key Vocabulary, Pre-Reading Activity, Reading Text, and Comprehension Activities.
  - Simplify the text and create interactive activities based on the subject-specific rules above.
  - For any chart-like activities, use a series of bolded headings and bulleted lists.
  - Use **bold** for key terms from the vocabulary list within the reading text.
  - **CRUCIAL:** You MUST write out all practice problems. Do NOT summarize or use phrases like "[Continue in same format]". You must generate the complete, usable worksheet.
  ${bilingualInstructions}
  ${proficiencyAdaptations}
  
  Provide ONLY the raw Markdown for the student worksheet, and nothing else.`;
};

// --- THIS PROMPT IS NOW STRICTER ---
const createTeacherGuidePrompt = (details, studentWorksheet) => {
  const { bilingualInstructions, subjectAwareInstructions } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate a teacher's guide for the student worksheet provided below.

  **STUDENT WORKSHEET CONTENT TO CREATE A GUIDE FOR:**
  \`\`\`
  ${studentWorksheet}
  \`\`\`

  ${subjectAwareInstructions}

  **TASK:**
  Generate a complete teacher's guide in GitHub Flavored Markdown. **Your primary task is to create a complete Answer Key for ALL activities from the worksheet.**
  - After the Answer Key, create a "Lesson Preparation & Pacing" section, highlighting materials with <mark> tags.
  - Then, list the Content and ELL Language Objectives.
  - Then, list the ELL Supports Included.
  - **CRUCIAL:** Do NOT repeat or copy the student worksheet content. Your purpose is to provide the answers and pedagogical notes FOR the worksheet.
  ${bilingualInstructions}

  Provide ONLY the raw Markdown for the teacher's guide, and nothing else.`;
};

const createDynamicDescriptorsPrompt = (details) => {
  const { contentToAdapt, learningObjectives, proficiencyLevel } = details;
  return `Based on the following original material and learning objectives for a ${proficiencyLevel} ELL student, generate a valid JSON object containing 3-5 observable, lesson-specific "Can Do" descriptors.

  **ORIGINAL MATERIAL:**
  \`\`\`
  ${contentToAdapt}
  \`\`\`
  
  **LEARNING OBJECTIVES:** ${learningObjectives}

  **TASK:**
  Your response MUST be ONLY a valid JSON object with a "title" and a "descriptors" array.
  Example: {"title": "Lesson-Specific 'Can Do' Descriptors", "descriptors": ["First descriptor.", "Second descriptor."]}
  `;
};


/**
 * Adapt material using Claude API with a multi-call strategy
 */
export const adaptMaterialWithClaude = async (params) => {
  const { subject, proficiencyLevel, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates, worksheetLength, addStudentChecklist, useMultipleChoice } = params;

  const subjectAwareInstructions = getSubjectAwareInstructions(subject, proficiencyLevel);
  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);
  const bilingualInstructions = buildBilingualInstructions({
    includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates
  });
  const iepInstructions = getIepAccommodationInstructions({
    worksheetLength, addStudentChecklist, useMultipleChoice
  });
  
  const promptDetails = { ...params, subjectAwareInstructions, proficiencyAdaptations, bilingualInstructions, iepInstructions };
  
  try {
    // --- THIS IS THE FINAL, SEQUENTIAL (CASCADING) LOGIC ---
    // STEP 1: Get the Student Worksheet
    console.log("Step 1: Requesting Student Worksheet...");
    const worksheetPrompt = createStudentWorksheetPrompt(promptDetails);
    const worksheetResult = await callClaudeAPI([{ role: 'user', content: worksheetPrompt }]);
    const studentWorksheet = worksheetResult.content[0].text;
    console.log("Step 1: Student Worksheet received.");

    // STEP 2: Get the Teacher's Guide (using the final worksheet)
    console.log("Step 2: Requesting Teacher's Guide...");
    const guidePrompt = createTeacherGuidePrompt(promptDetails, studentWorksheet);
    const guideResult = await callClaudeAPI([{ role: 'user', content: guidePrompt }]);
    const teacherGuide = guideResult.content[0].text;
    console.log("Step 2: Teacher's Guide received.");

    // STEP 3: Get the Descriptors
    console.log("Step 3: Requesting Descriptors...");
    const descriptorsPrompt = createDynamicDescriptorsPrompt(promptDetails);
    const descriptorsResult = await callClaudeAPI([{ role: 'user', content: descriptorsPrompt }], 500);
    const dynamicWidaDescriptors = JSON.parse(descriptorsResult.content[0].text);
    console.log("Step 3: Descriptors received.");

    // STEP 4: Assemble and return the final object
    return {
      studentWorksheet,
      teacherGuide,
      dynamicWidaDescriptors,
    };

  } catch (e) {
    console.error("A critical error occurred in the multi-call process.", e);
    throw new Error(`A critical error occurred while processing the AI's response.`);
  }
};
