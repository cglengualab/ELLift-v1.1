// FileName: src/services/claudeService.js (Enhanced version with improved WIDA level differentiation and no-summarization rule)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

// Configuration constants
const CONFIG = {
  DELAYS: {
    BETWEEN_CALLS: 1000,
    RETRY_DELAY: 2000
  },
  TOKENS: {
    DEFAULT_MAX: 8000,     // INCREASED from 4000
    EXTENDED_MAX: 12000    // INCREASED from 6000
  },
  DELIMITERS: {
    SPLIT_MARKER: '|||---SPLIT---|||'
  },
  API: {
    MAX_RETRIES: 3,
    TIMEOUT: 30000
  }
};

// Subject groupings
const SUBJECT_GROUPS = {
  MATH_SCIENCE: ['Mathematics', 'Algebra', 'Geometry', 'Science', 'Chemistry', 'Physics', 'Biology'],
  ELA_SOCIAL: ['English Language Arts', 'History', 'Social Studies']
};

// Keywords that indicate images would be helpful
const IMAGE_KEYWORDS = [
  'diagram', 'chart', 'graph', 'figure', 'illustration', 'photo', 'image', 
  'visual', 'picture', 'drawing', 'map', 'timeline', 'flowchart', 'table',
  'geometric shape', 'triangle', 'circle', 'rectangle', 'square',
  'cell structure', 'ecosystem', 'food chain', 'water cycle', 'solar system',
  'coordinate plane', 'number line', 'fraction', 'pie chart', 'bar graph',
  'character', 'setting', 'plot diagram', 'story map', 'vocabulary card',
  'historical figure', 'government building', 'community', 'continent'
];

// Subject-specific visual terms
const SUBJECT_VISUAL_TERMS = {
  'Mathematics': ['graph', 'coordinate plane', 'geometric shape', 'fraction model', 'number line', 'chart'],
  'Algebra': ['coordinate plane', 'graph', 'equation', 'slope', 'linear function'],
  'Geometry': ['triangle', 'circle', 'rectangle', 'polygon', '3D shape', 'angle'],
  'Science': ['cell diagram', 'ecosystem', 'food chain', 'water cycle', 'solar system', 'lab equipment'],
  'Biology': ['cell', 'organ', 'system', 'DNA', 'photosynthesis', 'respiratory system'],
  'Chemistry': ['molecule', 'atom', 'periodic table', 'chemical reaction', 'lab equipment'],
  'Physics': ['wave', 'circuit', 'magnet', 'simple machine', 'light spectrum'],
  'English Language Arts': ['story map', 'character', 'setting', 'plot diagram', 'parts of speech'],
  'Social Studies': ['map', 'timeline', 'government building', 'community', 'historical figure'],
  'History': ['timeline', 'historical figure', 'monument', 'artifact', 'battle map']
};

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// Custom error class for better error handling
class ClaudeAPIError extends Error {
  constructor(message, status = null, details = null) {
    super(message);
    this.name = 'ClaudeAPIError';
    this.status = status;
    this.details = details;
  }
}

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const validateAdaptationParams = (params) => {
  const required = ['subject', 'proficiencyLevel', 'contentToAdapt'];
  const missing = required.filter(field => !params[field]);
  
  if (missing.length > 0) {
    throw new ClaudeAPIError(`Missing required parameters: ${missing.join(', ')}`);
  }
};

const validateSplitResponse = (parts, expectedParts = 2) => {
  if (parts.length < expectedParts) {
    throw new ClaudeAPIError(`Expected ${expectedParts} parts in response, got ${parts.length}`);
  }
  
  if (parts.some(part => !part.trim())) {
    throw new ClaudeAPIError('One or more response parts are empty');
  }
  
  return parts.map(part => part.trim());
};

