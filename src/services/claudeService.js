// FileName: src/services/claudeService.js (Final version with multi-call parallel processing)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

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

// --- HELPER FUNCTIONS TO BUILD THE THREE SEPARATE PROMPTS ---

const createStudentWorksheetPrompt = (details) => {
  const { materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, contentToAdapt, bilingualInstructions, proficiencyAdaptations } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate ONLY a student-facing worksheet.
  
  **DETAILS:**
  - Material Type: ${materialType}
  - Subject: ${subject}
  - Grade Level: ${gradeLevel || 'not specified'}
  - WIDA Level: ${proficiencyLevel}
  - Learning Objectives: ${learningObjectives}

  **ORIGINAL MATERIAL:**
  \`\`\`
  ${contentToAdapt}
  \`\`\`

  **TASK:**
  Generate a complete student worksheet. The output for this part must be a single block of text formatted in GitHub Flavored Markdown.
  - Structure the worksheet with sections like Title, Background Knowledge, Key Vocabulary, Pre-Reading Activity, Reading Text, and Comprehension Activities.
  - Create interactive and varied activities with clear scaffolds.
  - For any chart-like activities, use a series of bolded headings and bulleted lists.
  ${bilingualInstructions}
  ${proficiencyAdaptations}
  
  Provide ONLY the raw Markdown for the student worksheet, and nothing else.`;
};

const createTeacherGuidePrompt = (details, studentWorksheet) => {
  const { proficiencyLevel, bilingualInstructions } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate ONLY a teacher's guide for the provided student worksheet.

  **STUDENT WORKSHEET CONTENT:**
  \`\`\`
  ${studentWorksheet}
  \`\`\`

  **TASK:**
  Generate a complete teacher's guide. The output must be a single block of plain text.
  - Create a complete Answer Key for ALL activities on the student worksheet.
  - Create a "Lesson Preparation & Pacing" section with materials and timing.
  - List the Content and ELL Language Objectives.
  - List the ELL Supports Included.
  ${bilingualInstructions}

  Provide ONLY the raw text for the teacher's guide, and nothing else.`;
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
  Your response MUST be ONLY a valid JSON object with a "title" and a "descriptors" array. Do not include any other text or explanations.
  Example: {"title": "Lesson-Specific 'Can Do' Descriptors", "descriptors": ["First descriptor.", "Second descriptor."]}
  `;
};

const buildBilingualInstructions = ({
  includeBilingualSupport, nativeLanguage, translateInstructions,
}) => {
  if (!includeBilingualSupport || !nativeLanguage) return '';
  let instructions = `\n\n  **BILINGUAL SUPPORT:**\n`;
  instructions += `- Provide translations for key vocabulary in ${nativeLanguage} in parentheses and italics. Example: (*mansión*)\n`;
  if (translateInstructions) {
    instructions += `- Provide translations for activity directions in ${nativeLanguage} using a <br> tag and italics.\n`;
  }
  return instructions;
};

const getProficiencyAdaptations = (proficiencyLevel) => {
  // This function is simplified for the prompt builders but can be expanded
  return `Adapt the content to be appropriate for the ${proficiencyLevel} WIDA proficiency level.`;
};


/**
 * Adapt material using Claude API with a multi-call strategy
 */
export const adaptMaterialWithClaude = async (params) => {
  // Pass all params in a single object for easier management
  const { proficiencyLevel, includeBilingualSupport, nativeLanguage, translateInstructions } = params;

  // Prepare shared instructions
  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);
  const bilingualInstructions = buildBilingualInstructions({
    includeBilingualSupport,
    nativeLanguage,
    translateInstructions,
  });
  
  const promptDetails = { ...params, proficiencyAdaptations, bilingualInstructions };
  
  // --- THE NEW MULTI-CALL LOGIC ---
  try {
    // --- STEP 1: Get the Student Worksheet first (this is the appetizer) ---
    console.log("Requesting Student Worksheet...");
    const worksheetPrompt = createStudentWorksheetPrompt(promptDetails);
    const worksheetResult = await callClaudeAPI([{ role: 'user', content: worksheetPrompt }]);
    const studentWorksheet = worksheetResult.content[0].text;
    console.log("Student Worksheet received.");

    // --- STEP 2: Now, get the Teacher's Guide and Descriptors IN PARALLEL (the main course and dessert) ---
    console.log("Requesting Teacher's Guide and Descriptors in parallel...");
    const guidePrompt = createTeacherGuidePrompt(promptDetails, studentWorksheet); // Pass the worksheet to create the answer key
    const descriptorsPrompt = createDynamicDescriptorsPrompt(promptDetails);

    const [guideResult, descriptorsResult] = await Promise.all([
      callClaudeAPI([{ role: 'user', content: guidePrompt }]),
      callClaudeAPI([{ role: 'user', content: descriptorsPrompt }], 500) // Lower max_tokens for this small JSON response
    ]);
    
    const teacherGuide = guideResult.content[0].text;
    const dynamicWidaDescriptors = JSON.parse(descriptorsResult.content[0].text);
    console.log("Teacher's Guide and Descriptors received.");

    // --- STEP 3: Assemble the final, guaranteed-valid object ---
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
