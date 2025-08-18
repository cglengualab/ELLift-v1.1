// FileName: src/services/claudeService.js (COMPLETE VERSION WITH MATH ENHANCEMENTS)

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
// MATHEMATICAL ENHANCEMENT FUNCTIONS (NEW)
// =====================================================

const enhanceMathematicalTypography = (content) => {
  return content
    // Better mathematical symbols
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^4/g, '⁴')
    .replace(/sqrt\(/g, '√(')
    .replace(/\+-/g, '±')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/infinity/g, '∞')
    // Better fractions (common ones)
    .replace(/1\/2/g, '½')
    .replace(/1\/3/g, '⅓')
    .replace(/2\/3/g, '⅔')
    .replace(/1\/4/g, '¼')
    .replace(/3\/4/g, '¾')
    // Degree symbol
    .replace(/degrees?/g, '°')
    .replace(/(\d+)\s*deg/g, '$1°')
    // Mathematical operations
    .replace(/\* /g, '× ')
    .replace(/ \* /g, ' × ')
    .replace(/\/ /g, '÷ ')
    .replace(/ \/ /g, ' ÷ ');
};

const generatePrintReadyTable = (tableType, equations = [], xValues = []) => {
  switch(tableType) {
    case 'systems':
      return `
**Solve by Table Method:**

**System:**
- **Equation 1:** ${equations[0] || 'y = ___'}
- **Equation 2:** ${equations[1] || 'y = ___'}

**Instructions:** Complete the table and find where y-values match.

| x  | y₁ (Equation 1) | y₂ (Equation 2) | Match? |
|----|-----------------|-----------------|---------${xValues.length ? xValues.map(x => `\n| ${x}  | ______________ | ______________ | ______ |`).join('') : '\n| -2 | ______________ | ______________ | ______ |\n| -1 | ______________ | ______________ | ______ |\n|  0 | ______________ | ______________ | ______ |\n|  1 | ______________ | ______________ | ______ |\n|  2 | ______________ | ______________ | ______ |'}

**Solution:** The intersection point is ( _____ , _____ )

**Check Your Answer:** 
- Substitute x = _____ and y = _____ into Equation 1: _________________
- Substitute x = _____ and y = _____ into Equation 2: _________________
- Do both equations work? □ Yes □ No
`;

    case 'basic_table':
      return `
| x  | y  |
|----|----${xValues.length ? xValues.map(x => `\n| ${x}  | ___ |`).join('') : '\n| -2 | ___ |\n| -1 | ___ |\n|  0 | ___ |\n|  1 | ___ |\n|  2 | ___ |'}
`;

    case 'fraction_operations':
      return `
**Fraction Operations Table:**

| Problem | Step 1 | Step 2 | Final Answer |
|---------|---------|---------|--------------|
| _____ + _____ | Find common denominator: _____ | Add numerators: _____ | _____ |
| _____ - _____ | Find common denominator: _____ | Subtract numerators: _____ | _____ |
| _____ × _____ | Multiply numerators: _____ | Multiply denominators: _____ | _____ |
| _____ ÷ _____ | Flip second fraction: _____ | Multiply: _____ | _____ |
`;

    default:
      return '';
  }
};

const generateCoordinateGrid = (title = "Coordinate Plane") => {
  return `
**${title}**

*Use this grid to plot points and draw lines. Each square = 1 unit*

      y
      ↑
   5  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
   4  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
   3  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
   2  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
   1  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
  ────┼──────────────────────────────── → x
  -5  | -4 -3 -2 -1  0  1  2  3  4  5
  -1  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
  -2  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
  -3  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
  -4  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·
  -5  |  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·

**Instructions:**
1. Plot the y-intercept of each equation
2. Use the slope to find a second point
3. Draw straight lines through the points
4. Mark the intersection point with a circle

**Intersection Point:** ( _____ , _____ )
`;
};

