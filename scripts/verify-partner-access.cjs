// Read-only test runner. No database migrations, deployment, or Git writes.
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const reportPath = process.argv[2];
const checks = [];
const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, file))).digest('hex');
function run(name, args, env = {}) {
  const startedAt = new Date().toISOString();
  const result = cp.spawnSync(process.execPath, args, { cwd: repo, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  process.stdout.write((result.stdout || '') + (result.stderr || ''));
  checks.push({ name, startedAt, exitCode: result.status, error: result.error?.message || null, output: (result.stdout || '') + (result.stderr || '') });
}
run('partner-security', ['--import', './scripts/partner-access-test-loader.mjs', '--test', 'tests/partner-access/security.test.mjs']);
run('partner-http-and-pharmacy-regression', ['--import', 'tsx', '--test', 'tests/partner-access/http.test.ts', 'tests/partner-access/regression.test.ts'], { TSX_TSCONFIG_PATH: path.join(repo, 'apps/api-gateway/tsconfig.json') });
run('existing-admin-meetings-regression', ['--import', 'tsx', '--test', 'apps/api-gateway/src/lib/admin-meetings-policy.test.ts'], { TSX_TSCONFIG_PATH: path.join(repo, 'apps/api-gateway/tsconfig.json') });
const requiredChecks = checks.slice();
run('baseline-known-admin-staff-advisory', ['--import', 'tsx', '--test', 'apps/api-gateway/src/lib/admin-staff-policy.test.ts'], { TSX_TSCONFIG_PATH: path.join(repo, 'apps/api-gateway/tsconfig.json') });
const advisory = checks.at(-1);
const baselinePolicyUnchanged =
  sha256File('apps/api-gateway/src/lib/admin-staff-policy.ts') === 'a37fc31c858eb0be14372a607c74c42a899f9b6251bedae312cfe8f7f2b5bfc0' &&
  sha256File('apps/api-gateway/src/lib/admin-staff-policy.test.ts') === '3277b289c115313f1d4c9cb878503dab233f439392c59165eba8e285ca480776';
const result = {
  schema: 'ambulant-partner-access-tests-v1',
  createdAt: new Date().toISOString(),
  checks,
  passed: requiredChecks.every(c => c.exitCode === 0) && (advisory.exitCode === 0 || baselinePolicyUnchanged),
  baselineAdvisory: advisory.exitCode === 0 ? null : baselinePolicyUnchanged ? {
    test: advisory.name,
    disposition: 'PREEXISTING_UNCHANGED_NOT_INTRODUCED_BY_PARTNER_PATCH',
    detail: 'Existing implementation lets staff.compensation.manage imply staff.compensation.read, while its existing test expects false.',
  } : { test: advisory.name, disposition: 'BLOCKING_LOCAL_VARIANCE', detail: 'The failing Staff policy or its test differs from the captured baseline.' },
  databaseMutated: false,
  deployed: false,
};
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), { flag: 'wx' });
console.log('PARTNER_TESTS=' + (checks.slice(0, 2).every(c => c.exitCode === 0) ? 'PASS' : 'FAIL'));
console.log('COMBINED_REGRESSION=' + (result.passed ? (result.baselineAdvisory ? 'PASS_WITH_BASELINE_ADVISORY' : 'PASS') : 'FAIL'));
process.exitCode = result.passed ? 0 : 1;
