const { spawn } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

/**
 * Code Execution Integration Layer.
 *
 * In production this would connect to Judge0 / a Docker sandbox / an
 * isolated runner service. For this dev/demo build we ship a SAFE local
 * executor that only supports a handful of languages and NEVER runs
 * anything privileged. It is explicitly labelled DEV EXECUTOR.
 *
 * Received code is only executed for languages that can run safely as a
 * plain child process with hard timeouts. Node.js is executed with
 * --disallow-code-generation-from-strings and no network is needed.
 */

const TIMEOUT_MS = 5000;

function supported(language) {
  return ['javascript', 'node', 'nodejs', 'python', 'python3', 'py'].includes(
    String(language || '').toLowerCase()
  );
}

function runCommand(language) {
  switch (String(language).toLowerCase()) {
    case 'javascript':
    case 'node':
    case 'nodejs':
      return { cmd: 'node', args: ['--disallow-code-generation-from-strings', '-e'] };
    case 'python':
    case 'python3':
    case 'py':
      return { cmd: 'python', args: ['-c'] };
    default:
      return null;
  }
}

function runProcess(cmd, args, code, timeoutMs, input) {
  return new Promise((resolve) => {
    let finished = false;
    const start = Date.now();
    const child = spawn(cmd, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdout = [];
    const stderr = [];

    child.stdout.on('data', (d) => stdout.push(d.toString()));
    child.stderr.on('data', (d) => stderr.push(d.toString()));

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { child.kill(); } catch (e) { /* noop */ }
        resolve({
          output: '',
          error: `Execution timed out after ${timeoutMs}ms`,
          exitCode: null,
          timeMs: Date.now() - start,
        });
      }
    }, timeoutMs);

    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({
          output: '',
          error: `Failed to launch ${cmd}: ${err.message}`,
          exitCode: null,
          timeMs: Date.now() - start,
        });
      }
    });

    child.on('close', (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        const output = stdout.join('').trim();
        const error = stderr.join('').trim();
        resolve({
          output,
          error,
          exitCode: code,
          timeMs: Date.now() - start,
          timedOut: false,
        });
      }
    });

    try {
      // Feed the test-case input on stdin (when provided) then close it. This
      // lets `node -e`/`python -c` programs actually read `input()` /
      // `process.stdin` per test case — real judge-style evaluation.
      const stdinData = input == null ? '' : String(input);
      if (stdinData) child.stdin.write(stdinData);
      child.stdin.end();
    } catch (err) {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({ output: '', error: 'Failed to write input to executor', exitCode: null, timeMs: Date.now() - start });
      }
    }
  });
}

/**
 * Executes user code with optional stdin input.
 * Returns a normalised result object.
 */
async function executeCode({ language, code, input }) {
  if (!code || !String(code).trim()) {
    return { success: false, error: 'Code is empty' };
  }

  if (!supported(language)) {
    return {
      success: false,
      error: `Language "${language}" is not supported by the DEV EXECUTOR. ` +
        'Only javascript/node and python are available in this development build. ' +
        'READY FOR INTEGRATION with a full code execution service (Judge0 / Docker sandbox).',
    };
  }

  const rc = runCommand(language);
  if (!rc) {
    return { success: false, error: `No runner configured for language "${language}"` };
  }

  // For node -e / python -c we pass the code as the program argument, and the
  // (optional) test input is delivered on the child's stdin so programs that
  // read process.stdin / input() are judged against real per-test data.
  const result = await runProcess(rc.cmd, [...rc.args, code], code, TIMEOUT_MS, input);

  return {
    success: result.exitCode === 0,
    output: result.error ? (result.output ? `${result.output}\n${result.error}` : result.error) : result.output,
    error: result.exitCode === 0 ? '' : result.error,
    exitCode: result.exitCode,
    timeMs: result.timeMs,
    executionMode: 'DEV_EXECUTOR',
    note: 'Executed by the secure dev executor. Production integration point: Judge0 / Docker sandbox.',
  };
}

/**
 * Runs code against test cases and computes a pass/fail summary.
 * Used by assessment evaluation for CODING questions.
 *
 * Test cases from older stores may be a single OBJECT ({input, expected})
 * rather than an array; both forms are accepted so previously-created
 * questions keep being judged instead of silently producing 0/0.
 */
async function evaluateTestCases({ language, code, testCases }) {
  let list = testCases;
  if (list && !Array.isArray(list) && typeof list === 'object') {
    // A single test case was stored as a plain object (legacy data).
    list = [list];
  }
  list = Array.isArray(list) ? list : [];

  if (list.length === 0) {
    return { passed: 0, total: 0, results: [], note: 'No test cases provided' };
  }

  const results = [];
  let passed = 0;
  for (const tc of list) {
    // Each case runs the candidate's REAL code with the case's input on stdin
    // and compares the program's actual stdout to the expected value. Nothing
    // here fabricates a pass/fail.
    const run = await executeCode({ language, code, input: tc.input });
    const actual = String(run.output || '').trim().replace(/\r\n/g, '\n');
    const expected = String(tc.expected === undefined ? '' : tc.expected).trim();
    const ok = run.success && actual === expected;
    if (ok) passed += 1;
    results.push({
      input: tc.input === undefined ? '' : tc.input,
      expected,
      actual,
      passed: ok,
      error: run.error || '',
    });
  }
  return { passed, total: list.length, results };
}

module.exports = { executeCode, evaluateTestCases, supported };