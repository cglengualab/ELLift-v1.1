// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

/**
 * Make a request to our Claude API proxy
 */
const callClaudeAPI = async (messages, maxTokens = 3000) => {
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

/**
 * Extract text from PDF file using PDF.js
 */
export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    return await extractPDFText(file, setProcessingStep);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

/**
 * Generate proficiency-level specific adaptations
 */
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

/**
 * Generate bilingual support instructions
 */
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

SPECIFIC ADAPTATIONS FOR ${proficiencyLevel.toUpperCase()} LEVEL:
${proficiencyAdaptations}

REQUIRED OUTPUT FORMAT:
Please structure your response as clean, readable text without any markdown formatting. Use the following structure:

ADAPTED MATERIAL:
[The adapted content ready for classroom use - no markdown, just plain text]

CONTENT OBJECTIVES (maintained):
Use bullet points to list each objective clearly:
- [First content objective and how it's maintained]
- [Second content objective and how it's maintained]
- [Additional objectives as needed]

ELL LANGUAGE OBJECTIVES:
Use bullet points to list each language objective with clear domain labels:
- LISTENING: [Specific listening objective for this WIDA level]
- SPEAKING: [Specific speaking objective for this WIDA level]
- READING: [Specific reading objective for this WIDA level]
- WRITING: [Specific writing objective for this WIDA level]
Note: Include only the language domains that are relevant for this specific material type and activity.

ELL SUPPORTS INCLUDED:
Use bullet points to list each support clearly:
- [First scaffold or support added]
- [Second scaffold or support added]
- [Additional supports as needed]

${includeBilingualSupport ? `BILINGUAL VOCABULARY SUPPORT:
Use bullet points to list key terms:
- [English term] = [${nativeLanguage} translation]
- [English term] = [${nativeLanguage} translation]
- [Additional bilingual vocabulary as needed]

` : ''}ASSESSMENT ADAPTATIONS:
Use bullet points to list assessment modifications:
- [First assessment adaptation]
- [Second assessment adaptation]
- [Additional adaptations as needed]

IMPORTANT: Do not use any markdown formatting like **bold**, *italics*, ### headers, or markdown bullet points with -. Use only plain text with regular bullet points (•) and clear section headers that can be easily copied and pasted into any document.`;

  const data = await callClaudeAPI([
    {
      role: "user",
      content: prompt
    }
  ], 3000);

  return data.content[0].text;
};
