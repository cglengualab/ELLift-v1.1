// src/services/claudeService.js

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : window.location.origin;

/**
 * Make a request to our Claude API proxy
 */
const callClaudeAPI = async (messages, maxTokens = 3000) => {
  const formattedMessages = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    }
    return msg;
  });

  const response = await fetch(`${API_BASE_URL}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: formattedMessages, max_tokens: maxTokens })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `API request failed: ${response.status}`);
  }

  return response.json();
};

/**
 * Extract text from PDF file using Claude
 */
export const extractTextFromPDF = async (file, setProcessingStep) => {
  console.log("📁 [extractTextFromPDF] Uploading file:", file);

  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      console.log("🧪 [extractTextFromPDF] Base64 sample:", base64.slice(0, 50));
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  setProcessingStep('Extracting text');

  const response = await fetch(`${API_BASE_URL}/api/extract-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data })
  });

  console.log("📨 [extractTextFromPDF] Sent base64 to /api/extract-text");

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ [extractTextFromPDF] Server error:", errorText);
    throw new Error('PDF upload detected! Please copy the text from your PDF and paste it into the text area below.');
  }

  const data = await response.json();
  console.log("✅ [extractTextFromPDF] Response from server:", data);

  return data.text;
};
