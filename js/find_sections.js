const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const lines = content.split('\n');

let jsLines = [];
let startLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<script>') || (lines[i].includes('<script ') && !lines[i].includes('src='))) {
        startLine = i + 1; // 1-based line number for start of content
        continue;
    }
    if (lines[i].includes('</script>') && startLine !== -1) {
        break;
    }
    if (startLine !== -1) {
        jsLines.push({ num: i + 1, text: lines[i] });
    }
}

console.log('Total JS lines in index.html:', jsLines.length);

// Let's scan for key patterns that mark where files/modules start
// e.g. Comments like "// Initialize Dexie", "// Firebase Libraries", "// Navigation & State globals", "// outcomes", "// Weekly Targets", "// Paces", etc.
const markers = [];

jsLines.forEach(line => {
    // Check for comment headers
    if (line.text.includes('// Initialize Dexie Local Database') || line.text.includes('// Initialize Dexie')) {
        markers.push({ name: 'Database Setup (db.js)', line: line.num });
    }
    if (line.text.includes('window.localDBHelper = {')) {
        markers.push({ name: 'Database Helpers (db.js)', line: line.num });
    }
    if (line.text.includes('window.syncManager = {')) {
        markers.push({ name: 'Sync Manager (db.js)', line: line.num });
    }
    if (line.text.includes('window.firestoreDiagnostics = {')) {
        markers.push({ name: 'Firebase Diagnostics (firebase.js)', line: line.num });
    }
    if (line.text.includes('// Navigation & State globals')) {
        markers.push({ name: 'Navigation & State (state.js)', line: line.num });
    }
    if (line.text.includes('window.formatDaysPassed = function')) {
        markers.push({ name: 'Common Utilities (utils.js)', line: line.num });
    }
    if (line.text.includes('// --- Outcomes Program Visibility Logic ---')) {
        markers.push({ name: 'Outcomes & Pass System (outcome.js)', line: line.num });
    }
    if (line.text.includes('// --- Weekly Targets System Logic ---')) {
        markers.push({ name: 'Weekly Targets (paces.js or new file)', line: line.num });
    }
    if (line.text.includes('// --- Pace Management System Logic ---')) {
        markers.push({ name: 'Pace Management (paces.js)', line: line.num });
    }
    if (line.text.includes('window.renderSchedulePage = function') || line.text.includes('window.switchRoutineSet = function')) {
        markers.push({ name: 'Schedule/Routine UI (schedule.js)', line: line.num });
    }
    if (line.text.includes('window.openSyncDashboardModal = function')) {
        markers.push({ name: 'Sync Dashboard UI (dashboard.js)', line: line.num });
    }
    if (line.text.includes('window.startTimer = function') || line.text.includes('window.activeTimerState = {') || line.text.includes('// --- Timer Logs ---')) {
        markers.push({ name: 'Timer Module (timer.js)', line: line.num });
    }
    if (line.text.includes('window.renderUI = function') || line.text.includes('document.addEventListener(\'DOMContentLoaded\'')) {
        markers.push({ name: 'Main Application Core (app.js)', line: line.num });
    }
});

markers.sort((a, b) => a.line - b.line);
markers.forEach((m, idx) => {
    const nextLine = idx < markers.length - 1 ? markers[idx+1].line : jsLines[jsLines.length - 1].num;
    console.log(`- ${m.name} starts at line ${m.line}, ends before line ${nextLine} (~${nextLine - m.line} lines)`);
});
