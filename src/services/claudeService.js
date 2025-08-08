// FileName: src/services/claudeService.js (COMPLETE FINAL VERSION)

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

// WIDA-ALIGNED OBJECTIVE EXTRACTION FUNCTIONS
const extractContentObjectives = (originalContent, subject, contentAnalysis) => {
  const objectives = [];
  
  // Look for existing objectives in the original content
  const objectivePatterns = [
    /students will be able to (.*?)(?:\.|;|$)/gi,
    /objective[s]?:\s*(.*?)(?:\n|$)/gi,
    /learning goal[s]?:\s*(.*?)(?:\n|$)/gi,
    /(?:learners|students) will (.*?)(?:\.|;|$)/gi
  ];
  
  // Extract any existing objectives
  objectivePatterns.forEach(pattern => {
    const matches = originalContent.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10) {
        objectives.push(match[1].trim());
      }
    }
  });
  
  // If no objectives found, generate based on subject AND content type
  if (objectives.length === 0) {
    const subjectLower = subject.toLowerCase();
    
    // Science objectives
    if (subjectLower.includes('science') || subjectLower.includes('biology') || 
        subjectLower.includes('chemistry') || subjectLower.includes('physics')) {
      objectives.push('investigate scientific phenomena through observation and analysis');
      objectives.push('explain scientific concepts using evidence and reasoning');
      if (contentAnalysis.measurements > 0) {
        objectives.push('collect and interpret data using appropriate tools and units');
      }
    }
    
    // Social Studies/History objectives
    else if (subjectLower.includes('history') || subjectLower.includes('social studies') || 
             subjectLower.includes('geography') || subjectLower.includes('government')) {
      objectives.push('analyze historical events and their causes and effects');
      objectives.push('evaluate primary and secondary sources for relevance and reliability');
      if (contentAnalysis.dates > 0) {
        objectives.push('sequence events chronologically and explain their relationships');
      }
    }
    
    // Mathematics objectives
    else if (subjectLower.includes('math') || subjectLower.includes('algebra') || 
             subjectLower.includes('geometry') || contentAnalysis.hasMath) {
      objectives.push('solve mathematical problems using grade-appropriate strategies');
      objectives.push('explain mathematical reasoning using appropriate vocabulary');
      if (contentAnalysis.hasCoordinates) {
        objectives.push('represent mathematical relationships graphically');
      }
    }
    
    // Language Arts objectives
    else if (subjectLower.includes('english') || subjectLower.includes('language arts') || 
             subjectLower.includes('literature') || subjectLower.includes('writing')) {
      objectives.push('analyze text structure and author\'s purpose');
      objectives.push('cite textual evidence to support analysis');
      if (contentAnalysis.contentType === 'reading_comprehension') {
        objectives.push('determine central ideas and supporting details');
      }
    }
    
    // World Languages objectives
    else if (subjectLower.includes('spanish') || subjectLower.includes('french') || 
             subjectLower.includes('chinese') || subjectLower.includes('language')) {
      objectives.push('communicate ideas in the target language');
      objectives.push('compare linguistic structures between languages');
      objectives.push('interpret cultural practices and perspectives');
    }
    
    // Arts objectives
    else if (subjectLower.includes('art') || subjectLower.includes('music') || 
             subjectLower.includes('drama') || subjectLower.includes('dance')) {
      objectives.push('create artistic works using appropriate techniques and tools');
      objectives.push('analyze and interpret artistic expressions');
      objectives.push('evaluate artistic choices and their effects');
    }
    
    // Technology/Computer Science objectives
    else if (subjectLower.includes('technology') || subjectLower.includes('computer')) {
      objectives.push('apply computational thinking to solve problems');
      objectives.push('create digital artifacts using appropriate tools');
      objectives.push('evaluate technology\'s impact on society');
    }
    
    // Health/PE objectives
    else if (subjectLower.includes('health') || subjectLower.includes('physical education')) {
      objectives.push('demonstrate understanding of health concepts and practices');
      objectives.push('analyze factors that influence health decisions');
      objectives.push('apply strategies for maintaining personal wellness');
    }
    
    // Generic fallback
    else {
      objectives.push(`demonstrate understanding of ${subject.toLowerCase()} concepts`);
      objectives.push(`apply ${subject.toLowerCase()} knowledge to new situations`);
      objectives.push(`communicate ${subject.toLowerCase()} ideas effectively`);
    }
  }
  
  return objectives.slice(0, 3); // Limit to 3 main content objectives
};

