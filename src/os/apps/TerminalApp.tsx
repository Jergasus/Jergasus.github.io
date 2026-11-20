'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { runCommand, type TerminalLine } from '../terminal/commands';
import { localizedPath } from '@/i18n/localized-path';
import { PREF_KEYS, writePref } from '../storage';
import { useOs } from '../context';

const PROMPT = 'jesus@jg-os:~$';

type OutputEntry = { id: number; text: string; isInput: boolean };

let nextId = 0;
const makeId = () => ++nextId;

/** Set data-theme and persist to storage, without importing useTheme. */
function applyTheme(theme: 'light' | 'dark') {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  writePref(PREF_KEYS.theme, theme);
}

/**
 * Terminal app: a prompt, a history-aware input, and a translated output log.
 */
export function TerminalApp() {
  const t = useTranslations('os');
  const tWork = useTranslations('work');
  const { openApp } = useOs();
  const pathname = usePathname();

  // t is stable per locale; the lazy initializer runs once at mount.
  const [entries, setEntries] = useState<OutputEntry[]>(() => [
    { id: makeId(), text: t('terminal.welcome'), isInput: false },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the bottom whenever entries change.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  /** Translate a TerminalLine to a human-readable string. */
  const translateLine = useCallback(
    (line: TerminalLine): string => {
      if ('raw' in line) return line.raw;

      const { key, values } = line;

      // os.terminal.project has a {status} value that is itself a work.* key.
      if (key === 'os.terminal.project' && values?.status) {
        const statusKey = values.status as string;
        const translatedStatus = statusKey.startsWith('work.')
          ? tWork(statusKey.slice('work.'.length) as Parameters<typeof tWork>[0])
          : statusKey;
        return t(key.slice('os.'.length) as Parameters<typeof t>[0], {
          ...values,
          status: translatedStatus,
        } as Parameters<typeof t>[1]);
      }

      if (key.startsWith('os.')) {
        return t(key.slice('os.'.length) as Parameters<typeof t>[0], values as Parameters<typeof t>[1]);
      }

      return key;
    },
    [t, tWork],
  );

  const push = (text: string, isInput: boolean) =>
    setEntries((prev) => [...prev, { id: makeId(), text, isInput }]);

  const submit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;

    // Echo the command
    push(`${PROMPT} ${cmd}`, true);

    // Add to history (most recent first)
    setHistory((prev) => [cmd, ...prev]);
    setHistIdx(-1);
    setInput('');

    const result = runCommand(cmd);

    // Add output lines
    for (const line of result.lines) {
      push(translateLine(line), false);
    }

    // Handle side effect
    const effect = result.effect;
    if (effect) {
      switch (effect.type) {
        case 'clear':
          setEntries([]);
          break;
        case 'open':
          openApp(effect.app);
          break;
        case 'locale':
          window.location.href = localizedPath(pathname, effect.locale);
          break;
        case 'theme':
          applyTheme(effect.theme);
          break;
      }
    }
  }, [input, openApp, pathname, translateLine]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(nextIdx);
      setInput(history[nextIdx]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx <= 0) {
        setHistIdx(-1);
        setInput('');
        return;
      }
      const nextIdx = histIdx - 1;
      setHistIdx(nextIdx);
      setInput(history[nextIdx]);
      return;
    }
  };

  return (
    <div className="os-terminal">
      {/* Output log */}
      <div
        role="log"
        ref={outputRef}
        className="os-terminal-output"
        aria-live="polite"
        aria-label={t('terminal.inputLabel')}
      >
        {entries.map((entry) => (
          <div key={entry.id} className={`os-terminal-line${entry.isInput ? ' os-terminal-line--input' : ''}`}>
            {entry.text}
          </div>
        ))}
      </div>

      {/* Input row */}
      <div className="os-terminal-row">
        <span className="os-terminal-prompt" aria-hidden="true">
          {PROMPT}
        </span>
        <label htmlFor="os-terminal-input" className="sr-only">
          {t('terminal.inputLabel')}
        </label>
        <input
          ref={inputRef}
          id="os-terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="os-terminal-input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