const enhanceWorksheetFormatting = (content) => {
  return content
    // Better section headers
    .replace(/^(Part \d+[:\s]*.*?)$/gm, '\n## 📚 $1\n' + '═'.repeat(50))
    .replace(/^(Step \d+[:\s]*.*?)$/gm, '\n**🔸 $1**')
    
    // Better instructions
    .replace(/Instructions?:/gi, '\n**📋 Instructions:**')
    .replace(/Directions?:/gi, '\n**📋 Directions:**')
    .replace(/Solution:/gi, '\n**✅ Solution:**')
    .replace(/Answer:/gi, '\n**✅ Answer:**')
    .replace(/Check:/gi, '\n**🔍 Check:**')
    .replace(/Verify:/gi, '\n**🔍 Verify:**')
    
    // Better examples and practice
    .replace(/Example:/gi, '\n**💡 Example:**')
    .replace(/Practice:/gi, '\n**✏️ Practice:**')
    .replace(/Warm[- ]?up:/gi, '\n**🔥 Warm-up:**')
    
    // Mathematical sections
    .replace(/Formula:/gi, '\n**📐 Formula:**')
    .replace(/Given:/gi, '\n**📝 Given:**')
    .replace(/Find:/gi, '\n**🎯 Find:**')
    
    // Add visual breaks
    .replace(/\n\n(?=Part|\*\*|##)/g, '\n\n' + '─'.repeat(60) + '\n\n');
};

const fixTableFormatting = (content) => {
  return content
    // Ensure proper table spacing
    .replace(/\|([^|]+)\|/g, (match, cell) => `| ${cell.trim()} |`)
    // Fix table headers
    .replace(/\|\s*-+\s*\|/g, '|---|')
    // Add spacing around tables
    .replace(/(\n\|.*?\|\n(?:\|.*?\|\n)*)/g, '\n$1\n')
    // Fix coordinate grid spacing
    .replace(/(\d)\s+\|/g, '$1 |')
    .replace(/\|\s+(\d)/g, '| $1')
    // Ensure consistent table borders
    .replace(/\|([^|\n]*)\|/g, (match, content) => {
      const trimmed = content.trim();
      const padded = trimmed.length < 15 ? trimmed.padEnd(15) : trimmed;
      return `| ${padded} |`;
    });
};

const detectMathSubject = (subject, content) => {
  const subjectLower = subject.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // PHASE 1: Explicitly identify NON-MATH subjects first
  if (subjectLower.includes('english') || 
      subjectLower.includes('language arts') || 
      subjectLower.includes('literature') || 
      subjectLower.includes('reading') || 
      subjectLower.includes('writing')) {
    return 'english_language_arts';
  }
  
  if (subjectLower.includes('history')) {
    return 'history';
  }
  
  if (subjectLower.includes('social studies') || 
      subjectLower.includes('government') || 
      subjectLower.includes('economics') || 
      subjectLower.includes('civics')) {
    return 'social_studies';
  }
  
  // PHASE 2: Identify SCIENCE subjects (mixed math/science)
  if (subjectLower.includes('biology') ||
      contentLower.includes('cell') || 
      contentLower.includes('organism') ||
      contentLower.includes('dna') ||
      contentLower.includes('photosynthesis')) {
    return 'biology';
  }
  
  if (subjectLower.includes('chemistry') ||
      contentLower.includes('h2o') || 
      contentLower.includes('co2') ||
      contentLower.includes('chemical') ||
      contentLower.includes('reaction')) {
    return 'chemistry';
  }
  
  if (subjectLower.includes('physics') ||
      contentLower.includes('force') || 
      contentLower.includes('velocity') ||
      contentLower.includes('acceleration') ||
      contentLower.includes('wave')) {
    return 'physics';
  }
  
  if (subjectLower.includes('science') ||
      contentLower.includes('experiment') ||
      contentLower.includes('hypothesis') ||
      contentLower.includes('observation')) {
    return 'general_science';
  }
  
  // PHASE 3: Identify MATH subjects last
  if (subjectLower.includes('geometry') || 
      contentLower.includes('triangle') || 
      contentLower.includes('angle') ||
      contentLower.includes('area') ||
      contentLower.includes('perimeter') ||
      contentLower.includes('volume') ||
      contentLower.includes('circle') ||
      contentLower.includes('polygon')) {
    return 'geometry';
  }
  
  if (subjectLower.includes('algebra') ||
      contentLower.includes('equation') ||
      contentLower.includes('variable') ||
      contentLower.includes('solve for') ||
      contentLower.includes('system') ||
      contentLower.includes('linear') ||
      contentLower.includes('quadratic')) {
    return 'algebra';
  }
  
  if (contentLower.includes('data') ||
      contentLower.includes('graph') ||
      contentLower.includes('statistics') ||
      contentLower.includes('probability') ||
      contentLower.includes('mean') ||
      contentLower.includes('median') ||
      contentLower.includes('mode')) {
    return 'statistics';
  }
  
  if (contentLower.includes('fraction') ||
      contentLower.includes('decimal') ||
      contentLower.includes('percent') ||
      contentLower.includes('ratio') ||
      contentLower.includes('proportion')) {
    return 'basic_math';
  }
  
  if (subjectLower.includes('mathematics') || 
      subjectLower.includes('math')) {
    return 'mathematics';
  }
  
  // SAFE DEFAULT: Non-math content
  return 'general_content';
};

// ADD THIS NEW FUNCTION RIGHT HERE:
const getSubjectCategory = (mathSubject) => {
  switch (mathSubject) {
    case 'english_language_arts':
      return 'ELA';
    case 'history':
    case 'social_studies':
      return 'SOCIAL_STUDIES';
    case 'biology':
    case 'chemistry':
    case 'physics':
    case 'general_science':
      return 'SCIENCE';
    case 'geometry':
    case 'algebra':
    case 'statistics':
    case 'basic_math':
    case 'mathematics':
      return 'MATH';
    default:
      return 'GENERAL';
  }
};

const getMaterialsBySubject = (mathSubject) => {
  const category = getSubjectCategory(mathSubject);
  switch (category) {
    case 'MATH':
      return 'Calculator (if permitted), graph paper, ruler';
    case 'SCIENCE':
      return 'Calculator (if permitted), safety goggles, lab equipment';
    case 'ELA':
      return 'Highlighters for text marking, sticky notes';
    case 'SOCIAL_STUDIES':
      return 'Maps, timeline templates, highlighters';
    default:
      return 'Highlighters and reference materials';
  }
};

const getSubjectSpecificMaterials = (mathSubject) => {
  const category = getSubjectCategory(mathSubject);
  switch (category) {
    case 'MATH':
      return 'Coordinate grid paper or graphing materials';
    case 'SCIENCE':
      return 'Lab materials as specified in procedures';
    case 'ELA':
      return 'Audio recording of passage (optional)';
    case 'SOCIAL_STUDIES':
      return 'Primary source documents or images';
    default:
      return 'Visual aids as appropriate';
  }
};

const getExtensionsBySubject = (mathSubject, contentAnalysis) => {
  const category = getSubjectCategory(mathSubject);
  switch (category) {
    case 'ELA':
      return 'Text-to-self connections discussion, creative writing extensions, literary analysis peer review';
    case 'SOCIAL_STUDIES':
      return 'Historical timeline creation, current events connections, debate and discussion activities';
    case 'SCIENCE':
      return 'Real-world application of scientific concepts, additional experiments, science journal entries';
    case 'MATH':
      return 'Real-world application of mathematical concepts, problem-solving challenges, math journal entries';
    default:
      return 'Real-world application examples, cross-curricular connections';
  }
};

const getSubjectSpecificTemplates = (mathSubject) => {
  const templates = {
    geometry: {
      triangleArea: `
**Triangle Area Calculation:**
      
      A
     /|\\
    / | \\
   /  |h \\
  /   |   \\
 /_______\\
 B   base  C

**📐 Formula:** Area = ½ × base × height
**📝 Given:** base = _____ units, height = _____ units
**✏️ Calculation:** Area = ½ × _____ × _____ = _____ square units
`,
      
      coordinateDistance: `
**Distance Formula:**
**📝 Points:** A(x₁, y₁) = ( _____ , _____ )
              B(x₂, y₂) = ( _____ , _____ )

**📐 Formula:** d = √[(x₂-x₁)² + (y₂-y₁)²]
**✏️ Substitute:** d = √[(_____-_____)² + (_____-_____)²]
**🔸 Simplify:** d = √[_____² + _____²]
**✅ Calculate:** d = √_____ = _____ units
`,

      rectangleArea: `
**Rectangle Area and Perimeter:**

    ┌─────────────┐
    │             │ height = _____ units
    │             │
    │             │
    └─────────────┘
     base = _____ units

**📐 Formulas:**
- Area = base × height = _____ × _____ = _____ square units
- Perimeter = 2(base + height) = 2(_____ + _____) = _____ units
`
    },
    
    statistics: {
      dataTable: `
**Data Analysis Table:**

| Category | Frequency | Percentage |
|----------|-----------|------------|
| ________ | _________ | _________% |
| ________ | _________ | _________% |
| ________ | _________ | _________% |
| ________ | _________ | _________% |
| **Total** | _________ | **100%**   |

**📊 Calculations:**
- **Mean** = (Sum of all values) ÷ (Number of values) = _____
- **Mode** = Most frequent value = _____
- **Range** = Highest value - Lowest value = _____
- **Median** = Middle value when arranged in order = _____
`,

      probabilityTable: `
**Probability Calculations:**

| Event | Favorable Outcomes | Total Possible | Probability |
|-------|-------------------|----------------|-------------|
| _____ | _________________ | ______________ | _____/_____ |
| _____ | _________________ | ______________ | _____/_____ |

**📐 Formula:** P(event) = (Favorable outcomes) ÷ (Total possible outcomes)
**✅ Check:** All probabilities should add up to 1 (or 100%)
`
    },
    
    algebra: {
      systemSolution: generatePrintReadyTable('systems'),
      coordinateGrid: generateCoordinateGrid(),
      
      quadraticFactoring: `
**Quadratic Factoring:**

**📝 Given:** ax² + bx + c = 0
**📝 Example:** x² + ___x + ___ = 0

**🔸 Step 1:** Find two numbers that multiply to give _____ and add to give _____
**🔸 Step 2:** The numbers are _____ and _____
**🔸 Step 3:** Factor: (x + ____)(x + ____) = 0
**✅ Solutions:** x = _____ or x = _____

**🔍 Check:** Substitute both values back into the original equation
`
    },

    basic_math: {
      fractionOperations: generatePrintReadyTable('fraction_operations'),
      
      percentageTable: `
**Percentage Calculations:**

| Part | Whole | Percentage | Calculation |
|------|-------|------------|-------------|
| ___  | ___   | _______%   | (___/___) × 100 = ___% |
| ___  | ___   | _______%   | (___/___) × 100 = ___% |

**📐 Formulas:**
- **Percentage** = (Part ÷ Whole) × 100
- **Part** = (Percentage ÷ 100) × Whole  
- **Whole** = Part ÷ (Percentage ÷ 100)
`
    }
  };
  
  return templates[mathSubject] || {};
};

// =====================================================
// ERROR HANDLING (EXISTING)
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
// UTILITY FUNCTIONS (EXISTING)
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
// CONTENT ANALYSIS (EXISTING WITH MATH ENHANCEMENTS)
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
    definitionPattern: /:\s*[A-Z]/g.test(content),
    
    // Enhanced math detection
    hasSystemsOfEquations: /system|simultaneous|linear.*equation/i.test(content),
    hasGeometry: /triangle|circle|angle|area|perimeter|volume|polygon/i.test(content),
    hasStatistics: /data|graph|mean|median|mode|probability/i.test(content),
    hasFractions: /\d+\/\d+|fraction|numerator|denominator/i.test(content),
    hasAlgebra: /solve.*for|variable|expression|equation/i.test(content)
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
    (analysis.hasReadingPassage ? 10 : 0) +
    (analysis.hasSystemsOfEquations ? 6 : 0) +
    (analysis.hasGeometry ? 4 : 0);
  
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
  
  // Enhanced math content type detection
  if (analysis.hasSystemsOfEquations || lowerContent.includes('system of equations')) {
    return 'systems_of_equations';
  } else if (analysis.hasGeometry || lowerContent.includes('geometry')) {
    return 'geometry';
  } else if (analysis.hasStatistics || lowerContent.includes('statistics')) {
    return 'statistics';
  } else if (analysis.hasMath && (analysis.hasEquations || analysis.hasFormulas)) {
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
// WIDA ALIGNMENT FUNCTIONS (EXISTING)
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
      // Enhanced math-specific objectives
      if (contentAnalysis.hasSystemsOfEquations) {
        objectives.push('determine whether an ordered pair is a solution to a system of equations');
      }
      if (contentAnalysis.hasGeometry) {
        objectives.push('calculate area, perimeter, and volume using appropriate formulas');
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
// PROFICIENCY ADAPTATIONS (EXISTING)
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
// API COMMUNICATION (EXISTING)
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
// CONTENT GENERATION (ENHANCED)
// =====================================================

const buildWorksheetPrompt = (params, contentAnalysis, adaptationRules) => {
  // ADD THIS ENTIRE BLOCK - START
  console.log('🔍 DEBUG - Parameters received:');
  console.log('Full params object:', params);
  console.log('proficiencyLevel from params:', params.proficiencyLevel);
  console.log('adaptationRules received:', adaptationRules);
  // ADD THIS ENTIRE BLOCK - END

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
  
  // ADD THIS ENTIRE BLOCK - START
  console.log('🔍 DEBUG - After destructuring:');
  console.log('proficiencyLevel:', proficiencyLevel);
  console.log('proficiencyLevel type:', typeof proficiencyLevel);
  console.log('proficiencyLevel lowercase:', proficiencyLevel?.toLowerCase());
  
  const widaLookup = WIDA_LEVELS[proficiencyLevel?.toLowerCase()];
  console.log('WIDA_LEVELS lookup result:', widaLookup);
  
  if (!widaLookup) {
    console.error('❌ WIDA level not found!');
    console.log('Available WIDA levels:', Object.keys(WIDA_LEVELS));
  } else {
    console.log('✅ WIDA level found:', widaLookup);
  }
  // ADD THIS ENTIRE BLOCK - END
  
  // Detect if this is math content
  const mathSubject = detectMathSubject(subject, contentToAdapt);
 // Define what subjects should get math enhancements
const mathSubjects = ['geometry', 'algebra', 'statistics', 'basic_math', 'mathematics'];
const scienceSubjects = ['biology', 'chemistry', 'physics', 'general_science'];

// Only apply math features to actual math subjects OR science with math content
const isMathContent = mathSubjects.includes(mathSubject) || 
                     (scienceSubjects.includes(mathSubject) && contentAnalysis.hasMath);
  
  // REPLACE THE EXISTING PROMPT BUILDING WITH THIS ENHANCED VERSION:
  const widaInfo = WIDA_LEVELS[proficiencyLevel.toLowerCase()];
  if (!widaInfo) {
    throw new Error(`Invalid WIDA level: ${proficiencyLevel}`);
  }

  let prompt = `You are an expert ELL curriculum specialist. 

🚨🚨🚨 CRITICAL REQUIREMENT 🚨🚨🚨
THIS WORKSHEET MUST BE FOR WIDA LEVEL ${widaInfo.level} (${widaInfo.label}) STUDENTS ONLY.
DO NOT CREATE LEVEL 1 OR LEVEL 2 CONTENT.
THIS IS FOR ADVANCED ELL STUDENTS AT LEVEL ${widaInfo.level}.

WIDA LEVEL ${widaInfo.level} MANDATORY CHARACTERISTICS:`;

// Add explicit level requirements
switch(widaInfo.level) {
  case 1:
    prompt += `
🎯 LEVEL 1 REQUIREMENTS:
- Use ONLY 3-5 word sentences
- Provide extensive bilingual vocabulary with Spanish translations
- Include word banks and picture choices for every activity
- Use simple present tense only
- Create true/false, matching, and picture identification activities
- Student responses: single words, phrases, or gestures only`;
    break;
    
  case 2:
    prompt += `
🎯 LEVEL 2 REQUIREMENTS:
- Use 6-10 word sentences with simple connectors like "and," "but," "because"
- Provide sentence frames and guided examples
- Include strategic bilingual support (not extensive)
- Use present and simple past tense
- Create short answer responses with scaffolding
- Student responses: short sentences with support`;
    break;
    
  case 3:
    prompt += `
🎯 LEVEL 3 REQUIREMENTS:
- Use expanded sentences with multiple clauses
- Include academic vocabulary with context clues and definitions
- Create paragraph-length responses with topic sentences
- Use multiple tenses and complex sentences with transitions
- Create structured analysis tasks
- Student responses: paragraphs with basic organization`;
    break;
    
  case 4:
    prompt += `
🎯 LEVEL 4 REQUIREMENTS - THIS IS THE CURRENT LEVEL:
- Use complex sentences with sophisticated academic vocabulary
- Include technical terms with minimal context support
- Require multi-paragraph responses with clear organization
- Use advanced grammar structures including passive voice and conditionals
- Create extended analysis tasks requiring evidence and reasoning
- Student responses: sophisticated academic discourse with minimal scaffolding
- NO basic vocabulary definitions - students should know academic terms
- NO sentence frames - students generate their own academic language
- NO bilingual support except for the most technical terms`;
    break;
    
  case 5:
    prompt += `
🎯 LEVEL 5 REQUIREMENTS:
- Use near grade-level academic language with strategic support only
- Include specialized terminology with occasional clarification
- Require extended cohesive texts with precision and sophistication
- Provide minimal scaffolding and encourage peer collaboration
- Create independent analysis and research-based response tasks
- Student responses: near-native academic discourse`;
    break;
    
  case 6:
    prompt += `
🎯 LEVEL 6 REQUIREMENTS:
- Use full grade-level complexity without ANY modification
- Include ALL specialized vocabulary without simplification
- Use complete range of academic language structures
- Provide NO linguistic modifications or scaffolding
- Create grade-level expectations with full academic rigor
- Student responses: native-level academic performance`;
    break;
}

prompt += `

🚨 CRITICAL: DO NOT USE CHARACTERISTICS FROM OTHER WIDA LEVELS.
🚨 VERIFY: This worksheet MUST demonstrate LEVEL ${widaInfo.level} language complexity.
🚨 CHECK: Student tasks MUST require LEVEL ${widaInfo.level} academic discourse.

**ADAPTATION REQUIREMENTS:**
- **Subject:** ${subject} (${materialType})
- **MANDATORY LEVEL:** WIDA Level ${widaInfo.level} - ${widaInfo.label}
- **Language Complexity:** ${adaptationRules.sentenceLength}
- **Vocabulary Expectations:** ${adaptationRules.vocabulary}
- **Grammar Requirements:** ${adaptationRules.grammarStructures}
- **Support Level:** ${adaptationRules.supports}
- **Assessment Type:** ${adaptationRules.assessmentTypes}`;

prompt += `

**CONTENT ANALYSIS:**
- Type: ${contentAnalysis.contentType}
- Complexity: ${contentAnalysis.complexity.level}
- Items: ${contentAnalysis.totalItems}
- Word Count: ${contentAnalysis.wordCount}`;

 // Add math-specific formatting requirements
 if (isMathContent) {
   prompt += `\n\n**MATHEMATICAL FORMATTING REQUIREMENTS:**
- Use proper mathematical symbols: ², ³, √, ±, ≤, ≥, ≠, °, ×, ÷
- Create clear tables for systems of equations with proper spacing
- Include coordinate grids for graphing problems when appropriate
- Use step-by-step formatting for multi-step problems
- Bold mathematical terms and highlight key formulas
- Include work space and answer verification sections
- Preserve ALL mathematical content and numbers exactly as given
- Add visual math templates when helpful (geometry shapes, coordinate planes)
- Use proper mathematical typography and formatting`;
 }

 prompt += `\n\n**CRITICAL FORMATTING RULES:**
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

prompt += `

🔍 FINAL VERIFICATION REQUIREMENTS:
Before generating the worksheet, confirm:
1. Language complexity matches LEVEL ${widaInfo.level} expectations
2. Student tasks require LEVEL ${widaInfo.level} academic discourse
3. Vocabulary and grammar align with LEVEL ${widaInfo.level} standards
4. Assessment methods appropriate for LEVEL ${widaInfo.level} students
5. NO elements from LEVEL 1, 2, or 3 included

EXAMPLES OF WHAT LEVEL ${widaInfo.level} STUDENTS CAN DO:
${widaInfo.level >= 4 ? 
  '- Analyze complex scientific phenomena using evidence-based reasoning\n- Construct multi-paragraph explanations with sophisticated vocabulary\n- Engage in academic argumentation with minimal scaffolding\n- Synthesize information from multiple sources independently' :
  '- Use basic academic vocabulary with support\n- Complete guided analysis tasks\n- Respond using sentence frames and scaffolding'
}`;

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

// ADD THIS SECTION:
  // Detect if this is math content for typography enhancements
  const mathSubject = detectMathSubject(params.subject, params.contentToAdapt);
  const mathSubjects = ['geometry', 'algebra', 'statistics', 'basic_math', 'mathematics'];
  const scienceSubjects = ['biology', 'chemistry', 'physics', 'general_science'];
  const isMathContent = mathSubjects.includes(mathSubject) || 
                       (scienceSubjects.includes(mathSubject) && contentAnalysis.hasMath);
  
 const result = await callClaudeAPI([{ role: 'user', content: prompt }], tokenLimit);
 
 // Apply ALL enhancements here
 let enhancedWorksheet = result.content[0].text;
 
// Temporarily disable mathematical typography to fix markdown corruption
if (isMathContent) {
   enhancedWorksheet = enhanceMathematicalTypography(enhancedWorksheet);
 }
 
 // Apply formatting enhancements
if (isMathContent) {
  enhancedWorksheet = enhanceMathematicalTypography(enhancedWorksheet);
  enhancedWorksheet = enhanceWorksheetFormatting(enhancedWorksheet);
  enhancedWorksheet = fixTableFormatting(enhancedWorksheet);
}
 
 return enhancedWorksheet;
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
 
 // Detect math subject for enhanced teacher notes
 const mathSubject = detectMathSubject(subject, params.contentToAdapt);
// Define what subjects should get math enhancements
const mathSubjects = ['geometry', 'algebra', 'statistics', 'basic_math', 'mathematics'];
const scienceSubjects = ['biology', 'chemistry', 'physics', 'general_science'];

// Only apply math features to actual math subjects OR science with math content
const isMathContent = mathSubjects.includes(mathSubject) || 
                     (scienceSubjects.includes(mathSubject) && contentAnalysis.hasMath);

// Debug output
console.log('DEBUG: mathSubject =', mathSubject, 'isMathContent =', isMathContent);
 
 let teacherGuide = `# Teacher's Guide: ${subject} - ${WIDA_LEVELS[proficiencyLevel.toLowerCase()].label}

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
- ${getMaterialsBySubject(mathSubject)}
- Vocabulary reference materials
- ${getSubjectSpecificMaterials(mathSubject)}

## Key Vocabulary Terms
${keyVocabulary}

## Suggested Pacing
- **Vocabulary Introduction:** 8-12 minutes
- **Main Activity:** ${calculateActivityTime(contentAnalysis)} minutes
- **Review & Discussion:** 10-15 minutes
- **Total Estimated Time:** ${calculateTotalTime(contentAnalysis)} minutes`;

// Subject-specific adaptations
const subjectCategory = getSubjectCategory(mathSubject);

if (subjectCategory === 'ELA') {
  teacherGuide += `\n\n## Literary Content Notes
- All literary content and authentic language preserved from original
- Text complexity maintained while adapting language structures
- Literary analysis scaffolded for ${proficiencyLevel} level students
- Assessment focuses on textual evidence and interpretation
- **Important:** Original text integrity maintained for authentic analysis

## Literary Vocabulary Support
- Literary terms defined with examples and context
- Complex vocabulary supported with synonyms and explanations
- Metaphorical language explained while preserving poetic meaning
- Text-based evidence instruction provided`;
}

if (subjectCategory === 'SOCIAL_STUDIES') {
  teacherGuide += `\n\n## Social Studies Content Notes
- All historical content and factual information preserved from original
- Historical analysis scaffolded while maintaining academic rigor
- Primary source interpretation adapted to ${proficiencyLevel} level
- Assessment focuses on evidence-based historical reasoning
- **Important:** Historical accuracy maintained throughout adaptation

## Historical Vocabulary Support
- Historical terms defined with context and examples
- Geographic and cultural references explained appropriately
- Timeline and chronological thinking supported with visual aids
- Primary source analysis instruction provided`;
}

// Add math-specific formatting requirements
if (isMathContent) {
   teacherGuide += `\n\n## Mathematical Content Notes
- All mathematical content and factual information preserved from original
- Mathematical procedures maintained while adapting language complexity
- Key mathematical vocabulary bolded throughout for emphasis
- Assessment validity maintained through careful adaptation
- **Important:** Answer keys from original materials remain valid

## Mathematical Vocabulary Support
- Mathematical symbols properly formatted (², √, ±, etc.)
- Key mathematical terms translated where appropriate
- Step-by-step problem-solving procedures scaffolded
- Visual supports provided for geometric concepts`;

   // Add subject-specific math guidance
   switch (mathSubject) {
     case 'algebra':
       teacherGuide += `\n\n## Algebra-Specific Support
- Systems of equations: Use table method before graphing
- Coordinate planes: Ensure students can plot points accurately
- Variables: Connect to concrete examples when possible`;
       break;
     case 'geometry':
       teacherGuide += `\n\n## Geometry-Specific Support
- Use visual aids and manipulatives when possible
- Connect measurements to real-world objects
- Practice mathematical vocabulary for shapes and spatial relationships`;
       break;
     case 'statistics':
       teacherGuide += `\n\n## Statistics-Specific Support
- Use real data that connects to students' experiences
- Practice reading and creating data tables
- Connect mathematical concepts to everyday decisions`;
       break;
   }
 }

 teacherGuide += `\n\n## Teaching Notes
- ${isMathContent ? 'Mathematical content' : 'All content'} preserved from original while adapting language structures
- Language structures adapted to ${proficiencyLevel} proficiency level
- Key vocabulary terms bolded throughout for emphasis
- Assessment validity maintained through careful adaptation

## Extension Activities
- Peer discussion of key concepts using sentence frames
- Vocabulary journal entries with drawings or examples
- ${getExtensionsBySubject(mathSubject, contentAnalysis)}

## Differentiation Suggestions
- **Above Level:** Encourage use of more complex sentence structures
- **Below Level:** Provide additional visual supports and sentence frames
- **ELD Newcomers:** Partner with bilingual peer mentor if available

${params.includeBilingualSupport && params.listCognates ? generateCognateSection(params.nativeLanguage, studentWorksheet) : ''}

## Assessment Criteria
Focus on content understanding while allowing for developing language proficiency. Accept language that demonstrates comprehension even if not grammatically perfect.`;

 return teacherGuide;
};

// =====================================================
// QUALITY VALIDATION (EXISTING)
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
// LONG CONTENT PROCESSING (EXISTING)
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
     hasMath: contentAnalysis.hasMath,
     mathSubject: detectMathSubject(params.subject, params.contentToAdapt),
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
     hasMath: contentAnalysis.hasMath,
     mathSubject: detectMathSubject(params.subject, params.contentToAdapt),
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
       strategy: isLongContent ? 'two_step' : 'standard',
       mathSubject: detectMathSubject(params.subject, params.contentToAdapt),
       enhancementsApplied: {
         mathematicalTypography: contentAnalysis.hasMath,
         worksheetFormatting: true,
         tableFormatting: true
       }
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
