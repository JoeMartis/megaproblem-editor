// Parser for edX Megaproblem XML format

import type {
  ProblemMetadata,
  Choice,
  MultipleChoiceQuestion,
  Solution,
  QuestionBlock,
  HtmlBlock,
  ProblemBlock,
  ParsedProblem,
} from '../types/problem';

// Parse the problem metadata from the root element
function parseMetadata(problemEl: Element): ProblemMetadata {
  return {
    displayName: problemEl.getAttribute('display_name') || 'Untitled Problem',
    maxAttempts: problemEl.getAttribute('max_attempts')
      ? parseInt(problemEl.getAttribute('max_attempts')!, 10)
      : null,
    markdown: problemEl.getAttribute('markdown'),
  };
}

// Parse a multiplechoiceresponse element
function parseMultipleChoice(el: Element): MultipleChoiceQuestion {
  const label = el.querySelector('label')?.textContent?.trim() || '';
  const choicegroup = el.querySelector('choicegroup');
  const shuffle = choicegroup?.getAttribute('shuffle') === 'true';

  const choices: Choice[] = [];
  const choiceEls = el.querySelectorAll('choice');
  choiceEls.forEach((choiceEl) => {
    choices.push({
      text: choiceEl.textContent?.trim() || '',
      correct: choiceEl.getAttribute('correct') === 'true',
    });
  });

  return {
    type: 'multiplechoice',
    label,
    choices,
    shuffle,
  };
}

// Parse a solution element
function parseSolution(el: Element): Solution {
  const detailedSolution = el.querySelector('.detailed-solution');
  let explanation = '';
  let htmlContent = '';

  if (detailedSolution) {
    // Get all paragraph content
    const paragraphs = detailedSolution.querySelectorAll('p');
    const texts: string[] = [];
    paragraphs.forEach((p, index) => {
      if (index === 0 && p.textContent?.trim() === 'Explanation') {
        return; // Skip the "Explanation" header
      }
      texts.push(p.textContent?.trim() || '');
    });
    explanation = texts.join('\n');
    htmlContent = detailedSolution.innerHTML;
  } else {
    htmlContent = el.innerHTML;
    explanation = el.textContent?.trim() || '';
  }

  return { explanation, htmlContent };
}

// Parse HTML block
function parseHtmlBlock(el: Element): HtmlBlock {
  return {
    type: 'html',
    content: el.innerHTML,
  };
}

