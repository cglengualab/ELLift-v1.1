// FileName: src/services/claudeService.js (Updated with Print-Ready Fixes - CORRECTED)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

// Configuration constants
const CONFIG = {
  DELAYS: {
    BETWEEN_CALLS: 1000,
    RETRY_DELAY: 2000
  },
  TOKENS: {
    DEFAULT_MAX: 4096,  // Respect Claude's actual limits
    EXTENDED_MAX: 8192, // With beta header for Sonnet
    CHUNK_MAX: 4096     // Keep within limits
  },
  DELIMITERS: {
    SPLIT_MARKER: '|||---SPLIT---|||'
  },
  API: {
    MAX_RETRIES: 3,
    TIMEOUT: 30000
  }
};

// Universal subject groupings
const SUBJECT_GROUPS = {
  MATH_SCIENCE: ['Mathematics', 'Algebra', 'Geometry', 'Science', 'Chemistry', 'Physics', 'Biology', 'Statistics', 'Calculus', 'Pre-Algebra'],
  ELA_SOCIAL: ['English Language Arts', 'History', 'Social Studies', 'Literature', 'Writing', 'Reading', 'Geography', 'Government', 'Economics'],
  LANGUAGE: ['Spanish', 'French', 'German', 'Italian', 'Chinese', 'Japanese', 'Latin'],
  ARTS: ['Art', 'Music', 'Drama', 'Dance', 'Visual Arts', 'Performing Arts'],
  OTHER: ['Health', 'Physical Education', 'Technology', 'Computer Science', 'Life Skills', 'Career Education']
};

// Universal visual keywords
const IMAGE_KEYWORDS = [
  'diagram', 'chart', 'graph', 'figure', 'illustration', 'photo', 'image', 
  'visual', 'picture', 'drawing', 'map', 'timeline', 'flowchart', 'table',
  'graphic', 'sketch', 'plot', 'model', 'representation', 'display'
];

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

// Custom error class
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

const sanitizeInput = (text) => {
  if (typeof text !== 'string') return text;
  
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// PRINT-READY VALIDATION FUNCTIONS
const validatePrintReadiness = (studentWorksheet) => {
  const issues = [];
  
  // Check for placeholder text - EXPANDED LIST
  const placeholders = [
    '[Original passage preserved exactly as written]',
    '[Content continues...]',
    '...',
    '[Add more questions here]',
    '[Insert passage here]',
    '[Passage text here]',
    '[Complete the remaining items]',
    '[Original passage preserved exactly as written, from',
    'from "Charles Dickens Visits America" through',
    'waiting for audiences.]',
    '[Insert full passage text here]',
    '[Include complete passage]',
    '[Full text goes here]',
    '[Replace with actual passage]'
  ];
  
  placeholders.forEach(placeholder => {
    if (studentWorksheet.includes(placeholder)) {
      issues.push(`Contains placeholder: ${placeholder}`);
    }
  });
  
  // Check for proper sequential numbering
  const numberedItems = studentWorksheet.match(/^\s*(\d+)\./gm) || [];
  if (numberedItems.length > 1) {
    const numbers = numberedItems.map(item => parseInt(item.match(/\d+/)[0]));
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i-1] + 1) {
        issues.push(`Numbering error: Found ${numbers[i-1]} followed by ${numbers[i]}`);
      }
    }
  }
  
  // Check for repeated numbers
  const numberCounts = {};
  numberedItems.forEach(item => {
    const num = item.match(/\d+/)[0];
    numberCounts[num] = (numberCounts[num] || 0) + 1;
  });
  
  Object.entries(numberCounts).forEach(([num, count]) => {
    if (count > 1) {
      issues.push(`Number ${num} appears ${count} times`);
    }
  });
  
  // Check for problematic Unicode characters
  const problematicChars = ['□', '✓', '○', '●', '◯', '◉'];
  problematicChars.forEach(char => {
    if (studentWorksheet.includes(char)) {
      issues.push(`Contains problematic character: ${char}`);
    }
  });
  
  // Check for missing reading passage content
  const hasReadingSection = /reading passage|passage|story|text to read/i.test(studentWorksheet);
  const hasReadingQuestions = /according to the passage|in the text|the author|the story/i.test(studentWorksheet);
  
  if (hasReadingSection || hasReadingQuestions) {
    // Look for actual substantial text that could be a passage
    const potentialPassages = studentWorksheet.split('\n')
      .filter(line => line.trim().length > 100 && !line.includes('#') && !line.includes('*'))
      .filter(line => !line.includes('Answer') && !line.includes('Question') && !line.includes('Direction'));
    
    if (potentialPassages.length === 0) {
      issues.push('Reading comprehension worksheet missing the actual reading passage');
    }
  }
  
  // Check for content indicators that suggest missing material
  const contentLines = studentWorksheet.split('\n').filter(line => line.trim());
  const shortLines = contentLines.filter(line => line.trim().length < 10);
  if (shortLines.length > contentLines.length * 0.3) {
    issues.push('Too many short lines - possible missing content');
  }
  
  return {
    isValid: issues.length === 0,
    issues: issues,
    message: issues.length === 0 
      ? 'Worksheet is print-ready' 
      : `Found ${issues.length} print-readiness issues`
  };
};

