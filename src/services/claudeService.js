// FileName: src/services/claudeService.js (VERCEL-COMPATIBLE VERSION)

import { extractTextFromPDF as extractPDFText } from './pdfService.js';

// =====================================================
// CONFIGURATION & CONSTANTS
// =====================================================

const CONFIG = {
  DELAYS: {
    BETWEEN_CALLS: 1200,
    RETRY_DELAY: 2500,
    PROCESSING_DELAY: 500
  },
  TOKENS: {
    DEFAULT_MAX: 4096,
    EXTENDED_MAX: 8192,
    CHUNK_MAX: 3500,
    INPUT_LIMIT: 150000
  },
  API: {
    MAX_RETRIES: 3,
    TIMEOUT: 45000,
    RATE_LIMIT_DELAY: 5000
  },
  VALIDATION: {
    MIN_CONTENT_LENGTH: 50,
    MAX_CONTENT_LENGTH: 500000,
    MAX_VOCABULARY_TERMS: 15
  }
};

const SUBJECT_GROUPS = {
  STEM: {
    subjects: ['Mathematics', 'Algebra', 'Geometry', 'Calculus', 'Statistics', 'Science', 'Chemistry', 'Physics', 'Biology', 'Computer Science'],
    primaryKLU: 'Explain',
    contentFocus: 'problem-solving and scientific reasoning'
  },
  HUMANITIES: {
    subjects: ['English Language Arts', 'History', 'Social Studies', 'Literature', 'Writing', 'Reading', 'Geography', 'Government', 'Economics'],
    primaryKLU: 'Inform',
    contentFocus: 'analysis and interpretation'
  },
  LANGUAGE: {
    subjects: ['Spanish', 'French', 'German', 'Italian', 'Chinese', 'Japanese', 'Latin', 'World Languages'],
    primaryKLU: 'Narrate',
    contentFocus: 'communication and cultural understanding'
  },
  ARTS: {
    subjects: ['Art', 'Music', 'Drama', 'Dance', 'Visual Arts', 'Performing Arts'],
    primaryKLU: 'Argue',
    contentFocus: 'creative expression and critique'
  },
  APPLIED: {
    subjects: ['Health', 'Physical Education', 'Technology', 'Career Education', 'Life Skills'],
    primaryKLU: 'Explain',
    contentFocus: 'practical application'
  }
};

const WIDA_LEVELS = {
  'entering': { level: 1, label: 'Entering (Level 1)' },
  'level 1': { level: 1, label: 'Entering (Level 1)' },
  'emerging': { level: 2, label: 'Emerging (Level 2)' },
  'level 2': { level: 2, label: 'Emerging (Level 2)' },
  'developing': { level: 3, label: 'Developing (Level 3)' },
  'level 3': { level: 3, label: 'Developing (Level 3)' },
  'expanding': { level: 4, label: 'Expanding (Level 4)' },
  'level 4': { level: 4, label: 'Expanding (Level 4)' },
  'bridging': { level: 5, label: 'Bridging (Level 5)' },
  'level 5': { level: 5, label: 'Bridging (Level 5)' },
  'reaching': { level: 6, label: 'Reaching (Level 6)' },
  'level 6': { level: 6, label: 'Reaching (Level 6)' }
};

// =====================================================
// ERROR HANDLING
// =====================================================

