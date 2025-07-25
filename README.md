# ELL Material Adapter

A modern web application built with Vite and React that helps teachers adapt classroom materials for English Language Learners (ELL students) using AI-powered content transformation.

## Features

- **PDF Upload Support**: Extract text from educational PDFs automatically
- **WIDA Proficiency Levels**: Adapt materials for all 5 WIDA English proficiency levels
- **Bilingual Support**: Optional native language vocabulary support for 18+ languages
- **Multiple Material Types**: Support for quizzes, worksheets, homework, and do-now activities
- **Claude AI Integration**: Powered by Anthropic's Claude for intelligent content adaptation
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Fast Development**: Vite-powered development with hot module replacement

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ell-material-adapter
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/           # React components
│   ├── ELLMaterialAdapter.jsx
│   ├── LoadingSpinner.jsx
│   └── ErrorAlert.jsx
├── constants/           # Configuration constants
│   └── options.js
├── services/           # API services
│   └── claudeService.js
├── App.jsx            # Main app component
├── main.jsx           # Application entry point
└── index.css          # Global styles
```

## Key Features Explained

### Material Adaptation Process

1. **Input**: Teachers can either paste text or upload PDF materials
2. **Configuration**: Select material type, subject, grade level, and student proficiency level
3. **Learning Objectives**: Specify what students should learn from the material
4. **Bilingual Support**: Optionally include native language vocabulary support
5. **AI Processing**: Claude analyzes and adapts the material with appropriate scaffolds
6. **Output**: Receive adapted material with language objectives and assessment modifications

### WIDA Proficiency Levels

- **Entering (Level 1)**: Extensive visual supports, simple language, word banks
- **Emerging (Level 2)**: Basic sentence structures, graphic organizers, choice questions
- **Developing (Level 3)**: Moderate vocabulary support, sentence frames, balanced tasks
- **Expanding (Level 4)**: Academic language with supports, complex thinking tasks
- **Bridging (Level 5)**: Grade-level language with strategic supports

### Supported Languages for Bilingual Support

Spanish, Mandarin Chinese, Arabic, Vietnamese, Korean, Tagalog, Russian, French, Portuguese, Japanese, Haitian Creole, Hindi, German, Italian, Polish, Urdu, Bengali, and more.

## Technology Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite 4
- **Styling**: Tailwind CSS 3
- **Icons**: Lucide React
- **AI Integration**: Anthropic Claude API
- **Development**: ESLint, PostCSS, Autoprefixer

## API Integration

The application integrates with Anthropic's Claude API for:
- PDF text extraction
- Intelligent material adaptation
- WIDA-aligned language objective generation
- Assessment modification suggestions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Performance Optimizations

- **Code Splitting**: Vendor libraries separated into chunks
- **Lazy Loading**: Components loaded on demand
- **Memoization**: Expensive calculations cached with React hooks
- **Optimized Assets**: Images and fonts optimized for web delivery
- **Fast Refresh**: Instant feedback during development

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with ❤️ for educators supporting English Language Learners
- Powered by Anthropic's Claude AI
- UI components inspired by modern design systems
- WIDA standards integration for authentic ELL support
