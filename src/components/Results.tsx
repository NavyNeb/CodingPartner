import { useState } from 'react';
import type { RunReport } from '../runner/execute';
import { Icon } from './Icon';

interface Props {
  report: RunReport | null;
  running: boolean;
  onJump?: (line: number) => void;
  footer?: React.ReactNode;
}

export function ResultsPanel({ report, running, onJump, footer }: Props) {
  const [tab, setTab] = useState<'tests' | 'console'>('tests');
  const logs = report?.logs ?? [];
  const failed = report?.tests.filter((t) => t.status === 'fail').length ?? 0;
  const passed = report?.tests.filter((t) => t.status === 'pass').length ?? 0;
  const total = report?.tests.length ?? 0;

  return (
    <section className="results" aria-label="Results">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'tests'} className="tab" onClick={() => setTab('tests')}>
          Tests
          {report && !report.fatal && total > 0 && (
            <span className={`count ${failed ? 'bad' : 'good'}`}>{passed}/{total}</span>
          )}
        </button>
        <button role="tab" aria-selected={tab === 'console'} className="tab" onClick={() => setTab('console')}>
          Console{logs.length > 0 && <span className="count">{logs.length}</span>}
        </button>
        <span className="tabs-spacer" />
        {report && <span className="run-meta">{report.ms} ms</span>}
      </div>

      <div className="results-body" role="tabpanel">
        {footer}
        {tab === 'console' ? (
          logs.length === 0 ? (
            <Empty title="Nothing logged" body="console.log output from your code (and any React warnings) shows up here." />
          ) : (
            <ul className="console">
              {logs.map((l, i) => <li key={i} className={`log log-${l.level}`}><span className="log-level">{l.level}</span><pre>{l.text}</pre></li>)}
            </ul>
          )
        ) : running ? (
          <div className="running"><span className="spinner" aria-hidden="true" /> Running…</div>
        ) : !report ? (
          <Empty title="No results yet" body={<>Press <kbd>Run</kbd> or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to check your solution against the tests.</>} />
        ) : (
          <>
            {report.timedOut && (
              <div className="banner bad" role="alert">
                <b>Timed out</b> while running “{report.timedOut}”. That usually means an infinite loop or a promise that never settles.
              </div>
            )}
            {report.fatal && <div className="banner bad" role="alert"><pre>{report.fatal}</pre></div>}
            {report.diagnostics && report.diagnostics.length > 0 && (
              <div className="diagnostics">
                <h4>Type errors in your code</h4>
                <ul>
                  {report.diagnostics.map((d, i) => (
                    <li key={i}>
                      {d.line > 0 ? <button className="line-link" onClick={() => onJump?.(d.line)}>line {d.line}</button> : <span className="line-link">setup</span>}
                      <span>{d.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {total > 0 && (
              <>
                <div className="meter" aria-hidden="true">
                  {report.tests.map((t, i) => <i key={i} className={t.status} />)}
                </div>
                <ul className="tests">
                  {report.tests.map((t, i) => (
                    <li key={i} className={`test ${t.status}`}>
                      <span className="test-icon" aria-label={t.status === 'pass' ? 'passed' : t.status === 'fail' ? 'failed' : 'skipped'}>
                        <Icon name={t.status === 'pass' ? 'check' : t.status === 'fail' ? 'x' : 'chevronRight'} size={14} strokeWidth={2.4} />
                      </span>
                      <div>
                        <div className="test-name">
                          {t.suite.length > 0 && <span className="test-suite">{t.suite.join(' › ')} › </span>}
                          {t.name}
                        </div>
                        {t.error && <pre className="test-error">{t.error}</pre>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Empty({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      <p>{body}</p>
    </div>
  );
}
