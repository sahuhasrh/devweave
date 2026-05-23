const { spawn } = require('child_process');

async function executeJavaScript(code) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let output = [];
    let hasError = false;

    const wrappedCode = `
      const logs = [];
      console.log = (...args) => {
        logs.push({ type: 'log', args: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ') });
      };
      console.error = (...args) => {
        logs.push({ type: 'error', args: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ') });
      };
      console.warn = (...args) => {
        logs.push({ type: 'warn', args: args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ') });
      };
      try {
        ${code}
        process.stdout.write(JSON.stringify({ success: true, logs }));
      } catch (error) {
        process.stdout.write(JSON.stringify({ success: false, error: error.message, logs }));
      }
    `;

    const child = spawn('node', ['-e', wrappedCode], {
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const executionTime = Date.now() - startTime;

      try {
        if (stdout) {
          const result = JSON.parse(stdout);
          if (result.success) {
            output = result.logs.map((log) => ({
              type: log.type === 'log' ? 'output' : log.type,
              content: log.args,
            }));
          } else {
            hasError = true;
            output = [
              ...result.logs.map((log) => ({
                type: log.type === 'log' ? 'output' : log.type,
                content: log.args,
              })),
              { type: 'error', content: `Error: ${result.error}` },
            ];
          }
        } else if (stderr) {
          hasError = true;
          output = [{ type: 'error', content: stderr.trim() }];
        } else if (code !== 0) {
          hasError = true;
          output = [{ type: 'error', content: `Process exited with code ${code}` }];
        }
      } catch (parseError) {
        hasError = true;
        output = [{ type: 'error', content: `Failed to parse execution result: ${parseError.message}` }];
      }

      resolve({
        success: !hasError,
        output,
        executionTime,
        stderr: hasError ? stderr : null,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        output: [{ type: 'error', content: `Execution failed: ${error.message}` }],
        executionTime: Date.now() - startTime,
        stderr: error.message,
      });
    });

    setTimeout(() => {
      if (!child.killed) {
        child.kill();
        resolve({
          success: false,
          output: [{ type: 'error', content: 'Execution timed out (10 seconds limit)' }],
          executionTime: Date.now() - startTime,
          stderr: 'Timeout',
        });
      }
    }, 10000);
  });
}

module.exports = { executeJavaScript };
