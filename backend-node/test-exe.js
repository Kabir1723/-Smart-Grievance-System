const { execSync } = require('child_process');
try {
    execSync('.\\grievance-system.exe', { stdio: 'pipe' });
} catch (e) {
    console.log('--- STDOUT ---');
    console.log(e.stdout ? e.stdout.toString() : '');
    console.log('--- STDERR ---');
    console.log(e.stderr ? e.stderr.toString() : '');
}
