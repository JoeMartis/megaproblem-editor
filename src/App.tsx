import { useState, useCallback, useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { xml } from '@codemirror/lang-xml';
import { oneDark } from '@codemirror/theme-one-dark';
import { ProblemPreview } from './components/ProblemPreview';
import { parseProblem, formatXmlPreserveInline, validateProblem, countQuestions } from './utils/problemParser';
import type { ValidationError } from './utils/problemParser';
import type { ParsedProblem } from './types/problem';
import './App.css';

const SAMPLE_PROBLEM = `<problem display_name="Sample Problem" max_attempts="2" markdown="null">
  <html>
    <p>This is an example edX megaproblem. You can edit the XML on the left and see the preview on the right.</p>
  </html>

  <multiplechoiceresponse>
    <label>1) What is 2 + 2?</label>
    <choicegroup type="MultipleChoice" shuffle="false">
      <choice correct="false">3</choice>
      <choice correct="true">4</choice>
      <choice correct="false">5</choice>
      <choice correct="false">22</choice>
    </choicegroup>
  </multiplechoiceresponse>
  <solution>
    <div class="detailed-solution">
      <p>Explanation</p>
      <p>2 + 2 = 4. This is basic arithmetic.</p>
    </div>
  </solution>

  <multiplechoiceresponse>
    <label>2) Which planet is closest to the Sun?</label>
    <choicegroup type="MultipleChoice" shuffle="true">
      <choice correct="false">Venus</choice>
      <choice correct="true">Mercury</choice>
      <choice correct="false">Earth</choice>
      <choice correct="false">Mars</choice>
    </choicegroup>
  </multiplechoiceresponse>
  <solution>
    <div class="detailed-solution">
      <p>Explanation</p>
      <p>Mercury is the closest planet to the Sun in our solar system.</p>
    </div>
  </solution>
</problem>`;

function App() {
  const [xmlContent, setXmlContent] = useState(SAMPLE_PROBLEM);
  const [parsedProblem, setParsedProblem] = useState<ParsedProblem | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showSolutions, setShowSolutions] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isDragging = useRef(false);

  // Parse problem whenever XML content changes
  useEffect(() => {
    try {
      const parsed = parseProblem(xmlContent);
      setParsedProblem(parsed);
      setParseError(null);
      setValidationErrors(validateProblem(parsed));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unknown error');
      setParsedProblem(null);
      setValidationErrors([]);
    }
  }, [xmlContent]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setXmlContent(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: xmlContent,
      extensions: [
        basicSetup,
        xml(),
        oneDark,
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, []); // Only initialize once

  // Handle format button
  const handleFormat = useCallback(() => {
    const formatted = formatXmlPreserveInline(xmlContent);
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: formatted,
        },
      });
    }
    setXmlContent(formatted);
  }, [xmlContent]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (viewRef.current) {
        const currentContent = viewRef.current.state.doc.toString();
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        });
      }
      setXmlContent(content);
    };
    reader.readAsText(file);
  }, []);

  // Handle file download
  const handleDownload = useCallback(() => {
    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = parsedProblem?.metadata.displayName
      ? `${parsedProblem.metadata.displayName.replace(/\s+/g, '_')}.xml`
      : 'problem.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [xmlContent, parsedProblem]);

  // Handle panel resize
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const containerWidth = window.innerWidth;
      const newWidth = (e.clientX / containerWidth) * 100;
      setLeftPanelWidth(Math.min(Math.max(newWidth, 20), 80));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <h1 className="app-title">edX Megaproblem Editor</h1>
          {parsedProblem && (
            <span className="question-count">
              {countQuestions(parsedProblem)} questions
            </span>
          )}
        </div>
        <div className="toolbar-center">
          {validationErrors.length > 0 && (
            <div className="validation-summary">
              <span className="error-count">
                {validationErrors.filter(e => e.type === 'error').length} errors
              </span>
              <span className="warning-count">
                {validationErrors.filter(e => e.type === 'warning').length} warnings
              </span>
            </div>
          )}
        </div>
        <div className="toolbar-right">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showSolutions}
              onChange={(e) => setShowSolutions(e.target.checked)}
            />
            Show Solutions
          </label>
          <button onClick={handleFormat} className="btn btn-secondary">
            Format XML
          </button>
          <label className="btn btn-secondary">
            Open File
            <input
              type="file"
              accept=".xml"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleDownload} className="btn btn-primary">
            Download
          </button>
        </div>
      </header>

      <main className="editor-container">
        <div className="editor-panel" style={{ width: `${leftPanelWidth}%` }}>
          <div className="panel-header">
            <span>XML Editor</span>
          </div>
          <div className="codemirror-wrapper" ref={editorRef} />
        </div>

        <div
          className="resize-handle"
          onMouseDown={handleMouseDown}
        />

        <div className="preview-panel" style={{ width: `${100 - leftPanelWidth}%` }}>
          <div className="panel-header">
            <span>Preview</span>
          </div>
          <div className="preview-content">
            {parseError ? (
              <div className="parse-error">
                <h3>XML Parse Error</h3>
                <pre>{parseError}</pre>
              </div>
            ) : parsedProblem ? (
              <>
                {validationErrors.length > 0 && (
                  <div className="validation-errors">
                    {validationErrors.map((err, index) => (
                      <div key={index} className={`validation-item ${err.type}`}>
                        {err.type === 'error' ? '!' : '?'} {err.message}
                      </div>
                    ))}
                  </div>
                )}
                <ProblemPreview problem={parsedProblem} showSolutions={showSolutions} />
              </>
            ) : (
              <div className="no-content">
                Enter valid problem XML to see preview
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