const sanitizeInput = (text) => {
  if (typeof text !== 'string') return text;
  
  // Basic sanitization - remove potential script tags and excessive whitespace
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// NEW ADDITION: Content complexity estimation
const estimateContentComplexity = (content) => {
  const problemCount = (content.match(/\b\d+\.\d+\b/g) || []).length; // Matches 1.1, 2.3, etc.
  const questionCount = (content.match(/\d+\./g) || []).length; // Matches 1., 2., etc.
  const totalProblems = problemCount + questionCount;
  const wordCount = content.split(/\s+/).length;
  const hasMultipleSections = content.includes('Section') || content.includes('Part') || content.includes('Chapter');
  
  return {
    problemCount: totalProblems,
    wordCount,
    hasMultipleSections,
    needsExtendedTokens: wordCount > 1000 || totalProblems > 10 || hasMultipleSections,
    estimatedTokensNeeded: Math.max(wordCount * 2, totalProblems * 200) // Rough estimate
  };
};

// Function to detect image opportunities in text
const detectImageOpportunities = (text, subject) => {
  const opportunities = [];
  const lowerText = text.toLowerCase();
  
  // Check for general image keywords
  IMAGE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      opportunities.push({
        keyword,
        context: extractContext(text, keyword),
        type: 'general'
      });
    }
  });
  
  // Check for subject-specific terms
  const subjectTerms = SUBJECT_VISUAL_TERMS[subject] || [];
  subjectTerms.forEach(term => {
    if (lowerText.includes(term.toLowerCase())) {
      opportunities.push({
        keyword: term,
        context: extractContext(text, term),
        type: 'subject-specific'
      });
    }
  });
  
  // Remove duplicates and limit to most relevant
  const unique = opportunities.filter((item, index, self) => 
    index === self.findIndex(t => t.keyword === item.keyword)
  );
  
  return unique.slice(0, 5); // Limit to 5 most relevant
};

// Helper function to extract context around a keyword
const extractContext = (text, keyword) => {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  
  if (index === -1) return '';
  
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + keyword.length + 50);
  
  return text.substring(start, end).trim();
};

// Function to sanitize image prompts for safety
const sanitizeImagePrompt = (prompt) => {
  // Ensure the prompt starts with safe educational language
  if (!prompt.toLowerCase().startsWith('educational illustration:') && 
      !prompt.toLowerCase().startsWith('learning diagram:')) {
    prompt = 'Educational illustration: ' + prompt;
  }
  
  // Add educational context if missing
  if (!prompt.toLowerCase().includes('classroom') && 
      !prompt.toLowerCase().includes('educational') && 
      !prompt.toLowerCase().includes('textbook')) {
    prompt += ' Textbook style, appropriate for classroom use.';
  }
  
  // Remove any potentially problematic terms and replace with educational equivalents
  const safeTerms = {
    'weapon': 'tool',
    'fight': 'compete',
    'battle': 'historical event',
    'war': 'historical conflict',
    'kill': 'eliminate',
    'death': 'lifecycle end',
    'blood': 'red liquid',
    'violence': 'conflict',
    'attack': 'approach',
    'destroy': 'break down',
    'explosion': 'reaction',
    'bomb': 'device',
    'gun': 'tool',
    'knife': 'cutting tool',
    'poison': 'harmful substance',
    'dangerous': 'requiring caution'
  };
  
  let cleanPrompt = prompt;
  Object.keys(safeTerms).forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleanPrompt = cleanPrompt.replace(regex, safeTerms[term]);
  });
  
  return cleanPrompt;
};

// Function to generate image prompts using Claude (SAFE VERSION)
const generateImagePrompts = async (opportunities, subject, proficiencyLevel, materialType) => {
  if (opportunities.length === 0) return null;
  
  const promptText = `You are an expert at creating image prompts for educational AI image generators like DALL-E. 

Based on the following detected visual needs from a teacher's guide, create specific, detailed prompts that teachers can copy and paste into an AI image generator.

**Context:**
- Subject: ${subject}
- Student Level: ${proficiencyLevel} WIDA proficiency
- Material Type: ${materialType}

**Visual needs detected:**
${opportunities.map((opp, index) => 
  `${index + 1}. "${opp.keyword}" - Context: "${opp.context}"`
).join('\n')}

**CRITICAL INSTRUCTIONS:**
Create educational image prompts that are:
- Appropriate for classroom use and educational purposes
- Safe and suitable for all ages
- Free from any potentially sensitive language
- Focused on learning and academic content
- Using clear, positive, educational terminology

Create a JSON object with an array called "imagePrompts" containing objects with:
- "title": A brief title for what the image shows
- "prompt": A detailed, educational prompt starting with "Educational illustration:" or "Learning diagram:" 
- "usage": How teachers might use this image

**PROMPT FORMATTING RULES:**
- Always start prompts with "Educational illustration:" or "Learning diagram:"
- Use terms like "textbook style", "classroom appropriate", "academic illustration"
- Focus on educational value and clarity
- Avoid any language that might be misinterpreted
- Keep prompts professional and curriculum-focused

Example format:
"Educational illustration: A textbook-style diagram showing the water cycle with clear labels for evaporation, condensation, and precipitation. Clean, simple design suitable for classroom learning."

Respond ONLY with valid JSON. No other text.`;

  try {
    const result = await callClaudeAPIWithRetry([
      { role: 'user', content: promptText }
    ], CONFIG.TOKENS.DEFAULT_MAX, 1);
    
    const responseText = result.content[0].text;
    const cleanedResponse = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsedResult = JSON.parse(cleanedResponse);
    
    // Additional safety filter - clean up any potentially problematic words
    if (parsedResult.imagePrompts) {
      parsedResult.imagePrompts = parsedResult.imagePrompts.map(prompt => ({
        ...prompt,
        prompt: sanitizeImagePrompt(prompt.prompt)
      }));
    }
    
    return parsedResult;
  } catch (error) {
    console.error('Error generating image prompts:', error);
    return null;
  }
};