class ClaudeAPIError extends Error {
  constructor(message, status = null, details = null, isRetryable = false) {
    super(message);
    this.name = 'ClaudeAPIError';
    this.status = status;
    this.details = details;
    this.isRetryable = isRetryable;
    this.timestamp = new Date().toISOString();
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const validateInput = (params) => {
  const errors = [];
  
  if (!params.contentToAdapt || typeof params.contentToAdapt !== 'string') {
    errors.push('Content to adapt is required and must be a string');
  } else if (params.contentToAdapt.length < CONFIG.VALIDATION.MIN_CONTENT_LENGTH) {
    errors.push(`Content too short (minimum ${CONFIG.VALIDATION.MIN_CONTENT_LENGTH} characters)`);
  } else if (params.contentToAdapt.length > CONFIG.VALIDATION.MAX_CONTENT_LENGTH) {
    errors.push(`Content too long (maximum ${CONFIG.VALIDATION.MAX_CONTENT_LENGTH} characters)`);
  }
  
  if (!params.subject) errors.push('Subject is required');
  if (!params.proficiencyLevel) errors.push('Proficiency level is required');
  if (!WIDA_LEVELS[params.proficiencyLevel.toLowerCase()]) {
    errors.push('Invalid proficiency level');
  }
  
  if (params.includeBilingualSupport && !params.nativeLanguage) {
    errors.push('Native language is required when bilingual support is enabled');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const sanitizeContent = (content) => {
  if (typeof content !== 'string') return content;
  
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[^\x00-\x7F]/g, (char) => {
      const keepChars = ['é', 'ñ', 'ü', 'ç', 'à', 'è', 'ì', 'ò', 'ù', '°', '²', '³', '½', '¼', '¾'];
      return keepChars.includes(char) ? char : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
};

// =====================================================
// CONTENT ANALYSIS
// =====================================================

const analyzeContentStructure = (content) => {
  const analysis = {
    wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
    characterCount: content.length,
    lineCount: content.split('\n').length,
    paragraphCount: content.split(/\n\s*\n/).filter(p => p.trim()).length,
    
    numberedItems: (content.match(/^\s*\d+[\.\)]/gm) || []).length,
    letterItems: (content.match(/^\s*[a-z][\.\)]/gim) || []).length,
    bulletPoints: (content.match(/^\s*[-•*]/gm) || []).length,
    
    fillInBlanks: (content.match(/_{3,}|\(\s*\)|\[\s*\]/g) || []).length,
    multipleChoice: (content.match(/^\s*[A-D][\.\)]/gm) || []).length,
    openEndedQuestions: (content.match(/\?/g) || []).length,
    
    hasMath: /[\d\+\-\*\/\=\<\>\(\)\[\]]/g.test(content),
    hasEquations: /[a-zA-Z]\s*=|=\s*[a-zA-Z]|\^|\√|∫|∑/g.test(content),
    hasCoordinates: /\(\s*[\d\-]+\s*,\s*[\d\-]+\s*\)/g.test(content),
    hasFormulas: /[a-zA-Z]\d+|[A-Z]{2,}/g.test(content),
    
    hasReadingPassage: /read|passage|text|story|article/i.test(content),
    hasDialogue: /"[^"]*"/g.test(content),
    
    hasInstructions: /directions?|instructions?/i.test(content),
    hasRubric: /rubric|criteria|points/i.test(content),
    
    measurements: (content.match(/\d+\s*(cm|mm|m|km|in|ft|yd|mi|g|kg|lb|oz|ml|l|gal|°C|°F)/gi) || []).length,
    percentages: (content.match(/\d+%/g) || []).length,
    dates: (content.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/gi) || []).length,
    
    boldedTerms: (content.match(/\*\*(.*?)\*\*/g) || []).length,
    definitionPattern: /:\s*[A-Z]/g.test(content)
  };
  
  analysis.totalItems = analysis.numberedItems + analysis.letterItems + analysis.bulletPoints;
  analysis.totalQuestions = analysis.openEndedQuestions + analysis.multipleChoice;
  analysis.complexity = calculateComplexity(analysis);
  analysis.contentType = determineContentType(analysis, content);
  analysis.estimatedReadingLevel = estimateReadingLevel(analysis);
  
  return analysis;
};

const calculateComplexity = (analysis) => {
  const complexityScore = 
    (analysis.wordCount / 100) * 1.0 +
    (analysis.totalItems * 2.0) +
    (analysis.openEndedQuestions * 1.5) +
    (analysis.paragraphCount * 0.8) +
    (analysis.hasMath ? 5 : 0) +
    (analysis.hasEquations ? 8 : 0) +
    (analysis.hasReadingPassage ? 10 : 0);
  
  return {
    score: Math.round(complexityScore * 10) / 10,
    level: complexityScore < 15 ? 'simple' : complexityScore < 40 ? 'moderate' : 'complex',
    needsChunking: complexityScore > 60 || analysis.totalItems > 20 || analysis.wordCount > 2500,
    needsExtendedTokens: complexityScore > 30 || analysis.wordCount > 1200,
    processingTime: Math.max(30, Math.min(120, complexityScore * 2))
  };
};

const determineContentType = (analysis, content) => {
  const lowerContent = content.toLowerCase();
  
  if (analysis.hasMath && (analysis.hasEquations || analysis.hasFormulas)) {
    return 'advanced_mathematics';
  } else if (analysis.hasMath || analysis.hasCoordinates) {
    return 'mathematics';
  } else if (lowerContent.includes('read') && analysis.hasReadingPassage && analysis.paragraphCount > 3) {
    return 'reading_comprehension';
  } else if (analysis.multipleChoice > analysis.openEndedQuestions && analysis.multipleChoice > 3) {
    return 'multiple_choice_assessment';
  } else if (analysis.fillInBlanks > 5) {
    return 'fill_in_blank_worksheet';
  } else if (analysis.totalQuestions > analysis.totalItems && analysis.openEndedQuestions > 3) {
    return 'discussion_questions';
  } else if (analysis.paragraphCount > analysis.totalItems && analysis.paragraphCount > 2) {
    return 'text_analysis';
  } else if (analysis.totalItems > analysis.paragraphCount && analysis.totalItems > 5) {
    return 'structured_worksheet';
  } else if (lowerContent.includes('lab') || lowerContent.includes('experiment')) {
    return 'lab_procedure';
  } else {
    return 'mixed_content';
  }
};

const estimateReadingLevel = (analysis) => {
  const avgWordsPerSentence = analysis.wordCount / Math.max(analysis.openEndedQuestions + analysis.paragraphCount, 1);
  
  if (avgWordsPerSentence < 8) return 'elementary';
  if (avgWordsPerSentence < 15) return 'middle_school';
  if (avgWordsPerSentence < 25) return 'high_school';
  return 'college_level';
};