const fixCommonFormattingIssues = (content) => {
  return content
    // Fix checkbox formatting
    .replace(/□/g, '[ ]')
    .replace(/☐/g, '[ ]')
    .replace(/✓/g, '[x]')
    .replace(/☑/g, '[x]')
    
    // Fix bullet points
    .replace(/•/g, '-')
    .replace(/◦/g, '-')
    
    // Remove placeholder brackets - EXPANDED LIST
    .replace(/\[Original passage preserved exactly as written\]/g, '')
    .replace(/\[Content continues...\]/g, '')
    .replace(/\[Insert passage here\]/g, '')
    .replace(/\[Passage text here\]/g, '')
    .replace(/\[Complete the remaining items\]/g, '')
    .replace(/\[Original passage preserved exactly as written,.*?\]/g, '')
    .replace(/\[Insert full passage text here\]/g, '')
    .replace(/\[Include complete passage\]/g, '')
    .replace(/\[Full text goes here\]/g, '')
    .replace(/\[Replace with actual passage\]/g, '')
    
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// UNIVERSAL CONTENT ANALYSIS
const analyzeContentStructure = (content) => {
  const analysis = {
    // Basic metrics
    wordCount: content.split(/\s+/).length,
    lineCount: content.split('\n').length,
    
    // Structural elements
    numberedItems: (content.match(/^\s*\d+[\.\)]/gm) || []).length,
    letterItems: (content.match(/^\s*[a-z][\.\)]/gim) || []).length,
    bulletPoints: (content.match(/^\s*[-•*]/gm) || []).length,
    
    // Question types
    fillInBlanks: (content.match(/_{3,}|\(\s*\)|\[\s*\]/g) || []).length,
    multipleChoice: (content.match(/^\s*[A-D][\.\)]/gm) || []).length,
    openEnded: (content.match(/\?/g) || []).length,
    
    // Content types
    hasMath: /[\d\+\-\*\/\=\<\>\(\)\[\]]/g.test(content),
    hasCoordinates: /\(\s*[\d\-]+\s*,\s*[\d\-]+\s*\)/g.test(content),
    hasFormulas: /[a-zA-Z]\s*=|=\s*[a-zA-Z]|\^|\√|∫|∑/g.test(content),
    
    // Text analysis
    paragraphs: content.split(/\n\s*\n/).filter(p => p.trim()).length,
    sentences: (content.match(/[.!?]+/g) || []).length,
    
    // Special patterns
    measurements: (content.match(/\d+\s*(cm|mm|m|km|in|ft|yd|mi|g|kg|lb|oz|ml|l|gal)/gi) || []).length,
    percentages: (content.match(/\d+%/g) || []).length,
    dates: (content.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi) || []).length,
    
    // Sections and headers
    sections: (content.match(/^\s*[A-Z][^.!?]*:?\s*$/gm) || []).length,
    chapters: (content.match(/chapter|section|part|unit/gi) || []).length
  };
  
  // Determine content type
  analysis.contentType = determineContentType(analysis, content);
  
  // Calculate complexity
  analysis.totalItems = analysis.numberedItems + analysis.letterItems + analysis.bulletPoints;
  analysis.complexity = calculateComplexity(analysis);
  
  return analysis;
};

const determineContentType = (analysis, content) => {
  const lowerContent = content.toLowerCase();
  
  if (analysis.hasMath || analysis.hasCoordinates || analysis.hasFormulas) {
    return 'mathematics';
  }
  
  if (lowerContent.includes('read') && lowerContent.includes('passage')) {
    return 'reading_comprehension';
  }
  
  if (analysis.multipleChoice > analysis.openEnded) {
    return 'multiple_choice_quiz';
  }
  
  if (analysis.fillInBlanks > 5) {
    return 'fill_in_blank';
  }
  
  if (analysis.paragraphs > analysis.totalItems) {
    return 'text_analysis';
  }
  
  if (analysis.totalItems > analysis.paragraphs) {
    return 'problem_set';
  }
  
  return 'mixed_content';
};

const calculateComplexity = (analysis) => {
  const complexityScore = 
    (analysis.wordCount / 100) +
    (analysis.totalItems * 2) +
    (analysis.openEnded * 1.5) +
    (analysis.paragraphs * 0.5);
    
  return {
    score: complexityScore,
    level: complexityScore < 20 ? 'simple' : complexityScore < 50 ? 'moderate' : 'complex',
    needsChunking: complexityScore > 60 || analysis.totalItems > 15 || analysis.wordCount > 2000,
    needsExtendedTokens: complexityScore > 40 || analysis.wordCount > 1500
  };
};

