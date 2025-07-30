# ELLift - AI-Powered ELL Material Adapter

![ELLift Logo](https://img.shields.io/badge/ELLift-AI%20ELL%20Adapter-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Vite](https://img.shields.io/badge/Vite-4-purple.svg)

**ELLift** is a modern web application that helps teachers adapt classroom materials for English Language Learners (ELL students) using AI-powered content transformation. Built with React and powered by Anthropic's Claude AI, it provides comprehensive adaptations across all 6 WIDA proficiency levels with bilingual support for 18+ languages.

🌐 **Live Demo**: [https://ellift.vercel.app/](https://ellift.vercel.app/)

## ✨ Key Features

### 🎯 WIDA-Aligned Adaptations
- **Complete 6-Level Support**: Entering (Level 1) through Reaching (Level 6)
- **Research-Based Scaffolding**: Authentic ELL pedagogical approaches for each proficiency level
- **Dynamic WIDA Descriptors**: Auto-generated "Can Do" statements aligned with lesson content
- **Subject-Specific Adaptations**: Specialized approaches for Math/Science vs. ELA/Social Studies

### 🌍 Comprehensive Bilingual Support
- **18+ Language Support**: Spanish, Mandarin Chinese, Arabic, Vietnamese, Korean, Tagalog, Russian, French, Portuguese, Japanese, Haitian Creole, Hindi, German, Italian, Polish, Urdu, Bengali, and more
- **Vocabulary Translations**: Key terms translated with proper formatting
- **Instruction Translation**: Bilingual directions for all activities
- **Cognate Identification**: Highlights English/native language cognates
- **Topic Summaries**: Pre-lesson summaries in students' native language

### 📚 Multi-Format Content Processing
- **PDF Upload Support**: Extract and adapt text from educational PDFs automatically
- **Text Input**: Direct paste and adaptation of any educational content
- **Material Type Flexibility**: Support for quizzes, worksheets, homework, and do-now activities
- **Grade Level Coverage**: 9th-12th grade materials

### 🧠 Advanced AI Integration
- **Claude AI Powered**: Uses Anthropic's Claude for intelligent content transformation
- **Vocabulary Integration**: Key vocabulary terms consistently highlighted throughout materials
- **Content Preservation**: Mathematical problems and core content remain intact while adding ELL scaffolds
- **Print-and-Go Ready**: Complete worksheets with zero additional teacher preparation needed

### ♿ IEP Accommodations
- **Flexible Worksheet Length**: Short (5-10 min), Medium (15-25 min), Long (30+ min)
- **Student Checklists**: Sequential task lists for independent work
- **Multiple Choice Options**: Convert open-ended questions to structured formats
- **Visual Supports**: Extensive graphic organizers and visual cues

### 🎨 AI-Generated Visual Aids
- **Smart Image Detection**: Automatically identifies opportunities for visual supports
- **Safe Educational Prompts**: Ready-to-use AI image generator prompts for teachers
- **Subject-Specific Visuals**: Tailored suggestions for math diagrams, science illustrations, and more
- **Classroom Appropriate**: All suggestions designed for educational use
- **Integrated Generator**: Built-in image generation interface with multiple AI providers

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- Anthropic Claude API key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/teacherrudiestre/ELLift.git
   cd ELLift
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_CLAUDE_API_KEY=your_anthropic_api_key_here
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 📖 How to Use ELLift

### Step 1: Input Your Content
- **Paste text** directly into the text area, or
- **Upload a PDF** file to automatically extract text

### Step 2: Configure Adaptation Settings
- **Material Type**: Select from Do Now, Quiz/Assessment, Classwork/Worksheet, or Homework
- **Subject**: Choose from Mathematics, English Language Arts, Science, Social Studies, History, Biology, Chemistry, Physics, Geometry, or Algebra
- **Grade Level**: Select 9th-12th grade
- **WIDA Proficiency Level**: Choose from Entering (1) through Reaching (6)

### Step 3: Set Learning Objectives
- Define what students should learn from the material

### Step 4: Configure Bilingual Support (Optional)
- **Native Language**: Select from 18+ supported languages
- **Translation Options**: Enable vocabulary translations, instruction translations, and cognate identification
- **Summary Translation**: Add native language topic summaries

### Step 5: Add IEP Accommodations (Optional)
- **Worksheet Length**: Adjust timing expectations
- **Student Checklist**: Add sequential task lists
- **Multiple Choice**: Convert to structured response formats

### Step 6: Generate Adapted Materials
- Click "Adapt Material" to process your content
- Receive complete student worksheet, teacher guide, and WIDA descriptors
- Optional: Use the integrated image generator for visual supports
- Access AI-generated image prompts for external image creation tools

## 🏗️ Project Structure

```
├── api/                     # Backend API routes
│   ├── claude.js               # Claude AI API endpoint
│   ├── extract-text.mjs        # Text extraction service
│   ├── generateImage.js        # AI image generation
│   └── image.js                # Image processing
├── public/                  # Static assets
│   ├── pdf.worker.js           # PDF processing worker
│   └── vite.svg                # Vite logo
├── server/                  # Server configuration
│   ├── package.json            # Server dependencies
│   └── server.js               # Express server setup
├── src/                     # React application source
│   ├── components/             # React components
│   │   ├── DynamicWidaCard.jsx    # Dynamic WIDA descriptors
│   │   ├── ELLMaterialAdapter.jsx # Main application component
│   │   ├── ErrorAlert.jsx         # Error handling component
│   │   ├── GenerateImageButton.jsx # AI image generation UI
│   │   ├── ImageGenerator.jsx     # Image generator interface
│   │   ├── LoadingSpinner.jsx     # Loading indicator
│   │   └── WidaCard.jsx           # WIDA descriptor display
│   ├── constants/              # Configuration constants
│   │   ├── options.js             # Form options and dropdowns
│   │   └── widaData.js            # WIDA proficiency descriptors
│   └── services/               # Frontend services
│       ├── claudeService.js       # Claude AI integration
│       ├── imageService.js        # Image generation service
│       └── pdfService.js          # PDF text extraction
├── .env                     # Environment variables
├── .env.example            # Environment template
├── .gitignore              # Git ignore rules
├── README.md               # Project documentation
├── eslintrc.js             # ESLint configuration
├── index.html              # HTML entry point
├── package.json            # Project dependencies
├── postcss.config.js       # PostCSS configuration
└── vite.config.js          # Vite build configuration
```

## 🎯 WIDA Proficiency Level Adaptations

### Level 1 (Entering)
- **Language**: 3-5 word sentences maximum
- **Supports**: Extensive visuals, word banks, fill-in-the-blank
- **Format**: Matching, pointing, drawing activities
- **Instructions**: Broken into tiny, numbered steps

### Level 2 (Emerging)
- **Language**: 6-10 word sentences with basic connectors
- **Supports**: Visual organizers, sentence starters
- **Format**: Yes/no, multiple choice, guided examples
- **Instructions**: Simple sequence with visual cues

### Level 3 (Developing)
- **Language**: Expanded sentences with multiple clauses
- **Supports**: Sentence frames, graphic organizers
- **Format**: Mix of structured and semi-open responses
- **Instructions**: Step-by-step reasoning guides

### Level 4 (Expanding)
- **Language**: Complex sentences with academic vocabulary
- **Supports**: Minimal scaffolding, text-based learning
- **Format**: Analysis and evaluation tasks
- **Instructions**: Justification and reasoning requirements

### Level 5 (Bridging)
- **Language**: Grade-level academic language with strategic supports
- **Supports**: Advanced academic language functions
- **Format**: Synthesis and critique tasks
- **Instructions**: Extended explanations and peer review

### Level 6 (Reaching)
- **Language**: Full grade-level academic language
- **Supports**: Minimal to no scaffolding
- **Format**: Abstract reasoning and formal communication
- **Instructions**: Metacognitive reflection and complex analysis

## 🧪 Subject-Specific Adaptations

### Mathematics & Science
- **Content Preservation**: All original problems, equations, and numbers preserved
- **Scaffolding**: Language support added around problems without changing mathematical content
- **Answer Key Compatibility**: Teacher answer keys remain valid
- **Visual Supports**: Coordinate planes, diagrams, and mathematical illustrations

### ELA & Social Studies
- **Text Adaptation**: Complexity adjusted by proficiency level
- **Author's Voice**: Preserved at higher levels (Bridging/Reaching)
- **Reading Supports**: Chunking, headings, and context clues
- **Analysis Tasks**: Scaffolded critical thinking activities

## 🌍 Supported Languages

**Primary Languages**: Spanish, Mandarin Chinese, Arabic, Vietnamese, Korean, Tagalog, Russian, French, Portuguese, Japanese

**Additional Languages**: Haitian Creole, Hindi, German, Italian, Polish, Urdu, Bengali

**Custom Support**: "Other" option for additional languages

## 🛠️ Technology Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite 4
- **Styling**: Tailwind CSS 3
- **Icons**: Lucide React
- **AI Integration**: Anthropic Claude API
- **PDF Processing**: PDF.js integration
- **Development**: ESLint, PostCSS, Autoprefixer

## 🔧 Performance Optimizations

- **Code Splitting**: Vendor libraries separated into chunks
- **Lazy Loading**: Components loaded on demand
- **Memoization**: Expensive calculations cached with React hooks
- **Optimized Assets**: Images and fonts optimized for web delivery
- **Fast Refresh**: Instant feedback during development

## 🌐 Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 📝 API Integration

ELLift features a full-stack architecture with both frontend and backend API integration:

### Backend Services (`/api/`)
- **Claude AI Endpoint** (`claude.js`): Handles Claude API requests with rate limiting and error handling
- **Text Extraction** (`extract-text.mjs`): Advanced PDF text processing and parsing
- **Image Generation** (`generateImage.js`): AI image creation with multiple provider support
- **Image Processing** (`image.js`): Image optimization and manipulation

### Frontend Services (`/src/services/`)
- **Claude Service** (`claudeService.js`): Frontend Claude AI integration with multi-call strategy
- **PDF Service** (`pdfService.js`): Client-side PDF text extraction
- **Image Service** (`imageService.js`): Image generation interface and management

### Key Features
- **Multi-Call Strategy**: Complex material adaptation using sequential API calls
- **Rate Limiting**: Intelligent request throttling and retry logic
- **Error Handling**: Comprehensive error management with graceful degradation
- **Timeout Protection**: 30-second request timeout with abort controllers
- **Input Validation**: Sanitization and response validation throughout
- **Content Preservation**: Mathematical integrity maintained while adding language scaffolds

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add some amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure browser compatibility
- Test with multiple WIDA levels and languages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Built with ❤️** for educators supporting English Language Learners
- **Powered by** Anthropic's Claude AI
- **UI components** inspired by modern design systems
- **WIDA standards** integration for authentic ELL support
- **Special thanks** to ELL teachers and students who inspire this work

## 📞 Support & Contact

- **Issues**: Please use the [GitHub Issues](https://github.com/teacherrudiestre/ELLift/issues) page
- **Feature Requests**: Submit via GitHub Issues with the "enhancement" label
- **Documentation**: Check the [Wiki](https://github.com/teacherrudiestre/ELLift/wiki) for detailed guides

---

**ELLift** - Empowering educators to create inclusive, accessible learning experiences for English Language Learners at every proficiency level.