const determineWIDAStandards = (subject) => {
  const subjectLower = subject.toLowerCase();
  const standards = ['ELD-SI: Language for Social and Instructional Purposes'];
  
  // Check for each standard area
  if (subjectLower.includes('math') || subjectLower.includes('algebra') || 
      subjectLower.includes('geometry') || subjectLower.includes('calculus')) {
    standards.push('ELD-MA: Language for Mathematics');
  }
  
  if (subjectLower.includes('science') || subjectLower.includes('biology') || 
      subjectLower.includes('chemistry') || subjectLower.includes('physics')) {
    standards.push('ELD-SC: Language for Science');
  }
  
  if (subjectLower.includes('english') || subjectLower.includes('language arts') || 
      subjectLower.includes('literature') || subjectLower.includes('writing')) {
    standards.push('ELD-LA: Language for Language Arts');
  }
  
  if (subjectLower.includes('history') || subjectLower.includes('social studies') || 
      subjectLower.includes('geography') || subjectLower.includes('government') || 
      subjectLower.includes('economics')) {
    standards.push('ELD-SS: Language for Social Studies');
  }
  
  // If no specific standard matched, determine based on subject groups
  if (standards.length === 1) {
    for (const [group, subjects] of Object.entries(SUBJECT_GROUPS)) {
      if (subjects.some(s => subjectLower.includes(s.toLowerCase()))) {
        if (group === 'MATH_SCIENCE') {
          standards.push('ELD-MA: Language for Mathematics', 'ELD-SC: Language for Science');
        } else if (group === 'ELA_SOCIAL') {
          standards.push('ELD-LA: Language for Language Arts', 'ELD-SS: Language for Social Studies');
        }
        break;
      }
    }
  }
  
  return [...new Set(standards)]; // Remove duplicates
};

const determinePrimaryLanguageFunction = (contentAnalysis, subject) => {
  const subjectLower = subject.toLowerCase();
  const contentLower = contentAnalysis.originalContent || '';
  
  // WIDA Key Language Uses (KLUs)
  
  // NARRATE - for sequencing, recounting, storytelling
  if (subjectLower.includes('history') || 
      contentLower.includes('story') || 
      contentLower.includes('sequence') ||
      contentLower.includes('first') && contentLower.includes('then') ||
      contentLower.includes('timeline')) {
    return 'Narrate';
  }
  
  // EXPLAIN - for how/why, processes, cause-effect
  if (subjectLower.includes('science') || 
      subjectLower.includes('math') ||
      contentLower.includes('why') ||
      contentLower.includes('how') ||
      contentLower.includes('because') ||
      contentLower.includes('cause') ||
      contentLower.includes('effect') ||
      contentAnalysis.hasMath) {
    return 'Explain';
  }
  
  // ARGUE - for claims, evidence, persuasion
  if (contentLower.includes('claim') ||
      contentLower.includes('evidence') ||
      contentLower.includes('argue') ||
      contentLower.includes('persuade') ||
      contentLower.includes('opinion') ||
      contentLower.includes('should') ||
      contentLower.includes('must') ||
      contentAnalysis.openEnded > 5) {
    return 'Argue';
  }
  
  // INFORM - for describing, comparing, classifying
  // This is the default/most common KLU
  return 'Inform';
};

