// FileName: src/constants/widaData.js

const widaContent = {
  // CHANGED: Keys now use "levelentering", "levelbeginning" to match the form values.
  "levelentering-English Language Arts-9-12": {
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
  "levelbeginning-English Language Arts-9-12": {
    level: "Beginning (Level 2)",
    grade: "9-12",
    subject: "English Language Arts",
    listening: ["Follow two-step oral directions.", "Locate information from a read-aloud of a familiar text."],
    speaking: ["Ask simple questions about the text (e.g., 'Who?', 'What?').", "Describe key scenes or characters using short sentences."],
    reading: [ /* You can fill this out later */ ],
    writing: [ /* You can fill this out later */ ],
  },
  // ... add more combinations here in the future
};

export const getWidaDescriptors = (level, subject, grade) => {
  // This logic correctly creates the grade band
  const gradeBand = (grade && (grade.includes('9') || grade.includes('10') || grade.includes('11') || grade.includes('12'))) ? '9-12' : '9-12';
  
  // This now creates the correct key, e.g., "levelentering-English Language Arts-9-12"
  const key = `level${level}-${subject}-${gradeBand}`;
  
  // The lookup will now succeed!
  return widaContent[key] || null;
};
