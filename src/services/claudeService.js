// FileName: src/services/claudeService.js (Final version with sequential API calls for stability)

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

const getSubjectAwareInstructions = (subject, proficiencyLevel) => {
  const mathAndScience = ['Mathematics', 'Algebra', 'Geometry', 'Science', 'Chemistry', 'Physics', 'Biology'];
  const elaAndSocial = ['English Language Arts', 'History', 'Social Studies'];

  if (mathAndScience.includes(subject)) {
    return `
      **CRITICAL SUBJECT RULE: PRESERVE CORE PROBLEMS**
      - For this ${subject} material, you MUST NOT change or alter the core numbers, equations, variables, or logic of the exercises.
      - Your task is to add scaffolding and support **AROUND** the original problems (e.g., simplifying wordy instructions, pre-teaching vocabulary, providing visual aids) but the problems themselves must remain unchanged to ensure the teacher's answer key remains valid.
    `;
  }

  if (elaAndSocial.includes(subject)) {
    if (['bridging', 'reaching'].includes(proficiencyLevel)) {
      return `
        **CRITICAL SUBJECT RULE: PRESERVE AUTHOR'S VOICE**
        - For this high-level ELA/Social Studies material, prioritize preserving the original author's tone and voice.
        - Do not oversimplify. Focus on defining high-level academic or figurative language and clarifying only the most complex sentence structures. The student must engage with the text in a near-native form.
      `;
    }
    return `
      **CRITICAL SUBJECT RULE: SIMPLIFY AND REPHRASE**
      - For this ${subject} material, your primary task is to simplify and rephrase complex reading passages to make them more accessible.
      - Chunk the text into smaller paragraphs and adapt analytical questions with appropriate scaffolds.
    `;
  }

  return ''; // Default case, no special instructions
};

const getIepAccommodationInstructions = ({
  worksheetLength,
  addStudentChecklist,
  useMultipleChoice
}) => {
  let instructions = `\n\n  **IEP ACCOMMODATION REQUIREMENTS:**\n`;
  
  if (worksheetLength) {
    instructions += `- **Worksheet Length:** Adjust the number of activities to fit a "${worksheetLength}" time frame. Short: 5-10 min, Medium: 15-25 min, Long: 30+ min.\n`;
  }
  
  if (addStudentChecklist) {
    instructions += `- **Student Checklist:** At the very top of the student worksheet, add a section called "My Checklist" with 3-5 simple, sequential steps for completing the worksheet. Example: 1. [ ] Read Key Vocabulary. 2. [ ] Read the text.\n`;
  }

  if (useMultipleChoice) {
    instructions += `- **Multiple Choice:** Convert all open-ended comprehension questions into a multiple-choice format with 3-4 clear options.\n`;
  }

  return instructions;
};

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

const createTeacherGuidePrompt = (details, studentWorksheet) => {
  const { bilingualInstructions, subjectAwareInstructions } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate ONLY a teacher's guide for the provided student worksheet.

  **STUDENT WORKSHEET CONTENT:**
  \`\`\`
  ${studentWorksheet}
  \`\`\`

  ${subjectAwareInstructions}

  **TASK:**
  Generate a complete teacher's guide as a single block of GitHub Flavored Markdown.
  - Create a complete Answer Key for ALL activities on the student worksheet.
  - Create a "Lesson Preparation & Pacing" section, highlighting materials with <mark> tags.
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
    // --- THIS IS THE NEW, SEQUENTIAL (CASCADING) LOGIC ---
    // STEP 1: Get the Student Worksheet
    console.log("Step 1: Requesting Student Worksheet...");
    const worksheetPrompt = createStudentWorksheetPrompt(promptDetails);
    const worksheetResult = await callClaudeAPI([{ role: 'user', content: worksheetPrompt }]);
    const studentWorksheet = worksheetResult.content[0].text;
    console.log("Step 1: Student Worksheet received.");

    // STEP 2: Get the Teacher's Guide
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
