const app = require('./index');

const PORT = process.env.PORT || 5004;
const source = process.env.source || '0.0.0.0';
app.listen(PORT, source ,() => {
  console.log(`🚀 Server running at http://${source}:${PORT}`);
});