// =====================================================
// WIDA ALIGNMENT FUNCTIONS
// =====================================================

const getSubjectGroup = (subject) => {
  for (const [groupName, groupData] of Object.entries(SUBJECT_GROUPS)) {
    if (groupData.subjects.some(s => subject.toLowerCase().includes(s.toLowerCase()))) {
      return { name: groupName, ...groupData };
    }
  }
  return SUBJECT_GROUPS.APPLIED;
};

const extractContentObjectives = (originalContent, subject, contentAnalysis) => {
  const objectives = [];
  
  const objectivePatterns = [
    /(?:students will be able to|learners will|objective[s]?:|learning goal[s]?:|students will)\s*([^.!?]+)/gi
  ];
  
  objectivePatterns.forEach(pattern => {
    const matches = originalContent.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].trim().length > 15) {
        objectives.push(match[1].trim().toLowerCase().replace(/^to\s+/, ''));
      }
    }
  });
  
  if (objectives.length === 0) {
    const subjectGroup = getSubjectGroup(subject);
    objectives.push(...generateSubjectObjectives(subject, subjectGroup, contentAnalysis));
  }
  
  return objectives.slice(0, 4);
};

const generateSubjectObjectives = (subject, subjectGroup, contentAnalysis) => {
  const objectives = [];
  const subjectLower = subject.toLowerCase();
  
  switch (subjectGroup.name) {
    case 'STEM':
      objectives.push(`solve ${subjectLower} problems using appropriate strategies and tools`);
      objectives.push(`explain ${subjectLower} concepts using evidence and logical reasoning`);
      if (contentAnalysis.hasMath) {
        objectives.push('justify mathematical solutions with clear explanations');
      }
      if (contentAnalysis.measurements > 0) {
        objectives.push('collect and analyze data using appropriate units and measurements');
      }
      break;
      
    case 'HUMANITIES':
      objectives.push(`analyze ${subjectLower} content for main ideas and supporting details`);
      objectives.push('evaluate sources for credibility and relevance');
      if (contentAnalysis.hasReadingPassage) {
        objectives.push('cite textual evidence to support analysis and interpretation');
      }
      if (contentAnalysis.dates > 0) {
        objectives.push('sequence events and explain cause-and-effect relationships');
      }
      break;
      
    case 'LANGUAGE':
      objectives.push('communicate ideas effectively in the target language');
      objectives.push('compare linguistic and cultural patterns across languages');
      objectives.push('interpret authentic materials in cultural context');
      break;
      
    case 'ARTS':
      objectives.push('create artistic works using appropriate techniques and media');
      objectives.push('analyze artistic choices and their effects on meaning');
      objectives.push('evaluate artistic expressions using established criteria');
      break;
      
    default:
      objectives.push(`apply ${subjectLower} knowledge to real-world situations`);
      objectives.push(`demonstrate understanding of ${subjectLower} concepts and practices`);
      objectives.push('make informed decisions based on evidence and analysis');
  }
  
  return objectives;
};

const createLanguageObjectives = (contentObjectives, proficiencyLevel, contentAnalysis, subject) => {
  const level = WIDA_LEVELS[proficiencyLevel.toLowerCase()]?.level || 3;
  const subjectGroup = getSubjectGroup(subject);
  const primaryKLU = determinePrimaryKLU(contentAnalysis, subjectGroup);
  
  const objectives = [];
  
  objectives.push(getKLUObjective(primaryKLU, level));
  
  switch (level) {
    case 1:
      objectives.push(`match ${subject.toLowerCase()} vocabulary to visual representations`);
      objectives.push('respond to questions using single words, phrases, or gestures');
      objectives.push('follow simple one-step directions with visual support');
      break;
      
    case 2:
      objectives.push(`use basic ${subject.toLowerCase()} vocabulary in short sentences`);
      objectives.push('ask and answer simple questions using sentence frames');
      objectives.push('produce brief written responses with graphic organizer support');
      break;
      
    case 3:
      objectives.push(`participate in ${subject.toLowerCase()} discussions using academic vocabulary`);
      objectives.push('write paragraph-length responses with topic sentences and details');
      objectives.push('explain reasoning using connecting words and phrases');
      break;
      
    case 4:
      objectives.push(`analyze ${subject.toLowerCase()} content using complex sentence structures`);
      objectives.push('produce multi-paragraph responses with clear organization');
      objectives.push('engage in academic debates with minimal scaffolding');
      break;
      
    case 5:
    case 6:
      objectives.push(`demonstrate grade-level academic discourse in ${subject.toLowerCase()}`);
      objectives.push('produce extended written work meeting grade-level expectations');
      objectives.push('evaluate and synthesize information from multiple sources');
      break;
  }
  
  return objectives.slice(0, 4);
};

