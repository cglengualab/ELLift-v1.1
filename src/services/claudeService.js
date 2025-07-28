// FileName: src/services/claudeService.js (Final version with complete answer key instruction)

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
    entering: '- Use very simple sentence structures and present tense\n- Provide extensive visual supports and vocabulary definitions\n- Include picture cues and gesture descriptions\n- Use sentence starters and word banks\n- Focus on key vocabulary with native language cognates when possible',
    emerging: '- Use simple sentence structures with basic connecting words\n- Provide vocabulary support with examples and visual aids\n- Include graphic organizers and sentence frames\n- Use yes/no and choice questions alongside open-ended ones\n- Provide opportunities for partner work and discussion',
    developing: '- Use clear sentence structures with some complex sentences\n- Provide moderate vocabulary support with context clues\n- Include sentence frames and transition words\n- Balance receptive and productive language tasks\n- Encourage extended responses with scaffolding',
    expanding: '- Use varied sentence structures with academic language\n- Provide context for technical vocabulary\n- Include opportunities for academic discourse\n- Encourage critical thinking with language support\n- Use complex texts with strategic supports',
    bridging: '- Maintain grade-level academic language with strategic supports\n- Provide context for complex concepts and abstract ideas\n- Include opportunities for academic argument and analysis\n- Use sophisticated vocabulary with explanations\n- Prepare students for mainstream academic expectations'
  };
  
  return adaptations[proficiencyLevel] || adaptations.developing;
};

const getBilingualInstructions = (includeBilingualSupport, nativeLanguage, proficiencyLevel) => {
  if (!includeBilingualSupport || !nativeLanguage) return '';

  let supportLevel = '';
  if (['entering', 'emerging'].includes(proficiencyLevel)) {
    supportLevel = 'Provide more extensive bilingual support to aid comprehension';
  } else if (proficiencyLevel === 'developing') {
    supportLevel = 'Provide moderate bilingual support, focusing on academic vocabulary';
  } else {
    supportLevel = 'Provide minimal, strategic bilingual support for complex concepts only';
  }

  return `

BILINGUAL VOCABULARY SUPPORT:
- Include ${nativeLanguage} translations for key academic vocabulary and technical terms
- Focus on cognates between ${nativeLanguage} and English when available
- Provide ${nativeLanguage} support for complex concepts that are difficult to visualize
- Use bilingual support strategically - as a bridge to English, not a replacement
- For ${proficiencyLevel} level: ${supportLevel}
- Include a bilingual vocabulary glossary if helpful`;
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
  nativeLanguage
}) => {
  const bilingualInstructions = getBilingualInstructions(includeBilingualSupport, nativeLanguage, proficiencyLevel);
  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);

  const prompt = `You are an expert in English Language Learning (ELL) pedagogy and curriculum adaptation. Please adapt the following ${materialType} for ${subject} ${gradeLevel ? `(${gradeLevel})` : ''} for students at the ${proficiencyLevel} WIDA English proficiency level.

CONTENT LEARNING OBJECTIVES:
${learningObjectives}

ORIGINAL MATERIAL:
${contentToAdapt}

ADAPTATION REQUIREMENTS:

1. CREATE STUDENT WORKSHEET: First, create the clean, print-and-go student worksheet with all necessary scaffolding (e.g., vocabulary, simplified text, sentence frames, interactive pre-reading activities, etc.).

// --- THIS IS THE MODIFIED SECTION ---
2. CREATE A COMPLETE ANSWER KEY: After creating the student worksheet, you must provide a complete answer key for ALL activities, including any Pre-Reading tasks.
- For objective questions (like vocabulary matching or fill-in-the-blanks), provide the direct answers.
- For subjective questions (like "What do you notice?" or "What do you think?"), provide sample or model answers that a teacher could use as a reference.
Place this complete answer key at the very beginning of the "teacherGuide" output.
// --- END OF MODIFIED SECTION ---

3. CREATE TEACHER NOTES: Create pedagogical notes for the teacher, including Content Objectives, ELL Language Objectives, a list of ELL Supports, and Assessment Adaptations.

4. ADD PREPARATION AND PACING: In the teacher notes, include a new section called "LESSON PREPARATION & PACING". This section must list any materials the teacher needs to prepare (e.g., "Prepare a visual of the White House") and suggest an estimated time for the activities, tailored to the selected WIDA level.

5. GENERATE LESSON-SPECIFIC DESCRIPTORS: Generate a list of 3-5 lesson-specific, observable "Can Do" descriptors for the selected WIDA level, as previously instructed.

6. ENSURE EXPLICIT INSTRUCTIONS: Ensure all instructions on the student worksheet are explicit, as previously instructed.

SPECIFIC ADAPTATIONS FOR ${proficiencyLevel.toUpperCase()} LEVEL:
${proficiencyAdaptations}

REQUIRED OUTPUT FORMAT:
Your entire response must be a single, valid JSON object with three top-level keys: "studentWorksheet", "teacherGuide", and "dynamicWidaDescriptors".

- "studentWorksheet" value: A single string containing ONLY the student-facing material.
- "teacherGuide" value: A single string containing ALL the teacher-facing material. It MUST be structured in this specific order: 1. ANSWER KEY, 2. LESSON PREPARATION & PACING, 3. CONTENT OBJECTIVES, 4. ELL LANGUAGE OBJECTIVES, 5. ELL SUPPORTS INCLUDED, 6. ASSESSMENT ADAPTATIONS.
- "dynamicWidaDescriptors" value: The JSON object for the lesson-specific descriptors.

Example JSON structure:
{
  "studentWorksheet": "Title: Rounding Practice\\n\\nPart 1: Vocabulary\\n...",
  "teacherGuide": "ANSWER KEY:\\nPre-Reading:\\n1. Sample answers: The building is white...\\nComprehension Questions:\\n1. The number 2.292 rounds to 2 because...\\n\\nLESSON PREPARATION & PACING:\\n- Materials: Place value chart visual...\\n- Pacing: This activity should take approximately 15-20 minutes for a Level 3 student.\\n\\nCONTENT OBJECTIVES (maintained):\\n- ...",
  "dynamicWidaDescriptors": {
    "title": "Lesson-Specific 'Can Do' Descriptors",
    "descriptors": ["..."]
  }
}

IMPORTANT: Ensure all values are properly escaped for JSON. All text content for studentWorksheet and teacherGuide should be single strings, with newlines represented as \\n.`;

  const data = await callClaudeAPI([
    {
      role: "user",
      content: prompt
    }
  ], 4000);

  try {
    const parsedData = JSON.parse(data.content[0].text);
    return parsedData;
  } catch (e) {
    console.error("Failed to parse Claude's JSON response. This is a critical error.", e);
    const rawResponse = data.content[0].text;
    console.log("RAW AI Response that failed parsing:", rawResponse);
    throw new Error(`The AI returned an invalid format. The raw response started with: "${rawResponse.substring(0, 200)}..."`);
  }
};
