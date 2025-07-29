// FileName: src/services/claudeService.js (Enhanced version with improvements and safe image prompts)

// Claude API service functions
import { extractTextFromPDF as extractPDFText } from './pdfService.js';

// Configuration constants
const CONFIG = {
  DELAYS: {
    BETWEEN_CALLS: 1000,
    RETRY_DELAY: 2000
  },
  TOKENS: {
    DEFAULT_MAX: 4000,
    EXTENDED_MAX: 6000
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
  return `Adapt the content to be appropriate for the ${proficiencyLevel} WIDA proficiency level, using research-based ELL best practices.`;
};

const getSubjectAwareInstructions = (subject, proficiencyLevel) => {
  if (SUBJECT_GROUPS.MATH_SCIENCE.includes(subject)) {
    return `
      **CRITICAL SUBJECT RULE: PRESERVE CORE PROBLEMS**
      - For this ${subject} material, you MUST NOT change or alter the core numbers, equations, variables, or logic of the exercises.
      - Your task is to add scaffolding and support **AROUND** the original problems (e.g., simplifying wordy instructions, pre-teaching vocabulary, providing visual aids) but the problems themselves must remain unchanged to ensure the teacher's answer key remains valid.
    `;
  }

  if (SUBJECT_GROUPS.ELA_SOCIAL.includes(subject)) {
    if (['bridging', 'reaching'].includes(proficiencyLevel.toLowerCase())) {
      return `
        **CRITICAL SUBJECT RULE: PRESERVE AUTHOR'S VOICE**
        - For this high-level ELA/Social Studies material, prioritize preserving the original author's tone and voice.
        - Do not oversimplify. Focus on defining high-level academic or figurative language and clarifying only the most complex sentence structures. The student must engage with the text in a near-native form.
      `;
    }
    return `
      **CRITICAL SUBJECT RULE: SIMPLIFY AND REPHRASE**
      - For this ${subject} material, your primary task is to simplify and rephrase complex reading passages to make them more accessible.
      - Chunk the text into smaller paragraphs and adapt analytical questions with appropriate scaffolds.
    `;
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

const createStudentAndDescriptorsPrompt = (details) => {
  const { materialType, subject, gradeLevel, proficiencyLevel, learningObjectives, contentToAdapt, bilingualInstructions, proficiencyAdaptations, subjectAwareInstructions, iepInstructions } = details;
  return `You are an expert ELL curriculum adapter. Your task is to generate two distinct pieces of text, separated by the exact delimiter: ${CONFIG.DELIMITERS.SPLIT_MARKER}

  **PART 1: STUDENT WORKSHEET**
  Generate a complete student worksheet formatted in simple GitHub Flavored Markdown.
  - Structure: Title, Background Knowledge, Key Vocabulary, Pre-Reading Activity, Reading Text, Comprehension Activities.
  - Apply all subject-aware rules, IEP accommodations, and bilingual supports as instructed.
  - **CRUCIAL:** You MUST write out all practice problems. Do NOT summarize or use phrases like "[Continue in same format]". You must generate the complete, usable worksheet.

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

/**
 * Adapt material using Claude API with a multi-call strategy
 */
export const adaptMaterialWithClaude = async (params, setProcessingStep) => {
  try {
    // Validate input parameters
    validateAdaptationParams(params);
    
    const { subject, proficiencyLevel, materialType, includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates, worksheetLength, addStudentChecklist, useMultipleChoice } = params;

    setProcessingStep?.('Preparing adaptation instructions...');

    const subjectAwareInstructions = getSubjectAwareInstructions(subject, proficiencyLevel);
    const proficiencyAdaptations = getProficiencyAdaptations(proficiencyLevel);
    const bilingualInstructions = buildBilingualInstructions({
      includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates
    });
    const iepInstructions = getIepAccommodationInstructions({
      worksheetLength, addStudentChecklist, useMultipleChoice
    });
    
    const promptDetails = { ...params, subjectAwareInstructions, proficiencyAdaptations, bilingualInstructions, iepInstructions };
    
    // STEP 1: Get the Student Worksheet and Descriptors together
    setProcessingStep?.('Generating student worksheet and descriptors...');
    console.log("Step 1: Requesting Student Worksheet & Descriptors...");
    
    const initialPrompt = createStudentAndDescriptorsPrompt(promptDetails);
    const initialResult = await callClaudeAPIWithRetry([{ role: 'user', content: initialPrompt }]);
    
    const initialParts = validateSplitResponse(
      initialResult.content[0].text.split(CONFIG.DELIMITERS.SPLIT_MARKER),
      2
    );
    
    const studentWorksheet = initialParts[0];
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
    const guideResult = await callClaudeAPIWithRetry([{ role: 'user', content: guidePrompt }]);
    const teacherGuide = guideResult.content[0].text;
    
    console.log("Step 2: Teacher's Guide received.");

    // STEP 3: Generate Image Prompts (NEW!)
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
      imagePrompts, // NEW!
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
