import React from 'react'
import ELLMaterialAdapter from './components/ELLMaterialAdapter'
import { Analytics } from '@vercel/analytics/react'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <ELLMaterialAdapter />
        <Analytics />
      </div>
    </ErrorBoundary>
  )
}

export default App
