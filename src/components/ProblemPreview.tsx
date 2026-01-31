import { useState, useEffect, useRef } from 'react';
import type { ParsedProblem, QuestionBlock, HtmlBlock, MultipleChoiceQuestion } from '../types/problem';

// Declare MathJax global
declare global {
  interface Window {
    MathJax?: {
      typeset?: (elements?: HTMLElement[]) => void;
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}

interface ProblemPreviewProps {
  problem: ParsedProblem;
  showSolutions: boolean;
}

function MultipleChoicePreview({
  question,
  questionNumber,
  showSolution,
  solution
}: {
  question: MultipleChoiceQuestion;
  questionNumber: number;
  showSolution: boolean;
  solution: string | null;
}) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  return (
    <div className="question-block multiple-choice">
      <div className="question-label">
        {question.label}
      </div>
      <div className="choices">
        {question.choices.map((choice, index) => (
          <label
            key={index}
            className={`choice ${selectedChoice === index ? 'selected' : ''} ${showSolution && choice.correct ? 'correct' : ''}`}
          >
            <input
              type="radio"
              name={`question-${questionNumber}`}
              checked={selectedChoice === index}
              onChange={() => setSelectedChoice(index)}
            />
            <span className="choice-text">{choice.text}</span>
            {showSolution && choice.correct && (
              <span className="correct-indicator"> ✓</span>
            )}
          </label>
        ))}
      </div>
      {showSolution && solution && (
        <div className="solution">
          <div className="solution-header">Explanation</div>
          <div className="solution-content" dangerouslySetInnerHTML={{ __html: solution }} />
        </div>
      )}
    </div>
  );
}

function HtmlBlockPreview({ content }: { content: string }) {
  return (
    <div className="html-block" dangerouslySetInnerHTML={{ __html: content }} />
  );
}

function QuestionBlockPreview({
  block,
  questionNumber,
  showSolutions
}: {
  block: QuestionBlock;
  questionNumber: number;
  showSolutions: boolean;
}) {
  const { question, solution } = block;

  if (question.type === 'multiplechoice') {
    return (
      <MultipleChoicePreview
        question={question}
        questionNumber={questionNumber}
        showSolution={showSolutions}
        solution={solution?.htmlContent || null}
      />
    );
  }

  if (question.type === 'numerical') {
    return (
      <div className="question-block numerical">
        <div className="question-label">{question.label}</div>
        <input type="text" className="numerical-input" placeholder="Enter your answer" />
        {showSolutions && (
          <div className="solution">
            <div className="solution-header">Answer: {question.answer}</div>
            {solution && (
              <div className="solution-content" dangerouslySetInnerHTML={{ __html: solution.htmlContent }} />
            )}
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'string') {
    return (
      <div className="question-block string">
        <div className="question-label">{question.label}</div>
        <input type="text" className="string-input" placeholder="Enter your answer" />
        {showSolutions && (
          <div className="solution">
            <div className="solution-header">Answer: {question.answer}</div>
            {solution && (
              <div className="solution-content" dangerouslySetInnerHTML={{ __html: solution.htmlContent }} />
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function ProblemPreview({ problem, showSolutions }: ProblemPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  let questionNumber = 0;

  // Re-render MathJax when content changes
  useEffect(() => {
    const typesetMath = () => {
      if (window.MathJax?.typesetPromise && containerRef.current) {
        // Clear previous MathJax rendering
        window.MathJax.typesetPromise([containerRef.current]).catch((err) => {
          console.warn('MathJax typeset error:', err);
        });
      }
    };

    // Small delay to ensure DOM is updated
    const timer = setTimeout(typesetMath, 100);
    return () => clearTimeout(timer);
  }, [problem, showSolutions]);

  return (
    <div className="problem-preview" ref={containerRef}>
      <div className="problem-header">
        <h1 className="problem-title">{problem.metadata.displayName}</h1>
        {problem.metadata.maxAttempts && (
          <div className="max-attempts">
            Max attempts: {problem.metadata.maxAttempts}
          </div>
        )}
      </div>

      {problem.introHtml && (
        <div className="problem-intro" dangerouslySetInnerHTML={{ __html: problem.introHtml }} />
      )}

      <div className="problem-blocks">
        {problem.blocks.map((block, index) => {
          if ('type' in block && block.type === 'html') {
            return <HtmlBlockPreview key={index} content={(block as HtmlBlock).content} />;
          } else {
            questionNumber++;
            return (
              <QuestionBlockPreview
                key={index}
                block={block as QuestionBlock}
                questionNumber={questionNumber}
                showSolutions={showSolutions}
              />
            );
          }
        })}
      </div>
    </div>
  );
}