const createWIDALanguageObjectives = (contentObjectives, proficiencyLevel, contentAnalysis, subject) => {
  const subjectLower = subject.toLowerCase();
  const languageObjectives = [];
  
  // Determine the primary KLU (Key Language Use)
  const primaryKLU = determinePrimaryLanguageFunction(contentAnalysis, subject);
  
  // Map proficiency levels
  const levelMap = {
    'entering': 1, 'level 1': 1,
    'emerging': 2, 'level 2': 2,
    'developing': 3, 'level 3': 3,
    'expanding': 4, 'level 4': 4,
    'bridging': 5, 'level 5': 5,
    'reaching': 6, 'level 6': 6
  };
  
  const level = levelMap[proficiencyLevel.toLowerCase()] || 3;
  
  // Generate KLU-aligned objectives based on level
  switch(level) {
    case 1: // Entering
      if (primaryKLU === 'Narrate') {
        languageObjectives.push('sequence events using visual supports and time words (first, next)');
      } else if (primaryKLU === 'Explain') {
        languageObjectives.push('show how/why using gestures, drawings, and single words');
      } else if (primaryKLU === 'Argue') {
        languageObjectives.push('express preferences using yes/no and choice cards');
      } else { // Inform
        languageObjectives.push('label and point to identify information using word banks');
      }
      
      // Add general language objectives for level 1
      languageObjectives.push(
        `match ${subject} vocabulary to visuals and realia`,
        `respond to ${subject} questions using gestures, words, or phrases`,
        `follow one-step directions with visual support`
      );
      break;
      
    case 2: // Emerging
      if (primaryKLU === 'Narrate') {
        languageObjectives.push('recount events using short sentences and sequence words');
      } else if (primaryKLU === 'Explain') {
        languageObjectives.push('describe how/why using phrases and simple sentences with because');
      } else if (primaryKLU === 'Argue') {
        languageObjectives.push('state opinions using sentence frames (I think... because...)');
      } else { // Inform
        languageObjectives.push('describe information using adjectives and simple sentences');
      }
      
      languageObjectives.push(
        `ask and answer ${subject} questions using general vocabulary`,
        `produce lists and short responses using graphic organizers`
      );
      break;
      
    case 3: // Developing
      if (primaryKLU === 'Narrate') {
        languageObjectives.push('tell stories with clear beginning, middle, and end using transition words');
      } else if (primaryKLU === 'Explain') {
        languageObjectives.push('explain processes using sequence words and cause-effect language');
      } else if (primaryKLU === 'Argue') {
        languageObjectives.push('support opinions with reasons using compound sentences');
      } else { // Inform
        languageObjectives.push('compare and contrast information using specific vocabulary');
      }
      
      languageObjectives.push(
        `participate in ${subject} discussions using academic vocabulary`,
        `write paragraph-length responses with topic sentences and details`
      );
      break;
      
    case 4: // Expanding
      if (primaryKLU === 'Narrate') {
        languageObjectives.push('produce detailed narratives with dialogue and descriptive language');
      } else if (primaryKLU === 'Explain') {
        languageObjectives.push('interpret and explain complex processes using technical vocabulary');
      } else if (primaryKLU === 'Argue') {
        languageObjectives.push('construct arguments with claims, evidence, and counterarguments');
      } else { // Inform
        languageObjectives.push('synthesize information from multiple sources using cohesive devices');
      }
      
      languageObjectives.push(
        `analyze ${subject} content using complex sentences`,
        `produce multi-paragraph responses with clear organization`
      );
      break;
      
    case 5: // Bridging
    case 6: // Reaching
      if (primaryKLU === 'Narrate') {
        languageObjectives.push('craft sophisticated narratives with nuanced language and literary devices');
      } else if (primaryKLU === 'Explain') {
        languageObjectives.push('evaluate and explain multiple perspectives using precise academic language');
      } else if (primaryKLU === 'Argue') {
        languageObjectives.push('debate complex issues using persuasive techniques and rhetorical devices');
      } else { // Inform
        languageObjectives.push('present comprehensive information using genre-appropriate discourse');
      }
      
      languageObjectives.push(
        `engage in technical ${subject} discussions with minimal support`,
        `produce extended academic writing meeting grade-level expectations`
      );
      break;
  }
  
  return languageObjectives.slice(0, 4); // Return up to 4 language objectives
};

