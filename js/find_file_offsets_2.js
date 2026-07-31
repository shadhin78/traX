const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const lines = content.split('\n');

const jsStart = lines.findIndex(l => l.includes('<script>') || (l.includes('<script ') && !l.includes('src='))) + 1;
const jsEnd = lines.lastIndexOf('    </script>') + 1;
const cssStart = lines.findIndex(l => l.includes('<style>') || l.includes('<style ')) + 1;
const cssEnd = lines.findIndex(l => l.includes('</style>')) + 1;

console.log('HTML Head Start: lines 1 to ' + (jsStart - 1));
console.log('CSS: lines ' + cssStart + ' to ' + cssEnd + ' (' + (cssEnd - cssStart + 1) + ' lines)');
console.log('HTML Body: lines ' + (cssEnd + 1) + ' to ' + lines.length + ' (' + (lines.length - cssEnd) + ' lines)');
console.log('Total JS Block: lines ' + jsStart + ' to ' + jsEnd + ' (' + (jsEnd - jsStart + 1) + ' lines)');

// Let's search for key function milestones in the JS block to map them to the 13 JS files:
const fileMilestones = [
  { file: 'js/state.js', trigger: 'window.ensureConfigDefaults = function' },
  { file: 'js/db.js', trigger: 'window.localDB = new Dexie' },
  { file: 'js/firebase.js', trigger: 'window.isCloudSyncAllowed = function' },
  { file: 'js/utils.js', trigger: 'window.formatDaysPassed = function' },
  { file: 'js/ui/schedule.js', trigger: 'window.switchRoutineSet = function' },
  { file: 'js/ui/subjects.js', trigger: 'function getSubjectColor' },
  { file: 'js/ui/daily-actions.js', trigger: 'window.renderDailyActions = function' },
  { file: 'js/ui/paces.js', trigger: 'window.renderPacesPage = function' },
  { file: 'js/ui/dashboard.js', trigger: 'window.openSyncDashboardModal = function' },
  { file: 'js/ui/outcome.js', trigger: 'window.renderOutcomeProgramToggles = function' },
  { file: 'js/ui/config.js', trigger: 'window.renderConfigPage = function' },
  { file: 'js/ui/timer.js', trigger: 'window.syncTimerStateFromCloud = function' },
  { file: 'js/app.js', trigger: 'window.renderUI = function' }
];

const results = [];
fileMilestones.forEach(m => {
  const idx = lines.findIndex(l => l.includes(m.trigger));
  if (idx !== -1) {
    results.push({ file: m.file, line: idx + 1 });
  } else {
    console.log(`Could not find trigger for ${m.file}: "${m.trigger}"`);
  }
});

results.sort((a, b) => a.line - b.line);

for (let i = 0; i < results.length; i++) {
  const curr = results[i];
  const next = (i < results.length - 1) ? results[i+1].line : jsEnd;
  console.log(`- ${curr.file}: starts at line ${curr.line}, ends before line ${next} (~${next - curr.line} lines)`);
}