const determinePrimaryKLU = (contentAnalysis, subjectGroup) => {
  if (contentAnalysis.hasReadingPassage && contentAnalysis.openEndedQuestions > 3) {
    return 'Argue';
  } else if (contentAnalysis.hasMath || subjectGroup.name === 'STEM') {
    return 'Explain';
  } else if (contentAnalysis.dates > 0 || contentAnalysis.hasDialogue) {
    return 'Narrate';
  } else {
    return 'Inform';
  }
};

const getKLUObjective = (klu, level) => {
  const objectives = {
    'Narrate': [
      'sequence events using time words and visual supports',
      'recount events using simple past tense and sequence words',
      'tell detailed stories with clear beginning, middle, and end',
      'produce complex narratives with dialogue and descriptive language',
      'craft sophisticated narratives using varied literary devices'
    ],
    'Explain': [
      'show how or why using drawings, gestures, and single words',
      'describe processes using simple sentences with "because"',
      'explain cause-and-effect relationships using transition words',
      'interpret complex processes using technical vocabulary',
      'evaluate multiple explanations using precise academic language'
    ],
    'Argue': [
      'express preferences using yes/no responses and choice cards',
      'state simple opinions using sentence frames',
      'support opinions with reasons using compound sentences',
      'construct arguments with claims, evidence, and counterarguments',
      'debate complex issues using sophisticated rhetorical strategies'
    ],
    'Inform': [
      'identify and label information using word banks and visuals',
      'describe information using adjectives and simple sentences',
      'compare and contrast information using specific vocabulary',
      'synthesize information from multiple sources using cohesive devices',
      'present comprehensive analysis using genre-appropriate discourse'
    ]
  };
  
  const levelIndex = Math.min(Math.max(level - 1, 0), 4);
  return objectives[klu][levelIndex];
};

const determineWIDAStandards = (subject) => {
  const standards = ['ELD-SI: Language for Social and Instructional Purposes'];
  const subjectLower = subject.toLowerCase();
  
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
      subjectLower.includes('geography') || subjectLower.includes('government')) {
    standards.push('ELD-SS: Language for Social Studies');
  }
  
  return [...new Set(standards)];
};

// =====================================================
// PROFICIENCY ADAPTATIONS
// =====================================================

const getAdaptationRules = (proficiencyLevel) => {
  const level = WIDA_LEVELS[proficiencyLevel.toLowerCase()]?.level || 3;
  
  const adaptations = {
    1: {
      sentenceLength: '3-5 words maximum',
      vocabulary: 'Basic everyday words only, extensive visual support',
      grammarStructures: 'Simple present tense, basic noun-verb patterns',
      discourseLevel: 'Words, phrases, and patterned sentences',
      supports: 'Word banks, picture matching, fill-in-blank with choices',
      assessmentTypes: 'True/false, multiple choice, picture identification'
    },
    2: {
      sentenceLength: '6-10 words with simple connectors',
      vocabulary: 'Familiar words with gradual academic introduction',
      grammarStructures: 'Present and simple past, regular plurals',
      discourseLevel: 'Simple and compound sentences',
      supports: 'Sentence starters, graphic organizers, guided examples',
      assessmentTypes: 'Short answers with frames, yes/no with explanation'
    },
    3: {
      sentenceLength: 'Expanded sentences with multiple clauses',
      vocabulary: 'Academic vocabulary with context clues',
      grammarStructures: 'Multiple tenses, complex sentences with transitions',
      discourseLevel: 'Paragraphs with basic cohesive devices',
      supports: 'Sentence frames, vocabulary charts, step-by-step guides',
      assessmentTypes: 'Paragraph responses, structured analysis tasks'
    },
    4: {
      sentenceLength: 'Complex sentences with sophisticated vocabulary',
      vocabulary: 'Technical terms with minimal context support',
      grammarStructures: 'Advanced structures, passive voice, conditionals',
      discourseLevel: 'Multi-paragraph texts with cohesion',
      supports: 'Text-based scaffolds, reasoning requirements',
      assessmentTypes: 'Extended responses, analysis with evidence'
    },
    5: {
      sentenceLength: 'Near grade-level with strategic support',
      vocabulary: 'Specialized terminology with occasional clarification',
      grammarStructures: 'Sophisticated academic language structures',
      discourseLevel: 'Extended cohesive texts with precision',
      supports: 'Minimal scaffolding, peer collaboration',
      assessmentTypes: 'Independent analysis, research-based responses'
    },
    6: {
      sentenceLength: 'Full grade-level complexity',
      vocabulary: 'All specialized vocabulary without modification',
      grammarStructures: 'Complete range of academic language structures',
      discourseLevel: 'Genre-appropriate extended discourse',
      supports: 'No linguistic modifications needed',
      assessmentTypes: 'Grade-level expectations with full rigor'
    }
  };
  
  return adaptations[level] || adaptations[3];
};

// =====================================================
// API COMMUNICATION
// =====================================================

