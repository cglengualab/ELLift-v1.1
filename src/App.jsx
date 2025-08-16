import React from 'react'
import ELLMaterialAdapter from './components/ELLMaterialAdapter'
import { Analytics } from '@vercel/analytics/react'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ELLMaterialAdapter />
      <Analytics />
    </div>
  )
}

export default App
