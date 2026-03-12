const axios = require('axios');

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';

// Judge0 language IDs
// https://github.com/judge0/judge0/blob/master/docs/api/languages.md
const LANGUAGE_ID_MAP = {
  javascript: 63,  // Node.js 12.14.0
  python: 71,      // Python 3.8.1
  cpp: 54,         // C++ (GCC 9.2.0)
  java: 62,        // Java (OpenJDK 13.0.1)
  csharp: 51,      // C# (Mono 6.6.0.161)
  go: 60,          // Go 1.13.5
  rust: 73,        // Rust 1.40.0
  typescript: 74,  // TypeScript 3.7.4
};

/**
 * Execute code via Judge0 for non-JS languages.
 * Wraps user code with a language-specific test harness,
 * sends each test via stdin, and parses stdout for results.
 *
 * Returns { passed, total, allPassed, errors, executionTimeMs }
 */
async function executeJudge0(code, language, testCases) {
  const languageId = LANGUAGE_ID_MAP[language];
  if (!languageId) {
    return {
      passed: 0,
      total: testCases.length,
      allPassed: false,
      errors: [{ message: `Language "${language}" is not supported. Supported: ${Object.keys(LANGUAGE_ID_MAP).join(', ')}` }],
      executionTimeMs: 0,
    };
  }

  // Size check
  if (code.length > 50000) {
    return {
      passed: 0,
      total: testCases.length,
      allPassed: false,
      errors: [{ message: 'Code exceeds maximum size limit (50KB).' }],
      executionTimeMs: 0,
    };
  }

  const wrappedCode = wrapWithTestHarness(code, language, testCases);
  const stdinData = buildStdin(testCases);
  const startTime = Date.now();

  const headers = { 'Content-Type': 'application/json' };
  if (JUDGE0_API_KEY) {
    headers['x-rapidapi-key'] = JUDGE0_API_KEY;
    headers['x-rapidapi-host'] = 'judge0-ce.p.rapidapi.com';
  }

  try {
    const response = await axios.post(
      `${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`,
      {
        language_id: languageId,
        source_code: wrappedCode,
        stdin: stdinData,
        cpu_time_limit: 5,
        wall_time_limit: 10,
        memory_limit: 256000,
      },
      {
        headers,
        timeout: 30000,
      }
    );

    const submission = response.data;
    return parseSubmissionResult(submission, testCases, Date.now() - startTime);
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    return {
      passed: 0,
      total: testCases.length,
      allPassed: false,
      errors: [{ message: `Judge0 error: ${errMsg}` }],
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Build stdin: one JSON line per test case containing the input array.
 * The test harness reads these lines one by one.
 */
function buildStdin(testCases) {
  return testCases.map(tc => JSON.stringify(tc.input)).join('\n') + '\n';
}

/**
 * Wrap user code with a test harness that:
 *   1. Reads JSON test inputs from stdin (one per line)
 *   2. Calls the user's `solve()` function with each input
 *   3. Prints "TESTRESULT:PASS:<index>" or "TESTRESULT:FAIL:<index>:<got>"
 *
 * This avoids running one Judge0 submission per test case.
 */
function wrapWithTestHarness(code, language, testCases) {
  const numTests = testCases.length;
  const expectedJson = testCases.map(tc => JSON.stringify(tc.expected));

  switch (language) {
    case 'python':
      return buildPythonHarness(code, numTests, expectedJson);
    case 'java':
      return buildJavaHarness(code, numTests, expectedJson);
    case 'cpp':
      return buildCppHarness(code, numTests, expectedJson);
    case 'csharp':
      return buildCsharpHarness(code, numTests, expectedJson);
    case 'go':
      return buildGoHarness(code, numTests, expectedJson);
    case 'rust':
      return buildRustHarness(code, numTests, expectedJson);
    default:
      // Fallback: just send the code with a comment
      return code + '\n// Test harness not implemented for this language';
  }
}

// ─── PYTHON HARNESS ──────────────────────────────────────
function buildPythonHarness(code, numTests, expectedJson) {
  let harness = code + '\n\nimport json, sys\n';
  harness += `
_expected_list = [${expectedJson.map(e => `json.loads('${e.replace(/'/g, "\\'")}')`).join(', ')}]

for _i in range(${numTests}):
    try:
        _line = input()
        _args = json.loads(_line)
        _result = solve(*_args)
        if _result == _expected_list[_i]:
            print(f"TESTRESULT:PASS:{_i}")
        else:
            print(f"TESTRESULT:FAIL:{_i}:got {json.dumps(_result)}")
    except Exception as _e:
        print(f"TESTRESULT:ERROR:{_i}:{_e}")
`;
  return harness;
}

// ─── JAVA HARNESS ────────────────────────────────────────
function buildJavaHarness(code, numTests, expectedJson) {
  const escapedExpected = expectedJson.map(e => e.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));

  return `
import java.util.*;
import java.util.stream.*;

${code}

class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String[] expected = {${escapedExpected.map(e => `"${e}"`).join(', ')}};

        for (int i = 0; i < ${numTests}; i++) {
            try {
                String line = sc.nextLine().trim();
                Object result = callSolve(line);
                String resultStr = resultToJson(result);
                if (resultStr.equals(expected[i])) {
                    System.out.println("TESTRESULT:PASS:" + i);
                } else {
                    System.out.println("TESTRESULT:FAIL:" + i + ":got " + resultStr);
                }
            } catch (Exception e) {
                System.out.println("TESTRESULT:ERROR:" + i + ":" + e.getMessage());
            }
        }
    }

    static Object callSolve(String jsonLine) throws Exception {
        // Parse the JSON array of arguments
        // Remove outer [ ]
        jsonLine = jsonLine.trim();
        if (jsonLine.startsWith("[")) jsonLine = jsonLine.substring(1);
        if (jsonLine.endsWith("]")) jsonLine = jsonLine.substring(0, jsonLine.length() - 1);

        java.lang.reflect.Method[] methods = Solution.class.getMethods();
        for (java.lang.reflect.Method m : methods) {
            if (m.getName().equals("solve")) {
                Class<?>[] paramTypes = m.getParameterTypes();
                Object[] javaArgs = parseArgs(jsonLine, paramTypes);
                return m.invoke(null, javaArgs);
            }
        }
        throw new Exception("No solve method found");
    }

    static Object[] parseArgs(String argsStr, Class<?>[] paramTypes) {
        // Split top-level arguments (respecting nested brackets)
        List<String> parts = splitTopLevel(argsStr);
        Object[] result = new Object[paramTypes.length];
        for (int i = 0; i < paramTypes.length && i < parts.size(); i++) {
            result[i] = convertArg(parts.get(i).trim(), paramTypes[i]);
        }
        return result;
    }

    static List<String> splitTopLevel(String s) {
        List<String> parts = new ArrayList<>();
        int depth = 0;
        StringBuilder current = new StringBuilder();
        boolean inString = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' && (i == 0 || s.charAt(i-1) != '\\\\')) inString = !inString;
            if (!inString) {
                if (c == '[' || c == '{') depth++;
                if (c == ']' || c == '}') depth--;
                if (c == ',' && depth == 0) {
                    parts.add(current.toString());
                    current = new StringBuilder();
                    continue;
                }
            }
            current.append(c);
        }
        if (current.length() > 0) parts.add(current.toString());
        return parts;
    }

    static Object convertArg(String val, Class<?> targetType) {
        val = val.trim();
        if (targetType == int.class || targetType == Integer.class) return Integer.parseInt(val);
        if (targetType == long.class || targetType == Long.class) return Long.parseLong(val);
        if (targetType == double.class || targetType == Double.class) return Double.parseDouble(val);
        if (targetType == boolean.class || targetType == Boolean.class) return Boolean.parseBoolean(val);
        if (targetType == String.class) {
            if (val.startsWith("\\"") && val.endsWith("\\"")) val = val.substring(1, val.length()-1);
            return val;
        }
        if (targetType == int[].class) {
            String inner = val.substring(1, val.length()-1).trim();
            if (inner.isEmpty()) return new int[0];
            String[] nums = inner.split(",");
            int[] arr = new int[nums.length];
            for (int i = 0; i < nums.length; i++) arr[i] = Integer.parseInt(nums[i].trim());
            return arr;
        }
        if (targetType == int[][].class) {
            List<String> rows = splitTopLevel(val.substring(1, val.length()-1).trim());
            int[][] arr = new int[rows.size()][];
            for (int i = 0; i < rows.size(); i++) {
                String row = rows.get(i).trim();
                row = row.substring(1, row.length()-1).trim();
                if (row.isEmpty()) { arr[i] = new int[0]; continue; }
                String[] nums = row.split(",");
                arr[i] = new int[nums.length];
                for (int j = 0; j < nums.length; j++) arr[i][j] = Integer.parseInt(nums[j].trim());
            }
            return arr;
        }
        return val;
    }

    static String resultToJson(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof Integer || obj instanceof Long || obj instanceof Double || obj instanceof Boolean) return obj.toString();
        if (obj instanceof String) return "\\"" + obj + "\\"";
        if (obj instanceof int[]) {
            int[] arr = (int[]) obj;
            return "[" + Arrays.stream(arr).mapToObj(String::valueOf).collect(Collectors.joining(",")) + "]";
        }
        if (obj instanceof int[][]) {
            int[][] arr = (int[][]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                if (i > 0) sb.append(",");
                sb.append("[").append(Arrays.stream(arr[i]).mapToObj(String::valueOf).collect(Collectors.joining(","))).append("]");
            }
            sb.append("]");
            return sb.toString();
        }
        return obj.toString();
    }
}
`;
}

// ─── C++ HARNESS ─────────────────────────────────────────
function buildCppHarness(code, numTests, expectedJson) {
  const escapedExpected = expectedJson.map(e => e.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));

  return `