// HELPER FUNCTIONS FOR LANGUAGE FEATURES
const getGrammarFocus = (proficiencyLevel, contentAnalysis) => {
  const levelMap = {
    'entering': 'Simple present tense, basic noun-verb structures',
    'level 1': 'Simple present tense, basic noun-verb structures',
    'emerging': 'Present and simple past tense, regular plurals',
    'level 2': 'Present and simple past tense, regular plurals',
    'developing': 'Multiple tenses, compound sentences, transitions',
    'level 3': 'Multiple tenses, compound sentences, transitions',
    'expanding': 'Complex sentences, passive voice, conditionals',
    'level 4': 'Complex sentences, passive voice, conditionals',
    'bridging': 'Sophisticated structures, subjunctive mood, nuanced tenses',
    'level 5': 'Sophisticated structures, subjunctive mood, nuanced tenses',
    'reaching': 'Full range of grammatical structures',
    'level 6': 'Full range of grammatical structures'
  };
  
  return levelMap[proficiencyLevel.toLowerCase()] || levelMap['developing'];
};

const getDiscourseFeatures = (proficiencyLevel) => {
  const levelMap = {
    'entering': 'Words, phrases, and patterned sentences',
    'level 1': 'Words, phrases, and patterned sentences',
    'emerging': 'Sentences and sentence groups',
    'level 2': 'Sentences and sentence groups',
    'developing': 'Paragraphs with cohesive devices',
    'level 3': 'Paragraphs with cohesive devices',
    'expanding': 'Organized multi-paragraph texts',
    'level 4': 'Organized multi-paragraph texts',
    'bridging': 'Extended cohesive texts with precision',
    'level 5': 'Extended cohesive texts with precision',
    'reaching': 'Genre-appropriate extended discourse',
    'level 6': 'Genre-appropriate extended discourse'
  };
  
  return levelMap[proficiencyLevel.toLowerCase()] || levelMap['developing'];
};

