// FileName: src/services/claudeService.js (Final version with robust delimiter parsing)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// ... (callClaudeAPI, extractTextFromPDF, getProficiencyAdaptations, and buildBilingualInstructions functions are unchanged) ...
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

  // --- THE PROMPT IS NOW MUCH SIMPLER ---
  const prompt = `You are an expert in English Language Learning (ELL) pedagogy and curriculum adaptation. Your task is to generate three distinct pieces of text based on the original material provided.

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

  **TASK:**
  Generate three pieces of content in order: the Student Worksheet, the Teacher's Guide, and the Lesson-Specific Descriptors. You MUST separate each of the three pieces of content with the exact delimiter: |||---SPLIT---|||

  **PART 1: Student Worksheet**
  Generate the complete student worksheet based on all the ADAPTATION REQUIREMENTS listed below. The output for this part must be a single block of text formatted in GitHub Flavored Markdown.

  **PART 2: Teacher's Guide**
  Generate the complete teacher's guide based on all the ADAPTATION REQUIREMENTS. The output for this part must be a single block of plain text.

  **PART 3: Lesson-Specific "Can Do" Descriptors**
  Generate a valid JSON object for the dynamic WIDA descriptors. This object must have a "title" and a "descriptors" array. The output for this part must be only the JSON object.

  **ADAPTATION REQUIREMENTS (Apply these to the content you generate):**
  1.  **Worksheet Structure:** ...
  2.  **Background Knowledge:** ...
  3.  **Key Vocabulary:** ...
  4.  **Pre-Reading Activity:** ...
  5.  **Reading Text:** ...
  6.  **Comprehension Activities & Charts:** Use a series of bolded headings and bulleted lists for any chart-like activities.
  7.  **Teacher Guide Content:** Must contain: A COMPLETE ANSWER KEY, LESSON PREPARATION & PACING, OBJECTIVES, SUPPORTS, and ADAPTATIONS.
  
  ${bilingualInstructions}

  **SPECIFIC ADAPTATIONS FOR ${proficiencyLevel.toUpperCase()} LEVEL:**
  ${proficiencyAdaptations}
  `;

  const data = await callClaudeAPI([
    {
      role: "user",
      content: prompt
    }
  ], 4000);

  // --- THIS LOGIC IS NEW AND MORE ROBUST ---
  try {
    // Get the entire raw text response from the AI
    const rawResponse = data.content[0].text;

    // Split the response into three parts using our special delimiter
    const parts = rawResponse.split('|||---SPLIT---|||');

    if (parts.length < 3) {
      console.error("AI response did not contain the expected number of parts.", parts);
      throw new Error("The AI returned a response in an unexpected structure.");
    }
    
    // Assemble our own, guaranteed-valid JSON object
    const structuredData = {
      studentWorksheet: parts[0].trim(),
      teacherGuide: parts[1].trim(),
      dynamicWidaDescriptors: JSON.parse(parts[2].trim()) // We only parse the small, simple JSON part
    };

    return structuredData;
  } catch (e) {
    console.error("Final parsing/splitting failed. This is a critical error.", e);
    const rawResponse = data.content[0].text;
    console.log("RAW AI Response that failed:", rawResponse);
    throw new Error(`There was a critical error processing the AI's response.`);
  }
};
