// Types for edX Megaproblem structure

export interface ProblemMetadata {
  displayName: string;
  maxAttempts: number | null;
  markdown: string | null;
}

export interface Choice {
  text: string;
  correct: boolean;
}

export interface MultipleChoiceQuestion {
  type: 'multiplechoice';
  label: string;
  choices: Choice[];
  shuffle: boolean;
}

export interface NumericalQuestion {
  type: 'numerical';
  label: string;
  answer: string;
  tolerance: string;
}

export interface StringQuestion {
  type: 'string';
  label: string;
  answer: string;
}

export type Question = MultipleChoiceQuestion | NumericalQuestion | StringQuestion;

export interface Solution {
  explanation: string;
  htmlContent: string;
}

export interface QuestionBlock {
  question: Question;
  solution: Solution | null;
}

export interface HtmlBlock {
  type: 'html';
  content: string;
}

export type ProblemBlock = QuestionBlock | HtmlBlock;

export interface ParsedProblem {
  metadata: ProblemMetadata;
  introHtml: string;
  blocks: ProblemBlock[];
}