const callClaudeAPI = async (messages, maxTokens = CONFIG.TOKENS.DEFAULT_MAX) => {
  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : window.location.origin;
  
  for (let attempt = 1; attempt <= CONFIG.API.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API.TIMEOUT);
      
      const sanitizedMessages = messages.map(msg => ({
        role: msg.role,
        content: sanitizeContent(msg.content)
      }));
      
      const response = await fetch(`${API_BASE_URL}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: sanitizedMessages, 
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        if (response.status === 429) {
          if (attempt < CONFIG.API.MAX_RETRIES) {
            console.warn(`Rate limited, waiting ${CONFIG.API.RATE_LIMIT_DELAY}ms before retry ${attempt + 1}`);
            await delay(CONFIG.API.RATE_LIMIT_DELAY);
            continue;
          }
        }
        
        throw new ClaudeAPIError(
          errorData.error || `API request failed: ${response.status}`,
          response.status,
          errorData,
          response.status >= 500 || response.status === 429
        );
      }
      
      const result = await response.json();
      
      if (!result.content?.[0]?.text) {
        throw new ClaudeAPIError('Invalid response format from API');
      }
      
      return result;
      
    } catch (error) {
      console.warn(`API call attempt ${attempt}/${CONFIG.API.MAX_RETRIES} failed:`, error.message);
      
      if (error.name === 'AbortError') {
        throw new ClaudeAPIError('Request timeout - content may be too complex', 408, error, true);
      }
      
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }
      
      if (attempt === CONFIG.API.MAX_RETRIES) {
        throw new ClaudeAPIError(
          `API call failed after ${CONFIG.API.MAX_RETRIES} attempts: ${error.message}`,
          error.status,
          error,
          false
        );
      }
      
      await delay(CONFIG.DELAYS.RETRY_DELAY * attempt);
    }
  }
};

// =====================================================
// CONTENT GENERATION
// =====================================================

const buildWorksheetPrompt = (params, contentAnalysis, adaptationRules) => {
  const {
    subject,
    proficiencyLevel,
    materialType,
    contentToAdapt,
    learningObjectives,
    includeBilingualSupport,
    nativeLanguage,
    translateSummary,
    translateInstructions,
    worksheetLength,
    addStudentChecklist,
    useMultipleChoice
  } = params;
  
  let prompt = `You are an expert ELL curriculum specialist. Create a complete, print-ready student worksheet for ${WIDA_LEVELS[proficiencyLevel.toLowerCase()].label} students.

**ADAPTATION REQUIREMENTS:**
- **Subject:** ${subject} (${materialType})
- **Proficiency Level:** ${adaptationRules.sentenceLength}
- **Vocabulary:** ${adaptationRules.vocabulary}
- **Grammar:** ${adaptationRules.grammarStructures}
- **Support Level:** ${adaptationRules.supports}
- **Assessment:** ${adaptationRules.assessmentTypes}

**CONTENT ANALYSIS:**
- Type: ${contentAnalysis.contentType}
- Complexity: ${contentAnalysis.complexity.level}
- Items: ${contentAnalysis.totalItems}
- Word Count: ${contentAnalysis.wordCount}

**CRITICAL FORMATTING RULES:**
1. Include EVERY word of reading passages - NO placeholders or abbreviations
2. Number all questions sequentially (1. 2. 3. etc.)
3. Bold key vocabulary terms using **term** format
4. Use [ ] for checkboxes, not symbols
5. NO placeholder text like "[Insert passage here]" or "..."

**STRUCTURE REQUIRED:**
1. Title and brief background summary
2. Key Vocabulary section (5-8 terms)${addStudentChecklist ? '\n3. Student Checklist section' : ''}
3. All original content adapted to proficiency level
4. Sequential questions and activities
5. Clear, simple directions for each section`;

  if (learningObjectives) {
    prompt += `\n\n**LEARNING OBJECTIVES:**
Students will be able to: ${learningObjectives}`;
  }

  if (includeBilingualSupport && nativeLanguage) {
    prompt += `\n\n**BILINGUAL SUPPORT (${nativeLanguage}):**`;
    prompt += `\n- Provide ${nativeLanguage} translations for key vocabulary: **term**: definition (*translation*)`;
    
    if (translateSummary) {
      prompt += `\n- Add 1-2 sentence summary in ${nativeLanguage} at the top`;
    }
    
    if (translateInstructions) {
      prompt += `\n- Include ${nativeLanguage} translations for all directions`;
    }
  }

  if (worksheetLength || useMultipleChoice) {
    prompt += `\n\n**ACCOMMODATIONS:**`;
    
    if (worksheetLength) {
      const timingMap = {
        'Short': '5-10 minutes - reduce to essential items only',
        'Medium': '15-25 minutes - standard adaptation',
        'Long': '30+ minutes - include extension activities'
      };
      prompt += `\n- Timing: ${timingMap[worksheetLength]}`;
    }
    
    if (useMultipleChoice) {
      prompt += `\n- Convert open-ended questions to multiple choice where appropriate`;
    }
  }

  prompt += `\n\n**ORIGINAL CONTENT TO ADAPT:**
\`\`\`
${contentToAdapt}
\`\`\`

Generate the complete worksheet with all original content preserved and adapted to ${proficiencyLevel} level. Ensure it's ready to print and use immediately.`;

  return prompt;
};

const generateWorksheet = async (params, contentAnalysis, adaptationRules) => {
  const prompt = buildWorksheetPrompt(params, contentAnalysis, adaptationRules);
  
  const tokenLimit = contentAnalysis.complexity.needsExtendedTokens 
    ? CONFIG.TOKENS.EXTENDED_MAX 
    : CONFIG.TOKENS.DEFAULT_MAX;
  
  const result = await callClaudeAPI([{ role: 'user', content: prompt }], tokenLimit);
  return result.content[0].text;
};

const extractKeyVocabulary = (worksheet) => {
  const boldTerms = (worksheet.match(/\*\*(.*?)\*\*/g) || [])
    .map(term => term.replace(/\*\*/g, ''))
    .slice(0, 10);
  
  return boldTerms.length > 0 
    ? boldTerms.join(', ')
    : 'Key terms bolded throughout worksheet';
};

const calculateActivityTime = (contentAnalysis) => {
  const baseTime = 15;
  const itemTime = contentAnalysis.totalItems * 1.5;
  const readingTime = contentAnalysis.hasReadingPassage ? 10 : 0;
  const mathTime = contentAnalysis.hasMath ? 5 : 0;
  
  return Math.max(baseTime, Math.min(35, baseTime + itemTime + readingTime + mathTime));
};

const calculateTotalTime = (contentAnalysis) => {
  const activityTime = calculateActivityTime(contentAnalysis);
  return activityTime + 25;
};

const generateCognateSection = (nativeLanguage, worksheet) => {
  return `\n## Cognates to Highlight (English/${nativeLanguage})
*Review the worksheet content to identify cognate pairs that can help students make connections between languages.*

Examples might include:
- Technical vocabulary terms that share Latin or Greek roots
- Academic language that appears in both languages
- Content-specific terminology with similar forms`;
};

const generateTeacherGuide = async (studentWorksheet, params, contentAnalysis) => {
  const { subject, proficiencyLevel } = params;
  const adaptationRules = getAdaptationRules(proficiencyLevel);
  
  const contentObjectives = extractContentObjectives(
    params.contentToAdapt, subject, contentAnalysis
  );
  
  const languageObjectives = createLanguageObjectives(
    contentObjectives, proficiencyLevel, contentAnalysis, subject
  );
  
  const widaStandards = determineWIDAStandards(subject);
  const keyVocabulary = extractKeyVocabulary(studentWorksheet);
  
  return `# Teacher's Guide: ${subject} - ${WIDA_LEVELS[proficiencyLevel.toLowerCase()].label}

## WIDA ELD Standards Alignment
${widaStandards.map(std => `- ${std}`).join('\n')}

## Learning Objectives

### Content Objectives
Students will be able to:
${contentObjectives.map(obj => `- ${obj}`).join('\n')}

### Language Objectives  
Students will be able to:
${languageObjectives.map(obj => `- ${obj}`).join('\n')}

## Proficiency Level Adaptations
- **Sentence Complexity:** ${adaptationRules.sentenceLength}
- **Vocabulary Support:** ${adaptationRules.vocabulary}
- **Grammar Focus:** ${adaptationRules.grammarStructures}
- **Discourse Level:** ${adaptationRules.discourseLevel}
- **Instructional Supports:** ${adaptationRules.supports}
- **Assessment Types:** ${adaptationRules.assessmentTypes}

## Materials Needed
- Student worksheet
- ${contentAnalysis.hasMath ? 'Calculator (if permitted), graph paper' : 'Highlighters for text marking'}
- Vocabulary reference materials
- ${contentAnalysis.contentType === 'reading_comprehension' ? 'Audio recording of passage (optional)' : 'Visual aids as appropriate'}

## Key Vocabulary Terms
${keyVocabulary}

## Suggested Pacing
- **Vocabulary Introduction:** 8-12 minutes
- **Main Activity:** ${calculateActivityTime(contentAnalysis)} minutes
- **Review & Discussion:** 10-15 minutes
- **Total Estimated Time:** ${calculateTotalTime(contentAnalysis)} minutes

## Teaching Notes
- All mathematical content and factual information preserved from original
- Language structures adapted to ${proficiencyLevel} proficiency level
- Key vocabulary terms bolded throughout for emphasis
- Assessment validity maintained through careful adaptation

## Extension Activities
- Peer discussion of key concepts using sentence frames
- Vocabulary journal entries with drawings or examples
- ${contentAnalysis.contentType === 'reading_comprehension' ? 'Text-to-self connections discussion' : 'Real-world application examples'}

## Differentiation Suggestions
- **Above Level:** Encourage use of more complex sentence structures
- **Below Level:** Provide additional visual supports and sentence frames
- **ELD Newcomers:** Partner with bilingual peer mentor if available

${params.includeBilingualSupport && params.listCognates ? generateCognateSection(params.nativeLanguage, studentWorksheet) : ''}

## Assessment Criteria
Focus on content understanding while allowing for developing language proficiency. Accept language that demonstrates comprehension even if not grammatically perfect.`;
};

// =====================================================
// QUALITY VALIDATION
// =====================================================

const validateWorksheet = (worksheet) => {
  const issues = [];
  
  const placeholders = [
    '[Original passage preserved exactly as written]',
    '[Content continues...]',
    '[Add more questions here]',
    '[Insert passage here]',
    '[Passage text here]',
    '[Complete the remaining items]',
    '[Insert full passage text here]',
    '[Include complete passage]',
    '[Full text goes here]',
    '[Replace with actual passage]',
    '...',
    'etc.'
  ];
  
  placeholders.forEach(placeholder => {
    if (worksheet.includes(placeholder)) {
      issues.push(`Contains placeholder: ${placeholder}`);
    }
  });
  
  const numberedItems = worksheet.match(/^\s*(\d+)\./gm) || [];
  if (numberedItems.length > 1) {
    const numbers = numberedItems.map(item => parseInt(item.match(/\d+/)[0]));
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i-1] + 1) {
        issues.push(`Numbering gap: ${numbers[i-1]} to ${numbers[i]}`);
      }
    }
  }
  
  const numberCounts = {};
  numberedItems.forEach(item => {
    const num = item.match(/\d+/)[0];
    numberCounts[num] = (numberCounts[num] || 0) + 1;
  });
  
  Object.entries(numberCounts).forEach(([num, count]) => {
    if (count > 1) {
      issues.push(`Duplicate number: ${num} appears ${count} times`);
    }
  });
  
  const problematicChars = ['□', '✓', '○', '●', '◯', '◉'];
  problematicChars.forEach(char => {
    if (worksheet.includes(char)) {
      issues.push(`Problematic character: ${char} (use [ ] instead)`);
    }
  });
  
  const vocabSection = worksheet.includes('## Key Vocabulary') || worksheet.includes('# Key Vocabulary');
  const boldedTerms = (worksheet.match(/\*\*(.*?)\*\*/g) || []).length;
  
  if (vocabSection && boldedTerms === 0) {
    issues.push('Vocabulary section exists but no terms are bolded in content');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    hasVocabSection: vocabSection,
    boldedTermCount: boldedTerms,
    wordCount: worksheet.split(/\s+/).length,
    message: issues.length === 0 
      ? 'Worksheet passes quality validation'
      : `Found ${issues.length} quality issues`
  };
};

