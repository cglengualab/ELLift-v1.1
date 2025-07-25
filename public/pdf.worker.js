// This file ensures PDF.js worker is available
// The actual worker will be loaded from CDN but this provides a fallback
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