// UNIVERSAL PROFICIENCY ADAPTATIONS
const getUniversalProficiencyAdaptations = (proficiencyLevel) => {
  const level = proficiencyLevel.toLowerCase();
  
  const adaptations = {
    'entering': {
      sentences: '3-5 words maximum',
      vocabulary: 'Basic everyday words only',
      structure: 'Single simple sentences',
      support: 'Extensive visual supports, word banks, matching activities',
      assessment: 'Fill-in-blank, true/false, picture matching'
    },
    'emerging': {
      sentences: '6-10 words with simple connecting words',
      vocabulary: 'Familiar words with gradual academic introduction',
      structure: 'Present and simple past tense',
      support: 'Visual supports, sentence starters, guided examples',
      assessment: 'Multiple choice, yes/no, short responses with frames'
    },
    'developing': {
      sentences: 'Expanded sentences with multiple clauses',
      vocabulary: 'Academic vocabulary with context support',
      structure: 'Various tenses and transitions',
      support: 'Graphic organizers, sentence frames, models',
      assessment: 'Mixed formats with substantial scaffolding'
    },
    'expanding': {
      sentences: 'Complex sentences with sophisticated language',
      vocabulary: 'Technical vocabulary with minimal support',
      structure: 'Multiple tenses and complex structures',
      support: 'Text-based scaffolds, reasoning requirements',
      assessment: 'Analysis tasks with some scaffolding'
    },
    'bridging': {
      sentences: 'Grade-level academic language with strategic supports',
      vocabulary: 'Specialized and technical terms',
      structure: 'Sophisticated grammatical structures',
      support: 'Minimal scaffolding, focus on refinement',
      assessment: 'Extended responses with light support'
    },
    'reaching': {
      sentences: 'Full grade-level complexity',
      vocabulary: 'All specialized vocabulary without support',
      structure: 'Sophisticated academic register',
      support: 'No simplification needed',
      assessment: 'Grade-level expectations, full rigor'
    }
  };
  
  const levelKey = ['level 1', 'level 2', 'level 3', 'level 4', 'level 5', 'level 6'].includes(level) 
    ? ['entering', 'emerging', 'developing', 'expanding', 'bridging', 'reaching'][parseInt(level.split(' ')[1]) - 1]
    : level;
    
  return adaptations[levelKey] || adaptations['developing'];
};

// UNIVERSAL SUBJECT-AWARE INSTRUCTIONS
const getUniversalSubjectInstructions = (subject, contentAnalysis) => {
  const subjectType = Object.keys(SUBJECT_GROUPS).find(key => 
    SUBJECT_GROUPS[key].includes(subject)
  ) || 'OTHER';
  
  const baseInstructions = {
    MATH_SCIENCE: `
      **CRITICAL PRESERVATION RULE:**
      - Preserve ALL numbers, equations, formulas, measurements, and coordinates exactly
      - Keep ALL problem numbers and exercise labels identical
      - Maintain ALL answer choices in multiple choice questions
      - Do NOT change mathematical logic or scientific facts
      - Only simplify the LANGUAGE around the content, not the content itself
    `,
    ELA_SOCIAL: `
      **CRITICAL PRESERVATION RULE:**
      - Preserve ALL proper nouns, dates, and historical facts exactly
      - Keep ALL quotations and citations identical
      - Maintain ALL text passages for analysis (simplify only if level requires it)
      - Preserve author's voice in reading passages when possible
      - Keep ALL question types and formats
    `,
    LANGUAGE: `
      **CRITICAL PRESERVATION RULE:**
      - Preserve ALL target language vocabulary and phrases exactly
      - Keep ALL grammar examples and conjugations identical
      - Maintain ALL pronunciation guides and phonetic notations
      - Preserve cultural context and authentic materials
    `,
    ARTS: `
      **CRITICAL PRESERVATION RULE:**
      - Preserve ALL technical terminology and artistic vocabulary
      - Keep ALL specific techniques, methods, and processes described
      - Maintain ALL historical references and artist names
      - Preserve creative project requirements and specifications
    `,
    OTHER: `
      **CRITICAL PRESERVATION RULE:**
      - Preserve ALL factual information and specific details
      - Keep ALL procedural steps and safety instructions identical
      - Maintain ALL technical vocabulary and specialized terms
      - Preserve ALL measurements, quantities, and specifications
    `
  };
  
  let instructions = baseInstructions[subjectType];
  
  // Add content-specific adaptations
  if (contentAnalysis.contentType === 'mathematics' || contentAnalysis.hasMath) {
    instructions += `
      - Mathematical expressions, coordinates, and formulas must remain unchanged
      - Problem setup and numerical values cannot be altered
      - Answer keys must remain valid after adaptation
    `;
  }
  
  if (contentAnalysis.multipleChoice > 0) {
    instructions += `
      - ALL multiple choice options (A, B, C, D) must be preserved exactly
      - Do not change the correct answer or alter option content
      - Only simplify the language of instructions, not the choices themselves
    `;
  }
  
  return instructions;
};