const fixCommonIssues = (content) => {
  return content
    .replace(/□/g, '[ ]')
    .replace(/☐/g, '[ ]')
    .replace(/✓/g, '[x]')
    .replace(/☑/g, '[x]')
    .replace(/•/g, '-')
    .replace(/◦/g, '-')
    .replace(/\[Original passage preserved exactly as written\]/g, '')
    .replace(/\[Content continues...\]/g, '')
    .replace(/\[Insert passage here\]/g, '')
    .replace(/\[Passage text here\]/g, '')
    .replace(/\[Complete the remaining items\]/g, '')
    .replace(/\[Insert full passage text here\]/g, '')
    .replace(/\[Include complete passage\]/g, '')
    .replace(/\[Full text goes here\]/g, '')
    .replace(/\[Replace with actual passage\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// =====================================================
// LONG CONTENT PROCESSING
// =====================================================

const processLongContent = async (params, setProcessingStep, contentAnalysis) => {
  setProcessingStep?.('Step 1: Generating worksheet structure...');
  
  const adaptationRules = getAdaptationRules(params.proficiencyLevel);
  
  const structurePrompt = `Create a complete worksheet structure for ${params.subject} at ${params.proficiencyLevel} level.

**REQUIREMENTS:**
- Title and background summary
- Key vocabulary section with 6-8 bolded terms
- ${params.addStudentChecklist ? 'Student checklist with specific steps' : ''}
- Pre-reading questions
- Reading comprehension questions (numbered 1, 2, 3...)
- Post-reading activities

**ADAPTATIONS:**
- Sentences: ${adaptationRules.sentenceLength}
- Vocabulary: ${adaptationRules.vocabulary}
- Support: ${adaptationRules.supports}

**CRITICAL:** Where the reading passage should appear, write exactly: {{READING_PASSAGE_PLACEHOLDER}}

**ORIGINAL CONTENT:**
\`\`\`
${params.contentToAdapt}
\`\`\`

Create the complete structure but use {{READING_PASSAGE_PLACEHOLDER}} for the actual passage.`;

  const structureResult = await callClaudeAPI([{ role: 'user', content: structurePrompt }]);
  
  setProcessingStep?.('Step 2: Inserting complete reading passage...');
  
  const originalPassage = extractReadingPassage(params.contentToAdapt);
  const finalWorksheet = structureResult.content[0].text.replace(
    '{{READING_PASSAGE_PLACEHOLDER}}', 
    `## Reading Passage\n\n${originalPassage}`
  );
  
  return finalWorksheet;
};

const extractReadingPassage = (content) => {
  const lines = content.split('\n').filter(line => line.trim());
  const passageLines = [];
  
  for (let line of lines) {
    const cleanLine = line.trim();
    
    if (cleanLine.match(/^(questions?|directions?|instructions?|name:|date:|class:)/i) ||
        cleanLine.match(/^\s*\d+[\.\)]/) ||
        cleanLine.match(/^\s*[a-z][\.\)]/i) ||
        cleanLine.length < 20) {
      continue;
    }
    
    if (cleanLine.length > 20 && !cleanLine.endsWith('?')) {
      passageLines.push(cleanLine);
    }
  }
  
  return passageLines.length > 0 ? passageLines.join('\n\n') : content;
};

// =====================================================
// MAIN EXPORT FUNCTIONS
// =====================================================

export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    setProcessingStep?.('Extracting text from PDF...');
    return await extractPDFText(file, setProcessingStep);
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new ClaudeAPIError('Failed to extract text from PDF', null, error);
  }
};

