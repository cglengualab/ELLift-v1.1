// FileName: src/services/claudeService.js (Updated to request Markdown for Teacher's Guide)

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

const buildBilingualInstructions = ({
  includeBilingualSupport,
  nativeLanguage,
  translateSummary,
  translateInstructions,
  listCognates
}) => {
  if (!includeBilingualSupport || !nativeLanguage) return '';

  let instructions = `\n\n  **BILINGUAL SUPPORT REQUIREMENTS (Language: ${nativeLanguage}):**\n`;

  instructions += `- For each term in the 'Key Vocabulary' section, provide its translation in ${nativeLanguage}. The translation MUST be formatted in parentheses and italics, without the language name. Example: **mansion**: a large house (*mansión*)\n`;
  
  if (translateSummary) {
    instructions += `- At the very top of the 'studentWorksheet' before the title, provide a 1-2 sentence summary of the topic in ${nativeLanguage}.\n`;
  }
  
  if (translateInstructions) {
    instructions += `- For **every** 'Directions:' line on the student worksheet (including for Pre-Reading, Comprehension, and Extension activities), you MUST insert an HTML line break tag (<br>) immediately after the English text, and then provide the translation in ${nativeLanguage} formatted in italics. Example: Directions: Do this.<br>*Instrucciones: Haz esto.*\n`;
  }
  
  if (listCognates) {
    instructions += `- In the 'teacherGuide' under 'ELL SUPPORTS INCLUDED', create a 'Cognates to Highlight' list of English/${nativeLanguage} cognates found in the text.\n`;
  }

  return instructions;
};

const getProficiencyAdaptations = (proficiencyLevel) => {
  return `Adapt the content to be appropriate for the ${proficiencyLevel} WIDA proficiency level, using research-based ELL best practices.`;
};

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
  Generate a complete student worksheet formatted in simple GitHub Flavored Markdown.
  - Structure the worksheet with sections like Title, Background Knowledge, Key Vocabulary, Pre-Reading Activity, Reading Text, and Comprehension Activities.
  - Simplify the text, create interactive activities, and use scaffolds like sentence frames.
  - For any chart-like activities, use a series of bolded headings and bulleted lists.
  - Use **bold** for key terms from the vocabulary list within the reading text.
  ${bilingualInstructions}
  ${proficiencyAdaptations}
  
  Provide ONLY the raw Markdown for the student worksheet, and nothing else.`;
};

const createTeacherGuidePrompt = (details, studentWorksheet) => {
  const { bilingualInstructions } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate ONLY a teacher's guide for the provided student worksheet.

  **STUDENT WORKSHEET CONTENT:**
  \`\`\`
  ${studentWorksheet}
  \`\`\`

  **TASK:**
  Generate a complete teacher's guide as a single block of **GitHub Flavored Markdown**.
  - Create a complete Answer Key for ALL activities on the student worksheet.
  - Create a "Lesson Preparation & Pacing" section.
  - List the Content and ELL Language Objectives.
  - List the ELL Supports Included.
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
  const { proficiencyLevel, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates } = params;

  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);
  const bilingualInstructions = buildBilingualInstructions({
    includeBilingualSupport,
    nativeLanguage,
    translateSummary,
    translateInstructions,
    listCognates
  });
  
  const promptDetails = { ...params, proficiencyAdaptations, bilingualInstructions };
  
  try {
    console.log("Requesting Student Worksheet...");
    const worksheetPrompt = createStudentWorksheetPrompt(promptDetails);
    const worksheetResult = await callClaudeAPI([{ role: 'user', content: worksheetPrompt }]);
    const studentWorksheet = worksheetResult.content[0].text;
    console.log("Student Worksheet received.");

    console.log("Requesting Teacher's Guide and Descriptors in parallel...");
    const guidePrompt = createTeacherGuidePrompt(promptDetails, studentWorksheet);
    const descriptorsPrompt = createDynamicDescriptorsPrompt(promptDetails);

    const [guideResult, descriptorsResult] = await Promise.all([
      callClaudeAPI([{ role: 'user', content: guidePrompt }]),
      callClaudeAPI([{ role: 'user', content: descriptorsPrompt }], 500)
    ]);
    
    const teacherGuide = guideResult.content[0].text;
    const dynamicWidaDescriptors = JSON.parse(descriptorsResult.content[0].text);
    console.log("Teacher's Guide and Descriptors received.");

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