const extractKeyVocabulary = (studentWorksheet) => {
  // Extract bolded vocabulary terms
  const boldTerms = (studentWorksheet.match(/\*\*(.*?)\*\*/g) || [])
    .map(term => term.replace(/\*\*/g, ''))
    .slice(0, 5); // First 5 terms
  
  return boldTerms.length > 0 ? boldTerms.join(', ') : 'See bolded terms in worksheet';
};

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
  
  // Check for placeholder text
  const placeholders = [
    '[Original passage preserved exactly as written]',
    '[Content continues...]',
    '...',
    '[Add more questions here]',
    '[Insert passage here]',
    '[Passage text here]',
    '[Complete the remaining items]',
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
    
    // Remove placeholder brackets
    .replace(/\[Original passage preserved exactly as written\]/g, '')
    .replace(/\[Content continues...\]/g, '')
    .replace(/\[Insert passage here\]/g, '')
    .replace(/\[Passage text here\]/g, '')
    .replace(/\[Complete the remaining items\]/g, '')
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

// Enhanced API call
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

// TWO-STEP STRATEGY FOR LONG CONTENT
const handleLongContentWithTwoSteps = async (params, setProcessingStep, contentAnalysis) => {
  const { subject, proficiencyLevel, addStudentChecklist, includeBilingualSupport, nativeLanguage } = params;
  
  // STEP 1: Generate the structure and questions only
  setProcessingStep?.('Step 1: Generating worksheet structure and questions...');
  
  const adaptations = getUniversalProficiencyAdaptations(proficiencyLevel);
  
  const structurePrompt = `You are an expert ELL curriculum adapter. Generate a complete worksheet structure with questions and activities for ${proficiencyLevel} level students.

**PROFICIENCY LEVEL ADAPTATIONS:**
- Sentence Structure: ${adaptations.sentences}
- Vocabulary: ${adaptations.vocabulary}
- Grammar: ${adaptations.structure}
- Support Provided: ${adaptations.support}

**TASK:** Create the complete worksheet with:
- Title and background
- Key vocabulary section with bolded terms
- ${addStudentChecklist ? 'Content-specific checklist' : ''}
- Pre-reading questions
- Reading comprehension questions (numbered sequentially 1, 2, 3...)
- Activities and extensions
- ${includeBilingualSupport && nativeLanguage ? `Bilingual support in ${nativeLanguage}` : ''}

**CRITICAL:** Where the reading passage should go, write exactly: "{{READING_PASSAGE_PLACEHOLDER}}"

**ORIGINAL CONTENT TO ANALYZE:**
\`\`\`
${params.contentToAdapt}
\`\`\`

Generate the complete worksheet structure but replace the actual passage with {{READING_PASSAGE_PLACEHOLDER}}.
Bold key vocabulary terms throughout. Use print-ready formatting with [ ] for checkboxes.`;

  const structureResult = await callClaudeAPIWithRetry([{ role: 'user', content: structurePrompt }], CONFIG.TOKENS.DEFAULT_MAX);
  const worksheetStructure = structureResult.content[0].text;
  
  // STEP 2: Insert the actual passage
  setProcessingStep?.('Step 2: Inserting the complete reading passage...');
  
  // Extract the original passage from the content - be more aggressive about finding it
  let originalPassage = params.contentToAdapt;
  
  // Try to identify where the passage starts and ends
  const lines = params.contentToAdapt.split('\n');
  let passageLines = [];
  let inPassage = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip obvious headers, questions, or instructions
    if (line.match(/^(questions?|directions?|instructions?|name:|date:|class:|period:)/i)) {
      continue;
    }
    
    // Skip numbered questions
    if (line.match(/^\s*\d+[\.\)]/)) {
      continue;
    }
    
    // Skip lettered items
    if (line.match(/^\s*[a-z][\.\)]/i)) {
      continue;
    }
    
    // If it's a substantial line (more than a few words), it's likely part of the passage
    if (line.length > 20 && !line.includes('?')) {
      passageLines.push(line);
      inPassage = true;
    } else if (inPassage && line.length > 10) {
      passageLines.push(line);
    }
  }
  
  // If we found passage lines, use them; otherwise use the whole content
  if (passageLines.length > 0) {
    originalPassage = passageLines.join('\n\n');
  }
  
  // Replace placeholder with actual passage
  const finalWorksheet = worksheetStructure.replace('{{READING_PASSAGE_PLACEHOLDER}}', `## Reading Passage\n\n${originalPassage}`);
  
  // Generate WIDA-aligned descriptors for long content
const contentObjectives = extractContentObjectives(
  params.contentToAdapt,
  subject,
  contentAnalysis
);

const languageObjectives = createWIDALanguageObjectives(
  contentObjectives,
  proficiencyLevel,
  contentAnalysis,
  subject
);

const descriptors = {
  title: `${subject} - ${proficiencyLevel} Level Reading Comprehension`,
  contentObjectives: contentObjectives,
  languageObjectives: languageObjectives,
  widaStandards: determineWIDAStandards(subject),
  descriptors: [
    ...contentObjectives.map(obj => `Students can ${obj}`),
    ...languageObjectives.slice(0, 2)
  ]
};
  
  return {
    studentWorksheet: finalWorksheet,
    dynamicWidaDescriptors: descriptors,
    method: 'two_step_long_content'
  };
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

  let instructions = `\n\n**BILINGUAL SUPPORT REQUIREMENTS (Language: ${nativeLanguage}):**\n`;

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
  let instructions = `\n\n**IEP ACCOMMODATION REQUIREMENTS:**\n`;
  
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