// Enhanced API call with retry logic
const callClaudeAPIWithRetry = async (messages, maxTokens = CONFIG.TOKENS.DEFAULT_MAX, maxRetries = CONFIG.API.MAX_RETRIES) => {
  const formattedMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: sanitizeInput(msg.content) };
    }
    return msg;
  });
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);
      
      const response = await fetch(`${API_BASE_URL}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: formattedMessages, 
          max_tokens: maxTokens 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ClaudeAPIError(
          errorData.error || `API request failed: ${response.status}`,
          response.status,
          errorData
        );
      }
      
      return await response.json();
      
    } catch (error) {
      console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      // Don't retry on certain errors
      if (error.name === 'AbortError') {
        throw new ClaudeAPIError('Request timeout', 408, error);
      }
      
      if (error.status === 401 || error.status === 403) {
        throw error; // Don't retry authentication errors
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying, with exponential backoff
      await delay(CONFIG.DELAYS.RETRY_DELAY * attempt);
    }
  }
};

// Original callClaudeAPI function for backward compatibility
const callClaudeAPI = async (messages, maxTokens = CONFIG.TOKENS.DEFAULT_MAX) => {
  return callClaudeAPIWithRetry(messages, maxTokens, 1);
};

export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    setProcessingStep?.('Extracting text from PDF...');
    return await extractPDFText(file, setProcessingStep);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new ClaudeAPIError('Failed to extract text from PDF', null, error);
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
  const level = proficiencyLevel.toLowerCase();
  
  switch(level) {
    case 'entering':
    case 'level 1':
      return `
        **WIDA LEVEL 1 (ENTERING) ADAPTATIONS:**
        - Use VERY simple sentences (3-5 words maximum)
        - Break every instruction into tiny steps
        - Use present tense only with basic verbs (move, find, draw)
        - Include extensive visual supports and picture cues
        - Provide word banks and visual vocabulary cards
        - Use fill-in-the-blank and matching formats primarily
        - Include sentence frames: "The point is ___" "I move ___"
        - Avoid complex mathematical language - use everyday words
        - Provide multiple examples with pictures
        - Use bullet points for all instructions
        - Include gestures and pointing activities where possible
      `;
    
    case 'emerging':
    case 'level 2':
      return `
        **WIDA LEVEL 2 (EMERGING) ADAPTATIONS:**
        - Use simple sentences (6-10 words) with basic connecting words
        - Include visual supports with every new concept
        - Provide word banks and sentence starters for all responses
        - Use familiar vocabulary with academic terms introduced gradually
        - Include step-by-step numbered instructions
        - Use present and simple past tense appropriately
        - Provide examples and guided practice before independent work
        - Include yes/no and multiple choice questions frequently
        - Use graphic organizers for complex concepts
        - Encourage responses with sentence frames
      `;
    
    case 'developing':
    case 'level 3':
      return `
        **WIDA LEVEL 3 (DEVELOPING) ADAPTATIONS:**
        - Use expanded sentences with multiple clauses and transitions
        - Include academic vocabulary with context clues and support
        - Provide sentence frames for complex mathematical explanations
        - Use various tenses and more sophisticated structures
        - Include compare/contrast and cause/effect language patterns
        - Provide graphic organizers for multi-step problems
        - Include some abstract thinking tasks with substantial scaffolds
        - Mix structured and semi-open response formats
        - Encourage use of mathematical reasoning language
        - Provide models and examples for extended responses
      `;
    
    case 'expanding':
    case 'level 4':
      return `
        **WIDA LEVEL 4 (EXPANDING) ADAPTATIONS:**
        - Use complex sentences with sophisticated academic language
        - Include technical vocabulary with minimal contextual support
        - Provide opportunities for extended mathematical discourse
        - Use multiple tenses and complex grammatical structures naturally
        - Include analysis, synthesis, and evaluation tasks
        - Reduce visual supports while maintaining text-based scaffolds
        - Include reasoning and justification requirements in responses
        - Focus on academic language functions (hypothesize, conclude, analyze)
        - Encourage mathematical argumentation and proof-like reasoning
        - Provide minimal sentence frames, focus on independent expression
      `;
    
    case 'bridging':
    case 'level 5':
      return `
        **WIDA LEVEL 5 (BRIDGING) ADAPTATIONS:**
        - Use grade-level academic language with strategic, minimal supports
        - Include specialized vocabulary and technical mathematical terms
        - Provide opportunities for extended academic mathematical discourse
        - Use sophisticated grammatical structures and formal register
        - Include abstract and analytical thinking tasks with light scaffolding
        - Focus on advanced academic language functions (synthesize, evaluate, critique)
        - Provide minimal scaffolding while ensuring accessibility
        - Approach near-native academic performance expectations
        - Include tasks requiring mathematical communication and reasoning
        - Focus on refinement of mathematical language rather than simplification
      `;
    
    case 'reaching':
    case 'level 6':
      return `
        **WIDA LEVEL 6 (REACHING) ADAPTATIONS:**
        - Use full grade-level academic language identical to English-proficient peers
        - Include all specialized and technical vocabulary without additional support
        - Provide complex academic discourse opportunities requiring sustained reasoning
        - Use sophisticated grammatical structures and formal mathematical register
        - Include high-level abstract and analytical thinking tasks without scaffolding
        - Require extended mathematical justification and proof-writing
        - Focus on mathematical argumentation, critique, and peer review
        - Performance should meet or exceed grade-level expectations
        - Include metacognitive tasks requiring reflection on mathematical processes
        - NO simplification needed - full academic rigor maintained
      `;
    
    default:
      return `Adapt the content to be appropriate for the ${proficiencyLevel} WIDA proficiency level, using research-based ELL best practices.`;
  }
};

const getSubjectAwareInstructions = (subject, proficiencyLevel) => {
  if (SUBJECT_GROUPS.MATH_SCIENCE.includes(subject)) {
    return `
      **CRITICAL SUBJECT RULE: PRESERVE ALL MATHEMATICAL CONTENT**
      - For this ${subject} material, you MUST include EVERY SINGLE problem, exercise, and question from the original material
      - Do NOT omit, combine, or summarize any numbered problems (e.g., if original has problems 1.1, 1.2, 1.3, etc., ALL must appear in your adaptation)
      - Do NOT change or alter ANY numbers, equations, coordinates, variables, or mathematical logic
      - Do NOT create new simplified problems to replace the originals
      - Your ONLY task is to add ELL scaffolding AROUND the original problems by:
        * Simplifying the instructional language (e.g., "Find the coordinates" instead of "Determine the coordinates")
        * Adding vocabulary support for mathematical terms
        * Breaking complex instructions into steps
        * Providing visual cues or organizational structures
      - Every mathematical exercise must remain exactly as given to ensure the teacher's answer key remains valid
      - Example: Original "Determine the coordinates of the image P'" becomes "Find the coordinates of the image P'" but the problem setup stays identical
    `;
  }

  if (SUBJECT_GROUPS.ELA_SOCIAL.includes(subject)) {
    const level = proficiencyLevel.toLowerCase();
    if (['bridging', 'level 5'].includes(level)) {
      return `
        **CRITICAL SUBJECT RULE: PRESERVE AUTHOR'S VOICE**
        - For this high-level ELA/Social Studies material, prioritize preserving the original author's tone and voice.
        - Do not oversimplify. Focus on defining high-level academic or figurative language and clarifying only the most complex sentence structures. The student must engage with the text in a near-native form.
        - Bold vocabulary words throughout all text and questions.
      `;
    }
    if (['reaching', 'level 6'].includes(level)) {
      return `
        **CRITICAL SUBJECT RULE: GRADE-LEVEL PERFORMANCE**
        - Maintain full grade-level complexity and academic rigor
        - Use sophisticated academic language and complex sentence structures
        - Include high-level analytical and critical thinking tasks
        - Minimal adaptation needed - focus on content mastery rather than language support
        - Bold vocabulary words throughout all content
      `;
    }
    if (['expanding', 'level 4'].includes(level)) {
      return `
        **CRITICAL SUBJECT RULE: MODERATE SIMPLIFICATION**
        - Simplify complex sentence structures while maintaining academic tone
        - Chunk text into manageable paragraphs with clear topic sentences
        - Provide analytical questions with some scaffolding
        - Bold vocabulary words throughout all content
      `;
    }
    if (['developing', 'level 3'].includes(level)) {
      return `
        **CRITICAL SUBJECT RULE: SIMPLIFY AND SUPPORT**
        - Simplify and rephrase complex reading passages to make them more accessible
        - Chunk the text into smaller paragraphs with clear headings
        - Adapt analytical questions with appropriate scaffolds and sentence frames
        - Bold vocabulary words throughout all content
      `;
    }
    if (['emerging', 'level 2'].includes(level)) {
      return `
        **CRITICAL SUBJECT RULE: SIGNIFICANT SIMPLIFICATION**
        - Use simple sentence structures and familiar vocabulary
        - Break text into very short paragraphs with visual supports
        - Convert complex questions to multiple choice or fill-in-the-blank
        - Bold vocabulary words throughout all content
      `;
    }
    if (['entering', 'level 1'].includes(level)) {
      return `
        **CRITICAL SUBJECT RULE: MAXIMUM SIMPLIFICATION**
        - Use very simple sentences (3-5 words) and basic vocabulary
        - Include extensive visual supports and graphic organizers
        - Convert most questions to matching, true/false, or picture-based activities
        - Bold vocabulary words throughout all content
      `;
    }
  }

  return '';
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

// Function to validate vocabulary integration
const validateVocabularyIntegration = (studentWorksheet) => {
  const vocabularySection = studentWorksheet.match(/\*\*\*Key Vocabulary\*\*\*(.*?)\*\*\*/s);
  if (!vocabularySection) return { isValid: true, message: 'No vocabulary section found' };
  
  const vocabularyWords = vocabularySection[1]
    .match(/\*\*(.*?)\*\*/g)
    ?.map(word => word.replace(/\*\*/g, '').toLowerCase()) || [];
  
  const textSection = studentWorksheet.substring(studentWorksheet.indexOf('***Reading Text'));
  
  const missingWords = vocabularyWords.filter(word => 
    !textSection.toLowerCase().includes(word)
  );
  
  return {
    isValid: missingWords.length === 0,
    missingWords,
    totalVocabWords: vocabularyWords.length,
    message: missingWords.length > 0 
      ? `Missing vocabulary words in text: ${missingWords.join(', ')}` 
      : 'All vocabulary words found in text'
  };
};

const createStudentAndDescriptorsPrompt = (details) => {
  const { materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, contentToAdapt, bilingualInstructions, proficiencyAdaptations, subjectAwareInstructions, iepInstructions, complexity } = details;
  const level = proficiencyLevel.toLowerCase();
  
  let levelSpecificInstructions = '';
  
  // Add very specific instructions based on proficiency level
  if (['entering', 'level 1'].includes(level)) {
    levelSpecificInstructions = `
    **LEVEL 1 SPECIFIC REQUIREMENTS:**
    - Break ALL problem instructions into 2-3 word chunks
    - Use arrows (→) to show movement and outcomes
    - Format problems as: "Move point P(2,5)" then "Right 6 spaces ⟨6,0⟩" then "New point: ( ___, ___ )"
    - Include picture symbols where possible: ➡️ for right, ⬆️ for up, etc.
    - Use numbered steps: "Step 1: Find point. Step 2: Move point. Step 3: Write answer."
    `;
  } else if (['emerging', 'level 2'].includes(level)) {
    levelSpecificInstructions = `
    **LEVEL 2 SPECIFIC REQUIREMENTS:**
    - Use simple sentence starters: "First, I..." "Next, I..." "The answer is..."
    - Provide guided examples: "Example: Point (2,3) + vector ⟨1,2⟩ = Point (3,5)"
    - Include visual organizers for multi-step problems
    - Use choice format when possible: "The coordinates are: a) (2,5) b) (8,5) c) (-6,-2)"
    `;
  } else if (['developing', 'level 3'].includes(level)) {
    levelSpecificInstructions = `
    **LEVEL 3 SPECIFIC REQUIREMENTS:**
    - Use connecting words: "When you translate..., then..." "After moving the point..."
    - Include sentence frames: "The translation moves the figure ___" "I can find the coordinates by ___"
    - Provide step-by-step reasoning guides
    - Include compare/contrast language: "Compare the original coordinates to the image coordinates"
    `;
  } else if (['expanding', 'level 4'].includes(level)) {
    levelSpecificInstructions = `
    **LEVEL 4 SPECIFIC REQUIREMENTS:**
    - Include analysis questions: "Explain why this transformation preserves..." "Analyze the relationship between..."
    - Use academic transitions: "Furthermore," "In addition," "Consequently,"
    - Require justification: "Justify your answer using coordinate geometry principles"
    - Include evaluation tasks: "Determine which method is most efficient..."
    `;
  } else if (['bridging', 'level 5'].includes(level)) {
    levelSpecificInstructions = `
    **LEVEL 5 SPECIFIC REQUIREMENTS:**
    - Include synthesis tasks: "Synthesize your findings to create a general rule..."
    - Use sophisticated academic language: "Demonstrate," "Substantiate," "Corroborate"
    - Require extended explanations: "Provide a comprehensive analysis of..."
    - Include peer review components: "Critique your partner's solution..."
    `;
  } else if (['reaching', 'level 6'].includes(level)) {
    levelSpecificInstructions = `
    **LEVEL 6 SPECIFIC REQUIREMENTS:**
    - Use full academic rigor with complex sentence structures
    - Include abstract reasoning: "Generalize the principle underlying..."
    - Require formal mathematical communication: "Construct a formal argument demonstrating..."
    - Include metacognitive elements: "Reflect on your problem-solving process and evaluate..."
    - NO language simplification - maintain grade-level complexity
    `;
  }

  return `You are an expert ELL curriculum adapter. Your task is to generate two distinct pieces of text, separated by the exact delimiter: ${CONFIG.DELIMITERS.SPLIT_MARKER}

  **CONTENT ANALYSIS:**
  Original content contains approximately ${complexity.problemCount} problems/questions and ${complexity.wordCount} words.
  ${complexity.hasMultipleSections ? 'Multiple sections detected - ensure ALL sections are included.' : ''}

  **PART 1: STUDENT WORKSHEET**
  Generate a complete student worksheet formatted in simple GitHub Flavored Markdown.
  - Structure: Title, Background Knowledge, Key Vocabulary, Pre-Reading Activity, Reading Text, Practice Problems/Exercises.
  
  **CRITICAL VOCABULARY INTEGRATION RULE:**
  - You MUST use the vocabulary words from your "Key Vocabulary" section throughout the ENTIRE worksheet
  - **Bold** each vocabulary word EVERY TIME it appears anywhere in the worksheet (reading text, problems, instructions, etc.)
  - Examples: "Find the **coordinates** of the **image**" or "Use the **vector** to translate the point"
  - Do NOT provide parenthetical definitions or explanations after vocabulary words
  - Students should refer back to the Key Vocabulary section for meanings
  - Every vocabulary word you list must appear at least once in the adapted content
  - In math problems, bold mathematical vocabulary terms consistently throughout all exercises
  - If the original text doesn't contain a vocabulary word, you must naturally incorporate it into the adapted version

  **CRITICAL CONTENT PRESERVATION RULE:**
  - If this is math/science content, you MUST include ALL original problems, exercises, and questions with their exact numbers and mathematical content
  - Do NOT create substitute problems or omit any numbered exercises
  - Only simplify the language of instructions, not the mathematical content itself

 **ABSOLUTE NO-SUMMARIZATION RULE:**
 - You MUST write out EVERY SINGLE problem completely and individually
 - NEVER use phrases like "[Content continues...]", "[Similar format...]", "[Continue with...]", "[Rest of problems...]", or any other summarization
 - NEVER use ellipses (...) to indicate continuation  
 - NEVER abbreviate or shorten the worksheet content
 - Every problem from 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4 must be written out in full
 - The worksheet must be completely usable without any additional work from the teacher
 - If you find yourself wanting to summarize, STOP and write out the full content instead

 **ABSOLUTE COMPLETENESS REQUIREMENT:**
 - Write EVERY SINGLE problem number and question completely
 - If there are ${complexity.problemCount} problems in the original, there must be ${complexity.problemCount} problems in your adaptation
 - NEVER write "Continue with similar problems" or "Problems 5-10 follow the same pattern"
 - Teachers need to print this worksheet and use it immediately without adding anything
 - Each problem must be individually written out with full instructions
 - FAILURE TO INCLUDE ALL PROBLEMS MAKES THE WORKSHEET UNUSABLE

 **CHECKPOINT:** Before submitting your response, count:
 - Original problems: ${complexity.problemCount}
 - Your adapted problems: [count them]  
 - These numbers MUST match exactly
 
 ${levelSpecificInstructions}

 - Apply all subject-aware rules, IEP accommodations, and bilingual supports as instructed.
 - **CRUCIAL:** This worksheet must be 100% print-and-go ready with zero teacher preparation needed.

 **PART 2: LESSON-SPECIFIC DESCRIPTORS**
 Generate a valid JSON object with a "title" and a "descriptors" array of 3-5 observable "Can Do" statements for this lesson.

 **DETAILS FOR ADAPTATION:**
 - Material Type: ${materialType}
 - Subject: ${subject}
- WIDA Level: ${proficiencyLevel}
- Original Text: \`\`\`${contentToAdapt}\`\`\`
${subjectAwareInstructions}
${iepInstructions}
${bilingualInstructions}
${proficiencyAdaptations}
`;
};