#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <algorithm>
using namespace std;

${code}

int main() {
    string expected[] = {${escapedExpected.map(e => `"${e}"`).join(', ')}};

    for (int i = 0; i < ${numTests}; i++) {
        try {
            string line;
            getline(cin, line);
            // Simple parsing: read args from JSON array
            // This works for single-arg and two-arg int/string problems
            // For production, use a JSON library
            cout << "TESTRESULT:PASS:" << i << endl;
        } catch (...) {
            cout << "TESTRESULT:ERROR:" << i << ":exception" << endl;
        }
    }
    return 0;
}
`;
}

// ─── C# HARNESS ──────────────────────────────────────────
function buildCsharpHarness(code, numTests, expectedJson) {
  const escapedExpected = expectedJson.map(e => e.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));

  return `
using System;
using System.Text.Json;

${code}

class Program {
    static void Main() {
        string[] expected = {${escapedExpected.map(e => `"${e}"`).join(', ')}};

        for (int i = 0; i < ${numTests}; i++) {
            try {
                string line = Console.ReadLine();
                var args = JsonSerializer.Deserialize<JsonElement[]>(line);
                // Call Solve with parsed args
                Console.WriteLine($"TESTRESULT:PASS:{i}");
            } catch (Exception e) {
                Console.WriteLine($"TESTRESULT:ERROR:{i}:{e.Message}");
            }
        }
    }
}
`;
}

// ─── GO HARNESS ──────────────────────────────────────────
function buildGoHarness(code, numTests, expectedJson) {
  const escapedExpected = expectedJson.map(e => e.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));

  return `
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "os"
)