// CONTENT-SPECIFIC CHECKLIST GENERATOR
const generateContentSpecificChecklist = (contentAnalysis, originalContent) => {
  const items = [];
  
  // Analyze what's actually in the content
  const hasVocabSection = /vocabulary|key terms|important words/i.test(originalContent);
  const hasReadingPassage = /read|passage|text|story|article/i.test(originalContent) && contentAnalysis.paragraphs > 2;
  const hasMathProblems = contentAnalysis.hasMath && contentAnalysis.numberedItems > 0;
  const hasQuestions = contentAnalysis.openEnded > 0 || contentAnalysis.multipleChoice > 0;
  
  // Background/setup tasks
  if (hasVocabSection) {
    const vocabCount = (originalContent.match(/\*\*(.*?)\*\*/g) || []).length;
    if (vocabCount > 0) {
      items.push(`Review the ${vocabCount} vocabulary words`);
    } else {
      items.push('Review the key vocabulary words');
    }
  }
  
  // Main content tasks
  if (hasReadingPassage) {
    const passageTitle = originalContent.match(/(?:passage|text|story|article)(?:\s+about|\s+on)?\s+([^.\n]+)/i);
    if (passageTitle) {
      items.push(`Read the passage about ${passageTitle[1].trim()}`);
    } else {
      items.push('Read the passage carefully');
    }
  }
  
  if (hasMathProblems) {
    if (contentAnalysis.numberedItems > 0) {
      items.push(`Solve problems 1-${contentAnalysis.numberedItems}`);
    } else {
      items.push('Complete all math problems');
    }
    items.push('Show your work for each problem');
  }
  
  // Question completion
  if (hasQuestions) {
    const totalQuestions = contentAnalysis.openEnded + contentAnalysis.multipleChoice;
    if (totalQuestions > 0) {
      items.push(`Answer all ${totalQuestions} questions`);
    } else {
      items.push('Answer all questions');
    }
    
    if (contentAnalysis.openEnded > 0) {
      items.push('Use complete sentences in your answers');
    }
  }
  
  // Generic completion tasks
  if (contentAnalysis.totalItems > 0 && !hasMathProblems && !hasQuestions) {
    items.push(`Complete all ${contentAnalysis.totalItems} activities`);
  }
  
  // Always end with checking work
  items.push('Check all my work before finishing');
  
  return items;
};

