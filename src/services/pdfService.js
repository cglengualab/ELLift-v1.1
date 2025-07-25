// PDF processing service using PDF.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

/**
 * Extract text from PDF file using PDF.js
 */
export const extractTextFromPDF = async (file, setProcessingStep) => {
  try {
    setProcessingStep('Reading PDF file...');

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    setProcessingStep('Loading PDF document...');

    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    setProcessingStep(`Processing ${pdf.numPages} pages...`);

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      setProcessingStep(`Extracting text from page ${pageNum} of ${pdf.numPages}...`);
      
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with proper spacing
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
      
      if (pageText) {
        fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
      }
    }

    setProcessingStep('PDF processing complete!');

    if (!fullText.trim()) {
      throw new Error('No text could be extracted from the PDF. The PDF might be image-based or password protected.');
    }

    // Clean up the extracted text
    const cleanText = fullText
      .replace(/--- Page \d+ ---\n/g, '') // Remove page markers
      .replace(/\n{3,}/g, '\n\n') // Replace multiple line breaks with double line breaks
      .trim();

    return cleanText;

  } catch (error) {
    console.error('PDF processing error:', error);
    
    if (error.name === 'PasswordException') {
      throw new Error('This PDF is password protected. Please unlock it first or copy the text manually.');
    } else if (error.name === 'InvalidPDFException') {
      throw new Error('This file is not a valid PDF. Please check the file and try again.');
    } else if (error.message.includes('Loading')) {
      throw new Error('Failed to load PDF. The file might be corrupted or too large.');
    } else if (error.message.includes('No text')) {
      throw new Error('No text found in PDF. This might be an image-based PDF. Try using OCR software first or copy the text manually.');
    } else {
      throw new Error(`PDF processing failed: ${error.message}. Please try copying the text manually or use a different PDF.`);
    }
  }
};
