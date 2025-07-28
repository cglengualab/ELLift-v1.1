// FileName: src/constants/widaData.js

const widaContent = {
  // Key format: "level[number]-[subject]-[grade_band]"
  "level1-English Language Arts-9-12": {
    level: "Entering (Level 1)",
    grade: "9-12",
    subject: "English Language Arts",
    listening: [
      "Follow one-step oral directions with gestures or visuals.",
      "Point to objects, pictures, or words from an oral description.",
    ],
    speaking: [
      "Answer yes/no or choice questions about the text.",
      "Repeat key phrases or short sentences with a partner.",
    ],
    reading: ["Match vocabulary words to pictures or translations.", "Identify high-frequency words within a simplified text."],
    writing: ["Label key pictures or diagrams.", "Copy key vocabulary words or short sentences."],
  },
  "level2-English Language Arts-9-12": {
    level: "Beginning (Level 2)",
    grade: "9-12",
    subject: "English Language Arts",
    listening: ["Follow two-step oral directions.", "Locate information from a read-aloud of a familiar text."],
    speaking: ["Ask simple questions about the text (e.g., 'Who?', 'What?').", "Describe key scenes or characters using short sentences."],
    reading: [ /* ... */ ],
    writing: [ /* ... */ ],
  },
};

export const getWidaDescriptors = (level, subject, grade) => {
  const gradeBand = (grade && (grade.includes('9') || grade.includes('10') || grade.includes('11') || grade.includes('12'))) ? '9-12' : '9-12';
  const key = `level${level}-${subject}-${gradeBand}`;

  // NEW STYLED DEBUGGING LOGS TO MAKE THEM STAND OUT
  console.log('%c[WIDA DEBUGGER]', 'color: #fff; background-color: #7c3aed; padding: 2px 6px; border-radius: 4px; font-weight: bold;');
  console.log('Attempting to find WIDA key:', key);
  console.log('Available keys in widaData.js:', Object.keys(widaContent));
  
  return widaContent[key] || null;
};