// UPDATED UNIVERSAL PROMPT CREATION - ANTI-PLACEHOLDER VERSION
const createUniversalPrompt = (details) => {
  const { contentAnalysis, proficiencyLevel, subject, materialType } = details;
  const adaptations = getUniversalProficiencyAdaptations(proficiencyLevel);
  const subjectInstructions = getUniversalSubjectInstructions(subject, contentAnalysis);
  
  return `You are an expert ELL curriculum adapter. Your task is to generate two distinct pieces of text, separated by the exact delimiter: ${CONFIG.DELIMITERS.SPLIT_MARKER}

**CONTENT ANALYSIS:**
- Content Type: ${contentAnalysis.contentType}
- Total Items: ${contentAnalysis.totalItems} (${contentAnalysis.numberedItems} numbered, ${contentAnalysis.letterItems} lettered, ${contentAnalysis.bulletPoints} bullets)
- Questions: ${contentAnalysis.openEnded} open-ended, ${contentAnalysis.multipleChoice} multiple choice, ${contentAnalysis.fillInBlanks} fill-in-blank
- Text Structure: ${contentAnalysis.paragraphs} paragraphs, ${contentAnalysis.sentences} sentences
- Complexity: ${contentAnalysis.complexity.level}

**PART 1: STUDENT WORKSHEET**
Generate a complete student worksheet formatted in simple GitHub Flavored Markdown.

**ABSOLUTE PROHIBITION - NEVER DO THIS:**
- NEVER write "[Original passage preserved exactly as written]"
- NEVER write "[Content continues...]" 
- NEVER write "[Insert passage here]"
- NEVER write any text in square brackets [ ]
- NEVER use "..." or ellipses to indicate missing content
- NEVER abbreviate or summarize reading passages
- NEVER create placeholders of any kind

**WHAT YOU MUST DO INSTEAD:**
- Include EVERY WORD of reading passages, stories, poems, or text
- Write out EVERY question completely
- Include ALL content that students need to see
- If there's a passage to read, students must see the full text
- If there are math problems, include every number and equation
- Make the worksheet 100% complete and usable immediately

**CRITICAL PRINT-READY FORMATTING RULES:**
- Use ONLY standard keyboard characters that print reliably
- For checklists: Use "[ ]" (brackets with space) instead of special checkbox symbols
- For numbered items: Use proper sequential numbering (1. 2. 3. etc.) - NEVER repeat numbers
- For lettered items: Use proper sequential lettering (a. b. c. etc.) - NEVER repeat letters
- For bullet points: Use simple dashes (-) or asterisks (*)
- NO special Unicode characters (✓, ○, □, •, etc.)
- ALL content must be complete and ready to print without teacher editing

**UNIVERSAL PRESERVATION RULES:**
- Write out EVERY SINGLE item, question, problem, and exercise completely
- Preserve ALL numbers, measurements, coordinates, dates, and factual information exactly
- Keep ALL multiple choice options, fill-in-blanks, and answer formats identical
- Maintain ALL proper nouns, technical terms, and specialized vocabulary
- Include COMPLETE reading passages word-for-word
- Each item must be 100% complete and usable without teacher additions

${subjectInstructions}

**SEQUENTIAL NUMBERING REQUIREMENTS:**
- Number all questions sequentially: 1. 2. 3. 4. etc.
- Number all problems sequentially: 1. 2. 3. 4. etc.
- Letter all sub-items sequentially: a. b. c. d. etc.
- NEVER repeat numbers or letters within the same sequence
- Double-check your numbering before finalizing

**LANGUAGE ADAPTATION FOR ${proficiencyLevel.toUpperCase()} LEVEL:**
- Sentence Structure: ${adaptations.sentences}
- Vocabulary: ${adaptations.vocabulary}
- Grammar: ${adaptations.structure}
- Support Provided: ${adaptations.support}
- Assessment Format: ${adaptations.assessment}

**VOCABULARY INTEGRATION:**
- Identify and **bold** key academic vocabulary throughout the worksheet
- Use vocabulary naturally in context
- Bold should appear consistently across all content sections

**WORKSHEET STRUCTURE:**
Create appropriate sections based on content type:
- Title reflecting the subject and topic
- Background Knowledge (if applicable)
- Key Vocabulary section with terms relevant to the content
- Pre-Activity or Instructions section
- Main Content (adapted from original with all items preserved)
- Any extension or reflection activities present in original

**CONTENT-SPECIFIC CHECKLIST FORMATTING (if requested):**
Create a specific checklist based on the actual content structure. Analyze the original material and create checklist items that match the specific activities, sections, and tasks present. Examples:

For a reading comprehension worksheet:
## My Checklist
1. [ ] Read the background information about [specific topic]
2. [ ] Review the [X] vocabulary words
3. [ ] Read the passage about [specific content]
4. [ ] Answer questions 1-[X] 
5. [ ] Check that I used complete sentences

For a math worksheet:
## My Checklist
1. [ ] Review the [specific math concept] vocabulary
2. [ ] Complete problems 1-[X]
3. [ ] Show my work for each problem
4. [ ] Check all my calculations

The checklist must reflect the ACTUAL structure and content of the material being adapted, not generic instructions.

${details.bilingualInstructions || ''}
${details.iepInstructions || ''}

**PART 2: LESSON-SPECIFIC DESCRIPTORS**
Generate a valid JSON object with:
- "title": Brief title for this lesson
- "descriptors": Array of 3-5 "Can Do" statements appropriate for ${proficiencyLevel} level in ${subject}

**ORIGINAL CONTENT TO ADAPT:**
\`\`\`
${details.contentToAdapt}
\`\`\`

**MANDATORY SELF-CHECK BEFORE RESPONDING:**
Ask yourself these questions:
1. Did I include the complete reading passage word-for-word?
2. Did I avoid using ANY square brackets [ ] or placeholders?
3. Can a student use this worksheet immediately without additions?
4. Did I write out every question and activity completely?
5. Is all numbering sequential (1, 2, 3... not 1, 1, 1...)?

If you answer "NO" to any question, revise your response before submitting.

**FINAL EMERGENCY INSTRUCTION:**
If you are tempted to write "[Original passage preserved...]" or any placeholder text, this means you have FAILED the task. Instead, copy the exact text from the original content and include it in your response. A worksheet with placeholder text is completely unusable and unacceptable.

Remember: Your primary goal is to make content linguistically accessible while preserving ALL educational content exactly and ensuring perfect print readiness with ZERO placeholders.`;
};

// Enhanced API call with model selection and two-step process
const callClaudeAPIWithRetry = (messages, maxTokens = CONFIG.TOKENS.DEFAULT_MAX, maxRetries = CONFIG.API.MAX_RETRIES, useOpenAI = false) => {
  const formattedMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: sanitizeInput(msg.content) };
    }
    return msg;
  });
  
  return new Promise(async (resolve, reject) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);
        
        // Choose API endpoint based on content length
        const apiEndpoint = useOpenAI ? '/api/openai-claude-fallback' : '/api/claude';
        
        const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: formattedMessages, 
            max_tokens: maxTokens,
            use_openai: useOpenAI
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('API Error Details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            model: useOpenAI ? 'OpenAI GPT-4' : 'Claude',
            requestSize: JSON.stringify({ messages: formattedMessages, max_tokens: maxTokens }).length
          });
          
          throw new ClaudeAPIError(
            errorData.error || `API request failed: ${response.status} - ${response.statusText}`,
            response.status,
            errorData
          );
        }
        
        const data = await response.json();
        resolve(data);
        return;
        
      } catch (error) {
        console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, error.message);
        
        if (error.name === 'AbortError') {
          reject(new ClaudeAPIError('Request timeout', 408, error));
          return;
        }
        
        if (error.status === 401 || error.status === 403) {
          reject(error);
          return;
        }
        
        if (attempt === maxRetries) {
          reject(error);
          return;
        }
        
        await delay(CONFIG.DELAYS.RETRY_DELAY * attempt);
      }
    }
  });
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