export const adaptMaterialWithClaude = async (params, setProcessingStep) => {
  const startTime = Date.now();
  
  try {
    setProcessingStep?.('Validating input parameters...');
    const validation = validateInput(params);
    
    if (!validation.isValid) {
      throw new ClaudeAPIError(`Input validation failed: ${validation.errors.join(', ')}`);
    }
    
    setProcessingStep?.('Analyzing content structure and complexity...');
    const contentAnalysis = analyzeContentStructure(params.contentToAdapt);
    
    console.log('Content Analysis Results:', {
      type: contentAnalysis.contentType,
      complexity: contentAnalysis.complexity.level,
      wordCount: contentAnalysis.wordCount,
      totalItems: contentAnalysis.totalItems,
      estimatedTime: contentAnalysis.complexity.processingTime + 's'
    });
    
    const isLongContent = contentAnalysis.wordCount > 1000 || 
                         contentAnalysis.complexity.needsChunking ||
                         contentAnalysis.contentType === 'reading_comprehension';
    
    const adaptationRules = getAdaptationRules(params.proficiencyLevel);
    
    let studentWorksheet;
    
    if (isLongContent && contentAnalysis.contentType === 'reading_comprehension') {
      console.log('Using two-step strategy for long reading comprehension content');
      studentWorksheet = await processLongContent(params, setProcessingStep, contentAnalysis);
    } else {
      console.log('Using standard generation strategy');
      setProcessingStep?.('Generating adapted student worksheet...');
      studentWorksheet = await generateWorksheet(params, contentAnalysis, adaptationRules);
    }
    
    setProcessingStep?.('Validating worksheet quality...');
    let validation_result = validateWorksheet(studentWorksheet);
    
    if (!validation_result.isValid) {
      console.warn('Quality issues detected:', validation_result.issues);
      studentWorksheet = fixCommonIssues(studentWorksheet);
      validation_result = validateWorksheet(studentWorksheet);
    }
    
    await delay(CONFIG.DELAYS.BETWEEN_CALLS);
    setProcessingStep?.('Generating comprehensive teacher guide...');
    
    const teacherGuide = await generateTeacherGuide(
      studentWorksheet, params, contentAnalysis
    );
    
    setProcessingStep?.('Creating WIDA-aligned learning descriptors...');
    
    const contentObjectives = extractContentObjectives(
      params.contentToAdapt, params.subject, contentAnalysis
    );
    
    const languageObjectives = createLanguageObjectives(
      contentObjectives, params.proficiencyLevel, contentAnalysis, params.subject
    );
    
    const dynamicWidaDescriptors = {
      title: `${params.subject} - ${WIDA_LEVELS[params.proficiencyLevel.toLowerCase()].label}`,
      contentObjectives,
      languageObjectives,
      widaStandards: determineWIDAStandards(params.subject),
      descriptors: [
        ...contentObjectives.map(obj => `Students can ${obj}`),
        ...languageObjectives.slice(0, 2)
      ]
    };
    
    setProcessingStep?.('Finalizing materials...');
    
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    console.log('Adaptation completed successfully:', {
      processingTime: processingTime + 's',
      contentType: contentAnalysis.contentType,
      complexity: contentAnalysis.complexity.level,
      finalWordCount: studentWorksheet.split(/\s+/).length,
      qualityIssues: validation_result.issues.length
    });
    
    return {
      studentWorksheet,
      teacherGuide,
      dynamicWidaDescriptors,
      imagePrompts: null,
      metadata: {
        contentAnalysis,
        adaptationRules,
        validation: validation_result,
        processingTime,
        strategy: isLongContent ? 'two_step' : 'standard'
      }
    };
    
  } catch (error) {
    const processingTime = Math.round((Date.now() - startTime) / 1000);
    
    console.error('Adaptation failed:', {
      error: error.message,
      processingTime: processingTime + 's',
      params: {
        subject: params.subject,
        proficiencyLevel: params.proficiencyLevel,
        contentLength: params.contentToAdapt?.length || 0
      }
    });
    
    if (error instanceof ClaudeAPIError) {
      throw error;
    }
    
    throw new ClaudeAPIError(
      `Adaptation process failed: ${error.message}`,
      null,
      error
    );
  }
};
