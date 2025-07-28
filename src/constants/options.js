import { FileText, Users, BookOpen, ClipboardList } from 'lucide-react';

export const materialTypes = [
  { value: 'do-now', label: 'Do Now Activity', icon: ClipboardList },
  { value: 'quiz', label: 'Quiz/Assessment', icon: FileText },
  { value: 'classwork', label: 'Classwork/Worksheet', icon: BookOpen },
  { value: 'homework', label: 'Homework Assignment', icon: Users }
];

export const subjects = [
  'Mathematics', 'English Language Arts', 'Science', 'Social Studies', 
  'History', 'Biology', 'Chemistry', 'Physics', 'Geometry', 'Algebra'
];

export const gradeLevels = ['9th Grade', '10th Grade', '11th Grade', '12th Grade'];

export const proficiencyLevels = [
  { value: 'entering', label: 'Entering (Level 1)' },
  { value: 'emerging', label: 'Emerging (Level 2)' },
  { value: 'developing', label: 'Developing (Level 3)' },
  { value: 'expanding', label: 'Expanding (Level 4)' },
  { value: 'bridging', label: 'Bridging (Level 5)' },
  { value: 'reaching', label: 'Reaching (Level 6)' }, // <-- ADDED
];

export const commonLanguages = [
  'Spanish', 'Mandarin Chinese', 'Arabic', 'Vietnamese', 'Korean', 
  'Tagalog', 'Russian', 'French', 'Portuguese', 'Japanese',
  'Haitian Creole', 'Hindi', 'German', 'Italian', 'Polish',
  'Urdu', 'Bengali', 'Other'
];
