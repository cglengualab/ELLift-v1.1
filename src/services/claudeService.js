// FileName: src/services/claudeService.js (Simplified and more robust prompt)

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

const getProficiencyAdaptations = (proficiencyLevel) => {
  const adaptations = {
    entering: '- Use very simple sentence structures and present tense...',
    emerging: '- Use simple sentence structures with basic connecting words...',
    developing: '- Use clear sentence structures with some complex sentences...',
    expanding: '- Use varied sentence structures with academic language...',
    bridging: '- Maintain grade-level academic language with strategic supports...'
  };
  return adaptations[proficiencyLevel] || adaptations.developing;
};

const buildBilingualInstructions = ({
  includeBilingualSupport,
  nativeLanguage,
  translateInstructions,
}) => {
  if (!includeBilingualSupport || !nativeLanguage) return '';

  let instructions = `\n\n  **BILINGUAL SUPPORT REQUIREMENTS (Language: ${nativeLanguage}):**\n`;
  instructions += `- Provide translations for key vocabulary in ${nativeLanguage} in parentheses and italics. Example: (*mansión*)\n`;
  if (translateInstructions) {
    instructions += `- Provide translations for activity directions in ${nativeLanguage} using a <br> tag and italics.\n`;
  }
  return instructions;
};


/**
 * Adapt material using Claude API
 */
export const adaptMaterialWithClaude = async ({
  contentToAdapt,
  materialType,
  subject,
  gradeLevel,
  proficiencyLevel,
  learningObjectives,
  includeBilingualSupport,
  nativeLanguage,
  translateSummary, // Note: these are now passed but not used in the simplified prompt
  translateInstructions,
  listCognates
}) => {
  // Only using the core bilingual features for this simplified version
  const bilingualInstructions = buildBilingualInstructions({
    includeBilingualSupport,
    nativeLanguage,
    translateInstructions,
  });
  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);

  // --- THIS IS THE NEW, SIMPLIFIED PROMPT ---
  const prompt = `You are an expert ELL curriculum adapter. Adapt the following material based on the details provided.

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
  Generate three distinct blocks of text, in order, separated by the exact delimiter: |||---SPLIT---|||

  **PART 1: STUDENT WORKSHEET**
  - Create a clean, student-facing worksheet.
  - Simplify the text for the WIDA level.
  - Create a "Key Vocabulary" list.
  - Create "Comprehension Activities" with scaffolds like sentence frames or simple graphic organizers (use headings and bullet points, not markdown tables).
  - Format this entire part using simple Markdown (# for title, ## for headings, ** for bold).
  ${bilingualInstructions}

  **PART 2: TEACHER'S GUIDE**
  - Create a complete Answer Key for the worksheet.
  - List the Content and ELL Language Objectives.
  - List the ELL Supports you included.
  - Format this entire part as plain text.

  **PART 3: LESSON-SPECIFIC DESCRIPTORS**
  - Generate a valid JSON object with a "title" and a "descriptors" array of 3-5 observable "Can Do" statements for this lesson.

  **ADAPTATION GUIDELINES:**
  ${proficiencyAdaptations}
  `;

  const data = await callClaudeAPI([
    {
      role: "user",
      content: prompt
    }
  ], 4000);

  try {
    const rawResponse = data.content[0].text;
    const parts = rawResponse.split('|||---SPLIT---|||');

    if (parts.length < 3) {
      console.error("AI response did not contain the expected number of parts.", parts);
      throw new Error("The AI returned a response in an unexpected structure.");
    }
    
    const structuredData = {
      studentWorksheet: parts[0].trim(),
      teacherGuide: parts[1].trim(),
      dynamicWidaDescriptors: JSON.parse(parts[2].trim())
    };

    return structuredData;
  } catch (e) {
    console.error("Final parsing/splitting failed. This is a critical error.", e);
    const rawResponse = data.content[0].text;
    console.log("RAW AI Response that failed:", rawResponse);
    throw new Error(`There was a critical error processing the AI's response.`);
  }
};