// Teacher guide creation with WIDA alignment
const createUniversalTeacherGuide = async (studentWorksheet, params, contentAnalysis) => {
  const { subject, proficiencyLevel } = params;
  const adaptations = getUniversalProficiencyAdaptations(proficiencyLevel);
  
  // Extract or generate content objectives
  const contentObjectives = extractContentObjectives(
    params.contentToAdapt, 
    subject, 
    contentAnalysis
  );
  
  // Create aligned language objectives
  const languageObjectives = createWIDALanguageObjectives(
    contentObjectives,
    proficiencyLevel,
    contentAnalysis,
    subject
  );
  
  // Determine applicable WIDA ELD Standards
  const widaStandards = determineWIDAStandards(subject);
  
  // Determine primary language function
  const primaryFunction = determinePrimaryLanguageFunction(contentAnalysis, subject);
  
  return `# Teacher's Guide: ${subject} - ${proficiencyLevel} Level

## WIDA ELD Standards Addressed
${widaStandards.map(std => `- ${std}`).join('\n')}

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
${contentObjectives.map(obj => `- ${obj}`).join('\n')}

## Language Objectives (${proficiencyLevel} Level)
Students will be able to:
${languageObjectives.map(obj => `- ${obj}`).join('\n')}

## Language Focus
- **Primary Language Function:** ${primaryFunction}
- **Key Language Features:** ${adaptations.vocabulary}
- **Sentence Structures:** ${adaptations.sentences}
- **Discourse Level:** ${adaptations.structure}

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
      estimatedInputTokens: Math.round(params.contentToAdapt.length / 4)
    });

    // Determine token allocation early
    const maxTokens = contentAnalysis.complexity.needsExtendedTokens ? CONFIG.TOKENS.EXTENDED_MAX : CONFIG.TOKENS.DEFAULT_MAX;
    console.log(`Token allocation: ${maxTokens} tokens for this adaptation`);

    // Check if we need special handling for long content
    const estimatedOutputLength = params.contentToAdapt.length * 1.5;
    const isLongContent = estimatedOutputLength > 2500 || contentAnalysis.wordCount > 800;
    
    if (isLongContent && contentAnalysis.contentType === 'reading_comprehension') {
      console.log('Using two-step strategy for long reading content');
      const twoStepResult = await handleLongContentWithTwoSteps(params, setProcessingStep, contentAnalysis);
      
      // Generate teacher guide
      setProcessingStep?.('Generating teacher guide...');
      const teacherGuide = await createUniversalTeacherGuide(twoStepResult.studentWorksheet, params, contentAnalysis);
      
      // Final validation
      const finalValidation = validatePrintReadiness(twoStepResult.studentWorksheet);
      const vocabValidation = validateVocabularyIntegration(twoStepResult.studentWorksheet);
      
      return {
        studentWorksheet: twoStepResult.studentWorksheet,
        teacherGuide,
        dynamicWidaDescriptors: twoStepResult.dynamicWidaDescriptors,
        imagePrompts: null,
        vocabularyValidation: vocabValidation,
        printReadinessValidation: finalValidation,
        contentAnalysis: {
          inputAnalysis: contentAnalysis,
          processingMethod: 'two_step_long_content',
          isLongContent: true,
          tokensUsed: CONFIG.TOKENS.DEFAULT_MAX
        }
      };
    }
    
    // Standard processing for manageable content
    console.log('Using standard universal processing');

    setProcessingStep?.('Preparing universal adaptation instructions...');

    // Build instruction components
    const bilingualInstructions = buildBilingualInstructions({
      includeBilingualSupport, nativeLanguage, translateSummary, translateInstructions, listCognates
    });
    const iepInstructions = getIepAccommodationInstructions({
      worksheetLength, addStudentChecklist, useMultipleChoice
    });
    
    const adaptations = getUniversalProficiencyAdaptations(proficiencyLevel);
    
    // Create simplified prompt for standard content
    const mainPrompt = `You are an expert ELL curriculum adapter. Generate a complete student worksheet for ${proficiencyLevel} level students.

**PROFICIENCY LEVEL ADAPTATIONS:**
- Sentence Structure: ${adaptations.sentences}
- Vocabulary: ${adaptations.vocabulary}
- Support Provided: ${adaptations.support}

**CRITICAL RULES:**
- Include EVERY word of any reading passages
- Number questions sequentially (1. 2. 3. etc.)
- Bold key vocabulary terms
- Use [ ] for checkboxes
- NO placeholder text or abbreviations

**SUBJECT:** ${subject}
**MATERIAL TYPE:** ${materialType}

${bilingualInstructions}
${iepInstructions}

**ORIGINAL CONTENT:**
\`\`\`
${params.contentToAdapt}
\`\`\`

Generate a complete, print-ready worksheet with all content preserved exactly.`;
    
    // STEP 1: Generate Student Worksheet
    setProcessingStep?.('Generating adapted worksheet...');
    
    let studentWorksheet;
    let attempts = 0;
    const maxRetries = 3;
    
    while (attempts < maxRetries) {
      attempts++;
      setProcessingStep?.(`Generating worksheet (attempt ${attempts}/${maxRetries})...`);
      
      try {
        const mainResult = await callClaudeAPIWithRetry([{ role: 'user', content: mainPrompt }], maxTokens);
        const candidateWorksheet = mainResult.content[0].text;
        
        // Check for placeholders immediately
        const placeholderCheck = validatePrintReadiness(candidateWorksheet);
        const hasPlaceholders = placeholderCheck.issues.some(issue => 
          issue.includes('placeholder') || issue.includes('missing')
        );
        
        if (!hasPlaceholders) {
          // Success! No placeholders found
          studentWorksheet = candidateWorksheet;
          break;
        } else {
          console.warn(`Attempt ${attempts}: Placeholders detected:`, placeholderCheck.issues);
          
          if (attempts === maxRetries) {
            // Last attempt - apply fixes and use it
            console.warn('Max retries reached, applying automatic fixes');
            studentWorksheet = fixCommonFormattingIssues(candidateWorksheet);
            break;
          } else {
            // Wait before retry
            await delay(CONFIG.DELAYS.RETRY_DELAY);
          }
        }
      } catch (error) {
        if (attempts === maxRetries) {
          throw error;
        }
        console.warn(`Attempt ${attempts} failed:`, error.message);
        await delay(CONFIG.DELAYS.RETRY_DELAY);
      }
    }
    
    // Generate dynamic WIDA-aligned descriptors
const contentObjectives = extractContentObjectives(
  params.contentToAdapt,
  subject,
  contentAnalysis
);

const languageObjectives = createWIDALanguageObjectives(
  contentObjectives,
  proficiencyLevel,
  contentAnalysis,
  subject
);

const dynamicWidaDescriptors = {
  title: `${subject} - ${proficiencyLevel} Level`,
  contentObjectives: contentObjectives,
  languageObjectives: languageObjectives,
  widaStandards: determineWIDAStandards(subject),
  descriptors: [
    ...contentObjectives.map(obj => `Students can ${obj}`),
    ...languageObjectives.slice(0, 2) // Include first 2 language objectives as descriptors
  ]
};
    
    // Validate output completeness
    const outputAnalysis = analyzeContentStructure(studentWorksheet);
    console.log('Output analysis:', {
      inputItems: contentAnalysis.totalItems,
      outputItems: outputAnalysis.totalItems,
      preservation: Math.round((outputAnalysis.totalItems / Math.max(contentAnalysis.totalItems, 1)) * 100) + '%'
    });
    
    console.log("Step 1: Student worksheet completed");

    // Wait between API calls
    await delay(CONFIG.DELAYS.BETWEEN_CALLS);

    // STEP 2: Generate Teacher Guide
    setProcessingStep?.('Generating teacher guide...');
    console.log("Step 2: Creating teacher guide");
    
    const teacherGuide = await createUniversalTeacherGuide(studentWorksheet, params, contentAnalysis);
    console.log("Step 2: Teacher guide completed");

    // STEP 3: Validate
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
      imagePrompts: null,
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
