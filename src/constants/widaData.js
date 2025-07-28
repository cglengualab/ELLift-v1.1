// This data structure holds the WIDA "Can Do" descriptors.
// We can expand this with more levels, subjects, and grade bands as needed.
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
    reading: [
      "Match vocabulary words to pictures or translations.",
      "Identify high-frequency words within a simplified text.",
    ],
    writing: [
      "Label key pictures or diagrams.",
      "Copy key vocabulary words or short sentences.",
    ],
  },
  // Add another example to show how it scales
  "level2-English Language Arts-9-12": {
    level: "Beginning (Level 2)",
    grade: "9-12",
    subject: "English Language Arts",
    listening: [
      "Follow two-step oral directions.",
      "Locate information from a read-aloud of a familiar text.",
    ],
    speaking: [
      "Ask simple questions about the text (e.g., 'Who?', 'What?').",
      "Describe key scenes or characters using short sentences.",
    ],
    reading: [ /* ... */ ],
    writing: [ /* ... */ ],
  },
  // ... add more combinations here
};

// This function finds and returns the correct data.
// Note: This is a simplified lookup. A more robust version could map multiple
// grade levels (e.g., '9th Grade', '10th Grade') to a single grade band ('9-12').
export const getWidaDescriptors = (level, subject, grade) => {
  // For now, we'll assume a direct match or a default band if grade is empty.
  const gradeBand = (grade && (grade.includes('9') || grade.includes('10') || grade.includes('11') || grade.includes('12'))) ? '9-12' : '9-12'; // Defaulting to 9-12 for simplicity
  const key = `level${level}-${subject}-${gradeBand}`;
  return widaContent[key] || null; // Return null if no match is found
};
