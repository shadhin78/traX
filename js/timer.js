/**
 * Project X Focus Timer Module
 * Established in window.TimerService namespace.
 */

(function () {
    // --- PRIVATE UTILITIES & HELPERS ---

    function formatHoursToHrMin(hoursDecimal) {
        if (isNaN(hoursDecimal) || hoursDecimal <= 0) return "0 min";
        const totalMinutes = Math.round(hoursDecimal * 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hrs > 0) {
            if (mins > 0) {
                return `${hrs} hr ${mins} min`;
            }
            return `${hrs} hr`;
        }
        return `${mins} min`;
    }

    function parseStartTime(startTime) {
        if (!startTime) return 0;
        if (typeof startTime.toDate === 'function') {
            return startTime.toDate().getTime();
        }
        if (startTime instanceof Date) {
            return startTime.getTime();
        }
        if (typeof startTime === 'string') {
            return new Date(startTime).getTime();
        }
        return Number(startTime);
    }

    function isAnyTimerRunning() {
        if (!AppState.activeTimerState) return false;
        if (AppState.activeTimerState.isRunning) return true;
        if (AppState.activeTimerState.timerStates) {
            return Object.values(AppState.activeTimerState.timerStates).some(store => store.isRunning);
        }
        return false;
    }

    function playCompletionChime() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // First beep: D5
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);

            // Second beep: A5
            setTimeout(() => {
                let osc2 = audioCtx.createOscillator();
                let gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
                osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain2.gain.setValueAtTime(0, audioCtx.currentTime);
                gain2.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.5);
            }, 150);
        } catch (e) {
            console.warn("Audio Context failed to play chime:", e);
        }
    }

    function initChronographDial() {
        const ticksContainer = document.getElementById('chrono-ticks-container');
        const numbersContainer = document.getElementById('chrono-numbers-container');
        const subdialTicksContainer = document.getElementById('chrono-subdial-ticks');
        const subdialNumbersContainer = document.getElementById('chrono-subdial-numbers');

        if (!ticksContainer || !numbersContainer || !subdialTicksContainer || !subdialNumbersContainer) return;
        if (ticksContainer.childElementCount > 0) return; // Already initialized

        // 1. Generate 60 Main Dial Ticks
        let ticksHTML = '';
        for (let i = 0; i < 60; i++) {
            const angle = i * 6;
            const isMajor = (i % 5 === 0);
            if (isMajor) {
                ticksHTML += `<line id="chrono-tick-${i}" x1="150" y1="12" x2="150" y2="24" stroke="var(--chrono-tick-major)" stroke-width="2.5" stroke-linecap="round" style="transform-origin: 150px 150px; transform: rotate(${angle}deg);" />`;
            } else {
                ticksHTML += `<line id="chrono-tick-${i}" x1="150" y1="12" x2="150" y2="18" stroke="var(--chrono-tick-minor)" stroke-width="1.2" stroke-opacity="0.6" stroke-linecap="round" style="transform-origin: 150px 150px; transform: rotate(${angle}deg);" />`;
            }
        }
        ticksContainer.innerHTML = ticksHTML;

        // 2. Generate 12 Main Dial Numbers (60, 5, 10, ..., 55)
        let numbersHTML = '';
        const mainRadius = 118;
        for (let i = 0; i < 12; i++) {
            const angleRad = (i * 30) * (Math.PI / 180);
            const nx = (150 + mainRadius * Math.sin(angleRad)).toFixed(2);
            const ny = (150 - mainRadius * Math.cos(angleRad)).toFixed(2);
            const tickIndex = i * 5;
            const numText = (i === 0) ? '60' : (i * 5).toString();
            numbersHTML += `<text id="chrono-num-${tickIndex}" x="${nx}" y="${ny}" fill="var(--chrono-text-number)" font-size="13" font-weight="800" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" dominant-baseline="central">${numText}</text>`;
        }
        numbersContainer.innerHTML = numbersHTML;

        // 3. Generate 30 Subdial Ticks (Center: 150, 205, R: 38)
        let subTicksHTML = '';
        for (let j = 0; j < 30; j++) {
            const subAngle = j * 12;
            const isMajor = (j % 5 === 0);
            if (isMajor) {
                subTicksHTML += `<line x1="150" y1="170" x2="150" y2="176" stroke="var(--chrono-subdial-tick-major)" stroke-width="1.8" stroke-linecap="round" style="transform-origin: 150px 205px; transform: rotate(${subAngle}deg);" />`;
            } else {
                subTicksHTML += `<line x1="150" y1="170" x2="150" y2="173" stroke="var(--chrono-subdial-tick-minor)" stroke-width="1" stroke-linecap="round" style="transform-origin: 150px 205px; transform: rotate(${subAngle}deg);" />`;
            }
        }
        subdialTicksContainer.innerHTML = subTicksHTML;

        // 4. Generate 6 Subdial Numbers (30, 5, 10, 15, 20, 25)
        let subNumbersHTML = '';
        const subRadius = 26;
        for (let k = 0; k < 6; k++) {
            const subRad = (k * 60) * (Math.PI / 180);
            const snx = (150 + subRadius * Math.sin(subRad)).toFixed(2);
            const sny = (205 - subRadius * Math.cos(subRad)).toFixed(2);
            const subNumText = (k === 0) ? '30' : (k * 5).toString();
            subNumbersHTML += `<text x="${snx}" y="${sny}" fill="var(--chrono-subdial-text)" font-size="8" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" dominant-baseline="central">${subNumText}</text>`;
        }
        subdialNumbersContainer.innerHTML = subNumbersHTML;
    }

    function tickTimer() {
        if (!AppState.activeTimerState) return;

        // Run background timer check
        checkBackgroundTimers();

        let elapsedMs = AppState.activeTimerState.elapsedBeforeStart || 0;
        if (AppState.activeTimerState.isRunning && AppState.activeTimerState.startTime) {
            elapsedMs += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
        }

        let displaySeconds = 0;
        if (AppState.activeTimerState.mode === 'stopwatch') {
            displaySeconds = Math.floor(elapsedMs / 1000);
            const saveBtn = document.getElementById('timer-btn-save');
            if (saveBtn) {
                saveBtn.disabled = (displaySeconds === 0);
            }
        } else {
            const targetMs = (AppState.activeTimerState.targetDuration || 0) * 1000;
            const remainingMs = Math.max(0, targetMs - elapsedMs);
            displaySeconds = Math.ceil(remainingMs / 1000);

            if (remainingMs <= 0 && AppState.activeTimerState.isRunning) {
                AppState.activeTimerState.isRunning = false;
                AppState.activeTimerState.elapsedBeforeStart = targetMs;
                AppState.activeTimerState.startTime = null;

                // Sync to store for current mode since it changed status
                saveActiveStateToStore();

                playCompletionChime();
                FirebaseService.saveTimerToCloud();

                const saveBtn = document.getElementById('timer-btn-save');
                if (saveBtn) {
                    saveBtn.disabled = false;
                }
            } else {
                const saveBtn = document.getElementById('timer-btn-save');
                if (saveBtn) {
                    saveBtn.disabled = (elapsedMs < 1000);
                }
            }
        }

        updateTimerUI(displaySeconds, elapsedMs);

        if (!isAnyTimerRunning()) {
            if (AppState.timerInterval) {
                clearInterval(AppState.timerInterval);
                AppState.timerInterval = null;
            }
        }
    }

    function updateTimerUI(displaySeconds, elapsedMs) {
        initChronographDial();

        if (typeof elapsedMs !== 'number') {
            elapsedMs = displaySeconds * 1000;
        }

        const mode = AppState.activeTimerState.mode || 'stopwatch';

        // Main Sweep Hand Needle - ALWAYS rotates FORWARD / Clockwise
        const totalSecsWithFraction = elapsedMs / 1000;
        const mainHandDeg = (totalSecsWithFraction % 60) * 6;
        const mainHand = document.getElementById('chrono-main-hand');
        if (mainHand) {
            mainHand.style.transform = `rotate(${mainHandDeg}deg)`;
        }

        // Subdial Hand Needle - ALWAYS rotates FORWARD / Clockwise
        const subdialDeg = ((totalSecsWithFraction % 1800) / 1800) * 360;
        const subdialHand = document.getElementById('chrono-subdial-hand');
        if (subdialHand) {
            subdialHand.style.transform = `rotate(${subdialDeg}deg)`;
        }

        // Edge Tick Marks & Radial Numbers Countdown Color Updating
        if (mode !== 'stopwatch') {
            const targetMs = Math.max(1000, (AppState.activeTimerState.targetDuration || 1) * 1000);
            const progressRatio = Math.min(1, Math.max(0, elapsedMs / targetMs));
            const elapsedTicksCount = Math.floor(progressRatio * 60);

            for (let i = 0; i < 60; i++) {
                const tickElem = document.getElementById(`chrono-tick-${i}`);
                if (tickElem) {
                    const isMajor = (i % 5 === 0);
                    if (i >= elapsedTicksCount) {
                        // Remaining time: HIGHLIGHTED in Electric Blue
                        tickElem.setAttribute('stroke', 'var(--chrono-main-hand)');
                        tickElem.setAttribute('stroke-opacity', '1');
                    } else {
                        // Elapsed time: DECREASED / DIMMED
                        tickElem.setAttribute('stroke', isMajor ? 'var(--chrono-tick-major)' : 'var(--chrono-tick-minor)');
                        tickElem.setAttribute('stroke-opacity', '0.2');
                    }
                }

                if (i % 5 === 0) {
                    const numElem = document.getElementById(`chrono-num-${i}`);
                    if (numElem) {
                        if (i >= elapsedTicksCount) {
                            // Remaining time number: HIGHLIGHTED in Electric Blue
                            numElem.setAttribute('fill', 'var(--chrono-main-hand)');
                            numElem.setAttribute('fill-opacity', '1');
                        } else {
                            // Elapsed time number: DECREASED / DIMMED
                            numElem.setAttribute('fill', 'var(--chrono-text-number)');
                            numElem.setAttribute('fill-opacity', '0.25');
                        }
                    }
                }
            }
        } else {
            // Stopwatch Mode: Restore standard full opacity for all ticks & numbers
            for (let i = 0; i < 60; i++) {
                const tickElem = document.getElementById(`chrono-tick-${i}`);
                if (tickElem) {
                    const isMajor = (i % 5 === 0);
                    tickElem.setAttribute('stroke', isMajor ? 'var(--chrono-tick-major)' : 'var(--chrono-tick-minor)');
                    tickElem.setAttribute('stroke-opacity', isMajor ? '1' : '0.6');
                }
                if (i % 5 === 0) {
                    const numElem = document.getElementById(`chrono-num-${i}`);
                    if (numElem) {
                        numElem.setAttribute('fill', 'var(--chrono-text-number)');
                        numElem.setAttribute('fill-opacity', '1');
                    }
                }
            }
        }

        // Split-color digital readout calculation
        let renderMs = elapsedMs;
        if (mode !== 'stopwatch') {
            const targetMs = (AppState.activeTimerState.targetDuration || 0) * 1000;
            renderMs = Math.max(0, targetMs - elapsedMs);
        }

        const totalSecs = Math.floor(renderMs / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        const hundredths = Math.floor((renderMs % 1000) / 10);

        let hhmmText = '';
        let ssmsText = '';

        if (hrs > 0) {
            hhmmText = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:`;
            ssmsText = `${String(secs).padStart(2, '0')}`;
        } else {
            hhmmText = `${String(mins).padStart(2, '0')}:`;
            ssmsText = `${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
        }

        safeSetText('timer-clock-hhmm', hhmmText);
        safeSetText('timer-clock-ssms', ssmsText);

        const clockText = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        safeSetText('timer-clock-text', clockText);

        // Status text update
        const statusText = document.getElementById('timer-status-text');
        if (statusText) {
            if (AppState.activeTimerState.isRunning) {
                statusText.textContent = 'FOCUSING';
                statusText.className = 'text-[9px] sm:text-xs font-bold uppercase tracking-widest text-emerald-400 mt-1.5 sm:mt-2';
            } else {
                let activeElapsed = AppState.activeTimerState.elapsedBeforeStart || 0;
                if (activeElapsed > 0) {
                    statusText.textContent = 'PAUSED';
                    statusText.className = 'text-[9px] sm:text-xs font-bold uppercase tracking-widest text-amber-400 mt-1.5 sm:mt-2';
                } else {
                    statusText.textContent = 'READY';
                    statusText.className = 'text-[9px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1.5 sm:mt-2';
                }
            }
        }

        const toggleBtn = document.getElementById('timer-btn-toggle');
        const fsToggleBtn = document.getElementById('timer-fs-btn-toggle');
        const isRunning = AppState.activeTimerState.isRunning;
        let activeElapsed = AppState.activeTimerState.elapsedBeforeStart || 0;

        let btnText = 'START';
        let btnBgClass = 'bg-blue-600 hover:bg-blue-700';

        if (isRunning) {
            btnText = 'PAUSE';
            btnBgClass = 'bg-amber-500 hover:bg-amber-600';
        } else if (activeElapsed > 0) {
            btnText = 'RESUME';
            btnBgClass = 'bg-blue-600 hover:bg-blue-700';
        }

        if (toggleBtn) {
            toggleBtn.textContent = btnText;
            toggleBtn.className = `flex-[1.4] py-3 sm:py-3.5 ${btnBgClass} text-white font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all touch-action-manipulation min-h-[44px]`;
        }

        if (fsToggleBtn) {
            fsToggleBtn.textContent = btnText;
            fsToggleBtn.className = `px-4 py-2 sm:px-5 sm:py-2.5 ${btnBgClass} text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all touch-action-manipulation flex items-center justify-center min-h-[40px]`;
        }

        // Update dashboard Focus Timer card in real-time if it exists
        if (document.getElementById('dash-timer-clock-text') || document.getElementById('dash-timer-progress-bar')) {
            let displayState = AppState.activeTimerState;
            let displayMode = AppState.activeTimerState.mode || 'stopwatch';

            if (AppState.activeTimerState.timerStates) {
                const runningMode = Object.keys(AppState.activeTimerState.timerStates).find(
                    m => AppState.activeTimerState.timerStates[m].isRunning
                );
                if (runningMode) {
                    displayMode = runningMode;
                    displayState = AppState.activeTimerState.timerStates[runningMode];
                }
            }

            const isTimerRunning = displayState.isRunning || false;
            let dashElapsedMs = displayState.elapsedBeforeStart || 0;
            if (displayState.isRunning && displayState.startTime) {
                dashElapsedMs += (window.getServerTime() - parseStartTime(displayState.startTime));
            }
            let dashSeconds = 0;
            let dashProgressPercent = 0;
            if (displayMode === 'stopwatch') {
                dashSeconds = Math.floor(dashElapsedMs / 1000);
                dashProgressPercent = Math.round(((dashSeconds % 60) / 60) * 100);
            } else {
                const targetMs = (displayState.targetDuration || 0) * 1000;
                const remainingMs = Math.max(0, targetMs - dashElapsedMs);
                dashSeconds = displayState.isRunning ? Math.ceil(remainingMs / 1000) : Math.floor(remainingMs / 1000);
                const target = displayState.targetDuration || 1;
                const elapsedSec = Math.floor(dashElapsedMs / 1000);
                dashProgressPercent = Math.min(100, Math.round((elapsedSec / target) * 100));
            }

            const dashHrs = Math.floor(dashSeconds / 3600);
            const dashMins = Math.floor((dashSeconds % 3600) / 60);
            const dashSecs = dashSeconds % 60;
            const dashClockText = `${String(dashHrs).padStart(2, '0')}:${String(dashMins).padStart(2, '0')}:${String(dashSecs).padStart(2, '0')}`;

            safeSetText('dash-timer-clock-text', dashClockText);

            const dashProgressBar = document.getElementById('dash-timer-progress-bar');
            if (dashProgressBar) {
                dashProgressBar.style.width = `${dashProgressPercent}%`;
            }

            const dashModeLabel = document.getElementById('dash-timer-mode-label');
            if (dashModeLabel) {
                dashModeLabel.textContent = displayMode.toUpperCase();
            }

            const dashStatusText = document.getElementById('dash-timer-status-text');
            if (dashStatusText) {
                dashStatusText.textContent = displayState.isRunning ? 'FOCUSING' : (dashElapsedMs > 0 ? 'PAUSED' : 'READY');
            }

            const dashSubjectText = document.getElementById('dash-timer-subject-text');
            if (dashSubjectText) {
                dashSubjectText.textContent = displayState.selectedSubject || 'General Study';
            }

            const dashCardBody = document.getElementById('dash-timer-card-body');
            if (dashCardBody) {
                const timerColor = window.getSubjectColor ? window.getSubjectColor(displayState.selectedSubject || 'General Study') : '#2563eb';
                dashCardBody.style.backgroundColor = `${timerColor}cc`;
            }

            const dashBtnToggle = document.getElementById('dash-timer-btn-toggle');
            if (dashBtnToggle) {
                dashBtnToggle.textContent = isTimerRunning ? 'PAUSE' : 'START';
            }
        }
        updateSubjectTargetUI();
    }

    function updateSubjectTargetUI() {
        const listContainer = document.getElementById('subject-targets-list');
        if (!listContainer) return;

        if (!window.subjectFocusTargets || Object.keys(window.subjectFocusTargets).length === 0) {
            listContainer.innerHTML = `<p class="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider py-4 text-center">No subject targets set. Click + to add one.</p>`;
            return;
        }

        let html = '';

        Object.entries(window.subjectFocusTargets).forEach(([subject, target]) => {
            const targetHours = parseInt(target.hours, 10) || 0;
            const targetMinutes = parseInt(target.minutes, 10) || 0;

            // Calculate Done time for subject (in seconds) - only logs completed on or after target creation date
            let doneSeconds = 0;
            const targetCreatedAt = target.createdAt ? new Date(target.createdAt) : null;
            if (targetCreatedAt) {
                targetCreatedAt.setHours(0, 0, 0, 0);
            }
            if (AppState.timerLogs) {
                AppState.timerLogs.forEach(log => {
                    if ((log.subject || 'General Study') === subject) {
                        const logDate = new Date(log.date);
                        if (!targetCreatedAt || logDate >= targetCreatedAt) {
                            doneSeconds += parseInt(log.duration || 0, 10);
                        }
                    }
                });
            }

            // Include current active running timer/stopwatch if its subject matches AND it is currently running
            if (AppState.activeTimerState && AppState.activeTimerState.isRunning && (AppState.activeTimerState.selectedSubject || 'General Study') === subject) {
                let activeElapsedMs = AppState.activeTimerState.elapsedBeforeStart || 0;
                if (AppState.activeTimerState.startTime) {
                    activeElapsedMs += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
                }
                doneSeconds += Math.floor(activeElapsedMs / 1000);
            }

            // Format Done using compact 00h 00m form to prevent mobile squishing
            const doneHrs = Math.floor(doneSeconds / 3600);
            const doneMins = Math.floor((doneSeconds % 3600) / 60);
            const doneText = `${String(doneHrs).padStart(2, '0')}h ${String(doneMins).padStart(2, '0')}m`;

            // Calculate Remain
            const targetSeconds = (targetHours * 3600) + (targetMinutes * 60);
            const remainSeconds = Math.max(0, targetSeconds - doneSeconds);
            const remainHrs = Math.floor(remainSeconds / 3600);
            const remainMins = Math.floor((remainSeconds % 3600) / 60);
            const remainText = `${String(remainHrs).padStart(2, '0')}h ${String(remainMins).padStart(2, '0')}m`;

            const remainColorClass = (targetSeconds > 0 && remainSeconds === 0) ? 'text-emerald-500' : 'text-indigo-500 dark:text-indigo-400';
            const targetText = `${String(targetHours).padStart(2, '0')}h ${String(targetMinutes).padStart(2, '0')}m`;

            // Calculate target completion percentage
            const progressPercent = targetSeconds > 0 ? Math.min(100, Math.round((doneSeconds / targetSeconds) * 100)) : 0;

            // Resolve subject theme color for left border and progress indicators
            const subjColor = (typeof window.getSubjectColor === 'function') ? window.getSubjectColor(subject) : '#6366f1';

            let startDateText = '';
            if (target.createdAt) {
                const sDate = new Date(target.createdAt);
                startDateText = sDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            } else {
                startDateText = 'All-time';
            }

            html += `
                <div class="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-col gap-2.5 shadow-sm relative overflow-hidden" style="border-left: 4px solid ${subjColor};">
                    <div class="flex justify-between items-center gap-2">
                        <div class="flex flex-col min-w-0">
                            <span class="font-black text-xs text-slate-800 dark:text-white truncate" title="${subject}">${subject}</span>
                            <span class="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-0.5">Start: ${startDateText}</span>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <!-- Progress Badge -->
                            <span class="text-[9px] font-black font-mono px-1.5 py-0.5 rounded-full ${progressPercent >= 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">${progressPercent}%</span>
                            
                            <!-- Edit Button -->
                            <button onclick="window.openSubjectTargetModal('${subject.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all" title="Edit Target">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Premium Progress Bar -->
                    <div class="w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500" style="width: ${progressPercent}%; background-color: ${progressPercent >= 100 ? '#10b981' : subjColor};"></div>
                    </div>

                    <!-- Details Grid -->
                    <div class="grid grid-cols-3 gap-1.5 text-center mt-0.5">
                        <div class="flex flex-col bg-white dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/80 rounded-xl py-1 px-0.5">
                            <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">Done</span>
                            <span class="text-[9.5px] font-black text-emerald-500 font-mono whitespace-nowrap">${doneText}</span>
                        </div>
                        <div class="flex flex-col bg-white dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/80 rounded-xl py-1 px-0.5">
                            <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">Remain</span>
                            <span class="text-[9.5px] font-black ${remainColorClass} font-mono whitespace-nowrap">${remainText}</span>
                        </div>
                        <div class="flex flex-col bg-white dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/80 rounded-xl py-1 px-0.5">
                            <span class="text-[7.5px] font-bold uppercase tracking-wider text-slate-400">Target</span>
                            <span class="text-[9.5px] font-black text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">${targetText}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    }

    window.openSubjectTargetModal = function (prefilledSubject = '') {
        const modal = document.getElementById('subject-target-modal');
        const backdrop = document.getElementById('stm-target-backdrop');
        const content = document.getElementById('stm-target-content');
        if (!modal || !backdrop || !content) return;

        // Populate modal subject selector first
        const select = document.getElementById('modal-target-subject');
        if (select) {
            select.innerHTML = buildProgramWiseSubjectOptionsHtml();

            if (prefilledSubject) {
                select.value = prefilledSubject;
                select.disabled = true; // when editing, disable changing subject to avoid confusion
                document.getElementById('subject-target-modal-title').textContent = 'Edit Subject Target';
            } else {
                select.disabled = false;
                document.getElementById('subject-target-modal-title').textContent = 'Add Subject Target';
            }
        }

        // Set inputs
        let hours = 1;
        let minutes = 0;
        let initialDate = new Date();
        const targetSubject = prefilledSubject || (select ? select.value : 'General Study');
        if (window.subjectFocusTargets && window.subjectFocusTargets[targetSubject]) {
            const tgt = window.subjectFocusTargets[targetSubject];
            hours = tgt.hours !== undefined ? tgt.hours : 1;
            minutes = tgt.minutes !== undefined ? tgt.minutes : 0;
            if (tgt.createdAt) {
                initialDate = new Date(tgt.createdAt);
            }
        }

        const hrsInput = document.getElementById('modal-target-hours');
        const minsInput = document.getElementById('modal-target-minutes');
        if (hrsInput) hrsInput.value = hours;
        if (minsInput) minsInput.value = minutes;

        const dateInput = document.getElementById('modal-target-start-date');
        if (dateInput) {
            const yyyy = initialDate.getFullYear();
            const mm = String(initialDate.getMonth() + 1).padStart(2, '0');
            const dd = String(initialDate.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }

        // Toggle Delete button based on Edit/Add mode
        const deleteBtn = document.getElementById('modal-target-delete-btn');
        if (deleteBtn) {
            if (prefilledSubject) {
                deleteBtn.classList.remove('hidden');
                deleteBtn.onclick = function () {
                    window.deleteSubjectTarget(prefilledSubject);
                };
            } else {
                deleteBtn.classList.add('hidden');
                deleteBtn.onclick = null;
            }
        }

        // Animate open
        modal.classList.remove('hidden'); void modal.offsetWidth;
        backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100');
        content.classList.remove('scale-95', 'opacity-0', 'translate-y-4'); content.classList.add('scale-100', 'opacity-100', 'translate-y-0');
        document.body.classList.add('overflow-hidden');
    };

    window.closeSubjectTargetModal = function () {
        const modal = document.getElementById('subject-target-modal');
        const backdrop = document.getElementById('stm-target-backdrop');
        const content = document.getElementById('stm-target-content');
        if (!modal || !backdrop || !content) return;

        backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0');
        content.classList.remove('scale-100', 'opacity-100', 'translate-y-0'); content.classList.add('scale-95', 'opacity-0', 'translate-y-4');
        setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300);
    };

    window.submitSubjectTarget = function () {
        const select = document.getElementById('modal-target-subject');
        if (!select) return;
        const subject = select.value || 'General Study';

        const hrsInput = document.getElementById('modal-target-hours');
        const minsInput = document.getElementById('modal-target-minutes');
        if (!hrsInput || !minsInput) return;

        let hours = parseInt(hrsInput.value, 10);
        let minutes = parseInt(minsInput.value, 10);

        if (isNaN(hours) || hours < 0) hours = 0;
        if (isNaN(minutes) || minutes < 0) minutes = 0;
        if (minutes > 59) minutes = 59;

        if (!window.subjectFocusTargets) {
            window.subjectFocusTargets = {};
        }

        const dateInput = document.getElementById('modal-target-start-date');
        let createdAt;
        if (dateInput && dateInput.value) {
            const parts = dateInput.value.split('-');
            const selectedDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
            createdAt = selectedDate.toISOString();
        } else {
            const existingTarget = window.subjectFocusTargets[subject];
            createdAt = (existingTarget && existingTarget.createdAt) ? existingTarget.createdAt : new Date().toISOString();
        }

        window.subjectFocusTargets[subject] = { hours, minutes, createdAt };

        if (window.FirebaseService) {
            window.FirebaseService.saveToCloud(true);
        }

        window.closeSubjectTargetModal();
        updateSubjectTargetUI();
    };

    window.deleteSubjectTarget = function (subject) {
        window.openConfirmModal(
            "Delete Subject Target?",
            `Are you sure you want to remove the focus target for "${subject}"?`,
            () => {
                if (window.subjectFocusTargets && window.subjectFocusTargets[subject]) {
                    delete window.subjectFocusTargets[subject];
                    if (window.FirebaseService) {
                        window.FirebaseService.saveToCloud(true);
                    }
                    updateSubjectTargetUI();
                    showToast(`Target for ${subject} deleted.`, "success");
                    if (typeof window.closeSubjectTargetModal === 'function') {
                        window.closeSubjectTargetModal();
                    }
                }
            }
        );
    };

    function buildProgramWiseSubjectOptionsHtml() {
        let optionsHtml = `<option value="General Study">General Study</option>`;
        const subjects = window.getAllSubjects ? window.getAllSubjects() : [];

        // Group subjects program-wise
        const programMap = {};
        subjects.forEach(s => {
            if (!s || !s.subject) return;
            const prog = s.program || 'General';
            if (!programMap[prog]) {
                programMap[prog] = new Set();
            }
            programMap[prog].add(s.subject);
        });

        const programNames = Object.keys(programMap).sort();

        programNames.forEach(prog => {
            const subList = Array.from(programMap[prog]).sort();
            if (subList.length > 0) {
                optionsHtml += `<optgroup label="🎓 ${prog}">`;
                subList.forEach(sub => {
                    optionsHtml += `<option value="${sub}">${sub}</option>`;
                });
                optionsHtml += `</optgroup>`;
            }
        });

        return optionsHtml;
    }

    function populateTimerSubjects() {
        const optionsHtml = buildProgramWiseSubjectOptionsHtml();

        ['timer-subject-select', 'modal-target-subject', 'atsm-subject', 'etsm-subject'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = optionsHtml;
                if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
                    select.value = currentValue;
                } else if (id === 'timer-subject-select' && AppState.activeTimerState && AppState.activeTimerState.selectedSubject) {
                    select.value = AppState.activeTimerState.selectedSubject;
                }
            }
        });
    }

    function getDurationString(totalSeconds) {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const _updateTimerFsBtn = (active) => {
        const btn = document.getElementById('timer-btn-fullscreen');
        if (!btn) return;
        if (active) {
            btn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 14h6m0 0v6m0-6L4 20m16-6h-6m0 0v6m0-6l6 6M4 10h6m0 0V4m0 6L4 4m16 6h-6m0 0V4m0 6l6-6"></path>
                </svg>
            `;
            btn.title = "Exit Fullscreen";
        } else {
            btn.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4"></path>
                </svg>
            `;
            btn.title = "Toggle Fullscreen";
        }
    };

    const _exitTimerFsCleanup = () => {
        const panel = document.getElementById('timer-active-panel');
        if (!panel) return;
        if (panel.classList.contains('timer-fs-exiting')) return;

        panel.classList.add('timer-fs-exiting');
        _updateTimerFsBtn(false);

        setTimeout(() => {
            panel.classList.remove('timer-fullscreen', 'timer-fs-exiting', 'dark');
            document.body.classList.remove('timer-fullscreen-active');
            window._timerFsActive = false;
            if (window._timerFsOriginalParent) {
                if (window._timerFsOriginalNext && window._timerFsOriginalNext.parentNode === window._timerFsOriginalParent) {
                    window._timerFsOriginalParent.insertBefore(panel, window._timerFsOriginalNext);
                } else {
                    window._timerFsOriginalParent.appendChild(panel);
                }
                window._timerFsOriginalParent = null;
                window._timerFsOriginalNext = null;
            }
        }, 200);
    };

    // --- MULTI-MODE STATE PERSISTENCE HELPERS ---

    function saveActiveStateToStore() {
        if (!AppState.activeTimerState) return;
        if (!AppState.activeTimerState.timerStates) {
            AppState.activeTimerState.timerStates = {
                stopwatch: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 0, selectedSubject: 'General Study' },
                timer: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 25 * 60, selectedSubject: 'General Study' },
                alarm: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 0, selectedSubject: 'General Study', alarmStart: '', alarmEnd: '', alarmUseCurrent: true }
            };
        }
        const currentMode = AppState.activeTimerState.mode;
        if (!AppState.activeTimerState.timerStates[currentMode]) {
            AppState.activeTimerState.timerStates[currentMode] = {};
        }
        const store = AppState.activeTimerState.timerStates[currentMode];

        store.isRunning = AppState.activeTimerState.isRunning;
        store.startTime = AppState.activeTimerState.startTime;
        store.elapsedBeforeStart = AppState.activeTimerState.elapsedBeforeStart;
        store.targetDuration = AppState.activeTimerState.targetDuration;
        store.selectedSubject = AppState.activeTimerState.selectedSubject || 'General Study';

        if (currentMode === 'alarm') {
            const startEl = document.getElementById('timer-alarm-start');
            const endEl = document.getElementById('timer-alarm-end');
            const useCurrentCb = document.getElementById('timer-alarm-use-current');

            store.alarmStart = startEl ? startEl.value : '';
            store.alarmEnd = endEl ? endEl.value : '';
            store.alarmUseCurrent = useCurrentCb ? useCurrentCb.checked : true;
        }
    }

    function loadActiveStateFromStore(mode) {
        if (!AppState.activeTimerState) return;
        if (!AppState.activeTimerState.timerStates) {
            AppState.activeTimerState.timerStates = {
                stopwatch: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 0, selectedSubject: 'General Study' },
                timer: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 25 * 60, selectedSubject: 'General Study' },
                alarm: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 0, selectedSubject: 'General Study', alarmStart: '', alarmEnd: '', alarmUseCurrent: true }
            };
        }
        if (!AppState.activeTimerState.timerStates[mode]) {
            AppState.activeTimerState.timerStates[mode] = {
                isRunning: false,
                startTime: null,
                elapsedBeforeStart: 0,
                targetDuration: mode === 'timer' ? 25 * 60 : 0,
                selectedSubject: 'General Study'
            };
        }
        const store = AppState.activeTimerState.timerStates[mode];

        AppState.activeTimerState.mode = mode;
        AppState.activeTimerState.isRunning = store.isRunning;
        AppState.activeTimerState.startTime = store.startTime;
        AppState.activeTimerState.elapsedBeforeStart = store.elapsedBeforeStart;
        AppState.activeTimerState.targetDuration = store.targetDuration;
        AppState.activeTimerState.selectedSubject = store.selectedSubject || 'General Study';

        // Restore DOM inputs for alarm mode
        if (mode === 'alarm') {
            setTimeout(() => {
                const startEl = document.getElementById('timer-alarm-start');
                const endEl = document.getElementById('timer-alarm-end');
                const useCurrentCb = document.getElementById('timer-alarm-use-current');

                if (startEl && store.alarmStart !== undefined) startEl.value = store.alarmStart;
                if (endEl && store.alarmEnd !== undefined) endEl.value = store.alarmEnd;
                if (useCurrentCb && store.alarmUseCurrent !== undefined) {
                    useCurrentCb.checked = store.alarmUseCurrent;
                    window.toggleAlarmUseCurrent();
                }
            }, 50);
        }

        const subjectSelect = document.getElementById('timer-subject-select');
        if (subjectSelect) {
            subjectSelect.value = AppState.activeTimerState.selectedSubject;
        }
    }

    function checkBackgroundTimers() {
        if (!AppState.activeTimerState || !AppState.activeTimerState.timerStates) return;

        let stateChanged = false;

        Object.entries(AppState.activeTimerState.timerStates).forEach(([mode, store]) => {
            if (mode === AppState.activeTimerState.mode) return; // skip currently active mode
            if (!store.isRunning) return;

            let elapsedMs = store.elapsedBeforeStart || 0;
            if (store.startTime) {
                elapsedMs += (window.getServerTime() - parseStartTime(store.startTime));
            }

            if (mode === 'timer' || mode === 'alarm') {
                const targetMs = (store.targetDuration || 0) * 1000;
                if (elapsedMs >= targetMs) {
                    store.isRunning = false;
                    store.elapsedBeforeStart = targetMs;
                    store.startTime = null;

                    playCompletionChime();
                    stateChanged = true;
                    showToast(`Background ${mode === 'alarm' ? 'Alarm Range' : 'Timer'} has completed!`, "success");
                }
            }
        });

        if (stateChanged) {
            FirebaseService.saveTimerToCloud();
            window.TimerService.updateDisplay();
        }
    }

    // --- GLOBAL BUTTON & ACTION HANDLERS ---

    window.syncTimerStateFromCloud = function () {
        if (!AppState.activeTimerState) return;

        // Initialize state store if missing
        if (!AppState.activeTimerState.timerStates) {
            AppState.activeTimerState.timerStates = {
                stopwatch: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 0, selectedSubject: 'General Study' },
                timer: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 25 * 60, selectedSubject: 'General Study' },
                alarm: { isRunning: false, startTime: null, elapsedBeforeStart: 0, targetDuration: 0, selectedSubject: 'General Study', alarmStart: '', alarmEnd: '', alarmUseCurrent: true }
            };
            // Seed current mode values
            const currentMode = AppState.activeTimerState.mode || 'stopwatch';
            AppState.activeTimerState.timerStates[currentMode] = {
                isRunning: AppState.activeTimerState.isRunning || false,
                startTime: AppState.activeTimerState.startTime || null,
                elapsedBeforeStart: AppState.activeTimerState.elapsedBeforeStart || 0,
                targetDuration: AppState.activeTimerState.targetDuration || 0,
                selectedSubject: AppState.activeTimerState.selectedSubject || 'General Study',
                alarmStart: document.getElementById('timer-alarm-start')?.value || '',
                alarmEnd: document.getElementById('timer-alarm-end')?.value || '',
                alarmUseCurrent: document.getElementById('timer-alarm-use-current')?.checked !== false
            };
        }

        // Restore alarm inputs if active mode is alarm
        if (AppState.activeTimerState.mode === 'alarm') {
            const store = AppState.activeTimerState.timerStates.alarm;
            const startEl = document.getElementById('timer-alarm-start');
            const endEl = document.getElementById('timer-alarm-end');
            const useCurrentCb = document.getElementById('timer-alarm-use-current');

            if (startEl && store.alarmStart !== undefined) startEl.value = store.alarmStart;
            if (endEl && store.alarmEnd !== undefined) endEl.value = store.alarmEnd;
            if (useCurrentCb && store.alarmUseCurrent !== undefined) {
                useCurrentCb.checked = store.alarmUseCurrent;
                window.toggleAlarmUseCurrent();
            }
        }

        const subjectSelect = document.getElementById('timer-subject-select');
        if (subjectSelect && AppState.activeTimerState.selectedSubject) {
            subjectSelect.value = AppState.activeTimerState.selectedSubject;
        }

        const btnStopwatch = document.getElementById('tm-mode-stopwatch');
        const btnTimer = document.getElementById('tm-mode-timer');
        const btnAlarm = document.getElementById('tm-mode-alarm');
        const presetsContainer = document.getElementById('timer-presets-container');
        const alarmContainer = document.getElementById('timer-alarm-container');

        if (btnStopwatch && btnTimer && btnAlarm) {
            const activeClass = "w-1/3 py-2.5 text-xs font-black rounded-xl transition-all bg-blue-600 text-white shadow";
            const inactiveClass = "w-1/3 py-2.5 text-xs font-black rounded-xl transition-all text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800/80";
            if (AppState.activeTimerState.mode === 'stopwatch') {
                btnStopwatch.className = activeClass;
                btnTimer.className = inactiveClass;
                btnAlarm.className = inactiveClass;
                if (presetsContainer) presetsContainer.classList.add('hidden');
                if (alarmContainer) alarmContainer.classList.add('hidden');
            } else if (AppState.activeTimerState.mode === 'timer') {
                btnStopwatch.className = inactiveClass;
                btnTimer.className = activeClass;
                btnAlarm.className = inactiveClass;
                if (presetsContainer) {
                    presetsContainer.classList.remove('hidden');
                    presetsContainer.classList.add('flex');
                }
                if (alarmContainer) alarmContainer.classList.add('hidden');
            } else if (AppState.activeTimerState.mode === 'alarm') {
                btnStopwatch.className = inactiveClass;
                btnTimer.className = inactiveClass;
                btnAlarm.className = activeClass;
                if (presetsContainer) presetsContainer.classList.add('hidden');
                if (alarmContainer) {
                    alarmContainer.classList.remove('hidden');
                    alarmContainer.classList.add('flex');
                }
            }
        }

        if (AppState.activeTimerState.mode === 'alarm') {
            window.updateAlarmStartText();
        }

        if (AppState.timerInterval) {
            clearInterval(AppState.timerInterval);
            AppState.timerInterval = null;
        }

        tickTimer();

        if (isAnyTimerRunning()) {
            AppState.timerInterval = setInterval(tickTimer, 40);
        }
    };

    window.updateAlarmStartText = function () {
        const useCurrentCb = document.getElementById('timer-alarm-use-current');
        const startInput = document.getElementById('timer-alarm-start');
        if (useCurrentCb && useCurrentCb.checked && startInput && (!AppState.activeTimerState || !AppState.activeTimerState.isRunning)) {
            const now = new Date();
            const curTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            startInput.value = curTimeStr;
        }
    };

    window.toggleAlarmUseCurrent = function () {
        const useCurrentCb = document.getElementById('timer-alarm-use-current');
        const startInput = document.getElementById('timer-alarm-start');
        if (useCurrentCb && startInput) {
            if (useCurrentCb.checked) {
                startInput.disabled = true;
                window.updateAlarmStartText();
            } else {
                startInput.disabled = false;
            }
        }
    };

    window.openTimerWarningModal = function (message) {
        if (message) {
            const msgEl = document.getElementById('tw-message');
            if (msgEl) msgEl.textContent = message;
        }
        const modal = document.getElementById('timer-warning-modal');
        const backdrop = document.getElementById('tw-backdrop');
        const content = document.getElementById('tw-content');
        if (!modal || !backdrop || !content) return;
        modal.classList.remove('hidden'); void modal.offsetWidth;
        backdrop.classList.remove('opacity-0'); backdrop.classList.add('opacity-100');
        content.classList.remove('scale-95', 'opacity-0', 'translate-y-4'); content.classList.add('scale-100', 'opacity-100', 'translate-y-0');
        document.body.classList.add('overflow-hidden');
    };

    window.closeTimerWarningModal = function () {
        const modal = document.getElementById('timer-warning-modal');
        const backdrop = document.getElementById('tw-backdrop');
        const content = document.getElementById('tw-content');
        if (!modal || !backdrop || !content) return;
        backdrop.classList.remove('opacity-100'); backdrop.classList.add('opacity-0');
        content.classList.remove('scale-100', 'opacity-100', 'translate-y-0'); content.classList.add('scale-95', 'opacity-0', 'translate-y-4');
        setTimeout(() => { modal.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }, 300);
    };

    window.setTimerMode = function (mode) {
        if (AppState.activeTimerState.mode === mode) return;

        // Save the current active mode state (do NOT pause it automatically)
        saveActiveStateToStore();

        loadActiveStateFromStore(mode);
        FirebaseService.saveTimerToCloud();
        window.TimerService.restore();
    };

    window.setTimerPreset = function (minutes) {
        if (AppState.activeTimerState.isRunning) {
            showToast("Please pause the timer before changing presets.", "error");
            return;
        }
        AppState.activeTimerState.targetDuration = minutes * 60;
        AppState.activeTimerState.elapsedBeforeStart = 0;
        AppState.activeTimerState.startTime = null;
        saveActiveStateToStore();
        FirebaseService.saveTimerToCloud();
        window.TimerService.restore();
        showToast(`Timer set to ${minutes} minutes.`, "success");
    };

    window.promptCustomTimer = function () {
        if (AppState.activeTimerState.isRunning) {
            showToast("Please pause the timer before changing presets.", "error");
            return;
        }
        const input = document.getElementById('custom-timer-input-minutes');
        if (input) {
            input.value = "25";
        }
        openModal('custom-timer-modal');
    };

    window.submitCustomTimer = function () {
        const input = document.getElementById('custom-timer-input-minutes');
        if (!input) return;
        const minutes = parseInt(input.value, 10);
        if (isNaN(minutes) || minutes <= 0) {
            showToast("Please enter a valid positive number of minutes.", "error");
            return;
        }
        AppState.activeTimerState.targetDuration = minutes * 60;
        AppState.activeTimerState.elapsedBeforeStart = 0;
        AppState.activeTimerState.startTime = null;
        saveActiveStateToStore();
        FirebaseService.saveTimerToCloud();
        window.TimerService.restore();
        closeModal('custom-timer-modal');
        showToast(`Timer set to ${minutes} minutes.`, "success");
    };

    window.toggleTimerClick = function () {
        if (!AppState.activeTimerState) return;

        const subjectSelect = document.getElementById('timer-subject-select');
        if (subjectSelect) {
            AppState.activeTimerState.selectedSubject = subjectSelect.value;
        }

        // Determine if any tracker is running
        let runningMode = null;
        if (AppState.activeTimerState.timerStates) {
            runningMode = Object.keys(AppState.activeTimerState.timerStates).find(
                m => AppState.activeTimerState.timerStates[m].isRunning
            );
        }

        if (AppState.activeTimerState.isRunning || runningMode) {
            window.TimerService.pause();
        } else {
            if (AppState.activeTimerState.mode === 'alarm') {
                const startEl = document.getElementById('timer-alarm-start');
                const endEl = document.getElementById('timer-alarm-end');
                if (!startEl || !endEl || !endEl.value) {
                    showToast("Please specify an End Time for the alarm range.", "error");
                    return;
                }

                const useCurrent = document.getElementById('timer-alarm-use-current')?.checked;
                if (useCurrent) {
                    const now = new Date();
                    const curTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    startEl.value = curTimeStr;
                }

                const startTimeVal = startEl.value;
                const endTimeVal = endEl.value;
                if (!startTimeVal) {
                    showToast("Please specify a Start Time.", "error");
                    return;
                }

                const timeStrToSeconds = (str) => {
                    const parts = str.split(':').map(Number);
                    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60;
                };

                let duration = timeStrToSeconds(endTimeVal) - timeStrToSeconds(startTimeVal);
                if (duration <= 0) {
                    duration += 24 * 3600; // cross-midnight
                }

                AppState.activeTimerState.targetDuration = duration;

                let elapsedMs = AppState.activeTimerState.elapsedBeforeStart || 0;
                const targetMs = (AppState.activeTimerState.targetDuration || 0) * 1000;
                if (elapsedMs >= targetMs) {
                    AppState.activeTimerState.elapsedBeforeStart = 0;
                }
            } else if (AppState.activeTimerState.mode === 'timer') {
                let elapsedMs = AppState.activeTimerState.elapsedBeforeStart || 0;
                const targetMs = (AppState.activeTimerState.targetDuration || 0) * 1000;
                if (elapsedMs >= targetMs) {
                    AppState.activeTimerState.elapsedBeforeStart = 0;
                }
            }
            window.TimerService.start();
        }
    };

    window.resetTimerClick = function () {
        if (!AppState.activeTimerState) return;
        window.openConfirmModal(
            "Reset Timer/Stopwatch?",
            "Are you sure you want to reset the current session? This will clear all accumulated time.",
            () => {
                window.TimerService.reset();
                showToast("Timer reset.", "success");
            }
        );
    };

    window.saveTimerSession = function () {
        if (!AppState.activeTimerState) return;

        let elapsedMs = AppState.activeTimerState.elapsedBeforeStart || 0;
        if (AppState.activeTimerState.isRunning && AppState.activeTimerState.startTime) {
            elapsedMs += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
        }

        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        if (elapsedSeconds <= 0) {
            showToast("No focus duration accumulated to save.", "error");
            return;
        }

        const subject = AppState.activeTimerState.selectedSubject || 'General Study';
        const mode = AppState.activeTimerState.mode;

        const newLog = {
            id: 'timer-log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            subject: subject,
            duration: elapsedSeconds,
            date: new Date(window.getServerTime()).toISOString(),
            mode: mode
        };

        if (!AppState.timerLogs) AppState.timerLogs = [];
        AppState.timerLogs.unshift(newLog);

        AppState.activeTimerState.isRunning = false;
        AppState.activeTimerState.startTime = null;
        AppState.activeTimerState.elapsedBeforeStart = 0;

        // Also reset stored state for active mode since we just saved it!
        const currentMode = AppState.activeTimerState.mode;
        if (AppState.activeTimerState.timerStates && AppState.activeTimerState.timerStates[currentMode]) {
            const store = AppState.activeTimerState.timerStates[currentMode];
            store.isRunning = false;
            store.startTime = null;
            store.elapsedBeforeStart = 0;
        }

        saveActiveStateToStore();
        FirebaseService.saveToCloud(true);
        FirebaseService.saveTimerToCloud();
        window.TimerService.restore();
        window.TimerService.updateDisplay();
        showToast(`Saved session: ${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s for ${subject}.`, "success");
    };

    window.deleteTimerLog = function (logId) {
        window.openConfirmModal(
            "Delete Study Record?",
            "Are you sure you want to delete this study record? This action cannot be undone.",
            () => {
                if (!AppState.timerLogs) AppState.timerLogs = [];
                AppState.timerLogs = AppState.timerLogs.filter(log => log.id !== logId);
                FirebaseService.saveToCloud(true);
                window.TimerService.updateDisplay();
                showToast("Study session deleted.", "success");
            }
        );
    };

    window.timerAnalyticsRange = 180;
    window.timerAnalyticsChartStyle = 'combo';
    window.timerAnalyticsGrouping = 'daily';

    window.updateTimerAnalyticsControls = function () {
        const range = window.timerAnalyticsRange || 180;
        const style = window.timerAnalyticsChartStyle || 'combo';
        const grouping = window.timerAnalyticsGrouping || 'daily';

        const activeClass = "shrink-0 px-2 sm:px-2.5 py-1 text-[9px] sm:text-[11px] font-bold rounded-lg transition-all bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/30 dark:border-slate-700/30";
        const inactiveClass = "shrink-0 px-2 sm:px-2.5 py-1 text-[9px] sm:text-[11px] font-bold rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";
        const disabledClass = "shrink-0 px-2 sm:px-2.5 py-1 text-[9px] sm:text-[11px] font-bold rounded-lg transition-all text-slate-400 dark:text-slate-600 opacity-40 cursor-not-allowed";

        // 1. Sync timeframe buttons styling
        [1, 7, 30, 180].forEach(d => {
            const btn = document.getElementById(`tar-btn-${d}`);
            const spectraBtn = document.getElementById(`spectra-tar-btn-${d}`);
            if (btn) btn.className = d === range ? activeClass : inactiveClass;
            if (spectraBtn) spectraBtn.className = d === range ? activeClass : inactiveClass;
        });

        // 2. Manage Grouping buttons based on selected Range
        if (range === 1) {
            window.timerAnalyticsGrouping = 'hourly';
        } else if (range === 7) {
            if (window.timerAnalyticsGrouping === 'hourly') window.timerAnalyticsGrouping = 'daily';
        } else if (range === 30) {
            if (window.timerAnalyticsGrouping === 'hourly' || window.timerAnalyticsGrouping === 'monthly') window.timerAnalyticsGrouping = 'daily';
        } else {
            if (window.timerAnalyticsGrouping === 'hourly') window.timerAnalyticsGrouping = 'daily';
        }

        const currentGrouping = window.timerAnalyticsGrouping;

        ['hourly', 'daily', 'weekly', 'monthly'].forEach(g => {
            const btn = document.getElementById(`tag-btn-${g}`);
            const spectraBtn = document.getElementById(`spectra-tag-btn-${g}`);
            let isDisabled = false;

            if (range === 1 && g !== 'hourly') isDisabled = true;
            else if (range === 7 && g !== 'daily') isDisabled = true;
            else if (range === 30 && (g === 'monthly' || g === 'hourly')) isDisabled = true;
            else if (range === 180 && g === 'hourly') isDisabled = true;

            [btn, spectraBtn].forEach(b => {
                if (!b) return;
                if (isDisabled) {
                    b.setAttribute('disabled', 'true');
                    b.className = disabledClass;
                } else {
                    b.removeAttribute('disabled');
                    b.className = g === currentGrouping ? activeClass : inactiveClass;
                }
            });
        });

        // 3. Sync Chart Style buttons styling
        ['combo', 'bar', 'line'].forEach(s => {
            const btn = document.getElementById(`tas-btn-${s}`);
            const spectraBtn = document.getElementById(`spectra-tas-btn-${s}`);
            if (btn) btn.className = s === style ? activeClass : inactiveClass;
            if (spectraBtn) spectraBtn.className = s === style ? activeClass : inactiveClass;
        });

        // Sync Target Input values
        const targetVal = window.dailyFocusHoursTarget || 4.0;
        ['timer-target-input', 'spectra-timer-target-input'].forEach(id => {
            const input = document.getElementById(id);
            if (input && parseFloat(input.value) !== targetVal) {
                input.value = targetVal;
            }
        });
    };

    window.openTimerAnalyticsModal = function () {
        const targetInput = document.getElementById('timer-target-input');
        if (targetInput) {
            targetInput.value = window.dailyFocusHoursTarget || 4.0;
        }
        if (window.timerAnalyticsRange === undefined) {
            window.timerAnalyticsRange = 180;
        }
        if (window.timerAnalyticsChartStyle === undefined) {
            window.timerAnalyticsChartStyle = 'combo';
        }
        if (window.timerAnalyticsGrouping === undefined) {
            window.timerAnalyticsGrouping = 'daily';
        }
        window.updateTimerAnalyticsControls();
        window.renderTimerAnalyticsChart();
        window.openModal('timer-analytics-modal');
    };

    window.getDailyFocusHoursTargetForDate = function (dateObj) {
        if (!window.dailyFocusHoursTargetHistory || window.dailyFocusHoursTargetHistory.length === 0) {
            return window.dailyFocusHoursTarget || 4.0;
        }

        const sorted = [...window.dailyFocusHoursTargetHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

        const queryDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const queryTime = queryDate.getTime();

        const firstEntryDate = new Date(sorted[0].date);
        const firstEntryStartOfDay = new Date(firstEntryDate.getFullYear(), firstEntryDate.getMonth(), firstEntryDate.getDate()).getTime();

        if (queryTime < firstEntryStartOfDay) {
            return 0;
        }

        let activeTarget = sorted[0].target;
        for (let i = 0; i < sorted.length; i++) {
            const entryDate = new Date(sorted[i].date);
            const entryStartOfDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate()).getTime();
            if (queryTime >= entryStartOfDay) {
                activeTarget = sorted[i].target;
            }
        }
        return activeTarget;
    };

    window.updateDailyFocusHoursTarget = function (value) {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && parsed > 0) {
            window.dailyFocusHoursTarget = parsed;
            window.dailyFocusHoursTargetDate = new Date().toISOString();

            if (!window.dailyFocusHoursTargetHistory) {
                window.dailyFocusHoursTargetHistory = [];
            }

            const todayStr = new Date().toDateString();
            const existingIdx = window.dailyFocusHoursTargetHistory.findIndex(entry =>
                new Date(entry.date).toDateString() === todayStr
            );

            if (existingIdx !== -1) {
                window.dailyFocusHoursTargetHistory[existingIdx].target = parsed;
                window.dailyFocusHoursTargetHistory[existingIdx].date = new Date().toISOString();
            } else {
                window.dailyFocusHoursTargetHistory.push({
                    date: new Date().toISOString(),
                    target: parsed
                });
            }

            if (window.FirebaseService) {
                window.FirebaseService.saveToCloud(true);
            }
            window.updateTimerAnalyticsControls();
            window.renderTimerAnalyticsChart();
        }
    };

    window.setTimerAnalyticsRange = function (days) {
        window.timerAnalyticsRange = days;
        window.updateTimerAnalyticsControls();
        window.renderTimerAnalyticsChart();
    };

    window.setTimerAnalyticsGrouping = function (grouping) {
        const range = window.timerAnalyticsRange || 180;
        if (range === 1 && grouping !== 'hourly') return;
        if (range === 7 && grouping !== 'daily') return;
        if (range === 30 && (grouping === 'monthly' || grouping === 'hourly')) return;
        if (range === 180 && grouping === 'hourly') return;

        window.timerAnalyticsGrouping = grouping;
        window.updateTimerAnalyticsControls();
        window.renderTimerAnalyticsChart();
    };

    window.setTimerAnalyticsChartStyle = function (style) {
        window.timerAnalyticsChartStyle = style;
        window.updateTimerAnalyticsControls();
        window.renderTimerAnalyticsChart();
    };

    window.renderTimerAnalyticsChart = function () {
        const ctx = document.getElementById('timerAnalyticsChart');
        if (!ctx) return;

        if (window.timerAnalyticsChartInstance) {
            window.timerAnalyticsChartInstance.destroy();
        }

        const range = window.timerAnalyticsRange || 180;
        const style = window.timerAnalyticsChartStyle || 'combo';
        let grouping = window.timerAnalyticsGrouping || 'daily';

        // Range constraints on grouping
        if (range === 1) {
            grouping = 'hourly';
        } else if (range === 7) {
            grouping = 'daily';
        } else if (range === 30 && (grouping === 'monthly' || grouping === 'hourly')) {
            grouping = 'daily';
        } else if (range > 30 && grouping === 'hourly') {
            grouping = 'daily';
        }

        let chartLabels = [];
        let chartActuals = [];
        let chartTargets = [];

        if (grouping === 'hourly') {
            const today = new Date();
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

            const hourlyActualSeconds = new Array(24).fill(0);

            if (AppState.timerLogs) {
                AppState.timerLogs.forEach(log => {
                    const logTime = new Date(log.date).getTime();
                    if (logTime >= todayStart && logTime <= todayEnd) {
                        const logDate = new Date(log.date);
                        const hr = logDate.getHours();
                        if (hr >= 0 && hr < 24) {
                            hourlyActualSeconds[hr] += parseInt(log.duration || 0, 10);
                        }
                    }
                });
            }

            // Real-time addition for active timer/stopwatch ONLY if currently running
            if (AppState.activeTimerState) {
                let activeMs = 0;
                if (AppState.activeTimerState.timerStates) {
                    Object.values(AppState.activeTimerState.timerStates).forEach(store => {
                        if (store.isRunning) {
                            let ms = store.elapsedBeforeStart || 0;
                            if (store.startTime) {
                                ms += (window.getServerTime() - parseStartTime(store.startTime));
                            }
                            activeMs += ms;
                        }
                    });
                } else if (AppState.activeTimerState.isRunning) {
                    activeMs = AppState.activeTimerState.elapsedBeforeStart || 0;
                    if (AppState.activeTimerState.startTime) {
                        activeMs += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
                    }
                }
                const activeSec = Math.floor(activeMs / 1000);
                if (activeSec > 0) {
                    const currentHr = today.getHours();
                    hourlyActualSeconds[currentHr] += activeSec;
                }
            }

            const dayTarget = window.getDailyFocusHoursTargetForDate(today);
            const hourlyTarget = parseFloat((dayTarget / 24).toFixed(2));

            let peakHour = { actual: 0, label: "No Data" };

            for (let h = 0; h < 24; h++) {
                const ampm = h >= 12 ? 'PM' : 'AM';
                let displayHr = h % 12;
                if (displayHr === 0) displayHr = 12;
                const label = `${displayHr} ${ampm}`;

                const actualHrs = parseFloat((hourlyActualSeconds[h] / 3600).toFixed(2));

                chartLabels.push(label);
                chartActuals.push(actualHrs);
                chartTargets.push(hourlyTarget);

                if (actualHrs > peakHour.actual) {
                    peakHour = { actual: actualHrs, label: label };
                }
            }

            const sumActual = parseFloat((hourlyActualSeconds.reduce((a, b) => a + b, 0) / 3600).toFixed(2));
            const sumTarget = dayTarget;
            const successRate = sumTarget > 0 ? Math.round((sumActual / sumTarget) * 100) : 0;

            // Update Stats UI for Today (both Modal and Spectra Pulse page)
            ['timer-average-focus', 'spectra-timer-average-focus'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = formatHoursToHrMin(sumActual);
            });

            ['timer-average-target', 'spectra-timer-average-target'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = formatHoursToHrMin(sumTarget);
            });

            ['timer-total-focus', 'spectra-timer-total-focus'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = formatHoursToHrMin(sumActual);
            });

            ['timer-success-rate', 'spectra-timer-success-rate'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerText = `${successRate}%`;
                    if (successRate >= 75) {
                        el.className = "text-base md:text-lg font-black text-emerald-600 dark:text-emerald-400";
                    } else if (successRate >= 40) {
                        el.className = "text-base md:text-lg font-black text-amber-600 dark:text-amber-400";
                    } else {
                        el.className = "text-base md:text-lg font-black text-rose-600 dark:text-rose-400";
                    }
                }
            });

            ['timer-success-rate-subtitle', 'spectra-timer-success-rate-subtitle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = `Today (Hourly)`;
            });

            ['timer-peak-value', 'spectra-timer-peak-value'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = peakHour.actual > 0 ? formatHoursToHrMin(peakHour.actual) : "0 min";
            });

            ['timer-peak-date', 'spectra-timer-peak-date'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = peakHour.actual > 0 ? peakHour.label : "No Data";
            });
        } else {
            // 1. Gather daily data points
            const dailyPoints = [];
            for (let i = range - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);

                const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
                const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

                let totalSeconds = 0;
                if (AppState.timerLogs) {
                    AppState.timerLogs.forEach(log => {
                        const logTime = new Date(log.date).getTime();
                        if (logTime >= dayStart && logTime <= dayEnd) {
                            totalSeconds += parseInt(log.duration || 0, 10);
                        }
                    });
                }

                const actualHrs = parseFloat((totalSeconds / 3600).toFixed(2));
                const dayTarget = window.getDailyFocusHoursTargetForDate(d);

                dailyPoints.push({
                    date: d,
                    actual: actualHrs,
                    target: dayTarget
                });
            }

            // 2. Compute Analytics Statistics (overall for the selected range)
            const sumActual = dailyPoints.reduce((acc, p) => acc + p.actual, 0);
            const avgActual = parseFloat((sumActual / range).toFixed(2));
            const sumTarget = dailyPoints.reduce((acc, p) => acc + p.target, 0);
            const avgTarget = parseFloat((sumTarget / range).toFixed(2));

            const successRate = avgTarget > 0 ? Math.round((avgActual / avgTarget) * 100) : 0;
            const successDays = dailyPoints.filter(p => p.actual >= p.target).length;

            let peakDay = { actual: 0, date: null };
            dailyPoints.forEach(p => {
                if (p.actual > peakDay.actual) {
                    peakDay = p;
                }
            });

            // Update Stats UI (both Modal and Spectra Pulse page)
            const avgVal = formatHoursToHrMin(avgActual);
            const avgTargetVal = formatHoursToHrMin(avgTarget);
            const totalVal = formatHoursToHrMin(sumActual);
            const rateStr = `${successRate}%`;
            const subtitleStr = `${successDays} of ${range} days`;
            const peakValStr = peakDay.actual > 0 && peakDay.date ? formatHoursToHrMin(peakDay.actual) : "0 min";
            const peakDateStr = peakDay.actual > 0 && peakDay.date ? peakDay.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "No Data";

            ['timer-average-focus', 'spectra-timer-average-focus'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = avgVal;
            });

            ['timer-average-target', 'spectra-timer-average-target'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = avgTargetVal;
            });

            ['timer-total-focus', 'spectra-timer-total-focus'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = totalVal;
            });

            ['timer-success-rate', 'spectra-timer-success-rate'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerText = rateStr;
                    if (successRate >= 75) {
                        el.className = "text-base md:text-lg font-black text-emerald-600 dark:text-emerald-400";
                    } else if (successRate >= 40) {
                        el.className = "text-base md:text-lg font-black text-amber-600 dark:text-amber-400";
                    } else {
                        el.className = "text-base md:text-lg font-black text-rose-600 dark:text-rose-400";
                    }
                }
            });

            ['timer-success-rate-subtitle', 'spectra-timer-success-rate-subtitle'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = subtitleStr;
            });

            ['timer-peak-value', 'spectra-timer-peak-value'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = peakValStr;
            });

            ['timer-peak-date', 'spectra-timer-peak-date'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = peakDateStr;
            });

            // 3. Perform Data Aggregation for Chart
            if (grouping === 'weekly') {
                const weeklyGroups = {};
                dailyPoints.forEach(p => {
                    const d = new Date(p.date);
                    const dayOfWeek = d.getDay();
                    const diffToSat = (dayOfWeek + 1) % 7;
                    
                    const satDate = new Date(d);
                    satDate.setDate(d.getDate() - diffToSat);
                    satDate.setHours(0, 0, 0, 0);
                    
                    const key = `${satDate.getFullYear()}-${String(satDate.getMonth() + 1).padStart(2, '0')}-${String(satDate.getDate()).padStart(2, '0')}`;
                    if (!weeklyGroups[key]) {
                        weeklyGroups[key] = [];
                    }
                    weeklyGroups[key].push(p);
                });

                const sortedKeys = Object.keys(weeklyGroups).sort();

                sortedKeys.forEach(key => {
                    const group = weeklyGroups[key];
                    const weekActualSum = group.reduce((acc, p) => acc + p.actual, 0);
                    const weekTargetSum = group.reduce((acc, p) => acc + p.target, 0);
                    const weekActual = parseFloat((weekActualSum / group.length).toFixed(2));
                    const weekTarget = parseFloat((weekTargetSum / group.length).toFixed(2));

                    chartActuals.push(weekActual);
                    chartTargets.push(weekTarget);

                    const startD = new Date(key);
                    const endD = new Date(startD);
                    endD.setDate(startD.getDate() + 6);
                    
                    const startStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    const endStr = endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    chartLabels.push(`${startStr} - ${endStr}`);
                });
            } else if (grouping === 'monthly') {
                const monthlyGroups = {};
                dailyPoints.forEach(p => {
                    const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}`;
                    if (!monthlyGroups[key]) {
                        monthlyGroups[key] = [];
                    }
                    monthlyGroups[key].push(p);
                });

                const sortedKeys = Object.keys(monthlyGroups).sort();

                sortedKeys.forEach(key => {
                    const group = monthlyGroups[key];
                    const groupActualSum = group.reduce((acc, p) => acc + p.actual, 0);
                    const groupTargetSum = group.reduce((acc, p) => acc + p.target, 0);
                    const groupActual = parseFloat((groupActualSum / group.length).toFixed(2));
                    const groupTarget = parseFloat((groupTargetSum / group.length).toFixed(2));

                    chartActuals.push(groupActual);
                    chartTargets.push(groupTarget);

                    const firstD = group[0].date;
                    const labelStr = firstD.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                    chartLabels.push(labelStr);
                });
            } else {
                chartLabels = dailyPoints.map(p => window.Utils.formatDate(p.date));
                chartActuals = dailyPoints.map(p => p.actual);
                chartTargets = dailyPoints.map(p => p.target);
            }
        }

        // 4. Set up datasets based on visual style
        let datasets = [];
        const canvasCtx = ctx.getContext('2d');
        const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;

        const actualLabelName = grouping === 'hourly'
            ? 'Hourly Focus Hours'
            : (grouping === 'daily'
                ? 'Actual Focus Hours'
                : (grouping === 'weekly'
                    ? 'Weekly Focus Hours (Avg/Day)'
                    : 'Monthly Focus Hours (Avg/Day)'));

        const targetLabelName = grouping === 'hourly'
            ? 'Hourly Target Hours'
            : (grouping === 'daily'
                ? 'Target Focus Hours'
                : (grouping === 'weekly'
                    ? 'Weekly Target Hours (Avg/Day)'
                    : 'Monthly Target Hours (Avg/Day)'));

        if (style === 'combo') {
            // Combo: Actual is Bar with rounded gradients, Target is Line with glow
            let successBarGrad = 'rgba(16, 185, 129, 1.0)';
            let failBarGrad = 'rgba(99, 102, 241, 1.0)';
            try {
                const successGrad = canvasCtx.createLinearGradient(0, 300, 0, 0);
                successGrad.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
                successGrad.addColorStop(1, 'rgba(16, 185, 129, 1.0)');
                successBarGrad = successGrad;

                const failGrad = canvasCtx.createLinearGradient(0, 300, 0, 0);
                failGrad.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
                failGrad.addColorStop(1, 'rgba(99, 102, 241, 1.0)');
                failBarGrad = failGrad;
            } catch (e) {
                console.error(e);
            }

            const barColors = [];
            const barHoverColors = [];
            for (let i = 0; i < chartActuals.length; i++) {
                const met = chartActuals[i] >= chartTargets[i];
                if (met) {
                    barColors.push(successBarGrad);
                    barHoverColors.push('rgba(16, 185, 129, 1)');
                } else {
                    barColors.push(failBarGrad);
                    barHoverColors.push('rgba(99, 102, 241, 1)');
                }
            }

            datasets = [
                {
                    type: 'bar',
                    label: actualLabelName,
                    data: chartActuals,
                    backgroundColor: barColors,
                    hoverBackgroundColor: barHoverColors,
                    borderRadius: 8,
                    borderWidth: 0,
                    barPercentage: range > 30 && grouping === 'daily' ? 0.8 : (grouping === 'hourly' ? 0.7 : 0.6)
                },
                {
                    type: 'line',
                    label: targetLabelName,
                    data: chartTargets,
                    borderColor: '#f43f5e',
                    borderWidth: 3.5,
                    borderDash: [6, 4],
                    fill: false,
                    tension: 0.4,
                    pointRadius: chartActuals.length > 30 ? 0 : 3.5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: isDark ? '#0f172a' : '#ffffff',
                    pointBorderColor: '#f43f5e',
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#f43f5e',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }
            ];
        } else if (style === 'bar') {
            // Bar: Grouped side-by-side actual vs target with premium gradients
            let barActualGrad = 'rgba(99, 102, 241, 1.0)';
            let barTargetGrad = 'rgba(244, 63, 94, 1.0)';
            try {
                const g1 = canvasCtx.createLinearGradient(0, 300, 0, 0);
                g1.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
                g1.addColorStop(1, 'rgba(99, 102, 241, 1.0)');
                barActualGrad = g1;

                const g2 = canvasCtx.createLinearGradient(0, 300, 0, 0);
                g2.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
                g2.addColorStop(1, 'rgba(244, 63, 94, 1.0)');
                barTargetGrad = g2;
            } catch (e) {
                console.error(e);
            }

            datasets = [
                {
                    type: 'bar',
                    label: actualLabelName,
                    data: chartActuals,
                    backgroundColor: barActualGrad,
                    hoverBackgroundColor: 'rgba(99, 102, 241, 1)',
                    borderRadius: 6,
                    borderWidth: 0
                },
                {
                    type: 'bar',
                    label: targetLabelName,
                    data: chartTargets,
                    backgroundColor: barTargetGrad,
                    hoverBackgroundColor: 'rgba(244, 63, 94, 1.0)',
                    borderRadius: 6,
                    borderWidth: 0
                }
            ];
        } else {
            // Line/Area: Line charts with futuristic linear gradients & smooth organic curves
            let actualLineGradient = '#6366f1';
            let actualFillGradient = 'rgba(99, 102, 241, 0.65)';
            try {
                const width = ctx.clientWidth || 500;
                const gradLine = canvasCtx.createLinearGradient(0, 0, width, 0);
                gradLine.addColorStop(0, '#818cf8');    // Bright Light Indigo
                gradLine.addColorStop(0.5, '#6366f1');  // Primary Indigo
                gradLine.addColorStop(1, '#4f46e5');    // Dark Indigo
                actualLineGradient = gradLine;

                const gradFill = canvasCtx.createLinearGradient(0, 0, 0, 300);
                gradFill.addColorStop(0, 'rgba(99, 102, 241, 0.85)'); // Indigo glow at top
                gradFill.addColorStop(0.5, 'rgba(129, 140, 248, 0.55)'); // Lighter indigo fade
                gradFill.addColorStop(1, 'rgba(99, 102, 241, 0)'); // Transparent
                actualFillGradient = gradFill;
            } catch (e) {
                console.error(e);
            }

            datasets = [
                {
                    type: 'line',
                    label: actualLabelName,
                    data: chartActuals,
                    borderColor: actualLineGradient,
                    borderWidth: 4,
                    backgroundColor: actualFillGradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: chartActuals.length > 30 ? 0 : 3.5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: isDark ? '#0f172a' : '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2.5,
                    pointHoverBackgroundColor: '#4f46e5',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 3
                },
                {
                    type: 'line',
                    label: targetLabelName,
                    data: chartTargets,
                    borderColor: '#f43f5e',
                    borderWidth: 3.5,
                    borderDash: [6, 4],
                    fill: false,
                    tension: 0.4,
                    pointRadius: chartActuals.length > 30 ? 0 : 3.5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: isDark ? '#0f172a' : '#ffffff',
                    pointBorderColor: '#f43f5e',
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#f43f5e',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }
            ];
        }

        // 5. Build and configure the Chart
        const maxVal = Math.max(...chartActuals, ...chartTargets);
        const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.2) : 5;
        const textColor = isDark ? '#94a3b8' : '#64748b';

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui';

        // Custom plugins to add futuristic touches
        const shadowPlugin = {
            id: 'timerAnalyticsShadow',
            beforeDatasetDraw: (chart, args) => {
                const { ctx: drawingCtx } = chart;
                const dataset = chart.data.datasets[args.index];
                drawingCtx.save();
                if (dataset.type === 'line') {
                    drawingCtx.shadowColor = (args.index === 0)
                        ? (isDark ? 'rgba(99, 102, 241, 0.65)' : 'rgba(99, 102, 241, 0.45)')
                        : (isDark ? 'rgba(244, 63, 94, 0.55)' : 'rgba(244, 63, 94, 0.35)');
                    drawingCtx.shadowBlur = 10;
                    drawingCtx.shadowOffsetX = 0;
                    drawingCtx.shadowOffsetY = 4;
                }
            },
            afterDatasetDraw: (chart, args) => {
                const { ctx: drawingCtx } = chart;
                drawingCtx.restore();
            }
        };

        const crosshairPlugin = {
            id: 'timerAnalyticsCrosshair',
            afterDraw: (chart) => {
                const activeElements = chart.tooltip?.getActiveElements?.() || chart.tooltip?._active || [];
                if (activeElements.length) {
                    const activePoint = activeElements[0];
                    const { ctx: drawingCtx, chartArea: { top, bottom } } = chart;
                    const x = activePoint.element.x;
                    drawingCtx.save();
                    drawingCtx.beginPath();
                    drawingCtx.moveTo(x, top);
                    drawingCtx.lineTo(x, bottom);
                    drawingCtx.lineWidth = 1.2;
                    drawingCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)';
                    drawingCtx.setLineDash([4, 4]);
                    drawingCtx.stroke();
                    drawingCtx.restore();
                }
            }
        };

        const chartConfig = {
            data: {
                labels: chartLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                weight: 'bold',
                                size: 11,
                                family: 'Outfit, Inter, sans-serif'
                            },
                            color: isDark ? '#cbd5e1' : '#475569',
                            padding: 20
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.15)',
                        borderWidth: 1.5,
                        titleColor: isDark ? '#ffffff' : '#0f172a',
                        titleFont: {
                            family: 'Outfit, Inter, sans-serif',
                            weight: '800',
                            size: 12
                        },
                        bodyColor: isDark ? '#cbd5e1' : '#334155',
                        bodyFont: {
                            family: 'Inter, sans-serif',
                            weight: '600',
                            size: 11
                        },
                        footerColor: isDark ? '#818cf8' : '#6366f1',
                        footerFont: {
                            family: 'Inter, sans-serif',
                            weight: '800',
                            size: 10
                        },
                        cornerRadius: 12,
                        padding: 12,
                        boxPadding: 6,
                        usePointStyle: true,
                        callbacks: {
                            label: function (context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return ` ${label}: ${value.toFixed(2)} hrs`;
                            },
                            footer: function (tooltipItems) {
                                if (tooltipItems.length >= 2) {
                                    const actual = tooltipItems[0].parsed.y;
                                    const target = tooltipItems[1].parsed.y;
                                    const diff = actual - target;
                                    const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
                                    if (diff >= 0) {
                                        return `Goal Met! (+${diff.toFixed(2)}h, ${percent}%)`;
                                    } else {
                                        return `Goal Missed (${diff.toFixed(2)}h, ${percent}%)`;
                                    }
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: yMax,
                        grid: {
                            color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)',
                            drawBorder: false,
                            borderDash: [5, 5]
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            color: isDark ? '#94a3b8' : '#64748b',
                            font: {
                                weight: 'bold',
                                family: 'Inter, sans-serif',
                                size: 10
                            },
                            padding: 8,
                            callback: v => `${v}h`
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        border: {
                            display: false
                        },
                        ticks: {
                            color: isDark ? '#94a3b8' : '#64748b',
                            font: {
                                weight: 'bold',
                                family: 'Inter, sans-serif',
                                size: 10
                            },
                            padding: 8,
                            maxTicksLimit: chartLabels.length > 30 ? 6 : (chartLabels.length > 7 ? 10 : 7),
                            maxRotation: 0,
                            minRotation: 0
                        }
                    }
                }
            },
            plugins: [
                shadowPlugin,
                crosshairPlugin,
                {
                    id: 'targetLineLabel',
                    afterDraw: (chart) => {
                        const { ctx: drawingCtx, chartArea: { right }, scales: { y: yScale } } = chart;
                        const targetHours = window.dailyFocusHoursTarget || 4.0;
                        const yPos = yScale.getPixelForValue(targetHours);

                        if (yPos >= chart.chartArea.top && yPos <= chart.chartArea.bottom) {
                            drawingCtx.save();
                            drawingCtx.fillStyle = '#f43f5e';
                            drawingCtx.font = 'bold 9px Inter, sans-serif';
                            drawingCtx.textAlign = 'right';
                            drawingCtx.textBaseline = 'bottom';
                            drawingCtx.fillText('CURRENT GOAL', right - 4, yPos - 10);
                            drawingCtx.restore();
                        }
                    }
                }
            ]
        };

        const ctx1 = document.getElementById('timerAnalyticsChart');
        if (ctx1) {
            if (window.timerAnalyticsChartInstance) {
                window.timerAnalyticsChartInstance.destroy();
            }
            window.timerAnalyticsChartInstance = new Chart(ctx1.getContext('2d'), chartConfig);
        }

        const ctx2 = document.getElementById('spectraFocusAnalyticsChart');
        if (ctx2) {
            if (window.spectraFocusAnalyticsChartInstance) {
                window.spectraFocusAnalyticsChartInstance.destroy();
            }
            window.spectraFocusAnalyticsChartInstance = new Chart(ctx2.getContext('2d'), chartConfig);
        }

        if (window.renderSpectraFocusHeatmap) {
            window.renderSpectraFocusHeatmap();
        }
    };

    window.spectraHeatmapRange = window.spectraHeatmapRange || 365;

    window.setSpectraHeatmapRange = function (days) {
        window.spectraHeatmapRange = days;
        const btn30 = document.getElementById('spectra-hm-btn-30');
        const btn90 = document.getElementById('spectra-hm-btn-90');
        const btn180 = document.getElementById('spectra-hm-btn-180');
        const btn365 = document.getElementById('spectra-hm-btn-365');

        const activeClass = "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all bg-indigo-600 text-white shadow shadow-indigo-500/20";
        const inactiveClass = "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200";

        if (btn30) btn30.className = days === 30 ? activeClass : inactiveClass;
        if (btn90) btn90.className = days === 90 ? activeClass : inactiveClass;
        if (btn180) btn180.className = days === 180 ? activeClass : inactiveClass;
        if (btn365) btn365.className = days === 365 ? activeClass : inactiveClass;

        window.renderSpectraFocusHeatmap();
    };

    window.renderSpectraFocusHeatmap = function () {
        const gridEl = document.getElementById('spectra-focus-heatmap-grid');
        const dashGridEl = document.getElementById('dashboard-focus-heatmap-grid');
        if (!gridEl && !dashGridEl) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Build date map of focus seconds
        const dailySecondsMap = {};

        if (AppState.timerLogs && Array.isArray(AppState.timerLogs)) {
            AppState.timerLogs.forEach(log => {
                if (!log.date) return;
                const d = new Date(log.date);
                if (isNaN(d.getTime())) return;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const dur = parseInt(log.duration || 0, 10);
                dailySecondsMap[key] = (dailySecondsMap[key] || 0) + dur;
            });
        }

        // Include current active running timer ONLY if currently running
        if (AppState.activeTimerState) {
            let activeMs = 0;
            if (AppState.activeTimerState.timerStates) {
                Object.values(AppState.activeTimerState.timerStates).forEach(store => {
                    if (store.isRunning) {
                        let ms = store.elapsedBeforeStart || 0;
                        if (store.startTime) {
                            ms += (window.getServerTime() - parseStartTime(store.startTime));
                        }
                        activeMs += ms;
                    }
                });
            } else if (AppState.activeTimerState.isRunning) {
                activeMs = AppState.activeTimerState.elapsedBeforeStart || 0;
                if (AppState.activeTimerState.startTime) {
                    activeMs += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
                }
            }
            const activeSec = Math.floor(activeMs / 1000);
            if (activeSec > 0) {
                const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                dailySecondsMap[todayKey] = (dailySecondsMap[todayKey] || 0) + activeSec;
            }
        }

        // Render main page heatmap if present
        if (gridEl) {
            const rangeDays = window.spectraHeatmapRange || 365;
            const endDate = new Date(today);
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - (rangeDays - 1));

            // Align start date to Sunday (day 0)
            const dayOfWeek = startDate.getDay();
            if (dayOfWeek !== 0) {
                startDate.setDate(startDate.getDate() - dayOfWeek);
            }

            const weeks = [];
            let currentWeek = [];
            let curr = new Date(startDate);

            let activeDaysCount = 0;
            let zeroCount = 0;
            let redCount = 0;
            let blueCount = 0;
            let greenCount = 0;
            let goldCount = 0;
            let gemCount = 0;

            while (curr <= endDate || currentWeek.length > 0) {
                const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
                const isFuture = curr > endDate;
                const sec = !isFuture ? (dailySecondsMap[key] || 0) : 0;
                const hours = parseFloat((sec / 3600).toFixed(2));

                if (!isFuture) {
                    if (hours > 0) activeDaysCount++;
                    if (hours === 0) zeroCount++;
                    else if (hours > 0 && hours <= 2.0) redCount++;
                    else if (hours > 2.0 && hours <= 4.0) blueCount++;
                    else if (hours > 4.0 && hours < 6.0) greenCount++;
                    else if (hours >= 6.0 && hours < 8.0) goldCount++;
                    else if (hours >= 8.0) gemCount++;
                }

                currentWeek.push({
                    date: new Date(curr),
                    dateKey: key,
                    hours: hours,
                    seconds: sec,
                    isFuture: isFuture
                });

                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }

                curr.setDate(curr.getDate() + 1);
                if (isFuture && currentWeek.length === 0) break;
            }

            // Calculate Current Streak
            let streak = 0;
            let checkDate = new Date(today);
            while (true) {
                const k = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                const s = dailySecondsMap[k] || 0;
                if (s > 0) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    if (checkDate.getTime() === today.getTime()) {
                        checkDate.setDate(checkDate.getDate() - 1);
                        continue;
                    }
                    break;
                }
            }

            // Update Stat Counters in UI
            const elActive = document.getElementById('spectra-hm-stat-active-days');
            const elStreak = document.getElementById('spectra-hm-stat-streak');
            const elZero = document.getElementById('spectra-hm-stat-zero');
            const elRed = document.getElementById('spectra-hm-stat-red');
            const elBlue = document.getElementById('spectra-hm-stat-blue');
            const elGreen = document.getElementById('spectra-hm-stat-green');
            const elGold = document.getElementById('spectra-hm-stat-gold');
            const elGem = document.getElementById('spectra-hm-stat-gem');

            if (elActive) elActive.innerText = activeDaysCount;
            if (elStreak) elStreak.innerText = `${streak} days 🔥`;
            if (elZero) elZero.innerText = zeroCount;
            if (elRed) elRed.innerText = redCount;
            if (elBlue) elBlue.innerText = blueCount;
            if (elGreen) elGreen.innerText = greenCount;
            if (elGold) elGold.innerText = goldCount;
            if (elGem) elGem.innerText = gemCount;

            // 3. Render GitHub Grid (Month Labels + Day Rows)
            let monthLabelsHtml = '<div class="flex items-center text-[10px] font-extrabold text-slate-400 dark:text-slate-500 mb-1 pl-7 gap-1">';
            let prevMonth = -1;

            weeks.forEach((wk) => {
                const firstDayOfWeek = wk[0].date;
                const month = firstDayOfWeek.getMonth();
                if (month !== prevMonth) {
                    const monthName = firstDayOfWeek.toLocaleDateString(undefined, { month: 'short' });
                    monthLabelsHtml += `<span class="shrink-0 text-center" style="width: 14px;">${monthName}</span>`;
                    prevMonth = month;
                } else {
                    monthLabelsHtml += `<span class="shrink-0" style="width: 14px;"></span>`;
                }
            });
            monthLabelsHtml += '</div>';

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            let gridRowsHtml = '';

            for (let d = 0; d < 7; d++) {
                const dayLabel = (d === 1 || d === 3 || d === 5) ? dayNames[d] : '';
                gridRowsHtml += `<div class="flex items-center gap-1">`;
                gridRowsHtml += `<span class="w-6 text-[9px] font-bold text-slate-400 dark:text-slate-500 shrink-0 text-right pr-1">${dayLabel}</span>`;
                gridRowsHtml += `<div class="flex items-center gap-1">`;

                weeks.forEach((wk) => {
                    const dayObj = wk[d];
                    if (!dayObj) {
                        gridRowsHtml += `<div class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] opacity-0 pointer-events-none shrink-0"></div>`;
                        return;
                    }

                    if (dayObj.isFuture) {
                        gridRowsHtml += `<div class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/30 opacity-40 shrink-0"></div>`;
                        return;
                    }

                    const hrs = dayObj.hours;
                    let bgClass = "";
                    let tierText = "";
                    let badgeClass = "";
                    let boxInner = "";

                    if (hrs === 0) {
                        bgClass = "bg-rose-500/20 text-rose-500 border border-rose-300/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50 spectra-heatmap-box";
                        tierText = "❌ No Focus (0h)";
                        badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                        boxInner = `<svg class="w-2 h-2 sm:w-2.5 sm:h-2.5 text-rose-500/90 dark:text-rose-400/90 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
                    } else if (hrs > 0 && hrs <= 2.0) {
                        bgClass = "bg-rose-600 text-white border border-rose-500 dark:bg-rose-700 dark:border-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.45)] spectra-heatmap-box";
                        tierText = "⭕ Low Focus (0-2h)";
                        badgeClass = "bg-rose-600/20 text-rose-400 border border-rose-600/40";
                        boxInner = `<svg class="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white/90 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>`;
                    } else if (hrs > 2.0 && hrs <= 4.0) {
                        bgClass = "bg-blue-500 text-white border border-blue-400 dark:bg-blue-600 dark:border-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)] spectra-heatmap-box";
                        tierText = "🔵 Moderate Focus (2-4h)";
                        badgeClass = "bg-blue-500/20 text-blue-400 border border-blue-500/40";
                    } else if (hrs > 4.0 && hrs < 6.0) {
                        bgClass = "bg-emerald-500 text-white border border-emerald-400 dark:bg-emerald-600 dark:border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)] spectra-heatmap-box";
                        tierText = "🟢 Target Met (> 4h)";
                        badgeClass = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
                    } else if (hrs >= 6.0 && hrs < 8.0) {
                        bgClass = "bg-amber-400 text-amber-950 border border-amber-300 dark:bg-amber-500 dark:border-amber-400 animate-gold-pulse spectra-heatmap-box";
                        tierText = "🟡 Glowing Golden Focus (≥ 6h)";
                        badgeClass = "bg-amber-500/20 text-amber-400 border border-amber-500/40";
                    } else if (hrs >= 8.0) {
                        bgClass = "bg-gradient-to-tr from-cyan-400 via-sky-300 via-fuchsia-400 to-indigo-500 text-white border border-cyan-300 dark:border-cyan-400 animate-diamond-shimmer spectra-heatmap-box";
                        tierText = "💎 Valuable Diamond Focus (≥ 8h)";
                        badgeClass = "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40";
                    }

                    const formattedDate = dayObj.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    const formattedTime = formatHoursToHrMin(hrs);

                    gridRowsHtml += `<div class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] ${bgClass} shrink-0 cursor-pointer flex items-center justify-center overflow-hidden"
                        data-date="${formattedDate}"
                        data-datekey="${dayObj.dateKey}"
                        data-time="${formattedTime}"
                        data-tier="${tierText}"
                        data-badge="${badgeClass}"
                        onclick="window.showSpectraHeatmapDayDetail('${dayObj.dateKey}')"
                        onmouseenter="window.showSpectraHeatmapTooltip(event, this)"
                        onmousemove="window.moveSpectraHeatmapTooltip(event)"
                        onmouseleave="window.hideSpectraHeatmapTooltip()">${boxInner}</div>`;
                });

                gridRowsHtml += `</div></div>`;
            }

            gridEl.innerHTML = monthLabelsHtml + gridRowsHtml;
        }

        // Render compact 2-month dashboard card heatmap if present
        if (dashGridEl) {
            const dashRangeDays = 60; // 2 months fixed
            const dashEndDate = new Date(today);
            const dashStartDate = new Date(today);
            dashStartDate.setDate(dashStartDate.getDate() - (dashRangeDays - 1));

            const dashDayOfWeek = dashStartDate.getDay();
            if (dashDayOfWeek !== 0) {
                dashStartDate.setDate(dashStartDate.getDate() - dashDayOfWeek);
            }

            const dashWeeks = [];
            let currentDashWeek = [];
            let currDash = new Date(dashStartDate);

            while (currDash <= dashEndDate || currentDashWeek.length > 0) {
                const key = `${currDash.getFullYear()}-${String(currDash.getMonth() + 1).padStart(2, '0')}-${String(currDash.getDate()).padStart(2, '0')}`;
                const isFuture = currDash > dashEndDate;
                const sec = !isFuture ? (dailySecondsMap[key] || 0) : 0;
                const hours = parseFloat((sec / 3600).toFixed(2));

                currentDashWeek.push({
                    date: new Date(currDash),
                    dateKey: key,
                    hours: hours,
                    seconds: sec,
                    isFuture: isFuture
                });

                if (currentDashWeek.length === 7) {
                    dashWeeks.push(currentDashWeek);
                    currentDashWeek = [];
                }

                currDash.setDate(currDash.getDate() + 1);
                if (isFuture && currentDashWeek.length === 0) break;
            }

            let dashMonthLabelsHtml = '<div class="flex items-center justify-between w-full text-[9px] font-extrabold text-slate-400 dark:text-slate-500 mb-1.5 pl-5 sm:pl-6 pr-0.5 gap-1.5 shrink-0">';
            let prevDashMonth = -1;

            dashWeeks.forEach((wk) => {
                const firstDayOfWeek = wk[0].date;
                const month = firstDayOfWeek.getMonth();
                if (month !== prevDashMonth) {
                    const monthName = firstDayOfWeek.toLocaleDateString(undefined, { month: 'short' });
                    dashMonthLabelsHtml += `<span class="flex-1 text-center truncate min-w-0">${monthName}</span>`;
                    prevDashMonth = month;
                } else {
                    dashMonthLabelsHtml += `<span class="flex-1 min-w-0"></span>`;
                }
            });
            dashMonthLabelsHtml += '</div>';

            const dashDayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
            let dashGridRowsHtml = '<div class="flex-1 flex flex-col justify-between w-full gap-1 min-h-0">';

            for (let d = 0; d < 7; d++) {
                const dayLabel = (d === 1 || d === 3 || d === 5) ? dashDayNames[d] : '';
                dashGridRowsHtml += `<div class="flex items-center gap-1.5 w-full flex-1 min-h-0">`;
                dashGridRowsHtml += `<span class="w-4 sm:w-5 text-[9px] font-extrabold text-slate-400 dark:text-slate-500 shrink-0 text-right pr-0.5">${dayLabel}</span>`;
                dashGridRowsHtml += `<div class="flex items-center justify-between gap-1 sm:gap-1.5 flex-1 h-full min-w-0">`;

                dashWeeks.forEach((wk) => {
                    const dayObj = wk[d];
                    if (!dayObj) {
                        dashGridRowsHtml += `<div class="flex-1 h-full max-h-[22px] min-h-[14px] aspect-square rounded-[4px] opacity-0 pointer-events-none shrink-0"></div>`;
                        return;
                    }

                    if (dayObj.isFuture) {
                        dashGridRowsHtml += `<div class="flex-1 h-full max-h-[22px] min-h-[14px] aspect-square rounded-[4px] bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/30 dark:border-slate-800/30 opacity-40 shrink-0"></div>`;
                        return;
                    }

                    const hrs = dayObj.hours;
                    let bgClass = "";
                    let tierText = "";
                    let badgeClass = "";
                    let boxInner = "";

                    if (hrs === 0) {
                        bgClass = "bg-rose-500/20 text-rose-500 border border-rose-300/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50 spectra-heatmap-box";
                        tierText = "❌ No Focus (0h)";
                        badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                        boxInner = `<svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-500/90 dark:text-rose-400/90 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
                    } else if (hrs > 0 && hrs <= 2.0) {
                        bgClass = "bg-rose-600 text-white border border-rose-500 dark:bg-rose-700 dark:border-rose-600 shadow-[0_0_6px_rgba(225,29,72,0.45)] spectra-heatmap-box";
                        tierText = "⭕ Low Focus (0-2h)";
                        badgeClass = "bg-rose-600/20 text-rose-400 border border-rose-600/40";
                        boxInner = `<svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/90 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>`;
                    } else if (hrs > 2.0 && hrs <= 4.0) {
                        bgClass = "bg-blue-500 text-white border border-blue-400 dark:bg-blue-600 dark:border-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)] spectra-heatmap-box";
                        tierText = "🔵 Moderate Focus (2-4h)";
                        badgeClass = "bg-blue-500/20 text-blue-400 border border-blue-500/40";
                    } else if (hrs > 4.0 && hrs < 6.0) {
                        bgClass = "bg-emerald-500 text-white border border-emerald-400 dark:bg-emerald-600 dark:border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)] spectra-heatmap-box";
                        tierText = "🟢 Target Met (> 4h)";
                        badgeClass = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
                    } else if (hrs >= 6.0 && hrs < 8.0) {
                        bgClass = "bg-amber-400 text-amber-950 border border-amber-300 dark:bg-amber-500 dark:border-amber-400 animate-gold-pulse spectra-heatmap-box";
                        tierText = "🟡 Glowing Golden Focus (≥ 6h)";
                        badgeClass = "bg-amber-500/20 text-amber-400 border border-amber-500/40";
                    } else if (hrs >= 8.0) {
                        bgClass = "bg-gradient-to-tr from-cyan-400 via-sky-300 via-fuchsia-400 to-indigo-500 text-white border border-cyan-300 dark:border-cyan-400 animate-diamond-shimmer spectra-heatmap-box";
                        tierText = "💎 Valuable Diamond Focus (≥ 8h)";
                        badgeClass = "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40";
                    }

                    const formattedDate = dayObj.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    const formattedTime = formatHoursToHrMin(hrs);

                    dashGridRowsHtml += `<div class="flex-1 h-full max-h-[22px] min-h-[14px] aspect-square rounded-[4px] ${bgClass} cursor-pointer flex items-center justify-center overflow-hidden transition-transform hover:scale-125 z-10"
                        data-date="${formattedDate}"
                        data-datekey="${dayObj.dateKey}"
                        data-time="${formattedTime}"
                        data-tier="${tierText}"
                        data-badge="${badgeClass}"
                        onclick="window.showSpectraHeatmapDayDetail('${dayObj.dateKey}', false)"
                        onmouseenter="window.showSpectraHeatmapTooltip(event, this)"
                        onmousemove="window.moveSpectraHeatmapTooltip(event)"
                        onmouseleave="window.hideSpectraHeatmapTooltip()">${boxInner}</div>`;
                });

                dashGridRowsHtml += `</div></div>`;
            }
            dashGridRowsHtml += '</div>';

            dashGridEl.innerHTML = dashMonthLabelsHtml + dashGridRowsHtml;
        }

        // Auto-populate Side Note panel & Dashboard Card Header with Today's details on render if side note exists
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        window.showSpectraHeatmapDayDetail(todayKey, false);
    };

    window.showSpectraHeatmapDayDetail = function (dateKey, openModal = false) {
        if (!dateKey) return;

        // Update selected box purple stroke glow across all grids
        const allBoxes = document.querySelectorAll('#spectra-focus-heatmap-grid [data-datekey], #dashboard-focus-heatmap-grid [data-datekey]');
        allBoxes.forEach(b => b.classList.remove('spectra-heatmap-selected'));

        const targetBoxes = document.querySelectorAll(`[data-datekey="${dateKey}"]`);
        targetBoxes.forEach(b => b.classList.add('spectra-heatmap-selected'));

        const [y, m, d] = dateKey.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const dayOfWeekStr = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
        const shortDateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        // Filter timer logs for this dateKey
        const dayLogs = [];
        let totalSec = 0;
        if (AppState.timerLogs && Array.isArray(AppState.timerLogs)) {
            AppState.timerLogs.forEach(log => {
                if (!log.date) return;
                const logD = new Date(log.date);
                if (isNaN(logD.getTime())) return;
                const k = `${logD.getFullYear()}-${String(logD.getMonth() + 1).padStart(2, '0')}-${String(logD.getDate()).padStart(2, '0')}`;
                if (k === dateKey) {
                    dayLogs.push(log);
                    totalSec += parseInt(log.duration || 0, 10);
                }
            });
        }

        // Active timer addition if today AND currently running
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (dateKey === todayKey && AppState.activeTimerState) {
            let activeMs = 0;
            if (AppState.activeTimerState.timerStates) {
                Object.values(AppState.activeTimerState.timerStates).forEach(store => {
                    if (store.isRunning) {
                        let ms = store.elapsedBeforeStart || 0;
                        if (store.startTime) {
                            ms += (window.getServerTime() - parseStartTime(store.startTime));
                        }
                        activeMs += ms;
                    }
                });
            } else if (AppState.activeTimerState.isRunning) {
                activeMs = AppState.activeTimerState.elapsedBeforeStart || 0;
                if (AppState.activeTimerState.startTime) {
                    activeMs += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
                }
            }
            const activeSec = Math.floor(activeMs / 1000);
            if (activeSec > 0) {
                totalSec += activeSec;
                dayLogs.push({
                    subjectName: AppState.activeTimerState.subjectName || "Active Session",
                    duration: activeSec,
                    date: new Date().toISOString(),
                    active: true
                });
            }
        }

        const hrs = parseFloat((totalSec / 3600).toFixed(2));
        const formattedTime = formatHoursToHrMin(hrs);

        // Update Header Detail in Dashboard Compact Heatmap Card (DD/MM/YY • Xh Ym)
        const dayFormatted = String(d).padStart(2, '0');
        const monthFormatted = String(m).padStart(2, '0');
        const yearFormatted = String(y).slice(-2);
        const compactDateFormatted = `${dayFormatted}/${monthFormatted}/${yearFormatted}`;

        const totalMin = Math.floor(totalSec / 60);
        const hDur = Math.floor(totalMin / 60);
        const mDur = totalMin % 60;
        const compactDurFormatted = `${hDur}h ${mDur}m`;

        const elDashDetail = document.getElementById('dash-hm-selected-detail');
        if (elDashDetail) {
            elDashDetail.innerHTML = `<span class="text-slate-600 dark:text-slate-300 font-extrabold">${compactDateFormatted}</span><span class="text-fuchsia-400 font-black">•</span><span class="font-black text-fuchsia-600 dark:text-fuchsia-400">${compactDurFormatted}</span>`;
        }

        const target = window.getDailyFocusHoursTargetForDate ? window.getDailyFocusHoursTargetForDate(dateObj) : (window.dailyFocusHoursTarget || 4.0);
        const targetPct = target > 0 ? Math.round((hrs / target) * 100) : 0;

        let tierText = "❌ No Focus (0h)";
        let badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";

        if (hrs > 0 && hrs <= 2.0) {
            tierText = "⭕ Low Focus (0-2h)";
            badgeClass = "bg-rose-600/20 text-rose-400 border border-rose-600/40";
        } else if (hrs > 2.0 && hrs <= 4.0) {
            tierText = "🔵 Moderate Focus (2-4h)";
            badgeClass = "bg-blue-500/20 text-blue-400 border border-blue-500/40";
        } else if (hrs > 4.0 && hrs < 6.0) {
            tierText = "🟢 Target Met (> 4h)";
            badgeClass = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
        } else if (hrs >= 6.0 && hrs < 8.0) {
            tierText = "🟡 Glowing Golden Focus (≥ 6h)";
            badgeClass = "bg-amber-500/20 text-amber-400 border border-amber-500/40";
        } else if (hrs >= 8.0) {
            tierText = "💎 Valuable Diamond Focus (≥ 8h)";
            badgeClass = "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40";
        }

        // 1. Populate Right Side Note Card Panel (Next to Tier Legend)
        const elSnDay = document.getElementById('spectra-sn-day-name');
        const elSnDate = document.getElementById('spectra-sn-date');
        const elSnBadge = document.getElementById('spectra-sn-tier-badge');
        const elSnTime = document.getElementById('spectra-sn-focus-time');
        const elSnTarget = document.getElementById('spectra-sn-target-pct');
        const elSnSubjects = document.getElementById('spectra-sn-subjects-list');

        if (elSnDay) elSnDay.innerText = dayOfWeekStr;
        if (elSnDate) elSnDate.innerText = shortDateStr;
        if (elSnBadge) {
            elSnBadge.innerText = tierText;
            elSnBadge.className = `px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md ${badgeClass}`;
            elSnBadge.classList.remove('hidden');
        }
        if (elSnTime) elSnTime.innerText = formattedTime;
        if (elSnTarget) elSnTarget.innerText = `${targetPct}%`;

        // Group subjects
        const subjectMap = {};
        dayLogs.forEach(log => {
            const subj = log.subjectName || log.subject || "General Focus";
            const dur = parseInt(log.duration || 0, 10);
            subjectMap[subj] = (subjectMap[subj] || 0) + dur;
        });

        if (elSnSubjects) {
            const subjectEntries = Object.entries(subjectMap);
            if (subjectEntries.length === 0) {
                elSnSubjects.innerHTML = `<span class="text-[10px] text-slate-400 italic">No focus sessions recorded for this day.</span>`;
            } else {
                let subjHtml = '';
                subjectEntries.forEach(([subjName, sec]) => {
                    const durStr = formatHoursToHrMin(sec / 3600);
                    subjHtml += `<span class="px-2 py-0.5 text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded-lg border border-indigo-500/20 flex items-center gap-1">${subjName}: <span class="font-bold text-indigo-700 dark:text-indigo-200">${durStr}</span></span>`;
                });
                elSnSubjects.innerHTML = subjHtml;
            }
        }

        // 2. Populate Optional Modal (if requested)
        const modal = document.getElementById('spectra-heatmap-day-modal');
        if (modal) {
            const elDate = document.getElementById('spectra-hm-modal-date');
            const elBadge = document.getElementById('spectra-hm-modal-tier-badge');
            const elTime = document.getElementById('spectra-hm-modal-time');
            const elPct = document.getElementById('spectra-hm-modal-target-pct');
            const elCount = document.getElementById('spectra-hm-modal-session-count');
            const elList = document.getElementById('spectra-hm-modal-sessions-list');

            if (elDate) elDate.innerText = dateStr;
            if (elBadge) {
                elBadge.innerText = tierText;
                elBadge.className = `inline-block mt-0.5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md ${badgeClass}`;
            }
            if (elTime) elTime.innerText = formattedTime;
            if (elPct) {
                elPct.innerText = `${targetPct}%`;
                elPct.className = `text-lg font-black ${targetPct >= 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`;
            }
            if (elCount) elCount.innerText = `${dayLogs.length} session${dayLogs.length === 1 ? '' : 's'}`;

            if (elList) {
                if (dayLogs.length === 0) {
                    elList.innerHTML = `<div class="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">No focus sessions recorded on this day.</div>`;
                } else {
                    let html = '';
                    dayLogs.forEach(log => {
                        const durSec = parseInt(log.duration || 0, 10);
                        const durStr = formatHoursToHrMin(durSec / 3600);
                        const subj = log.subjectName || log.subject || "General Focus";
                        const isNow = log.active ? true : false;
                        const logTimeStr = isNow ? "Active Now" : new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        html += `
                            <div class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/40 dark:border-slate-700/40">
                                <div class="flex items-center space-x-2.5">
                                    <div class="w-2 h-2 rounded-full ${isNow ? 'bg-emerald-500 animate-ping' : 'bg-indigo-500'}"></div>
                                    <span class="text-xs font-black text-slate-700 dark:text-slate-200">${subj}</span>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <span class="text-[10px] font-bold text-slate-400">${logTimeStr}</span>
                                    <span class="px-2 py-0.5 text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-500/20">${durStr}</span>
                                </div>
                            </div>
                        `;
                    });
                    elList.innerHTML = html;
                }
            }

            if (openModal) {
                modal.classList.remove('hidden');
            }
        }
    };

    window.closeSpectraHeatmapDayModal = function () {
        const modal = document.getElementById('spectra-heatmap-day-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.showSpectraHeatmapTooltip = function (e, el) {
        const tooltip = document.getElementById('spectra-focus-heatmap-tooltip');
        if (!tooltip) return;

        const date = el.getAttribute('data-date');
        const time = el.getAttribute('data-time');
        const tier = el.getAttribute('data-tier');
        const badgeClass = el.getAttribute('data-badge');

        tooltip.innerHTML = `
            <div class="text-[10px] text-slate-400 uppercase tracking-widest font-black">${date}</div>
            <div class="flex items-center gap-2 mt-0.5">
                <span class="text-xs sm:text-sm font-black text-white">${time}</span>
                <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md ${badgeClass}">${tier}</span>
            </div>
        `;

        tooltip.classList.remove('hidden');
        window.moveSpectraHeatmapTooltip(e);
    };

    window.moveSpectraHeatmapTooltip = function (e) {
        const tooltip = document.getElementById('spectra-focus-heatmap-tooltip');
        if (!tooltip || tooltip.classList.contains('hidden')) return;

        const x = e.clientX + 12;
        const y = e.clientY - 40;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    };

    window.hideSpectraHeatmapTooltip = function () {
        const tooltip = document.getElementById('spectra-focus-heatmap-tooltip');
        if (tooltip) tooltip.classList.add('hidden');
    };

    window.renderTimerPage = function () {
        if (!AppState.timerLogs) AppState.timerLogs = [];

        initChronographDial();
        populateTimerSubjects();

        const now = new Date();

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(now);
        const daysSinceSat = (weekStart.getDay() + 1) % 7;
        weekStart.setDate(weekStart.getDate() - daysSinceSat);
        weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        let secondsToday = 0;
        let secondsWeek = 0;
        let secondsMonth = 0;

        const subjectSeconds = {};

        AppState.timerLogs.forEach(log => {
            const logDate = new Date(log.date);
            const duration = parseInt(log.duration || 0, 10);

            if (logDate >= todayStart) {
                secondsToday += duration;
            }
            if (logDate >= weekStart) {
                secondsWeek += duration;
            }
            if (logDate >= monthStart) {
                secondsMonth += duration;
            }

            const sub = log.subject || 'General Study';
            subjectSeconds[sub] = (subjectSeconds[sub] || 0) + duration;
        });

        safeSetText('timer-stat-today', getDurationString(secondsToday));
        safeSetText('dash-timer-today-focus', getDurationString(secondsToday));
        safeSetText('timer-stat-week', getDurationString(secondsWeek));
        safeSetText('timer-stat-month', getDurationString(secondsMonth));

        const breakdownContainer = document.getElementById('timer-subject-breakdown-container');
        if (breakdownContainer) {
            let breakdownHtml = '';
            const sortedSubjects = Object.entries(subjectSeconds).sort((a, b) => b[1] - a[1]);
            const maxSeconds = sortedSubjects.length > 0 ? sortedSubjects[0][1] : 1;

            if (sortedSubjects.length === 0) {
                breakdownHtml = `<p class="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider py-4 text-center">No study records yet</p>`;
            } else {
                sortedSubjects.forEach(([subj, sec]) => {
                    const pct = Math.max(5, Math.round((sec / maxSeconds) * 100));
                    const formattedDuration = formatHoursToHrMin(sec / 3600);
                    const color = getSubjectColor(subj);

                    breakdownHtml += `
                        <div class="space-y-1">
                            <div class="flex justify-between items-center text-xs">
                                <span class="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[70%]" title="${subj}">${subj}</span>
                                <span class="font-black text-slate-900 dark:text-white">${formattedDuration}</span>
                            </div>
                            <div class="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden">
                                <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${color};"></div>
                            </div>
                        </div>
                    `;
                });
            }
            breakdownContainer.innerHTML = breakdownHtml;
        }

        // ── Session History Filter & Scrollable Container Logic ──
        if (typeof window.sessionHistoryFilter === 'undefined') {
            window.sessionHistoryFilter = 'all';
        }

        const historyTableBody = document.getElementById('timer-history-table-body');
        const historyContainer = document.getElementById('timer-history-container');
        const countBadge = document.getElementById('timer-history-count-badge');

        if (historyTableBody) {
            let historyHtml = '';
            const now = new Date();
            const filter = window.sessionHistoryFilter || 'all';

            const filteredLogs = (AppState.timerLogs || []).filter(log => {
                if (!log || !log.date) return false;
                const logDate = new Date(log.date);
                if (isNaN(logDate.getTime())) return false;

                if (filter === 'day') {
                    return logDate.toDateString() === now.toDateString();
                } else if (filter === 'week') {
                    const diffTime = now.getTime() - logDate.getTime();
                    const diffDays = diffTime / (1000 * 3600 * 24);
                    return diffDays >= 0 && diffDays <= 7;
                } else if (filter === 'month') {
                    return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
                }
                return true; // 'all'
            });

            // Update badge text
            if (countBadge) {
                countBadge.textContent = filteredLogs.length > 20 ?
                    `${filteredLogs.length} Sessions (Scrollable)` :
                    `${filteredLogs.length} Sessions`;
            }

            // After 20 sessions, container becomes scrollable (15 sessions visible at once)
            if (historyContainer) {
                if (filteredLogs.length > 20) {
                    historyContainer.classList.add('max-h-[670px]', 'overflow-y-auto', 'pr-1');
                } else {
                    historyContainer.classList.remove('max-h-[670px]', 'overflow-y-auto', 'pr-1');
                }
            }

            if (filteredLogs.length === 0) {
                const labelMap = { all: 'recorded yet', day: 'recorded today', week: 'recorded this week', month: 'recorded this month' };
                historyHtml = `
                    <tr>
                        <td colspan="5" class="py-8 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                            No focus sessions ${labelMap[filter] || 'found'}
                        </td>
                    </tr>
                `;
            } else {
                filteredLogs.forEach(log => {
                    const dateObj = new Date(log.date);
                    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    const dayStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    const dateStr = `${dayStr}, ${timeStr}`;

                    const totalMins = Math.floor(log.duration / 60);
                    const hrs = Math.floor(totalMins / 60);
                    const mins = totalMins % 60;
                    const durStr = `${String(hrs).padStart(2, '0')} hr : ${String(mins).padStart(2, '0')} min`;

                    const modeBadge = log.mode === 'timer' ?
                        `<span class="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-black text-[9px] uppercase tracking-wider rounded border border-blue-100 dark:border-blue-900/30">Timer</span>` :
                        log.mode === 'addx' ?
                            `<span class="px-2 py-0.5 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-black text-[9px] uppercase tracking-wider rounded border border-orange-100 dark:border-orange-900/30">Added</span>` :
                            `<span class="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-black text-[9px] uppercase tracking-wider rounded border border-emerald-100 dark:border-emerald-900/30">Stopwatch</span>`;

                    historyHtml += `
                        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td class="py-3 font-bold text-slate-500 dark:text-slate-400">${dateStr}</td>
                            <td class="py-3 font-black text-slate-800 dark:text-white">${log.subject}</td>
                            <td class="py-3 font-mono font-bold text-slate-700 dark:text-slate-300">${durStr}</td>
                            <td class="py-3 text-center">${modeBadge}</td>
                            <td class="py-3 text-right">
                                <div class="flex items-center justify-end gap-1">
                                    <button onclick="window.openEditTimerSessionModal('${log.id}')" class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 active:scale-95 transition-all" title="Edit session">
                                        <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button onclick="window.deleteTimerLog('${log.id}')" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 transition-all" title="Delete session">
                                        <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            historyTableBody.innerHTML = historyHtml;
        }
    };

    window.sessionHistoryFilter = 'all';
    window.setSessionHistoryFilter = function (filter) {
        window.sessionHistoryFilter = filter;
        ['all', 'day', 'week', 'month'].forEach(f => {
            const btn = document.getElementById(`sh-filter-${f}`);
            if (btn) {
                if (f === filter) {
                    btn.className = "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all bg-blue-600 text-white shadow shadow-blue-500/20";
                } else {
                    btn.className = "px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all text-slate-500 hover:bg-slate-200/80 dark:text-slate-400 dark:hover:bg-slate-800";
                }
            }
        });
        if (window.TimerService && window.TimerService.updateDisplay) {
            window.TimerService.updateDisplay();
        }
    };

    window.switchAtsmTab = function (tab) {
        window._atsmActiveTab = tab;
        const tabHours = document.getElementById('atsm-tab-hours');
        const tabRange = document.getElementById('atsm-tab-range');
        const panelHours = document.getElementById('atsm-panel-hours');
        const panelRange = document.getElementById('atsm-panel-range');

        const activeClass = 'flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all bg-emerald-600 text-white shadow';
        const inactiveClass = 'flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800/80';

        if (tab === 'hours') {
            if (tabHours) tabHours.className = activeClass;
            if (tabRange) tabRange.className = inactiveClass;
            if (panelHours) { panelHours.classList.remove('hidden'); panelHours.classList.add('flex'); }
            if (panelRange) { panelRange.classList.add('hidden'); panelRange.classList.remove('flex'); }
        } else {
            if (tabHours) tabHours.className = inactiveClass;
            if (tabRange) tabRange.className = activeClass;
            if (panelHours) { panelHours.classList.add('hidden'); panelHours.classList.remove('flex'); }
            if (panelRange) { panelRange.classList.remove('hidden'); panelRange.classList.add('flex'); }
        }
    };

    window.updateAtsmRangePreview = function () {
        const startInput = document.getElementById('atsm-range-start');
        const endInput = document.getElementById('atsm-range-end');
        const preview = document.getElementById('atsm-range-preview');
        if (!startInput || !endInput || !preview) return;

        if (startInput.value && endInput.value) {
            let diff = Utils.toMinutes(endInput.value) - Utils.toMinutes(startInput.value);
            if (diff <= 0) diff += 24 * 60; // cross-midnight
            const hrs = Math.floor(diff / 60);
            const mins = diff % 60;
            let durStr = '';
            if (hrs > 0) durStr += `${hrs}h `;
            durStr += `${mins}m`;
            preview.textContent = `Duration: ${durStr}`;
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
        }
    };

    window.openAddTimerSessionModal = function () {
        const now = new Date();
        const dateInput = document.getElementById('atsm-date');
        if (dateInput) {
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }

        const hoursInput = document.getElementById('atsm-hours');
        const minutesInput = document.getElementById('atsm-minutes');
        if (hoursInput) hoursInput.value = '0';
        if (minutesInput) minutesInput.value = '25';

        const rangeStart = document.getElementById('atsm-range-start');
        const rangeEnd = document.getElementById('atsm-range-end');
        if (rangeStart) rangeStart.value = '';
        if (rangeEnd) rangeEnd.value = '';
        const preview = document.getElementById('atsm-range-preview');
        if (preview) preview.classList.add('hidden');

        window.switchAtsmTab('hours');

        const subjectSelect = document.getElementById('atsm-subject');
        if (subjectSelect) {
            subjectSelect.innerHTML = buildProgramWiseSubjectOptionsHtml();
        }

        openModal('add-timer-session-modal');
    };

    window.submitManualTimerSession = function () {
        const dateInput = document.getElementById('atsm-date');
        const subjectSelect = document.getElementById('atsm-subject');

        if (!dateInput || !dateInput.value) {
            showToast("Please select a date.", "error");
            return;
        }

        let totalSeconds = 0;
        let sessionTimeStr = '12:00';

        if (window._atsmActiveTab === 'hours') {
            const hoursInput = document.getElementById('atsm-hours');
            const minutesInput = document.getElementById('atsm-minutes');
            const hours = parseInt(hoursInput?.value || '0', 10);
            const minutes = parseInt(minutesInput?.value || '0', 10);

            if (isNaN(hours) || isNaN(minutes)) {
                showToast("Please enter valid duration numbers.", "error");
                return;
            }
            totalSeconds = (hours * 3600) + (minutes * 60);
            if (totalSeconds <= 0) {
                showToast("Duration must be greater than zero.", "error");
                return;
            }
        } else {
            const startInput = document.getElementById('atsm-range-start');
            const endInput = document.getElementById('atsm-range-end');

            if (!startInput?.value || !endInput?.value) {
                showToast("Please enter both start and end times.", "error");
                return;
            }

            let diffMinutes = Utils.toMinutes(endInput.value) - Utils.toMinutes(startInput.value);
            if (diffMinutes <= 0) diffMinutes += 24 * 60; // cross-midnight

            totalSeconds = diffMinutes * 60;
            sessionTimeStr = startInput.value;
        }

        let sessionDate;
        if (window._atsmActiveTab === 'hours') {
            const now = new Date();
            const dateParts = dateInput.value.split('-');
            sessionDate = new Date(
                parseInt(dateParts[0], 10),
                parseInt(dateParts[1], 10) - 1,
                parseInt(dateParts[2], 10),
                now.getHours(),
                now.getMinutes(),
                now.getSeconds()
            );
        } else {
            const timeParts = sessionTimeStr.split(':').map(Number);
            sessionDate = new Date(dateInput.value + 'T' + String(timeParts[0] || 0).padStart(2, '0') + ':' + String(timeParts[1] || 0).padStart(2, '0') + ':00');
        }

        if (isNaN(sessionDate.getTime())) {
            showToast("Invalid date entered.", "error");
            return;
        }

        const subject = subjectSelect?.value || 'General Study';

        const newLog = {
            id: 'timer-log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            subject: subject,
            duration: totalSeconds,
            date: sessionDate.toISOString(),
            mode: 'addx'
        };

        if (!AppState.timerLogs) AppState.timerLogs = [];
        AppState.timerLogs.unshift(newLog);

        AppState.timerLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

        FirebaseService.saveToCloud(true);
        window.TimerService.updateDisplay();
        closeModal('add-timer-session-modal');

        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const durationStr = (hrs > 0 ? `${hrs}h ` : '') + `${mins}m`;
        showToast(`Session added: ${durationStr} for ${subject}.`, "success");
    };

    // ── Edit Timer Session Modal ──
    window._editingTimerLogId = null;

    window.openEditTimerSessionModal = function (logId) {
        const log = (AppState.timerLogs || []).find(l => l.id === logId);
        if (!log) {
            showToast('Session not found.', 'error');
            return;
        }

        window._editingTimerLogId = logId;

        const dateInput = document.getElementById('etsm-date');
        if (dateInput) {
            const d = new Date(log.date);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dateInput.value = `${yyyy}-${mm}-${dd}`;
        }

        const timeInput = document.getElementById('etsm-time');
        if (timeInput) {
            const d = new Date(log.date);
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            timeInput.value = `${hh}:${mi}`;
        }

        const totalMins = Math.floor((log.duration || 0) / 60);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;

        const hoursInput = document.getElementById('etsm-hours');
        const minutesInput = document.getElementById('etsm-minutes');
        if (hoursInput) hoursInput.value = String(hrs);
        if (minutesInput) minutesInput.value = String(mins);

        const subjectSelect = document.getElementById('etsm-subject');
        if (subjectSelect) {
            subjectSelect.innerHTML = buildProgramWiseSubjectOptionsHtml();
            subjectSelect.value = log.subject || 'General Study';
        }

        openModal('edit-timer-session-modal');
    };

    window.submitEditTimerSession = function () {
        const logId = window._editingTimerLogId;
        if (!logId) {
            showToast('No session selected for editing.', 'error');
            return;
        }

        const logIndex = (AppState.timerLogs || []).findIndex(l => l.id === logId);
        if (logIndex === -1) {
            showToast('Session not found.', 'error');
            return;
        }

        const dateInput = document.getElementById('etsm-date');
        const timeInput = document.getElementById('etsm-time');
        const hoursInput = document.getElementById('etsm-hours');
        const minutesInput = document.getElementById('etsm-minutes');
        const subjectSelect = document.getElementById('etsm-subject');

        if (!dateInput || !dateInput.value) {
            showToast('Please select a date.', 'error');
            return;
        }

        const hours = parseInt(hoursInput?.value || '0', 10);
        const minutes = parseInt(minutesInput?.value || '0', 10);

        if (isNaN(hours) || isNaN(minutes)) {
            showToast('Please enter valid duration numbers.', 'error');
            return;
        }

        const totalSeconds = (hours * 3600) + (minutes * 60);
        if (totalSeconds <= 0) {
            showToast('Duration must be greater than zero.', 'error');
            return;
        }

        const timeValue = timeInput?.value || '12:00';
        const timeParts = timeValue.split(':').map(Number);
        const dateParts = dateInput.value.split('-');
        const sessionDate = new Date(
            parseInt(dateParts[0], 10),
            parseInt(dateParts[1], 10) - 1,
            parseInt(dateParts[2], 10),
            timeParts[0] || 0,
            timeParts[1] || 0,
            0
        );

        if (isNaN(sessionDate.getTime())) {
            showToast('Invalid date entered.', 'error');
            return;
        }

        const subject = subjectSelect?.value || 'General Study';

        AppState.timerLogs[logIndex].subject = subject;
        AppState.timerLogs[logIndex].duration = totalSeconds;
        AppState.timerLogs[logIndex].date = sessionDate.toISOString();

        AppState.timerLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

        FirebaseService.saveToCloud(true);
        window.TimerService.updateDisplay();
        closeModal('edit-timer-session-modal');

        const durationStr = (hours > 0 ? `${hours}h ` : '') + `${minutes}m`;
        showToast(`Session updated: ${durationStr} for ${subject}.`, 'success');
        window._editingTimerLogId = null;
    };

    window._timerFsOriginalParent = null;
    window._timerFsOriginalNext = null;
    window._timerFsActive = false;

    window.toggleTimerFullscreen = function () {
        const panel = document.getElementById('timer-active-panel');
        if (!panel) return;

        const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (window._timerFsActive) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            return;
        }

        window._timerFsActive = true;

        window._timerFsOriginalParent = panel.parentNode;
        window._timerFsOriginalNext = panel.nextSibling;

        document.body.appendChild(panel);

        panel.classList.add('timer-fullscreen');
        panel.classList.toggle('dark', isDark);
        document.body.classList.add('timer-fullscreen-active');
        _updateTimerFsBtn(true);

        const docEl = document.documentElement;
        const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
        if (requestFs) {
            requestFs.call(docEl).catch(() => {
            });
        }
    };

    // --- PUBLIC SERVICE DEFINITION ---

    window.TimerService = {
        init: function () {
            // Setup DOM event listeners

            // 1. Subject change listener
            document.addEventListener('change', (e) => {
                if (e.target && e.target.id === 'timer-subject-select') {
                    if (AppState.activeTimerState) {
                        AppState.activeTimerState.selectedSubject = e.target.value;
                        FirebaseService.saveTimerToCloud();
                        updateSubjectTargetUI();
                    }
                }
            });

            // 2. Fullscreen change listeners
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement && window._timerFsActive) {
                    _exitTimerFsCleanup();
                }
            });
            document.addEventListener('webkitfullscreenchange', () => {
                if (!document.webkitFullscreenElement && window._timerFsActive) {
                    _exitTimerFsCleanup();
                }
            });

            // Restore/synchronize state immediately
            window.TimerService.restore();
        },

        saveActiveStateToStore: function () {
            saveActiveStateToStore();
        },

        loadActiveStateFromStore: function (mode) {
            loadActiveStateFromStore(mode);
        },

        start: function () {
            if (AppState.activeTimerState && !AppState.activeTimerState.isRunning) {
                // Check if any other mode is running
                if (AppState.activeTimerState.timerStates) {
                    const runningMode = Object.keys(AppState.activeTimerState.timerStates).find(mode => {
                        return mode !== AppState.activeTimerState.mode && AppState.activeTimerState.timerStates[mode].isRunning;
                    });
                    if (runningMode) {
                        const friendlyName = runningMode === 'stopwatch' ? 'Stopwatch' : (runningMode === 'alarm' ? 'Alarm Range' : 'Timer');
                        window.openTimerWarningModal(`Another session (${friendlyName}) is already active. Please pause it first.`);
                        return;
                    }
                }

                AppState.activeTimerState.isRunning = true;
                AppState.activeTimerState.startTime = window.getServerTime();
                saveActiveStateToStore();
                FirebaseService.saveTimerToCloud();
                window.TimerService.restore();
            }
        },

        pause: function () {
            if (AppState.activeTimerState) {
                if (AppState.activeTimerState.isRunning) {
                    AppState.activeTimerState.isRunning = false;
                    if (AppState.activeTimerState.startTime) {
                        AppState.activeTimerState.elapsedBeforeStart += (window.getServerTime() - parseStartTime(AppState.activeTimerState.startTime));
                    }
                    AppState.activeTimerState.startTime = null;
                }

                if (AppState.activeTimerState.timerStates) {
                    Object.keys(AppState.activeTimerState.timerStates).forEach(mode => {
                        const store = AppState.activeTimerState.timerStates[mode];
                        if (store.isRunning) {
                            store.isRunning = false;
                            if (store.startTime) {
                                store.elapsedBeforeStart += (window.getServerTime() - parseStartTime(store.startTime));
                            }
                            store.startTime = null;
                        }
                    });
                }

                saveActiveStateToStore();
                FirebaseService.saveTimerToCloud();
                window.TimerService.restore();
            }
        },

        resume: function () {
            window.TimerService.start();
        },

        stop: function () {
            window.TimerService.pause();
        },

        reset: function () {
            if (AppState.activeTimerState) {
                let targetMode = AppState.activeTimerState.mode;
                if (AppState.activeTimerState.timerStates) {
                    const runningMode = Object.keys(AppState.activeTimerState.timerStates).find(
                        m => AppState.activeTimerState.timerStates[m].isRunning
                    );
                    if (runningMode) {
                        targetMode = runningMode;
                    }
                }

                if (targetMode === AppState.activeTimerState.mode) {
                    AppState.activeTimerState.isRunning = false;
                    AppState.activeTimerState.startTime = null;
                    AppState.activeTimerState.elapsedBeforeStart = 0;
                }

                if (AppState.activeTimerState.timerStates && AppState.activeTimerState.timerStates[targetMode]) {
                    const store = AppState.activeTimerState.timerStates[targetMode];
                    store.isRunning = false;
                    store.startTime = null;
                    store.elapsedBeforeStart = 0;
                    if (targetMode === 'timer') {
                        store.targetDuration = 25 * 60;
                        if (targetMode === AppState.activeTimerState.mode) {
                            AppState.activeTimerState.targetDuration = 25 * 60;
                        }
                    } else if (targetMode === 'alarm') {
                        store.targetDuration = 0;
                        store.alarmStart = '';
                        store.alarmEnd = '';
                        store.alarmUseCurrent = true;
                        if (targetMode === AppState.activeTimerState.mode) {
                            AppState.activeTimerState.targetDuration = 0;
                        }
                    } else {
                        store.targetDuration = 0;
                        if (targetMode === AppState.activeTimerState.mode) {
                            AppState.activeTimerState.targetDuration = 0;
                        }
                    }
                }

                saveActiveStateToStore();
                FirebaseService.saveTimerToCloud();
                window.TimerService.restore();
            }
        },

        skip: function () {
            console.warn("TimerService: skip not implemented (no break/skip sessions exist in current codebase).");
        },

        saveSession: function () {
            window.saveTimerSession();
        },

        restore: function () {
            window.syncTimerStateFromCloud();
        },

        updateDisplay: function () {
            tickTimer();
            if (typeof window.renderTimerPage === 'function') {
                window.renderTimerPage();
            }
            // Real-time synchronization for Focus Analytics (both Modal & Spectra Pulse page)
            if (typeof window.updateTimerAnalyticsControls === 'function') {
                window.updateTimerAnalyticsControls();
            }
            if (typeof window.renderTimerAnalyticsChart === 'function') {
                window.renderTimerAnalyticsChart();
            }

            const spectraPage = document.getElementById('page-spectra-analytics');
            if (spectraPage && !spectraPage.classList.contains('hidden')) {
                if (typeof window.renderSpectraFocusHeatmap === 'function') {
                    window.renderSpectraFocusHeatmap();
                }
                if (typeof window.renderSpectraCommitmentsChart === 'function') {
                    window.renderSpectraCommitmentsChart();
                }
            }
        },

        destroy: function () {
            if (AppState.timerInterval) {
                clearInterval(AppState.timerInterval);
                AppState.timerInterval = null;
            }
        }
    };
})();
