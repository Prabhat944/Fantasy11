// server.js
const { server } = require('./index'); // 👈 Import the server object, not app

const PORT = process.env.PORT || 6001;
const source = process.env.source || '0.0.0.0';

// 👇 Listen on the server object
server.listen(PORT, source, () => {
  console.log(`🚀 Server running at http://${source}:${PORT}`);
});