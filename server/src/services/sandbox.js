const vm = require('vm');

/**
 * Evaluate JavaScript/TypeScript code in an isolated Node.js VM sandbox.
 * Returns { passed, total, allPassed, errors, executionTimeMs }
 */
function evaluateJSCode(code, testCases) {
  const errors = [];
  let passed = 0;
  const total = testCases.length;
  const startTime = Date.now();

  // Security checks
  const forbidden = ['require', 'process', 'child_process', 'fs', 'net', 'http', 'https', 'eval(', 'Function('];
  for (const term of forbidden) {
    if (code.includes(term)) {
      return {
        passed: 0,
        total,
        allPassed: false,
        errors: [{ message: `Forbidden keyword detected: "${term}". External modules and eval are not allowed.` }],
        executionTimeMs: 0,
      };
    }
  }

  // Size check
  if (code.length > 50000) {
    return {
      passed: 0, total, allPassed: false,
      errors: [{ message: 'Code exceeds maximum size limit (50KB).' }],
      executionTimeMs: 0,
    };
  }

  const wrapped = `${code}\nmodule.exports = typeof solve === 'function' ? solve : null;`;

  let fn;
  try {
    const context = vm.createContext({
      module: { exports: {} },
      exports: {},
      console: { log: () => {} },
      Math,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      String,
      Number,
      Boolean,
      Array,
      Object,
      JSON,
      Map,
      Set,
      RegExp,
      Date,
      Error,
      TypeError,
      RangeError,
    });
    const script = new vm.Script(wrapped);
    script.runInContext(context, { timeout: 800 });
    fn = context.module.exports;
  } catch (err) {
    return {
      passed: 0, total, allPassed: false,
      errors: [{ message: `Compilation Error: ${err.message}` }],
      executionTimeMs: Date.now() - startTime,
    };
  }

  if (typeof fn !== 'function') {
    return {
      passed: 0, total, allPassed: false,
      errors: [{ message: 'Your code must define a function named `solve`.' }],
      executionTimeMs: Date.now() - startTime,
    };
  }

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    try {
      const inputCopy = JSON.parse(JSON.stringify(tc.input));
      const context = vm.createContext({
        fn,
        args: inputCopy,
        result: undefined,
        Math,
        parseInt,
        parseFloat,
        String,
        Number,
        Boolean,
        Array,
        Object,
        JSON,
        Map,
        Set,
      });
      const runScript = new vm.Script('result = fn(...args);');
      runScript.runInContext(context, { timeout: 800 });

      const actual = context.result;
      const expected = tc.expected;

      if (deepEqual(actual, expected)) {
        passed++;
      } else {
        if (tc.visible) {
          errors.push({
            test: i + 1,
            input: tc.input,
            expected,
            got: actual,
            message: `Test ${i + 1}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
          });
        } else {
          errors.push({ test: i + 1, message: `Test ${i + 1} (hidden): Failed` });
        }
      }
    } catch (err) {
      errors.push({
        test: i + 1,
        message: `Test ${i + 1}: Runtime Error - ${err.message}`,
      });
    }
  }

  return {
    passed,
    total,
    allPassed: passed === total,
    errors,
    executionTimeMs: Date.now() - startTime,
  };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  return false;
}

module.exports = { evaluateJSCode, deepEqual };
