const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const pool = require('../config/db');

let server;
let baseUrl;

function makeRequest(method, endpoint, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      }
    }
    req.end();
  });
}

function createMultipartBody(filename, fileContent) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const header = `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: text/csv\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(header, 'utf8'),
    Buffer.from(fileContent, 'utf8'),
    Buffer.from(footer, 'utf8')
  ]);

  return {
    boundary,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    },
    body
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('   Weather Data Analysis System — Backend Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, errorDetails = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (errorDetails) console.error(`    ↳ Details: ${errorDetails}`);
      failed++;
    }
  }

  // Start test server on random ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // ----------------------------------------------------
    // Test 1: GET /api/health
    // ----------------------------------------------------
    console.log('[1] Health & Connection Pool');
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.statusCode === 200, 'GET /api/health returns 200 OK');
    assert(healthRes.body.status === 'ok', 'Health status is "ok"');
    assert(healthRes.body.database === 'weather_analysis', 'Connected to MySQL weather_analysis');

    // ----------------------------------------------------
    // Test 2: GET /api/weather/locations
    // ----------------------------------------------------
    console.log('\n[2] Available Locations');
    const locRes = await makeRequest('GET', '/api/weather/locations');
    assert(locRes.statusCode === 200, 'GET /api/weather/locations returns 200 OK');
    assert(Array.isArray(locRes.body.data), 'Locations returned as an array');
    assert(locRes.body.data.length > 0, `Found ${locRes.body.data.length} distinct locations`);

    // ----------------------------------------------------
    // Test 3: GET /api/weather (Pagination & Filtering)
    // ----------------------------------------------------
    console.log('\n[3] Weather Observations Filtering & Pagination');
    const pageRes = await makeRequest('GET', '/api/weather?page=1&limit=5');
    assert(pageRes.statusCode === 200, 'GET /api/weather returns 200 OK');
    assert(pageRes.body.data.records.length <= 5, 'Pagination limit respected');
    assert(pageRes.body.data.pagination.page === 1, 'Current page is 1');
    assert(pageRes.body.data.pagination.total > 0, `Total records count reported: ${pageRes.body.data.pagination.total}`);

    const filterRes = await makeRequest('GET', '/api/weather?location=New%20Delhi&startDate=2023-01-01&endDate=2023-06-30');
    assert(filterRes.statusCode === 200, 'GET /api/weather with location and date range filters returns 200');
    const allMatchLoc = filterRes.body.data.records.every(r => r.location === 'New Delhi');
    assert(allMatchLoc, 'All filtered records match queried location "New Delhi"');

    // ----------------------------------------------------
    // Test 4: CSV Upload - Header Validation (Missing Columns)
    // ----------------------------------------------------
    console.log('\n[4] CSV Header Validation');
    const badHeaderCsv = 'observation_date,location,temperature,humidity\n2022-01-01,TestCity,25,60'; // Missing 'rainfall'
    const mp1 = createMultipartBody('bad_header.csv', badHeaderCsv);
    const badHeaderRes = await makeRequest('POST', '/api/weather/upload', mp1.headers, mp1.body);
    assert(badHeaderRes.statusCode === 400, 'Rejects CSV with missing required columns with 400 Bad Request');
    assert(badHeaderRes.body.message.includes('rainfall'), 'Error message explicitly identifies missing required column "rainfall"');

    // ----------------------------------------------------
    // Test 5: CSV Upload - Never Convert Missing Measurements to Zero
    // ----------------------------------------------------
    console.log('\n[5] Preserving NULL for Missing Measurements (Never Silently 0)');
    const testNullDate = '2021-08-15';
    const testNullLoc = 'NullTestStation';

    // Delete existing test record if any
    await pool.query('DELETE FROM weather_records WHERE location = ?', [testNullLoc]);

    // CSV with empty temperature and empty rainfall
    const nullCsv = `observation_date,location,temperature,humidity,rainfall\n${testNullDate},${testNullLoc},,75.5,`;
    const mp2 = createMultipartBody('null_measurements.csv', nullCsv);
    const nullUploadRes = await makeRequest('POST', '/api/weather/upload', mp2.headers, mp2.body);
    assert(nullUploadRes.statusCode === 201, 'CSV with missing optional measurement accepted with 201');
    assert(nullUploadRes.body.data.acceptedRows === 1, '1 row accepted into weather_records');

    // Inspect actual database value
    const [dbRow] = await pool.query('SELECT temperature, humidity, rainfall FROM weather_records WHERE location = ?', [testNullLoc]);
    assert(dbRow.length === 1, 'Record found in MySQL');
    assert(dbRow[0].temperature === null, 'Missing temperature is strictly NULL in MySQL (NOT 0.00)');
    assert(Number(dbRow[0].humidity) === 75.5, 'Present humidity is stored accurately');
    assert(dbRow[0].rainfall === null, 'Missing rainfall is strictly NULL in MySQL (NOT 0.00)');

    // ----------------------------------------------------
    // Test 6: Duplicate Date/Location Detection & Schema Protection
    // ----------------------------------------------------
    console.log('\n[6] Duplicate Date/Location Prevention');
    // Upload exact same date/location again
    const dupCsv = `observation_date,location,temperature,humidity,rainfall\n${testNullDate},${testNullLoc},29.0,80.0,5.0`;
    const mp3 = createMultipartBody('duplicate.csv', dupCsv);
    const dupRes = await makeRequest('POST', '/api/weather/upload', mp3.headers, mp3.body);
    assert(dupRes.statusCode === 201, 'Batch processed and duplicates reported');
    assert(dupRes.body.data.rejectedRows === 1, 'Duplicate row was rejected');
    assert(dupRes.body.data.breakdown.duplicatesDetected === 1, 'Duplicate breakdown counter incremented');
    assert(dupRes.body.data.duplicatePolicy.length > 0, 'Response includes explanation of duplicate policy');

    // Verify issue was logged in data_quality_issues
    const [dupIssue] = await pool.query(
      'SELECT source_row_number, field_name, issue_description FROM data_quality_issues WHERE batch_id = ?',
      [dupRes.body.data.batchId]
    );
    assert(dupIssue.length === 1, 'Duplicate logged to data_quality_issues');
    assert(dupIssue[0].source_row_number === 2, 'Logged with exact source_row_number (2)');
    assert(dupIssue[0].issue_description.includes('Duplicate'), 'Issue description explains duplicate constraint violation');

    // Clean up test station
    await pool.query('DELETE FROM weather_records WHERE location = ?', [testNullLoc]);

    // ----------------------------------------------------
    // Test 7: Plausible Bounds & Nonnegative Measurements Validation
    // ----------------------------------------------------
    console.log('\n[7] Out-of-Bounds & Invalid Value Validation');
    const invalidValuesCsv = 
      'observation_date,location,temperature,humidity,rainfall\n' +
      '2022-05-01,BoundsTest,120.0,50.0,0.0\n' +     // Temp > 60°C
      '2022-05-02,BoundsTest,25.0,150.0,0.0\n' +     // Humidity > 100%
      '2022-05-03,BoundsTest,25.0,50.0,-10.0\n' +    // Rainfall < 0
      'invalid-date,BoundsTest,25.0,50.0,0.0\n' +    // Invalid date format
      '2099-01-01,BoundsTest,25.0,50.0,0.0\n' +      // Future date
      '2022-05-04,,25.0,50.0,0.0\n';                 // Missing location

    const mp4 = createMultipartBody('invalid_bounds.csv', invalidValuesCsv);
    const invalidRes = await makeRequest('POST', '/api/weather/upload', mp4.headers, mp4.body);
    assert(invalidRes.statusCode === 201, 'Processes batch containing invalid values');
    assert(invalidRes.body.data.totalRows === 6, 'Total 6 test rows parsed');
    assert(invalidRes.body.data.acceptedRows === 0, '0 out-of-bounds rows accepted');
    assert(invalidRes.body.data.rejectedRows === 6, 'All 6 invalid rows rejected');

    // ----------------------------------------------------
    // Test 8: Import Batches History & Quality Reports
    // ----------------------------------------------------
    console.log('\n[8] Import History and Quality Reports');
    const batchesRes = await makeRequest('GET', '/api/weather/imports');
    assert(batchesRes.statusCode === 200, 'GET /api/weather/imports returns 200 OK');
    assert(batchesRes.body.data.batches.length > 0, 'Batches list returned');

    const latestBatchId = invalidRes.body.data.batchId;
    const issuesRes = await makeRequest('GET', `/api/weather/imports/${latestBatchId}/issues`);
    assert(issuesRes.statusCode === 200, `GET /api/weather/imports/${latestBatchId}/issues returns 200 OK`);
    assert(issuesRes.body.data.issues.length === 6, 'Retrieved all 6 row-level quality issues for the batch');
    assert(issuesRes.body.data.issues[0].source_row_number !== undefined, 'Issues contain source_row_number column');

    // ----------------------------------------------------
    // Test 9: Unsupported File Types Rejection
    // ----------------------------------------------------
    console.log('\n[9] File Type Rejection');
    const textBody = 'this is not a csv';
    const boundary = '----BoundaryTest';
    const rawTxt = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="document.pdf"\r\nContent-Type: application/pdf\r\n\r\n${textBody}\r\n--${boundary}--\r\n`;
    const txtHeaders = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(rawTxt)
    };
    const badFileRes = await makeRequest('POST', '/api/weather/upload', txtHeaders, rawTxt);
    assert(badFileRes.statusCode === 400, 'Rejects non-CSV upload with 400 Bad Request');

    console.log('\n====================================================');
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }
}

runTests();
