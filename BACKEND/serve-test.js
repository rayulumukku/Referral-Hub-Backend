// Simple HTTP server to serve the test interface
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/test') {
    const filePath = path.join(__dirname, 'test-login-interface.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading test file');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🌐 Test server running at http://localhost:${PORT}`);
  console.log('📱 Open this URL in your browser to test the login interface');
  console.log('🔗 http://localhost:3001');
});
