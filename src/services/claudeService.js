// FileName: src/services/claudeService.js (Definitive version with reliable charts and teacher notes)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// ... (All helper functions like callClaudeAPI, extractTextFromPDF, etc. remain unchanged) ...
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

BILINGUAL VOCAB-SUPPORT:
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

  4.  **Pre-Reading Activity:** Create a short, interactive activity to engage the student before they read. This could be a vocabulary matching exercise, a "What do you see in this picture?" question, or a quick-sentence completion.

  5.  **Reading Text:**
      - Simplify the original text to be appropriate for the target WIDA level.
      - Break long paragraphs into smaller, more manageable chunks.
      - If the text contains a list of items or observations, format them as a bulleted list.
      - **Crucially, find the words from your 'Key Vocabulary' section within this simplified text and make them bold using Markdown (**word**).**

  6.  **Comprehension Activities & Charts:** Create a variety of tasks. For any activity that requires a chart or table (like a T-chart or multi-column chart), you MUST format it for the student worksheet as a **series of bolded headings, each followed by a bulleted list for the student to fill in.** DO NOT use Markdown table syntax for the student worksheet, as it is unreliable.

  7.  **Teacher Guide Content:** In a separate document, you will create a teacher guide. This guide must include:
      - **A COMPLETE ANSWER KEY:** Provide answers for ALL activities on the student worksheet, including pre-reading tasks. For subjective questions, provide sample answers.
      - **LESSON PREPARATION & PACING:** List necessary materials and suggest a time frame for the lesson.
      - **OBJECTIVES, SUPPORTS, and ADAPTATIONS:** Write the Content Objectives, ELL Language Objectives, a list of ELL Supports Included, and Assessment Adaptations.
      - **Teacher's Note for Charts:** In the "ELL SUPPORTS INCLUDED" section of the teacher guide, if you have replaced a table/chart with a "series of lists" on the student worksheet, add a bullet point under a "Teacher's Note" subheading suggesting that they can create a formal table themselves. Provide the recommended column headings for that table.

  8.  **Lesson-Specific Descriptors:** Generate 3-5 observable, lesson-specific "Can Do" descriptors as previously instructed.

  **SPECIFIC ADAPTATIONS FOR ${proficiencyLevel.toUpperCase()} LEVEL:**
  ${proficiencyAdaptations}
  ${bilingualInstructions}

  **REQUIRED OUTPUT FORMAT:**
  Your entire response must be a single, valid JSON object, formatted on a single line with no line breaks outside of the string values. It must have three top-level keys: "studentWorksheet", "teacherGuide", and "dynamicWidaDescriptors".

  - **"studentWorksheet" value**: A single string containing the complete student worksheet, formatted using simple GitHub Flavored Markdown (# for title, ## for headings, ** for bold, * for bullets).
  - **"teacherGuide" value**: A single string containing all teacher-facing material, starting with the ANSWER KEY, followed by LESSON PREPARATION & PACING, and then the objectives and support lists. This should be plain text with newlines represented as \\n.
  - **"dynamicWidaDescriptors" value**: The JSON object for the lesson-specific descriptors.
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
