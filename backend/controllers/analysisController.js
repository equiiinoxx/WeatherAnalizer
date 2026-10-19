const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let cachedAnalysis = null;

/**
 * Locate the virtual environment Python executable on Windows or POSIX
 */
function findPythonPath() {
  const rootVenvPythonWin = path.resolve(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(rootVenvPythonWin)) {
    return rootVenvPythonWin;
  }
  const rootVenvPythonPosix = path.resolve(__dirname, '..', '..', '.venv', 'bin', 'python');
  if (fs.existsSync(rootVenvPythonPosix)) {
    return rootVenvPythonPosix;
  }
  return 'python';
}

/**
 * Safely executes Python analysis script using child_process.spawn with an arguments array.
 * This guarantees shell-injection immunity by passing arguments directly to the OS process without shell interpolation.
 */
function runAnalysisScript(options = {}) {
  return new Promise((resolve, reject) => {
    const pythonPath = findPythonPath();
    const scriptPath = path.resolve(__dirname, '..', '..', 'analysis', 'analyze_weather.py');

    // Build argument list safely
    const args = [scriptPath];
    if (options.location && options.location !== 'ALL') {
      args.push('--location', String(options.location));
    }
    if (options.startDate) {
      args.push('--start-date', String(options.startDate));
    }
    if (options.endDate) {
      args.push('--end-date', String(options.endDate));
    }

    const env = {
      ...process.env,
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: process.env.DB_PORT || '3306',
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_NAME: process.env.DB_NAME
    };

    const pyProcess = spawn(pythonPath, args, {
      cwd: path.resolve(__dirname, '..', '..', 'analysis'),
      env,
      shell: false // Prevent shell injection
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
        console.error('Python analysis process exited with code:', code);
        console.error('Python diagnostics (stderr):', stderr);
        return reject(new Error(stderr || `Python analysis engine exited with code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        cachedAnalysis = parsed;
        resolve(parsed);
      } catch (err) {
        console.error('Failed to parse Python JSON stdout:', stdout);
        console.error('Python diagnostics (stderr):', stderr);
        reject(new Error('Invalid output format from Python analysis engine'));
      }
    });

    pyProcess.on('error', (err) => {
      console.error('Failed to spawn Python process:', err);
      reject(err);
    });
  });
}

async function triggerAnalysis(req, res) {
  try {
    const options = {
      location: req.query.location || req.body?.location,
      startDate: req.query.startDate || req.query.from || req.body?.startDate,
      endDate: req.query.endDate || req.query.to || req.body?.endDate
    };

    const result = await runAnalysisScript(options);
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
    const options = {
      location: req.query.location,
      startDate: req.query.startDate || req.query.from,
      endDate: req.query.endDate || req.query.to
    };

    // If filters are requested or no cache yet, run analysis
    if (!cachedAnalysis || options.location || options.startDate || options.endDate) {
      const result = await runAnalysisScript(options);
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
  getLatestAnalysis,
  runAnalysisScript,
  findPythonPath
};
