/**
 * Project X Utilities Module
 * Established in window.Utils namespace for compatibility.
 */

window.Utils = {
    /**
     * Converts a 24-hour time string (HH:MM) to total minutes from midnight.
     */
    toMinutes: function(t) {
        if (!t) return 0;
        const p = t.split(':').map(Number);
        return (p[0] || 0) * 60 + (p[1] || 0);
    },

    /**
     * Converts a 24-hour time string (HH:MM) to total minutes from midnight.
     * Alias for toMinutes.
     */
    timeToMinutes: function(t) {
        return window.Utils.toMinutes(t);
    },

    /**
     * Formats a 24-hour time string (HH:MM) to 12-hour display format with AM/PM.
     */
    formatTime12h: function(timeStr) {
        if (!timeStr) return '';
        const parts = timeStr.split(':').map(Number);
        let hrs = parts[0] || 0;
        const mins = parts[1] || 0;
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        hrs = hrs % 12;
        if (hrs === 0) hrs = 12;
        return `${hrs}:${mins.toString().padStart(2, '0')} ${ampm}`;
    },

    /**
     * Extracts the trailing numeric value from a string.
     */
    extractNum: function(chStr) {
        if (chStr === 'Rev') return 9999;
        const match = chStr.match(/(\d+)(?!.*\d)/);
        return match ? parseInt(match[0]) : 999;
    },

    /**
     * Parses the start date of a weekly target date range string.
     */
    parseStart: function(wkStr) {
        const parts = wkStr.split(' - ');
        return parts[0] ? new Date(parts[0]) : new Date(0);
    },

    /**
     * Formats elapsed days into readable months and days.
     */
    formatDaysPassed: function(daysPassed) {
        if (daysPassed > 30) {
            const months = Math.floor(daysPassed / 30);
            const days = daysPassed % 30;
            const monthStr = months === 1 ? "1 Month" : `${months} Months`;
            if (days > 0) {
                const dayStr = days === 1 ? "1 Day" : `${days} Days`;
                return `${monthStr}, ${dayStr}`;
            }
            return monthStr;
        }
        return daysPassed === 1 ? "1 Day" : `${daysPassed} Days`;
    },

    /**
     * Formats Date object into MMM DD format.
     */
    formatDate: function(dateObj) {
        return `${dateObj.toLocaleString('en-US', { month: 'short' })} ${dateObj.getDate()}`;
    },

    /**
     * Safely parses any date string or object representation into a Date object.
     */
    parseDateSafe: function(dateStr) {
        if (!dateStr) return new Date();
        if (dateStr instanceof Date) return new Date(dateStr.getTime());
        if (typeof dateStr === 'object') {
            if (typeof dateStr.toDate === 'function') return dateStr.toDate();
            if (dateStr.seconds !== undefined) return new Date(dateStr.seconds * 1000);
        }
        let parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) return parsed;
        if (typeof dateStr === 'string' && dateStr.includes('-')) {
            const parts = dateStr.split('T')[0].split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts.map(Number);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                    return new Date(y, m - 1, d);
                }
            }
        }
        return new Date();
    },

    /**
     * Maps letter grades to numeric CGPA values.
     */
    mapGradeToNumeric: function(grade, evalType = 'cgpa') {
        if (!grade) return 0.0;
        const g = grade.toUpperCase().trim();
        if (evalType === 'grade') {
            switch (g) {
                case 'A': return 4.0;
                case 'B': return 3.0;
                case 'C': return 2.25;
                case 'D': return 2.00;
                case 'E': return 0.0;
                case 'F': return 0.0;
                default: return 0.0;
            }
        } else {
            switch (g) {
                case 'A+': return 4.0;
                case 'A': return 3.75;
                case 'A-': return 3.50;
                case 'B+': return 3.25;
                case 'B': return 3.00;
                case 'B-': return 2.75;
                case 'C+': return 2.50;
                case 'C': return 2.25;
                case 'D': return 2.00;
                case 'F': return 0.00;
                default: return 0.0;
            }
        }
    },

    /**
     * Maps numeric CGPA to letter grades.
     */
    mapCgpaToGrade: function(cgpa, evalType = 'cgpa') {
        const v = parseFloat(cgpa);
        if (isNaN(v)) return '';
        if (evalType === 'grade') {
            if (v >= 4.0) return 'A';
            if (v >= 3.0) return 'B';
            if (v >= 2.25) return 'C';
            if (v >= 2.0) return 'D';
            if (v >= 0.01) return 'E';
            return 'F';
        } else {
            if (v >= 4.0) return 'A+';
            if (v >= 3.75) return 'A';
            if (v >= 3.5) return 'A-';
            if (v >= 3.25) return 'B+';
            if (v >= 3.0) return 'B';
            if (v >= 2.75) return 'B-';
            if (v >= 2.5) return 'C+';
            if (v >= 2.25) return 'C';
            if (v >= 2.0) return 'D';
            return 'F';
        }
    },

    /**
     * Formats GPA numbers to exactly 2 decimal points string.
     */
    formatCgpaMin2Dec: function(val) {
        let parsed = parseFloat(val);
        if (isNaN(parsed)) return '';
        return parsed.toFixed(2);
    },

    /**
     * Validates and formats CGPA inputs within 0.00 - 4.00 constraints.
     */
    validateAndFormatCgpa: function(valStr) {
        if (!valStr || valStr.trim() === '') return '';
        let val = parseFloat(valStr);
        if (isNaN(val)) return '';
        if (val < 0) val = 0.00;
        if (val > 4.0) val = 4.00;
        return window.Utils.formatCgpaMin2Dec(val);
    },

    /**
     * Safe wrapper for LocalStorage to avoid crashes under the file:// protocol or private/sandboxed browsing.
     */
    storage: {
        fallbackStore: {},
        getItem: function(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn(`localStorage.getItem failed for key "${key}":`, e);
                return this.fallbackStore[key] || null;
            }
        },
        setItem: function(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.warn(`localStorage.setItem failed for key "${key}":`, e);
                this.fallbackStore[key] = String(value);
            }
        },
        removeItem: function(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`localStorage.removeItem failed for key "${key}":`, e);
                delete this.fallbackStore[key];
            }
        }
    },
    escapeHtml: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

// Global legacy compatibility bindings
window.toMinutes = window.Utils.toMinutes;
window.timeToMinutes = window.Utils.timeToMinutes;
window.formatTime12h = window.Utils.formatTime12h;
window.extractNum = window.Utils.extractNum;
window.parseStart = window.Utils.parseStart;
window.formatDaysPassed = window.Utils.formatDaysPassed;
window.formatDate = window.Utils.formatDate;
window.parseDateSafe = window.Utils.parseDateSafe;
window.mapGradeToNumeric = window.Utils.mapGradeToNumeric;
window.mapCgpaToGrade = window.Utils.mapCgpaToGrade;
window.formatCgpaMin2Dec = window.Utils.formatCgpaMin2Dec;
window.validateAndFormatCgpa = window.Utils.validateAndFormatCgpa;
window.safeStorage = window.Utils.storage;
window.escapeHtml = window.Utils.escapeHtml;