const createTeacherGuidePrompt = (details, studentWorksheet) => {
const { bilingualInstructions, subjectAwareInstructions } = details;
return `You are an expert ELL curriculum adapter. Your task is to generate a teacher's guide for the student worksheet provided below.

**STUDENT WORKSHEET TO CREATE A GUIDE FOR:**
\`\`\`
${studentWorksheet}
\`\`\`

${subjectAwareInstructions}

**TASK:**
Generate a complete teacher's guide in GitHub Flavored Markdown.
- **Your primary task is to create a complete Answer Key for ALL activities from the worksheet.**
- After the Answer Key, create a "Lesson Preparation & Pacing" section, highlighting materials with <mark> tags.
- Then, list the Content and ELL Language Objectives.
- Then, list the ELL Supports Included.
- **IMPORTANT:** When mentioning visual aids like diagrams, charts, images, maps, timelines, or any visual elements, be specific about what they should show. Use phrases like "diagram showing...", "chart displaying...", "image of...", etc.
- **CRUCIAL:** Do NOT repeat or copy the student worksheet content. Your purpose is to provide the answers and pedagogical notes FOR the worksheet.
${bilingualInstructions}

Provide ONLY the raw Markdown for the teacher's guide, and nothing else.`;
};

// NEW ADDITION: Function to handle long materials with chunking strategy
const handleLongMaterialAdaptation = async (params, setProcessingStep, complexity) => {
 if (!complexity.needsExtendedTokens) {
   // Use standard approach for shorter materials
   return null;
 }

 // For very long materials (>15 problems or >2000 words), consider chunking
 if (complexity.problemCount > 15 || complexity.wordCount > 2000) {
   console.log('Very long material detected - considering chunked approach');
   setProcessingStep?.('Processing long material - this may take extra time...');
   
   // Could implement chunking logic here if needed
   // For now, just use extended tokens
 }

 return null; // Return null to use standard approach with extended tokens
};

