// FileName: src/services/claudeService.js (Enhanced version with intelligent chunking and no-summarization)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

// Configuration constants
const CONFIG = {
  DELAYS: {
    BETWEEN_CALLS: 1000,
    RETRY_DELAY: 2000
  },
  TOKENS: {
    DEFAULT_MAX: 8000,     // Keep higher for non-chunked content
    EXTENDED_MAX: 12000,   // Keep higher for complex single pieces
    CHUNK_MAX: 6000        // NEW: Specific limit for chunks
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

// Content complexity estimation
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
    needsChunking: wordCount > 1500 || totalProblems > 10, // NEW: chunking threshold
    estimatedTokensNeeded: Math.max(wordCount * 2, totalProblems * 200)
  };
};

// Validate request size
const validateRequestSize = (prompt) => {
  const estimatedTokens = prompt.length / 4;
  const maxAllowedTokens = 15000;
  
  if (estimatedTokens > maxAllowedTokens) {
    console.warn(`Prompt too large: ~${Math.round(estimatedTokens)} tokens (max: ${maxAllowedTokens})`);
    return false;
  }
  return true;
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
  
  return unique.slice(0, 5);
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
  if (!prompt.toLowerCase().startsWith('educational illustration:') && 
      !prompt.toLowerCase().startsWith('learning diagram:')) {
    prompt = 'Educational illustration: ' + prompt;
  }
  
  if (!prompt.toLowerCase().includes('classroom') && 
      !prompt.toLowerCase().includes('educational') && 
      !prompt.toLowerCase().includes('textbook')) {
    prompt += ' Textbook style, appropriate for classroom use.';
  }
  
  const safeTerms = {
    'weapon': 'tool', 'fight': 'compete', 'battle': 'historical event',
    'war': 'historical conflict', 'kill': 'eliminate', 'death': 'lifecycle end',
    'blood': 'red liquid', 'violence': 'conflict', 'attack': 'approach',
    'destroy': 'break down', 'explosion': 'reaction', 'bomb': 'device',
    'gun': 'tool', 'knife': 'cutting tool', 'poison': 'harmful substance',
    'dangerous': 'requiring caution'
  };
  
  let cleanPrompt = prompt;
  Object.keys(safeTerms).forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    cleanPrompt = cleanPrompt.replace(regex, safeTerms[term]);
  });
  
  return cleanPrompt;
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
        console.error('Claude API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          requestSize: JSON.stringify({ messages: formattedMessages, max_tokens: maxTokens }).length
        });
        
        throw new ClaudeAPIError(
          errorData.error || `API request failed: ${response.status} - ${response.statusText}`,
          response.status,
          errorData
        );
      }
      
      return await response.json();
      
    } catch (error) {
      console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (error.name === 'AbortError') {
        throw new ClaudeAPIError('Request timeout', 408, error);
      }
      
      if (error.status === 401 || error.status === 403) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
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

// CHUNKING SYSTEM - NEW FUNCTIONS

// Create prompt specifically for chunks
const createChunkPrompt = (details) => {
  const { chunkNumber, totalChunks, proficiencyLevel, subject } = details;
  
  // Get level-specific adaptations for chunks
  let levelInstructions = '';
  const level = proficiencyLevel.toLowerCase();
  
  if (['entering', 'level 1'].includes(level)) {
    levelInstructions = `
    - Use VERY simple words (3-5 words per sentence)
    - Break each problem into tiny steps with bullets
    - Use symbols: ➡️ right, ⬅️ left, ⬆️ up, ⬇️ down
    - Format as: "Step 1: Start at P(2,5)" "Step 2: Move right 6" "Step 3: New point is (8,5)"
    - Include visual cues and fill-in blanks with (___,___)
    `;
  } else if (['emerging', 'level 2'].includes(level)) {
    levelInstructions = `
    - Use simple sentences (6-10 words)
    - Provide sentence starters: "First, I..." "Next, I..." "The answer is..."
    - Include guided examples before each problem type
    - Use choice formats when helpful
    `;
  } else if (['developing', 'level 3'].includes(level)) {
    levelInstructions = `
    - Use complete sentences with connecting words: "When you translate..., then..."
    - Include sentence frames: "The vector ⟨a,b⟩ moves the point ___"
    - Provide step-by-step reasoning guides
    - Include compare/contrast language where appropriate
    `;
  } else if (['expanding', 'level 4'].includes(level)) {
    levelInstructions = `
    - Use complex sentences with academic vocabulary
    - Include analysis language: "Determine..." "Calculate..." "Explain why..."
    - Require mathematical justification in responses
    - Focus on academic mathematical discourse
    `;
  } else if (['bridging', 'level 5'].includes(level)) {
    levelInstructions = `
    - Use sophisticated academic language with minimal simplification
    - Include synthesis tasks: "Compare the results..." "What pattern do you notice..."
    - Require extended mathematical explanations
    - Focus on mathematical reasoning and communication
    `;
  } else if (['reaching', 'level 6'].includes(level)) {
    levelInstructions = `
    - Use FULL grade-level academic language - NO simplification
    - Maintain original mathematical language and complexity
    - Include all technical vocabulary without modification
    - Require complete mathematical reasoning and formal communication
    `;
  }

  return `You are processing chunk ${chunkNumber} of ${totalChunks} for an ELL worksheet adaptation.

  **CRITICAL CHUNK RULES:**
  - This is PART of a larger worksheet - do NOT create headers, vocabulary sections, or instructions
  - ONLY adapt the specific problems given below
  - Write out EVERY problem completely - no summarization or abbreviation
  - Maintain all numbers, coordinates, and mathematical expressions exactly as given
  - Apply ${proficiencyLevel} level language adaptations to instructions only
  - Do NOT change mathematical content, only simplify the language around it

  **MATHEMATICAL PRESERVATION:**
  - Keep ALL coordinates, vectors, and numbers identical: P(2,5), ⟨6,0⟩, etc.
  - Keep ALL problem parts: if there are parts A, B, C, include ALL
  - Keep ALL measurements: 120 miles, 60 miles, etc.

  **LEVEL-SPECIFIC LANGUAGE ADAPTATIONS:**
  ${levelInstructions}

  **PROBLEMS TO ADAPT:**
  \`\`\`
  ${details.contentToAdapt}
  \`\`\`

  Return ONLY the adapted problems with their exact numbers. No other content.
  Bold mathematical vocabulary terms like **coordinates**, **vector**, **translate**, **image**.`;
};

// Process a single chunk
const processSingleChunk = async (chunkParams) => {
  const promptDetails = {
    ...chunkParams,
    complexity: estimateContentComplexity(chunkParams.contentToAdapt)
  };

  const chunkPrompt = createChunkPrompt(promptDetails);
  
  // Validate request size
  if (!validateRequestSize(chunkPrompt)) {
    throw new ClaudeAPIError('Chunk request too large even after splitting');
  }
  
  const result = await callClaudeAPIWithRetry([{ role: 'user', content: chunkPrompt }], CONFIG.TOKENS.CHUNK_MAX);
  
  return {
    content: result.content[0].text,
    chunkNumber: chunkParams.chunkNumber
  };
};

// Process chunks one by one
const processChunksSequentially = async (chunks, params, setProcessingStep) => {
  const results = [];
  
  for (let i = 0; i < chunks.length; i++) {
    setProcessingStep?.(`Processing chunk ${i + 1} of ${chunks.length}...`);
    
    const chunkParams = {
      ...params,
      contentToAdapt: chunks[i],
      isChunk: true,
      chunkNumber: i + 1,
      totalChunks: chunks.length
    };
    
    const chunkResult = await processSingleChunk(chunkParams);
    results.push(chunkResult);
    
    // Wait between chunks
    if (i < chunks.length - 1) {
      await delay(CONFIG.DELAYS.BETWEEN_CALLS);
    }
  }
  
  return results;
};

// Helper to create full worksheet from chunks
const createFullWorksheetFromChunks = async (combinedProblems, params) => {
  const { proficiencyLevel, subject, nativeLanguage, includeBilingualSupport, addStudentChecklist, translateSummary } = params;
  
  let worksheet = '';
  
  // Add bilingual summary if requested
  if (translateSummary && includeBilingualSupport && nativeLanguage === 'Spanish') {
    worksheet += '*En esta lección, aprenderemos cómo mover puntos y figuras en un plano usando vectores y coordenadas.*\n\n';
  }
  
  // Title
  const bilingualTitle = includeBilingualSupport && nativeLanguage === 'Spanish' 
    ? ' (*Traslaciones en Geometría*)' 
    : '';
  worksheet += `# Translations in Geometry${bilingualTitle}\n\n`;
  
  // Student checklist if requested
  if (addStudentChecklist) {
    worksheet += `## My Checklist\n`;
    worksheet += `1. [ ] Read vocabulary words\n`;
    worksheet += `2. [ ] Look at examples\n`;
    worksheet += `3. [ ] Solve problems step by step\n\n`;
  }
  
  // Background Knowledge
  worksheet += `## Background Knowledge\n`;
  worksheet += `* Points have (x,y) **coordinates**\n`;
  worksheet += `* Moving points changes their **coordinates**\n`;
  worksheet += `* Arrows show direction of movement\n\n`;
  
  // Key Vocabulary
  worksheet += `## Key Vocabulary\n`;
  const vocabTranslations = includeBilingualSupport && nativeLanguage === 'Spanish';
  worksheet += `* **translate**: to move a shape or point${vocabTranslations ? ' (*trasladar*)' : ''}\n`;
  worksheet += `* **vector**: an arrow showing distance and direction${vocabTranslations ? ' (*vector*)' : ''}\n`;
 worksheet += `* **coordinates**: numbers showing position (x,y)${vocabTranslations ? ' (*coordenadas*)' : ''}\n`;
 worksheet += `* **image**: the new point after moving${vocabTranslations ? ' (*imagen*)' : ''}\n`;
 worksheet += `* **plane**: flat surface with points${vocabTranslations ? ' (*plano*)' : ''}\n\n`;
 
 // Pre-Reading Activity
 worksheet += `## Pre-Reading Activity\n`;
 const directions = `Directions: Match each word to its picture.`;
 const translatedDirections = includeBilingualSupport && nativeLanguage === 'Spanish' 
   ? `${directions}<br>*Instrucciones: Une cada palabra con su imagen.*` 
   : directions;
 worksheet += `${translatedDirections}\n\n`;
 worksheet += `**vector** ➡️   **coordinates** (2,3)   **plane** □\n\n`;
 
 // Practice Problems
 worksheet += `## Practice Problems\n\n`;
 worksheet += combinedProblems;
 
 return worksheet;
};

// Create teacher guide from chunked content
const createTeacherGuideFromChunked = async (fullWorksheet, params) => {
 const { subject, proficiencyLevel, nativeLanguage, includeBilingualSupport, listCognates } = params;
 
 // Create a simplified teacher guide prompt
 const guidePrompt = `Create a teacher's guide for this ELL ${subject} worksheet adapted for ${proficiencyLevel} level students.

**STUDENT WORKSHEET:**
\`\`\`
${fullWorksheet}
\`\`\`

**TASK:**
Generate a complete teacher's guide in GitHub Flavored Markdown with:

1. **Answer Key** - Provide answers for ALL practice problems
2. **Lesson Preparation & Pacing** - List materials needed (use <mark> tags)  
3. **Content Objectives** - What students will learn
4. **ELL Language Objectives** - Language skills students will develop
5. **ELL Supports Included** - List the adaptations provided

${includeBilingualSupport && listCognates ? `6. **Cognates to Highlight** - List English/${nativeLanguage} word pairs that share roots` : ''}

Focus on providing practical teaching guidance. Do NOT repeat the worksheet content.`;

 try {
   const result = await callClaudeAPIWithRetry([{ role: 'user', content: guidePrompt }], CONFIG.TOKENS.DEFAULT_MAX);
   return result.content[0].text;
 } catch (error) {
   console.warn('Failed to generate teacher guide for chunked content, using fallback');
   return createFallbackTeacherGuide(params);
 }
};

// Fallback teacher guide
const createFallbackTeacherGuide = (params) => {
 const { subject, proficiencyLevel } = params;
 
 return `# Teacher's Guide: ${subject} - ${proficiencyLevel} Level

## Answer Key
*Answers will vary based on specific problems. Please refer to your original answer key and apply the same solutions to the adapted problems.*

## Lesson Preparation & Pacing
**Materials Needed:**
- <mark>Coordinate grid paper</mark>
- <mark>Ruler or straightedge</mark>
- <mark>Colored pencils for marking translations</mark>
- <mark>Student worksheet</mark>

**Pacing:** 45-50 minutes
- Introduction: 10 minutes
- Vocabulary review: 10 minutes  
- Guided practice: 15 minutes
- Independent work: 15 minutes

## Content Objectives
Students will be able to:
- Apply translation vectors to coordinate points
- Identify the image of a point after translation
- Calculate coordinates after multiple translations

## ELL Language Objectives
Students will be able to:
- Use mathematical vocabulary related to transformations
- Follow multi-step directions in ${proficiencyLevel} appropriate language
- Communicate mathematical reasoning using sentence frames

## ELL Supports Included
- Simplified vocabulary and sentence structures
- Visual supports and symbols
- Step-by-step problem breakdown
- Bilingual vocabulary support
- Mathematical terminology consistently bolded`;
};

// Combine all chunk results
const combineChunkedResults = async (chunks, originalParams, setProcessingStep) => {
 console.log('Combining chunked results...');
 setProcessingStep?.('Combining all chunks into final worksheet...');
 
 // Sort chunks by number to ensure correct order
 const sortedChunks = chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
 
 // Combine all problem content
 const combinedProblems = sortedChunks.map(chunk => chunk.content).join('\n\n');
 
 // Create full worksheet structure
 const fullWorksheet = await createFullWorksheetFromChunks(combinedProblems, originalParams);
 
 // Generate descriptors
 const descriptors = {
   title: `${originalParams.subject} - ${originalParams.proficiencyLevel} Level`,
   descriptors: [
     "Students can work with coordinate geometry problems at their language level",
     "Students can apply translation vectors to points using adapted language",
     "Students can identify geometric transformations with appropriate scaffolds",
     "Students can calculate coordinate changes with language support",
     "Students can communicate mathematical reasoning using provided sentence frames"
   ]
 };
 
 // Create teacher guide
 setProcessingStep?.('Generating teacher guide...');
 await delay(CONFIG.DELAYS.BETWEEN_CALLS);
 const teacherGuide = await createTeacherGuideFromChunked(fullWorksheet, originalParams);
 
 return {
   studentWorksheet: fullWorksheet,
   teacherGuide,
   dynamicWidaDescriptors: descriptors,
   imagePrompts: null, // Skip image generation for chunked content to avoid additional API calls
   vocabularyValidation: { isValid: true, message: 'Chunked processing completed successfully' },
   contentAnalysis: {
     chunkingUsed: true,
     totalChunks: chunks.length,
     processingMethod: 'intelligent_chunking',
     originalProblemCount: estimateContentComplexity(originalParams.contentToAdapt).problemCount
   }
 };
};

// Enhanced chunking function
const handleLongMaterialAdaptation = async (params, setProcessingStep, complexity) => {
 // Only use chunking if content is actually large
 if (!complexity.needsChunking) {
   return null; // Use standard approach
 }

 console.log('Content requires chunking - implementing intelligent splitting');
 setProcessingStep?.('Analyzing content for optimal chunking...');

 // Split content by problems while preserving structure
 const content = params.contentToAdapt;
 
 // Find problem boundaries more intelligently
 const problemSections = [];
 const lines = content.split('\n');
 let currentSection = '';
 
 for (let i = 0; i < lines.length; i++) {
   const line = lines[i];
   
   // Check if this line starts a new problem (e.g., "1.1", "2.1", etc.)
   if (/^\s*\d+\.\d+/.test(line) && currentSection.trim()) {
     // Save the previous section
     problemSections.push(currentSection.trim());
     currentSection = line + '\n';
   } else {
     currentSection += line + '\n';
   }
 }
 
 // Don't forget the last section
 if (currentSection.trim()) {
   problemSections.push(currentSection.trim());
 }
 
 // Group problems into manageable chunks (3-4 problems per chunk)
 const chunks = [];
 const problemsPerChunk = Math.max(2, Math.min(4, Math.ceil(problemSections.length / 5))); // Limit to max 5 chunks
 
 for (let i = 0; i < problemSections.length; i += problemsPerChunk) {
   const chunk = problemSections.slice(i, i + problemsPerChunk).join('\n\n');
   if (chunk.trim()) {
     chunks.push(chunk);
   }
 }

 console.log(`Split content into ${chunks.length} chunks with ~${problemsPerChunk} problems each`);
 console.log('Chunk sizes:', chunks.map(chunk => `${chunk.split('\n').length} lines`));

 // Process each chunk separately
 const processedChunks = await processChunksSequentially(chunks, params, setProcessingStep);
 
 // Combine results
 return await combineChunkedResults(processedChunks, params, setProcessingStep);
};

// Standard prompt for non-chunked content (same as before but with enhanced detection)
const createStudentAndDescriptorsPrompt = (details) => {
 const { materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, contentToAdapt, bilingualInstructions, proficiencyAdaptations, subjectAwareInstructions, iepInstructions, complexity } = details;
 const level = proficiencyLevel.toLowerCase();
 
 // Count specific problem parts in the original
 const problemParts = contentToAdapt.match(/[ABC]\s*⟨[^⟩]+⟩/g) || [];
 const detailedProblems = contentToAdapt.match(/\d+\.\d+[^]*?(?=\d+\.\d+|\d+\.\d+|$)/g) || [];
 
 console.log(`Detected ${problemParts.length} vector parts and ${detailedProblems.length} detailed problems`);
 
 let levelSpecificInstructions = '';
 
 // More nuanced level instructions
 if (['entering', 'level 1'].includes(level)) {
   levelSpecificInstructions = `
   **LEVEL 1 SPECIFIC REQUIREMENTS:**
   - Use VERY simple words (3-5 words per sentence)
   - Break each problem into tiny steps with bullets
   - Use symbols: ➡️ right, ⬅️ left, ⬆️ up, ⬇️ down
   - Format as: "Step 1: Start at P(2,5)" "Step 2: Move right 6" "Step 3: New point is (8,5)"
   - Include visual cues and fill-in blanks with (___,___)
   - BUT keep ALL original numbers, coordinates, and vectors exactly as given
   `;
 } else if (['emerging', 'level 2'].includes(level)) {
   levelSpecificInstructions = `
   **LEVEL 2 SPECIFIC REQUIREMENTS:**
   - Use simple sentences (6-10 words)
   - Provide sentence starters: "First, I..." "Next, I..." "The answer is..."
   - Include guided examples before each problem type
   - Keep all original mathematical content but add scaffolding language
   - Use choice formats when helpful but preserve original problem structure
   `;
 } else if (['developing', 'level 3'].includes(level)) {
   levelSpecificInstructions = `
   **LEVEL 3 SPECIFIC REQUIREMENTS:**
   - Use complete sentences with connecting words: "When you translate..., then..."
   - Include sentence frames: "The vector ⟨a,b⟩ moves the point ___"
   - Provide step-by-step reasoning guides
   - Maintain all original problem complexity but add language support
   - Include compare/contrast language where appropriate
   `;
 } else if (['expanding', 'level 4'].includes(level)) {
   levelSpecificInstructions = `
   **LEVEL 4 SPECIFIC REQUIREMENTS:**
   - Use complex sentences with academic vocabulary
   - Include analysis language: "Determine..." "Calculate..." "Explain why..."
   - Require mathematical justification in responses
   - Maintain full problem complexity with minimal language modifications
   - Focus on academic mathematical discourse
   `;
 } else if (['bridging', 'level 5'].includes(level)) {
   levelSpecificInstructions = `
   **LEVEL 5 SPECIFIC REQUIREMENTS:**
   - Use sophisticated academic language with minimal simplification
   - Include synthesis tasks: "Compare the results..." "What pattern do you notice..."
   - Require extended mathematical explanations
   - Maintain near grade-level language complexity
   - Focus on mathematical reasoning and communication
   `;
 } else if (['reaching', 'level 6'].includes(level)) {
   levelSpecificInstructions = `
   **LEVEL 6 SPECIFIC REQUIREMENTS:**
   - Use FULL grade-level academic language - NO simplification
   - Maintain original mathematical language and complexity
   - Include all technical vocabulary without modification
   - Require complete mathematical reasoning and formal communication
   - This should be nearly identical to original except for organization and vocabulary bolding
   `;
 }

 return `You are an expert ELL curriculum adapter. Your task is to generate two distinct pieces of text, separated by the exact delimiter: ${CONFIG.DELIMITERS.SPLIT_MARKER}

 **CRITICAL ANALYSIS OF ORIGINAL CONTENT:**
 - Detected ${complexity.problemCount} total problems/questions
 - Detected ${problemParts.length} vector parts (A, B, C components)
 - Original contains ${complexity.wordCount} words
 - Problems with multiple parts: ${problemParts.length > 0 ? 'YES - must include ALL parts' : 'NO'}

 **ABSOLUTE MATHEMATICAL PRESERVATION RULE:**
 - EVERY number, coordinate, vector, and mathematical expression MUST remain identical
 - Problem 1.1 has parts A ⟨6, 0⟩ B ⟨5, -1⟩ C ⟨-8, -7⟩ - ALL must appear
 - Problem 2.3 mentions "120 miles east and 60 miles south" - these EXACT numbers must appear
 - ANY problem with specific measurements, coordinates, or values MUST keep them unchanged

 **PART 1: STUDENT WORKSHEET**
 Generate a complete student worksheet formatted in simple GitHub Flavored Markdown.
 
 **CRITICAL VOCABULARY INTEGRATION RULE:**
 - **Bold** mathematical vocabulary throughout: **translate**, **vector**, **coordinates**, **image**, **plane**
 - Use vocabulary naturally in context: "Find the **coordinates** of the **image**"
 - Do NOT add parenthetical definitions in the problems themselves

 **ABSOLUTE NO-SUMMARIZATION RULE - ENHANCED:**
 - Write out EVERY SINGLE problem completely with ALL parts
 - If original shows "A ⟨6, 0⟩ B ⟨5, -1⟩ C ⟨-8, -7⟩" then ALL THREE must appear
 - If original mentions "120 miles east and 60 miles south" these EXACT numbers must appear
 - NEVER write "[Content continues...]", "[Similar problems...]", or "[Continue with...]"
 - NEVER use "..." to indicate missing content
 - Each problem must be 100% complete with zero teacher additions needed

 **PROBLEM-BY-PROBLEM CHECKLIST:**
 Before finishing, verify each problem contains:
 - 1.1: Point P(2,5) with vectors A⟨6,0⟩, B⟨5,-1⟩, C⟨-8,-7⟩ ✓
 - 1.2: Complete problem statement with specific details ✓
 - 1.3: Pattern recognition with figures A, B, C ✓
 - 1.4: Construction site with vectors ⟨-6,3⟩, ⟨-3,3⟩, ⟨7,2⟩ ✓
 - 1.5: Polygons A through E and shape Q ✓
 - 2.1: Vector ⟨4,1⟩ and points A(a-1,b), B(2b+1,4+a) ✓
 - 2.2: Linear function with y-intercept details ✓
 - 2.3: College trip with 120, 60, 80, 40, 150 mile measurements ✓
 - 2.4: Triangle ABC with vertices A(-5,-2), B(-3,4), C(1,-2) ✓

 ${levelSpecificInstructions}

 - Apply subject-aware rules, IEP accommodations, and bilingual supports as instructed.
 - **CRUCIAL:** This worksheet must be 100% print-and-go ready.

 **PART 2: LESSON-SPECIFIC DESCRIPTORS**
 Generate a valid JSON object with a "title" and a "descriptors" array of 3-5 observable "Can Do" statements.

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

/**
* Main adaptation function with intelligent chunking
*/
export const adaptMaterialWithClaude = async (params, setProcessingStep) => {
 try {
   // Validate input parameters
   validateAdaptationParams(params);
   
   const { subject, proficiencyLevel, materialType, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates, worksheetLength, addStudentChecklist, useMultipleChoice } = params;

   setProcessingStep?.('Analyzing content complexity...');

   // Analyze content complexity
   const complexity = estimateContentComplexity(params.contentToAdapt);
   console.log('Content complexity analysis:', complexity);

   // Check if we need chunking
   const chunkingResult = await handleLongMaterialAdaptation(params, setProcessingStep, complexity);
   if (chunkingResult) {
     console.log('Chunking completed successfully');
     return chunkingResult;
   }

   // Standard processing for smaller content
   console.log('Using standard processing approach');
   const maxTokens = complexity.needsExtendedTokens ? CONFIG.TOKENS.EXTENDED_MAX : CONFIG.TOKENS.DEFAULT_MAX;
   console.log(`Using ${maxTokens} tokens for this adaptation`);

   setProcessingStep?.('Preparing adaptation instructions...');

   const subjectAwareInstructions = getSubjectAwareInstructions(subject, proficiencyLevel);
   const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);
   const bilingualInstructions = buildBilingualInstructions({
     includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates
   });
   const iepInstructions = getIepAccommodationInstructions({
     worksheetLength, addStudentChecklist, useMultipleChoice
   });
   
   const promptDetails = { ...params, subjectAwareInstructions, proficiencyAdaptations, bilingualInstructions, iepInstructions, complexity };
   
   // STEP 1: Get the Student Worksheet and Descriptors together
   setProcessingStep?.('Generating student worksheet and descriptors...');
   console.log("Step 1: Requesting Student Worksheet & Descriptors...");
   console.log(`Expected problems in output: ${complexity.problemCount}`);
   
   const initialPrompt = createStudentAndDescriptorsPrompt(promptDetails);
   
   // Validate request size before sending
   if (!validateRequestSize(initialPrompt)) {
     throw new ClaudeAPIError('Request too large for API. Please use shorter content or enable chunking.');
   }
   
   const initialResult = await callClaudeAPIWithRetry([{ role: 'user', content: initialPrompt }], maxTokens);
   
   const initialParts = validateSplitResponse(
     initialResult.content[0].text.split(CONFIG.DELIMITERS.SPLIT_MARKER),
     2
   );
   
   const studentWorksheet = initialParts[0];
   
   // Validate that all problems were included
   const outputComplexity = estimateContentComplexity(studentWorksheet);
   console.log('Output complexity analysis:', outputComplexity);
   if (outputComplexity.problemCount < complexity.problemCount * 0.8) {
     console.warn(`Potential content loss detected: Input had ~${complexity.problemCount} problems, output has ~${outputComplexity.problemCount}`);
   }
   
   // Validate vocabulary integration
   const vocabValidation = validateVocabularyIntegration(studentWorksheet);
   console.log('Vocabulary validation:', vocabValidation.message);
   
   if (!vocabValidation.isValid) {
     console.warn('Vocabulary integration issue detected:', vocabValidation.missingWords);
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
   const guideTokens = Math.min(maxTokens, CONFIG.TOKENS.EXTENDED_MAX);
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
     contentAnalysis: {
       inputComplexity: complexity,
       outputComplexity,
       tokensUsed: maxTokens,
       completenessCheck: {
         expectedProblems: complexity.problemCount,
         detectedProblems: outputComplexity.problemCount,
         ratio: outputComplexity.problemCount / Math.max(complexity.problemCount, 1)
       },
       chunkingUsed: false,
       processingMethod: 'standard'
     }
   };

 } catch (error) {
   console.error("A critical error occurred in the adaptation process.", error);
   
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