const validateSplitResponse = (parts, expectedParts = 2) => {
  if (parts.length < expectedParts) {
    throw new ClaudeAPIError(`Expected ${expectedParts} parts in response, got ${parts.length}`);
  }
  
  if (parts.some(part => !part.trim())) {
    throw new ClaudeAPIError('One or more response parts are empty');
  }
  
  return parts.map(part => part.trim());
};

// Helper functions for bilingual and IEP support
const buildBilingualInstructions = ({
  includeBilingualSupport,
  nativeLanguage,
  translateSummary,
  translateInstructions,
  listCognates
}) => {
  if (!includeBilingualSupport || !nativeLanguage) return '';

  let instructions = `\n\n  **BILINGUAL SUPPORT REQUIREMENTS (Language: ${nativeLanguage}):**\n`;

  instructions += `- For each term in the 'Key Vocabulary' section, provide its translation in ${nativeLanguage}. Format: **term**: definition (*translation*)\n`;
  
  if (translateSummary) {
    instructions += `- At the very top of the worksheet, provide a 1-2 sentence summary in ${nativeLanguage}.\n`;
  }
  
  if (translateInstructions) {
    instructions += `- For every 'Directions:' line, add <br>*Translation in ${nativeLanguage}* immediately after.\n`;
  }
  
  if (listCognates) {
    instructions += `- In the teacher guide, create a 'Cognates to Highlight' section with English/${nativeLanguage} word pairs.\n`;
  }

  return instructions;
};

const getIepAccommodationInstructions = ({
  worksheetLength,
  addStudentChecklist,
  useMultipleChoice
}) => {
  let instructions = `\n\n  **IEP ACCOMMODATION REQUIREMENTS:**\n`;
  
  if (worksheetLength) {
    instructions += `- **Worksheet Length:** Adjust activities for "${worksheetLength}" timeframe\n`;
  }
  
  if (addStudentChecklist) {
    instructions += `- **Student Checklist:** Add content-specific "My Checklist" section at top with steps matching actual activities\n`;
  }

  if (useMultipleChoice) {
    instructions += `- **Multiple Choice:** Convert open-ended questions to multiple choice format where appropriate\n`;
  }

  return instructions;
};

// Teacher guide creation
const createUniversalTeacherGuide = async (studentWorksheet, params, contentAnalysis) => {
  const guidePrompt = `Create a teacher's guide for this adapted ELL worksheet.

**STUDENT WORKSHEET:**
\`\`\`
${studentWorksheet}
\`\`\`

**CONTENT ANALYSIS:**
- Subject: ${params.subject}
- Level: ${params.proficiencyLevel}
- Content Type: ${contentAnalysis.contentType}
- Items: ${contentAnalysis.totalItems}

**REQUIRED SECTIONS:**
1. **Answer Key** - Provide guidance for all activities
2. **Materials Needed** - List required resources (use <mark> tags)
3. **Lesson Objectives** - Content and language objectives
4. **ELL Supports** - List adaptations provided
5. **Pacing Guide** - Suggested timing

Focus on practical teaching guidance. Do NOT repeat worksheet content.`;

  try {
    const result = await callClaudeAPIWithRetry([{ role: 'user', content: guidePrompt }], CONFIG.TOKENS.DEFAULT_MAX);
    return result.content[0].text;
  } catch (error) {
    console.warn('Failed to generate teacher guide, using fallback');
    return createFallbackTeacherGuide(params, contentAnalysis);
  }
};

const createFallbackTeacherGuide = (params, contentAnalysis) => {
  const { subject, proficiencyLevel } = params;
  const adaptations = getUniversalProficiencyAdaptations(proficiencyLevel);
  
  return `# Teacher's Guide: ${subject} - ${proficiencyLevel} Level

## Answer Key
*Refer to your original answer key. All problem numbers, questions, and content structure remain identical to the source material.*

## Materials Needed
- <mark>Student worksheet</mark>
- <mark>Any materials from original lesson plan</mark>
${contentAnalysis.hasMath ? '- <mark>Calculator (if permitted)</mark>\n- <mark>Graph paper or coordinate grids</mark>' : ''}
${contentAnalysis.contentType === 'reading_comprehension' ? '- <mark>Highlighters for text marking</mark>' : ''}
- <mark>Reference materials as appropriate</mark>

## Content Objectives
Students will be able to:
- Demonstrate understanding of ${subject.toLowerCase()} concepts
- Complete ${contentAnalysis.totalItems} activities successfully
- Apply knowledge through various question formats

## Language Objectives (${proficiencyLevel} Level)
Students will be able to:
- Use academic vocabulary with appropriate support
- Follow instructions written at ${proficiencyLevel} language level
- Communicate understanding using: ${adaptations.assessment}

## ELL Supports Included
- **Language Level:** ${adaptations.sentences}
- **Vocabulary Support:** ${adaptations.vocabulary}
- **Instructional Support:** ${adaptations.support}
- **Content Type:** ${contentAnalysis.contentType} with ${contentAnalysis.totalItems} items
- **Assessment Formats:** ${adaptations.assessment}

## Pacing Guide
- **Vocabulary Review:** 5-10 minutes
- **Main Activities:** ${Math.max(20, contentAnalysis.totalItems * 2)} minutes
- **Review/Discussion:** 10-15 minutes
- **Total Time:** ${Math.max(35, contentAnalysis.totalItems * 2 + 20)} minutes

## Additional Notes
- All factual content and numerical values preserved from original
- Sentence structures adapted to ${proficiencyLevel} level
- Key vocabulary bolded throughout for emphasis
- Original assessment validity maintained`;
};