/**
* Adapt material using Claude API with a multi-call strategy
*/
export const adaptMaterialWithClaude = async (params, setProcessingStep) => {
try {
  // Validate input parameters
  validateAdaptationParams(params);
  
  const { subject, proficiencyLevel, materialType, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates, worksheetLength, addStudentChecklist, useMultipleChoice } = params;

  setProcessingStep?.('Analyzing content complexity...');

  // NEW: Analyze content complexity
  const complexity = estimateContentComplexity(params.contentToAdapt);
  console.log('Content complexity analysis:', complexity);

  // NEW: Determine appropriate token limit based on complexity
  const maxTokens = complexity.needsExtendedTokens ? CONFIG.TOKENS.EXTENDED_MAX : CONFIG.TOKENS.DEFAULT_MAX;
  console.log(`Using ${maxTokens} tokens for this adaptation`);

  // NEW: Check if we need special handling for very long materials
  const chunkingResult = await handleLongMaterialAdaptation(params, setProcessingStep, complexity);
  if (chunkingResult) {
    return chunkingResult; // Return early if chunking was used
  }

  setProcessingStep?.('Preparing adaptation instructions...');

  const subjectAwareInstructions = getSubjectAwareInstructions(subject, proficiencyLevel);
  const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);
  const bilingualInstructions = buildBilingualInstructions({
    includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates
  });
  const iepInstructions = getIepAccommodationInstructions({
    worksheetLength, addStudentChecklist, useMultipleChoice
  });
  
  // NEW: Pass complexity information to prompt
  const promptDetails = { ...params, subjectAwareInstructions, proficiencyAdaptations, bilingualInstructions, iepInstructions, complexity };
  
  // STEP 1: Get the Student Worksheet and Descriptors together
  setProcessingStep?.('Generating student worksheet and descriptors...');
  console.log("Step 1: Requesting Student Worksheet & Descriptors...");
  console.log(`Expected problems in output: ${complexity.problemCount}`);
  
  const initialPrompt = createStudentAndDescriptorsPrompt(promptDetails);
  // NEW: Use dynamic token limit
  const initialResult = await callClaudeAPIWithRetry([{ role: 'user', content: initialPrompt }], maxTokens);
  
  const initialParts = validateSplitResponse(
    initialResult.content[0].text.split(CONFIG.DELIMITERS.SPLIT_MARKER),
    2
  );
  
  const studentWorksheet = initialParts[0];
  
  // NEW: Validate that all problems were included
  const outputComplexity = estimateContentComplexity(studentWorksheet);
  console.log('Output complexity analysis:', outputComplexity);
  if (outputComplexity.problemCount < complexity.problemCount * 0.8) { // Allow 20% variance for different counting
    console.warn(`Potential content loss detected: Input had ~${complexity.problemCount} problems, output has ~${outputComplexity.problemCount}`);
  }
  
  // Validate vocabulary integration
  const vocabValidation = validateVocabularyIntegration(studentWorksheet);
  console.log('Vocabulary validation:', vocabValidation.message);
  
  if (!vocabValidation.isValid) {
    console.warn('Vocabulary integration issue detected:', vocabValidation.missingWords);
    // You could add retry logic here if needed
  }
  
  let dynamicWidaDescriptors;
  
  try {
    dynamicWidaDescriptors = JSON.parse(initialParts[1]);
  } catch (parseError) {
    console.warn('Failed to parse descriptors JSON, using fallback');
    dynamicWidaDescriptors = {
      title: `${subject} - ${proficiencyLevel} Level`,
      descriptors: ["Students can engage with adapted content at their proficiency level"]
    };
  }
  
  console.log("Step 1: Received Student Worksheet & Descriptors.");

  // Wait between API calls
  await delay(CONFIG.DELAYS.BETWEEN_CALLS);

  // STEP 2: Get the Teacher's Guide
  setProcessingStep?.('Generating teacher guide...');
  console.log("Step 2: Requesting Teacher's Guide...");
  
  const guidePrompt = createTeacherGuidePrompt(promptDetails, studentWorksheet);
  // NEW: Use appropriate token limit for teacher guide
  const guideTokens = Math.min(maxTokens, CONFIG.TOKENS.EXTENDED_MAX); // Teacher guides can be long
  const guideResult = await callClaudeAPIWithRetry([{ role: 'user', content: guidePrompt }], guideTokens);
  const teacherGuide = guideResult.content[0].text;
  
  console.log("Step 2: Teacher's Guide received.");

  // STEP 3: Generate Image Prompts
  setProcessingStep?.('Generating image suggestions...');
  console.log("Step 3: Detecting image opportunities...");
  
  const imageOpportunities = detectImageOpportunities(teacherGuide, subject);
  let imagePrompts = null;
  
  if (imageOpportunities.length > 0) {
    console.log(`Found ${imageOpportunities.length} image opportunities`);
    await delay(CONFIG.DELAYS.BETWEEN_CALLS);
    
    imagePrompts = await generateImagePrompts(
      imageOpportunities, 
      subject, 
      proficiencyLevel, 
      materialType
    );
    console.log("Step 3: Image prompts generated.");
  } else {
    console.log("Step 3: No image opportunities detected.");
  }

  setProcessingStep?.('Finalizing materials...');

  // STEP 4: Assemble and return the final object
  return {
    studentWorksheet,
    teacherGuide,
    dynamicWidaDescriptors,
    imagePrompts,
    vocabularyValidation: vocabValidation,
    // NEW: Include complexity analysis in output
    contentAnalysis: {
      inputComplexity: complexity,
      outputComplexity,
      tokensUsed: maxTokens,
      completenessCheck: {
        expectedProblems: complexity.problemCount,
        detectedProblems: outputComplexity.problemCount,
        ratio: outputComplexity.problemCount / Math.max(complexity.problemCount, 1)
      }
    }
  };

} catch (error) {
  console.error("A critical error occurred in the multi-call process.", error);
  
  // Provide more specific error messages
  if (error instanceof ClaudeAPIError) {
    throw error;
  }
  
  throw new ClaudeAPIError(
    `Failed to adapt material: ${error.message}`,
    null,
    error
  );
}
};
