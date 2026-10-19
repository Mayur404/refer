import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import CodeHelp from "../components/CodeHelp.jsx";
import { languages } from "../data/languages.js";
import { runRemote } from "../services/compiler.js";
import { errorMessage } from "../utils/format.js";
import { indentationEdit } from "../utils/indentation.js";
import { EDITOR_LIMITS } from "../../shared/limits.js";

export default function Compiler() {
  const [language, setLanguage] = useState("cpp");
  const [sources, setSources] = useState(() =>
    Object.fromEntries(
      Object.entries(languages).map(([key, item]) => [key, item.starter]),
    ),
  );
  const code = sources[language];
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");
  const [running, setRunning] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const runRef = useRef(null);
  const editorRef = useRef(null);
  const editorSelection = useRef(null);
  const tabNavigation = useRef(false);
  const definition = languages[language];

  useEffect(() => () => runRef.current?.abort(), []);
  useLayoutEffect(() => {
    const selection = editorSelection.current;
    if (!selection) return;
    editorSelection.current = null;
    const editor = editorRef.current;
    editor.setSelectionRange(
      selection.start,
      selection.end,
      selection.direction,
    );
    editor.scrollTop = selection.scrollTop;
    editor.scrollLeft = selection.scrollLeft;
  }, [code]);

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    setOutput("");
    setStatus("idle");
    setElapsed(null);
  }

  async function run() {
    if (runRef.current) return;
    if (!code.trim()) {
      setOutput("Write some code before running.");
      setStatus("error");
      return;
    }
    if (code.length > EDITOR_LIMITS.code) {
      setOutput(
        `Keep source code below ${EDITOR_LIMITS.code.toLocaleString()} characters.`,
      );
      setStatus("error");
      return;
    }
    const controller = new AbortController();
    runRef.current = controller;
    setRunning(true);
    setStatus("running");
    setOutput("");
    setElapsed(null);
    const start = performance.now();
    try {
      const result = await runRemote(language, code, input, controller.signal);
      if (controller.signal.aborted || runRef.current !== controller) return;
      setOutput(result.output || "(Program completed with no output.)");
      setStatus(result.success ? "success" : "error");
    } catch (error) {
      if (controller.signal.aborted || runRef.current !== controller) return;
      setOutput(errorMessage(error));
      setStatus("error");
    } finally {
      if (!controller.signal.aborted && runRef.current === controller) {
        runRef.current = null;
        setElapsed(((performance.now() - start) / 1000).toFixed(2));
        setRunning(false);
      }
    }
  }

  function stop() {
    runRef.current?.abort();
    runRef.current = null;
    setRunning(false);
    setStatus("cancelled");
    setOutput("Execution cancelled.");
  }

  function download() {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = definition.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      tabNavigation.current = true;
      return;
    }
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    if (event.key === "Tab" && tabNavigation.current) {
      tabNavigation.current = false;
      return;
    }
    tabNavigation.current = false;
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      run();
      return;
    }
    if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey)
      return;
    event.preventDefault();
    const editor = event.currentTarget;
    const edit = indentationEdit(
      editor.value,
      editor.selectionStart,
      editor.selectionEnd,
      event.shiftKey,
    );
    const next =
      editor.value.slice(0, edit.from) +
      edit.text +
      editor.value.slice(edit.to);
    if (next === editor.value || next.length > editor.maxLength) return;
    editorSelection.current = {
      start: edit.start,
      end: edit.end,
      direction: editor.selectionDirection,
      scrollTop: editor.scrollTop,
      scrollLeft: editor.scrollLeft,
    };
    editor.setSelectionRange(edit.from, edit.to);
    // Native text insertion preserves the browser's undo history where supported.
    if (!document.execCommand?.("insertText", false, edit.text)) {
      editor.setRangeText(edit.text, edit.from, edit.to, "end");
    }
    setSources((current) => ({ ...current, [language]: next }));
  }

  return (
    <>
      <h1 className="sr-only">Compiler</h1>
      <div className="editor-toolbar compiler-toolbar">
        <div
          className="language-tabs"
          role="group"
          aria-label="Programming language"
        >
          {Object.entries(languages).map(([key, item]) => (
            <button
              key={key}
              className={language === key ? "selected" : ""}
              onClick={() => changeLanguage(key)}
              aria-pressed={language === key}
              disabled={running}
            >
              <Icon name="code" size={16} />
              {item.label}
            </button>
          ))}
        </div>
        <div className="editor-actions">
          <button
            className="button button-outline button-small"
            onClick={download}
            aria-label={`Download ${definition.filename}`}
            title={`Download ${definition.filename}`}
          >
            <Icon name="download" size={15} />
            <span>Download</span>
          </button>
          {running ? (
            <button className="button button-small" onClick={stop}>
              Stop execution
            </button>
          ) : (
            <button className="button button-small" onClick={run}>
              <Icon name="play" size={15} />
              Run code
            </button>
          )}
        </div>
      </div>
      <CodeHelp
        key={language}
        language={definition.label}
        code={code}
        input={input}
        output={output}
        open={showHelp}
        onOpen={() => setShowHelp(true)}
        onClose={() => setShowHelp(false)}
      />
      <div className="compiler-layout">
        <section className="code-panel" aria-label="Source editor">
          <div className="panel-heading">
            <span className="editor-filename">
              <Icon name="code" size={17} />
              {definition.filename}
            </span>
            <span className="mono">{definition.label} / SOURCE</span>
          </div>
          <div className="code-editor">
            <div className="line-numbers" aria-hidden="true">
              {code.split("\n").map((_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>
            <textarea
              ref={editorRef}
              aria-label={`${definition.label} source code`}
              aria-describedby="editor-keyboard-help"
              value={code}
              onChange={(event) => {
                setSources((current) => ({
                  ...current,
                  [language]: event.target.value,
                }));
              }}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                tabNavigation.current = false;
              }}
              onScroll={(event) => {
                event.currentTarget.previousElementSibling.scrollTop =
                  event.currentTarget.scrollTop;
              }}
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
              maxLength={EDITOR_LIMITS.code}
              disabled={running}
            />
          </div>
          <div className="editor-status">
            <span className="mono">
              UTF-8 / {code.split("\n").length} LINES
            </span>
            <span className="mono">CTRL + ENTER TO RUN</span>
            <span className="mono" id="editor-keyboard-help">
              TAB INDENTS · SHIFT+TAB UNINDENTS · ESC THEN TAB EXITS
            </span>
          </div>
        </section>
        <div className="io-panels">
          <section className="input-panel">
            <div className="panel-heading">
              <label className="mono" htmlFor="stdin">
                STANDARD INPUT
              </label>
              <span className="mono">STDIN</span>
            </div>
            <textarea
              id="stdin"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Enter input for your program…"
              spellCheck="false"
              maxLength={EDITOR_LIMITS.input}
              disabled={running}
            />
            <p className="input-hint">
              {language === "java"
                ? "Entry point: class Main, without public."
                : "Read using your language’s standard input."}
            </p>
          </section>
          <section className="output-panel">
            <div className="panel-heading">
              <span className="mono">OUTPUT</span>
              <button
                className="clear-output"
                onClick={() => {
                  setOutput("");
                  setStatus("idle");
                  setElapsed(null);
                }}
                disabled={running || !output}
              >
                Clear
              </button>
              <span className={`mono execution-status ${status}`}>
                {running ? "RUNNING…" : status.toUpperCase()}
              </span>
            </div>
            <pre tabIndex={0} aria-label="Program output" aria-live="polite">
              {output ||
                (running
                  ? "Executing your program…"
                  : "// Run your code to see the result here.")}
            </pre>
            {elapsed && (
              <div className="execution-time mono">
                COMPLETED IN {elapsed}s · INCLUDING TRANSFER
              </div>
            )}
          </section>
        </div>
      </div>
      <div className="compiler-note">
        <p>
          Running sends your source and input to Wandbox. Availability depends
          on the external service.
        </p>
      </div>
    </>
  );
}
