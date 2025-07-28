// FileName: src/services/claudeService.js (Updated to request separate student/teacher outputs)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// ... (callClaudeAPI, extractTextFromPDF, getProficiencyAdaptations, getBilingualInstructions functions are unchanged) ...
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

  const supportLevel = ['entering', 'emerging'].includes(proficiencyLevel) 
    ? 'Provide more extensive bilingual support to aid comprehension'
    : proficiencyLevel === 'developing'
    ? 'Provide moderate bilingual support, focusing on academic vocabulary'
    : 'Provide minimal, strategic bilingual support for complex concepts only';

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

1. MAINTAIN CONTENT OBJECTIVES: Ensure the adapted material still allows students to achieve the same content learning objectives listed above. Do not lower academic expectations.

2. ADD ELL LANGUAGE OBJECTIVES: Include specific WIDA-aligned language objectives that specify what students will be able to do linguistically (listening, speaking, reading, writing) at the ${proficiencyLevel} level.

3. ALIGN WITH ELL STANDARDS: Follow WIDA English Language Development Standards and research-based ELL best practices.${bilingualInstructions}

4. GENERATE LESSON-SPECIFIC DESCRIPTORS: After creating the adapted material, generate a new list of 3-5 lesson-specific "Can Do" descriptors for the selected WIDA level. These descriptors must be directly tied to the specific tasks and language objectives in the adapted material you just created.

CRUCIAL INSTRUCTION: The descriptors MUST use verbs that describe simple, observable actions that a teacher can easily assess.
- GOOD, OBSERVABLE VERBS: Point to, Label, Match, Name, Draw, Select, Sequence, Orally state, Circle, Underline.
- AVOID VAGUE VERBS: understand, learn, analyze, know, engage, explain.
Each descriptor should be a concrete "I can..." statement from the student's perspective, tailored to the lesson content.

5. ENSURE EXPLICIT INSTRUCTIONS: Analyze the original material. If instructions are given only once at the top of the page (e.g., a title like 'Solve for X' or 'Round each number'), you MUST add a clear, explicit instruction to EACH adapted problem or small group of problems. This is a critical scaffolding step for ELLs. For example, a math problem "1. 2x = 10" should become "1. Solve for x: 2x = 10". A rounding problem "1. 5,970" should become "1. Round 5,970 to the nearest thousand".

SPECIFIC ADAPTATIONS FOR ${proficiencyLevel.toUpperCase()} LEVEL:
${proficiencyAdaptations}

// --- THIS IS THE MODIFIED SECTION ---
REQUIRED OUTPUT FORMAT:
Your entire response must be a single, valid JSON object. Do not include any text outside of the JSON structure. The JSON object must have three top-level keys: "studentWorksheet", "teacherGuide", and "dynamicWidaDescriptors".

- "studentWorksheet" value: A single string containing ONLY the student-facing material. This should be a clean, print-and-go document with the title, vocabulary, instructions, and problems. Do NOT include objectives or teacher notes in this string.
- "teacherGuide" value: A single string containing all the pedagogical notes for the teacher. This must include the sections for CONTENT OBJECTIVES, ELL LANGUAGE OBJECTIVES, ELL SUPPORTS INCLUDED, and ASSESSMENT ADAPTATIONS.
- "dynamicWidaDescriptors" value: A JSON object with a "title" and an array of "descriptors" strings, as previously instructed.

Example JSON structure:
{
  "studentWorksheet": "Title: Rounding Practice\\n\\nPart 1: Vocabulary\\n...",
  "teacherGuide": "CONTENT OBJECTIVES (maintained):\\n- Students will...\\n\\nELL LANGUAGE OBJECTIVES:\\n- LISTENING: ...",
  "dynamicWidaDescriptors": {
    "title": "Lesson-Specific 'Can Do' Descriptors",
    "descriptors": [
      "First descriptor.",
      "Second descriptor."
    ]
  }
}
// --- END OF MODIFIED SECTION ---

IMPORTANT: Ensure all values are properly escaped for JSON. All text content for studentWorksheet and teacherGuide should be single strings, with newlines represented as \\n.`;

  const data = await callClaudeAPI([
    {
      role: "user",
      content: prompt
    }
  ], 4000); // Using 4000 to be safe, as JSON structure adds tokens

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
