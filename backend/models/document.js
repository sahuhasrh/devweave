const DEFAULT_DOCUMENT_CONTENT = `// Welcome to DevWeave!
// Start typing to collaborate in real-time

console.log("Hello, collaborative world!");
console.log("This is a real-time collaborative code editor powered by Yjs + Redis!");

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 8; i++) {
  console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}
`;

const YJS_TEXT_KEY = 'monaco';

module.exports = {
  DEFAULT_DOCUMENT_CONTENT,
  YJS_TEXT_KEY,
};
