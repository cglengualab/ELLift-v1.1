// PDF processing service using PDF.js - Client-side only
let pdfjsLib;

/**
 * Load PDF.js dynamically from CDN
 */
const loadPDFJS = async () => {
  if (pdfjsLib) return pdfjsLib;
  
  try {
    // Load PDF.js from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    document.head.appendChild(script);
    
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
    
    // Set up worker and return library
    if (window.pdfjsLib) {
      pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return pdfjsLib;
    } else {
      throw new Error('PDF.js failed to load from CDN');
    }
  } catch (error) {
    console.error('Failed to load PDF.js:', error);
    throw new Error('Could not load PDF processing library. Please copy and paste your text instead.');
  }
};

/**
 * Extract text from PDF file using PDF.js (client-side only)
 */
export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    setProcessingStep('Loading PDF library...');
    
    // Load PDF.js library
    const pdfLib = await loadPDFJS();
    
    setProcessingStep('Reading PDF file...');

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    setProcessingStep('Loading PDF document...');

    // Load PDF document
    const loadingTask = pdfLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    setProcessingStep(`Extracting text from ${pdf.numPages} page(s)...`);

    let extractedText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      setProcessingStep(`Processing page ${pageNum} of ${pdf.numPages}...`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with proper spacing
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      if (pageText) {
        // Add page break indicator for multi-page documents
        if (extractedText && pdf.numPages > 1) {
          extractedText += '\n\n--- PAGE BREAK ---\n\n';
        }
        extractedText += pageText;
      }
    }

    setProcessingStep('PDF text extraction complete!');

    if (!extractedText.trim()) {
      throw new Error('No text could be extracted from this PDF. It might be image-based, password protected, or contain no readable text.');
    }

    // Clean up the extracted text
    const cleanedText = extractedText
      .replace(/\n{3,}/g, '\n\n') // Replace multiple line breaks with double line breaks
      .trim();

    return cleanedText;

  } catch (error) {
    console.error('PDF processing error:', error);
    
    // Handle specific PDF.js errors
    if (error.name === 'PasswordException') {
      throw new Error('This PDF is password protected. Please unlock it first or copy the text manually.');
    } else if (error.name === 'InvalidPDFException') {
      throw new Error('This file is not a valid PDF. Please check the file and try again.');
    } else if (error.message?.includes('Loading') || error.message?.includes('load')) {
      throw new Error('Failed to load PDF or PDF library. Please try copying the text manually.');
    } else if (error.message?.includes('No text')) {
      throw new Error('No readable text found in this PDF. It might be image-based. Try copying the text manually.');
    } else {
      // Re-throw our custom errors, wrap others
      if (error.message?.includes('copy and paste') || error.message?.includes('manually')) {
        throw error;
      } else {
        throw new Error(`PDF processing failed: ${error.message}. Please try copying the text from your PDF manually.`);
      }
    }
  }
};