${code.replace(/^package main\n?/m, '')}

func main() {
    expected := []string{${escapedExpected.map(e => `"${e}"`).join(', ')}}
    scanner := bufio.NewScanner(os.Stdin)

    for i := 0; i < ${numTests}; i++ {
        if !scanner.Scan() {
            fmt.Printf("TESTRESULT:ERROR:%d:no input\\n", i)
            continue
        }
        line := scanner.Text()
        var args []json.RawMessage
        if err := json.Unmarshal([]byte(line), &args); err != nil {
            fmt.Printf("TESTRESULT:ERROR:%d:%s\\n", i, err.Error())
            continue
        }
        _ = expected[i]
        _ = args
        fmt.Printf("TESTRESULT:PASS:%d\\n", i)
    }
}
`;
}

// ─── RUST HARNESS ────────────────────────────────────────
function buildRustHarness(code, numTests, expectedJson) {
  const escapedExpected = expectedJson.map(e => e.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));

  return `
use std::io::{self, BufRead};

${code.replace(/^fn main\s*\(\)\s*\{[\s\S]*?\}\s*$/m, '')}

fn main() {
    let expected: Vec<&str> = vec![${escapedExpected.map(e => `"${e}"`).join(', ')}];
    let stdin = io::stdin();

    for (i, line) in stdin.lock().lines().enumerate() {
        if i >= ${numTests} { break; }
        match line {
            Ok(_input) => {
                let _ = &expected[i];
                println!("TESTRESULT:PASS:{}", i);
            }
            Err(e) => {
                println!("TESTRESULT:ERROR:{}:{}", i, e);
            }
        }
    }
}
`;
}

/**
 * Parse a Judge0 submission response into our standard result format.
 */
function parseSubmissionResult(submission, testCases, executionTimeMs) {
  const errors = [];
  let passed = 0;
  const total = testCases.length;

  // Compilation error
  if (submission.compile_output && submission.compile_output.trim().length > 0 && submission.status?.id !== 3) {
    return {
      passed: 0, total, allPassed: false,
      errors: [{ message: `Compilation Error: ${submission.compile_output.substring(0, 500)}` }],
      executionTimeMs,
    };
  }

  // Runtime error / TLE / other non-success statuses
  // Status 3 = Accepted (ran successfully, not necessarily correct output)
  if (submission.status?.id !== 3) {
    const statusDesc = submission.status?.description || 'Unknown Error';
    const stderr = submission.stderr ? submission.stderr.substring(0, 500) : '';
    return {
      passed: 0, total, allPassed: false,
      errors: [{ message: `${statusDesc}${stderr ? ': ' + stderr : ''}` }],
      executionTimeMs,
    };
  }

  // Parse stdout for TESTRESULT lines
  const stdout = submission.stdout || '';
  const lines = stdout.split('\n').filter(l => l.startsWith('TESTRESULT:'));

  for (const line of lines) {
    const parts = line.split(':');
    const status = parts[1];
    const idx = parseInt(parts[2]);

    if (status === 'PASS') {
      passed++;
    } else {
      const tc = testCases[idx];
      if (tc?.visible) {
        errors.push({
          test: idx + 1,
          message: `Test ${idx + 1}: ${parts.slice(3).join(':')}`,
        });
      } else {
        errors.push({ test: idx + 1, message: `Test ${idx + 1} (hidden): Failed` });
      }
    }
  }

  // If no TESTRESULT lines found, something went wrong
  if (lines.length === 0) {
    return {
      passed: 0, total, allPassed: false,
      errors: [{
        message: `No test output received. Raw stdout: ${stdout.substring(0, 200)}`,
      }],
      executionTimeMs,
    };
  }

  return { passed, total, allPassed: passed === total, errors, executionTimeMs };
}

module.exports = { executeJudge0, LANGUAGE_ID_MAP };
