const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let cachedAnalysis = null;

function findPythonPath() {
  const rootVenvPython = path.resolve(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(rootVenvPython)) {
    return rootVenvPython;
  }
  const rootVenvBinPython = path.resolve(__dirname, '..', '..', '.venv', 'bin', 'python');
  if (fs.existsSync(rootVenvBinPython)) {
    return rootVenvBinPython;
  }
  return 'python';
}

function runAnalysisScript() {
  return new Promise((resolve, reject) => {
    const pythonPath = findPythonPath();
    const scriptPath = path.resolve(__dirname, '..', '..', 'analysis', 'analyze.py');

    const env = {
      ...process.env,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '3306',
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME
    };

    const pyProcess = spawn(pythonPath, [scriptPath], {
      cwd: path.resolve(__dirname, '..', '..', 'analysis'),
      env
    });

    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python analysis process exited with code:', code, stderr);
        return reject(new Error(stderr || `Python analysis process exited with code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        cachedAnalysis = parsed;
        resolve(parsed);
      } catch (err) {
        console.error('Failed to parse Python analysis stdout as JSON:', stdout);
        reject(new Error('Invalid output format from Python analysis engine'));
      }
    });

    pyProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      reject(err);
    });
  });
}

async function triggerAnalysis(req, res) {
  try {
    const result = await runAnalysisScript();
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('Trigger analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to run Python analysis: ' + error.message
    });
  }
}

async function getLatestAnalysis(req, res) {
  try {
    if (!cachedAnalysis) {
      const result = await runAnalysisScript();
      return res.json({
        status: 'success',
        data: result
      });
    }
    res.json({
      status: 'success',
      data: cachedAnalysis
    });
  } catch (error) {
    console.error('Get latest analysis error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch analysis: ' + error.message
    });
  }
}

module.exports = {
  triggerAnalysis,
  getLatestAnalysis
};