// Main parser function
export function parseProblem(xmlString: string): ParsedProblem {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML Parse Error: ${parseError.textContent}`);
  }

  const problemEl = doc.querySelector('problem');
  if (!problemEl) {
    throw new Error('No <problem> element found');
  }

  const metadata = parseMetadata(problemEl);
  const blocks: ProblemBlock[] = [];
  let introHtml = '';

  // Process children in order
  const children = Array.from(problemEl.children);
  let foundFirstQuestion = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tagName = child.tagName.toLowerCase();

    if (tagName === 'html') {
      if (!foundFirstQuestion) {
        // This is intro HTML
        introHtml += child.innerHTML;
      } else {
        // This is an HTML block between questions
        blocks.push(parseHtmlBlock(child));
      }
    } else if (tagName === 'multiplechoiceresponse') {
      foundFirstQuestion = true;
      const question = parseMultipleChoice(child);

      // Look for the following solution
      let solution: Solution | null = null;
      if (i + 1 < children.length && children[i + 1].tagName.toLowerCase() === 'solution') {
        solution = parseSolution(children[i + 1]);
        i++; // Skip the solution in the next iteration
      }

      blocks.push({ question, solution });
    } else if (tagName === 'numericalresponse') {
      foundFirstQuestion = true;
      // Basic numerical response parsing
      const label = child.querySelector('label')?.textContent?.trim() || '';
      const answer = child.getAttribute('answer') || '';

      let solution: Solution | null = null;
      if (i + 1 < children.length && children[i + 1].tagName.toLowerCase() === 'solution') {
        solution = parseSolution(children[i + 1]);
        i++;
      }

      blocks.push({
        question: {
          type: 'numerical',
          label,
          answer,
          tolerance: '',
        },
        solution,
      });
    } else if (tagName === 'stringresponse') {
      foundFirstQuestion = true;
      const label = child.querySelector('label')?.textContent?.trim() || '';
      const answer = child.getAttribute('answer') || '';

      let solution: Solution | null = null;
      if (i + 1 < children.length && children[i + 1].tagName.toLowerCase() === 'solution') {
        solution = parseSolution(children[i + 1]);
        i++;
      }

      blocks.push({
        question: {
          type: 'string',
          label,
          answer,
        },
        solution,
      });
    }
    // Skip standalone solution elements (they're handled with their questions)
  }

  return { metadata, introHtml, blocks };
}

// Better XML formatter that preserves inline content
export function formatXmlPreserveInline(xml: string, indentSize: number = 2): string {
  const PADDING = ' '.repeat(indentSize);

  // Parse and re-serialize for proper formatting
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // If parsing fails, return original
    return xml;
  }

  function formatNode(node: Node, indent: number): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      if (!text) return '';
      return text;
    }

    if (node.nodeType === Node.COMMENT_NODE) {
      return PADDING.repeat(indent) + `<!--${node.textContent}-->`;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as Element;
    const tagName = el.tagName;

    // Build attributes string
    let attrs = '';
    for (const attr of Array.from(el.attributes)) {
      attrs += ` ${attr.name}="${attr.value}"`;
    }

    // Check if this element has only text content
    const hasOnlyText = el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE;
    const hasNoChildren = el.childNodes.length === 0;

    // Inline elements that should stay on one line
    const inlineElements = ['choice', 'label', 'p', 'span', 'a', 'strong', 'em', 'code'];
    const isInline = inlineElements.includes(tagName.toLowerCase()) || hasOnlyText;

    if (hasNoChildren) {
      return PADDING.repeat(indent) + `<${tagName}${attrs}></${tagName}>`;
    }

    if (isInline && hasOnlyText) {
      const text = el.textContent?.trim() || '';
      return PADDING.repeat(indent) + `<${tagName}${attrs}>${text}</${tagName}>`;
    }

    // Format children
    let result = PADDING.repeat(indent) + `<${tagName}${attrs}>`;
    let childContent = '';
    let hasElementChildren = false;

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        hasElementChildren = true;
      }
      const formatted = formatNode(child, indent + 1);
      if (formatted) {
        childContent += '\n' + formatted;
      }
    }

    if (hasElementChildren) {
      result += childContent + '\n' + PADDING.repeat(indent) + `</${tagName}>`;
    } else {
      // Text content only
      const text = el.textContent?.trim() || '';
      result += text + `</${tagName}>`;
    }

    return result;
  }

  return formatNode(doc.documentElement, 0);
}

// Count questions in problem
export function countQuestions(parsed: ParsedProblem): number {
  return parsed.blocks.filter((b): b is QuestionBlock => 'question' in b).length;
}

// Validate problem structure
export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  questionIndex?: number;
}

export function validateProblem(parsed: ParsedProblem): ValidationError[] {
  const errors: ValidationError[] = [];

  let questionIndex = 0;
  for (const block of parsed.blocks) {
    if ('question' in block) {
      questionIndex++;
      const q = block.question;

      if (q.type === 'multiplechoice') {
        // Check that at least one choice is correct
        const hasCorrect = q.choices.some((c) => c.correct);
        if (!hasCorrect) {
          errors.push({
            type: 'error',
            message: `Question ${questionIndex} has no correct answer`,
            questionIndex,
          });
        }

        // Check for empty choices
        const emptyChoices = q.choices.filter((c) => !c.text.trim());
        if (emptyChoices.length > 0) {
          errors.push({
            type: 'warning',
            message: `Question ${questionIndex} has empty choice(s)`,
            questionIndex,
          });
        }
      }

      // Check for missing solution
      if (!block.solution || !block.solution.explanation.trim() ||
          block.solution.explanation === 'Add your explanation here') {
        errors.push({
          type: 'warning',
          message: `Question ${questionIndex} is missing an explanation`,
          questionIndex,
        });
      }
    }
  }

  return errors;
}