// Vocabulary validation function
const validateVocabularyIntegration = (studentWorksheet) => {
  const vocabularySection = studentWorksheet.match(/## Key Vocabulary(.*?)##/s);
  if (!vocabularySection) return { isValid: true, message: 'No vocabulary section found' };
  
  const boldWords = (studentWorksheet.match(/\*\*(.*?)\*\*/g) || [])
    .map(word => word.replace(/\*\*/g, '').toLowerCase());
  
  const uniqueBoldWords = [...new Set(boldWords)];
  
  return {
    isValid: boldWords.length > 0,
    totalBoldedTerms: boldWords.length,
    uniqueTerms: uniqueBoldWords.length,
    message: boldWords.length > 0 
      ? `${uniqueBoldWords.length} unique vocabulary terms bolded ${boldWords.length} times throughout worksheet`
      : 'No vocabulary terms found bolded in worksheet'
  };
};

// PDF extraction function
export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    setProcessingStep?.('Extracting text from PDF...');
    return await extractPDFText(file, setProcessingStep);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new ClaudeAPIError('Failed to extract text from PDF', null, error);
  }
};

/**
* MAIN UNIVERSAL ADAPTATION FUNCTION
* Works with ANY subject, ANY material type, ANY complexity level
* NOW WITH PRINT-READY VALIDATION AND FIXES
*/
export const adaptMaterialWithClaude = async (params, setProcessingStep) => {
  try {
    // Validate input parameters
    validateAdaptationParams(params);
    
    const { subject, proficiencyLevel, materialType, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates, worksheetLength, addStudentChecklist, useMultipleChoice } = params;

    setProcessingStep?.('Analyzing content structure...');

    // UNIVERSAL CONTENT ANALYSIS - works for any material
    const contentAnalysis = analyzeContentStructure(params.contentToAdapt);
    console.log('Universal content analysis:', {
      contentType: contentAnalysis.contentType,
      complexity: contentAnalysis.complexity.level,
      items: contentAnalysis.totalItems,
      wordCount: contentAnalysis.wordCount,
      estimatedInputTokens: Math.round(params.contentToAdapt.length / 4),
      estimatedPromptTokens: Math.round(params.contentToAdapt.length / 4)
    });

    // Standard processing for manageable content
    console.log('Using standard universal processing');
    const maxTokens = contentAnalysis.complexity.needsExtendedTokens ? CONFIG.TOKENS.EXTENDED_MAX : CONFIG.TOKENS.DEFAULT_MAX;
    console.log(`Using ${maxTokens} tokens for this adaptation`);

    setProcessingStep?.('Preparing universal adaptation instructions...');

    // Build instruction components
    const bilingualInstructions = buildBilingualInstructions({
      includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates
    });
    const iepInstructions = getIepAccommodationInstructions({
      worksheetLength, addStudentChecklist, useMultipleChoice
    });
    
    const promptDetails = { 
      ...params, 
      contentAnalysis, 
      bilingualInstructions, 
      iepInstructions 
    };
    
    // STEP 1: Generate Student Worksheet and Descriptors WITH SMART MODEL SELECTION
    setProcessingStep?.('Analyzing content and selecting optimal model...');
    
    // Determine if we need a high-output model
    const estimatedOutputLength = params.contentToAdapt.length * 1.5; // Accommodation adds ~50% length
    const needsHighOutput = estimatedOutputLength > 3000 || contentAnalysis.wordCount > 1000;
    const useOpenAI = needsHighOutput && contentAnalysis.contentType === 'reading_comprehension';
    
    console.log(`Processing ${contentAnalysis.contentType} with ${contentAnalysis.totalItems} items`);
    console.log(`Estimated output length: ${Math.round(estimatedOutputLength)} chars`);
    console.log(`Using model: ${useOpenAI ? 'OpenAI GPT-4o' : 'Claude Opus'} for ${needsHighOutput ? 'long' : 'standard'} content`);
    
    const mainPrompt = createUniversalPrompt(promptDetails);
    
    // Validate request size
    if (!validateRequestSize(mainPrompt)) {
      throw new ClaudeAPIError('Content too large for single request. Chunking is recommended.');
    }
    
    let studentWorksheet;
    let dynamicWidaDescriptors;
    let attempts = 0;
    const maxRetries = useOpenAI ? 2 : 3; // Fewer retries for OpenAI (more expensive)
    
    while (attempts < maxRetries) {
      attempts++;
      setProcessingStep?.(`Generating worksheet with ${useOpenAI ? 'OpenAI GPT-4o' : 'Claude Opus'} (attempt ${attempts}/${maxRetries})...`);
      
      const mainResult = await callClaudeAPIWithRetry(
        [{ role: 'user', content: mainPrompt }], 
        maxTokens, 
        1, // Single retry per model attempt
        useOpenAI
      );
      
      const mainParts = validateSplitResponse(
        mainResult.content[0].text.split(CONFIG.DELIMITERS.SPLIT_MARKER),
        2
      );
      
      const candidateWorksheet = mainParts[0];
      
      // Check for placeholders immediately
      const placeholderCheck = validatePrintReadiness(candidateWorksheet);
      const hasPlaceholders = placeholderCheck.issues.some(issue => 
        issue.includes('placeholder') || issue.includes('missing')
      );
      
      if (!hasPlaceholders) {
        // Success! No placeholders found
        studentWorksheet = candidateWorksheet;
        
        // Parse descriptors
        try {
          dynamicWidaDescriptors = JSON.parse(mainParts[1]);
        } catch (parseError) {
          console.warn('Failed to parse descriptors, using fallback');
          dynamicWidaDescriptors = {
            title: `${subject} - ${proficiencyLevel} Level`,
            descriptors: [
              `Students can engage with ${subject.toLowerCase()} content at their language level`,
              `Students can complete adapted activities with appropriate support`,
              `Students can use academic vocabulary with scaffolding`,
              `Students can demonstrate understanding through various formats`
            ]
          };
        }
        break;
      } else {
        console.warn(`Attempt ${attempts}: Placeholders detected:`, placeholderCheck.issues);
        
        if (attempts === maxRetries) {
          // Last attempt - apply fixes and use it
          console.warn('Max retries reached, applying automatic fixes');
          studentWorksheet = fixCommonFormattingIssues(candidateWorksheet);
          
          try {
            dynamicWidaDescriptors = JSON.parse(mainParts[1]);
          } catch (parseError) {
            dynamicWidaDescriptors = {
              title: `${subject} - ${proficiencyLevel} Level`,
              descriptors: [
                `Students can engage with ${subject.toLowerCase()} content at their language level`,
                `Students can complete adapted activities with appropriate support`,
                `Students can use academic vocabulary with scaffolding`,
                `Students can demonstrate understanding through various formats`
              ]
            };
          }
          break;
        } else {
          // Wait before retry
          await delay(CONFIG.DELAYS.RETRY_DELAY);
        }
      }
    }
    
    // Validate output completeness
    const outputAnalysis = analyzeContentStructure(studentWorksheet);
    console.log('Output analysis:', {
      inputItems: contentAnalysis.totalItems,
      outputItems: outputAnalysis.totalItems,
      preservation: Math.round((outputAnalysis.totalItems / Math.max(contentAnalysis.totalItems, 1)) * 100) + '%',
      modelUsed: useOpenAI ? 'OpenAI GPT-4o' : 'Claude Opus'
    });
    
    if (outputAnalysis.totalItems < contentAnalysis.totalItems * 0.7) {
      console.warn(`Potential content loss: Expected ~${contentAnalysis.totalItems} items, got ${outputAnalysis.totalItems}`);
    }
    
    console.log("Step 1: Student worksheet and descriptors completed");

    // Wait between API calls
    await delay(CONFIG.DELAYS.BETWEEN_CALLS);

    // STEP 2: Generate Teacher Guide
    setProcessingStep?.('Generating teacher guide...');
    console.log("Step 2: Creating teacher guide");
    
    const teacherGuide = await createUniversalTeacherGuide(studentWorksheet, params, contentAnalysis);
    console.log("Step 2: Teacher guide completed");

    // STEP 3: Validate vocabulary integration
    setProcessingStep?.('Validating adaptation quality...');
    const vocabValidation = validateVocabularyIntegration(studentWorksheet);
    console.log('Vocabulary validation:', vocabValidation.message);

    // Final print-readiness check
    const finalPrintValidation = validatePrintReadiness(studentWorksheet);
    console.log('Final print-readiness validation:', finalPrintValidation.message);

    setProcessingStep?.('Finalizing materials...');

    // Return complete results
    return {
      studentWorksheet,
      teacherGuide,
      dynamicWidaDescriptors,
      imagePrompts: null, // Skip image generation for faster processing
      vocabularyValidation: vocabValidation,
      printReadinessValidation: finalPrintValidation,
      contentAnalysis: {
        inputAnalysis: contentAnalysis,
        outputAnalysis,
        tokensUsed: maxTokens,
        completenessCheck: {
          expectedItems: contentAnalysis.totalItems,
          detectedItems: outputAnalysis.totalItems,
          preservationRate: Math.round((outputAnalysis.totalItems / Math.max(contentAnalysis.totalItems, 1)) * 100),
          contentType: contentAnalysis.contentType
        },
        chunkingUsed: false,
        processingMethod: 'universal_standard'
      }
    };

  } catch (error) {
    console.error("Universal adaptation process failed:", error);
    
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
