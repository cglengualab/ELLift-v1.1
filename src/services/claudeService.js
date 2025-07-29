// FileName: src/services/claudeService.js (Final version with reliable Lesson-Specific Descriptors)

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
  translateSummary,
  translateInstructions,
  listCognates
}) => {
  const bilingualInstructions = buildBilingualInstructions({
    includeBilingualSupport,
    nativeLanguage,
    translateSummary,
    translateInstructions,
    listCognates
  });
  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);

  const prompt = `You are an expert in English Language Learning (ELL) pedagogy and curriculum adaptation. Your task is to adapt the following material for an ELL student.

  **ORIGINAL MATERIAL DETAILS:**
  - Material Type: ${materialType}
  - Subject: ${subject}
  - Grade Level: ${gradeLevel || 'not specified'}
  - WIDA Proficiency Level: ${proficiencyLevel}
  - Content Learning Objectives: ${learningObjectives}
  - Original Text:
  \`\`\`
  ${contentToAdapt}
  \`\`\`

  **ADAPTATION REQUIREMENTS:**
  1.  **Worksheet Structure:** Create a student worksheet with the following sections in this exact order: Title, Background Knowledge, Key Vocabulary, Pre-Reading Activity, Reading Text, Comprehension Activities, and an optional Extension activity.
  2.  **Background Knowledge:** Create a short, simple section with 2-3 bullet points of essential background information a student needs before reading.
  3.  **Key Vocabulary:** Select 3-5 of the most important vocabulary words from the original text. Provide simple, student-friendly definitions.
  4.  **Pre-Reading Activity:** Create a short, interactive activity to engage the student before they read.
  5.  **Reading Text:**
      - Simplify the original text to be appropriate for the target WIDA level.
      - Break long paragraphs into smaller, more manageable chunks.
      - If the text contains a list of items or observations, format them as a bulleted list.
      - **Crucially, find the words from your 'Key Vocabulary' section within this simplified text and make them bold using Markdown (**word**).**
  6.  **Comprehension Activities & Charts:** For any activity that requires a chart or table, you MUST format it for the student worksheet as a **series of bolded headings, each followed by a bulleted list.**
  7.  **Teacher Guide Content:** Create a teacher guide that includes: A COMPLETE ANSWER KEY, LESSON PREPARATION & PACING, OBJECTIVES, SUPPORTS, and ADAPTATIONS.
  
  ${bilingualInstructions}

  **SPECIFIC ADAPTATIONS FOR ${proficiencyLevel.toUpperCase()} LEVEL:**
  ${proficiencyAdaptations}

  CRUCIAL FINAL INSTRUCTION: Your response MUST begin with the character '{' and end with the character '}'. The entire output must be only the raw JSON.

  **REQUIRED OUTPUT FORMAT:**
  Your entire response must be a single, valid JSON object with three top-level keys: "studentWorksheet", "teacherGuide", and "dynamicWidaDescriptors".

  - "studentWorksheet" value: A single string containing the complete student worksheet, formatted using simple GitHub Flavored Markdown.
  - "teacherGuide" value: A single string containing all the pedagogical notes for the teacher, structured in the specific order previously instructed. This should be plain text.
  - **"dynamicWidaDescriptors" value**: This MUST be a JSON object with a "title" and a "descriptors" array. The "descriptors" array MUST contain 3-5 observable, lesson-specific "Can Do" statements that are directly tied to the activities in the student worksheet.
  `;

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
