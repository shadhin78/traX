/**
 * Project X Firebase & Data Layer Module
 * Established in window.FirebaseService namespace.
 */

// Private internal helper function to update DOM sync status indicator
function showSync(state) {
    const el = document.getElementById('sync-status');
    const icon = document.getElementById('sync-icon');
    const text = document.getElementById('sync-text');
    if (!el || !icon || !text) return;

    el.classList.remove('opacity-0', 'scale-95');
    el.classList.add('opacity-100', 'scale-100');

    if (state === 'saving') {
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />`;
        icon.classList.add('animate-spin', 'text-blue-500');
        icon.classList.remove('text-emerald-500', 'text-red-500');
        text.textContent = 'Saving...'; text.className = 'text-[9px] font-black uppercase tracking-widest text-blue-500';
    } else if (state === 'saved') {
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />`;
        icon.classList.remove('animate-spin', 'text-blue-500', 'text-red-500');
        icon.classList.add('text-emerald-500');
        text.textContent = 'Saved'; text.className = 'text-[9px] font-black uppercase tracking-widest text-emerald-500';
        setTimeout(() => { el.classList.remove('opacity-100', 'scale-100'); el.classList.add('opacity-0', 'scale-95'); }, 2000);
    } else if (state === 'error') {
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />`;
        icon.classList.remove('animate-spin', 'text-blue-500', 'text-emerald-500');
        icon.classList.add('text-red-500');
        text.textContent = 'Error'; text.className = 'text-[9px] font-black uppercase tracking-widest text-red-500';
    }
}

window.FirebaseService = {
    _saveDebounceTimer: null,
    _unsubscribeSnapshot: null,
    _authListeners: [],

    // 1. Fetch Firebase Configuration from API, fallback to .env or cached settings
    fetchConfig: async function() {
        if (window.location.protocol === 'file:') {
            console.log("file:// protocol detected in fetchConfig. Using offline fallback config.");
            return {
                apiKey: "AIzaSyB3esen42Pqg2KzwSbn2N9Af_XpR90Z8Cw",
                authDomain: "trax-76836.firebaseapp.com",
                projectId: "trax-76836",
                storageBucket: "trax-76836.firebasestorage.app",
                messagingSenderId: "451643537797",
                appId: "1:451643537797:web:ccd35df69ff56e3320ecec"
            };
        }

        let config;
        try {
            const clientSendTime = Date.now();
            const res = await fetch('/api/config');
            const clientRecvTime = Date.now();
            if (!res.ok) throw new Error("API config endpoint not available");
            config = await res.json();

            if (!config || !config.apiKey) {
                throw new Error("Invalid or empty configuration from API config endpoint");
            }
            
            const serverDateStr = res.headers.get('Date');
            if (serverDateStr) {
                const serverTime = new Date(serverDateStr).getTime();
                const latency = (clientRecvTime - clientSendTime) / 2;
                window.serverTimeOffset = serverTime - (clientSendTime + latency);
                console.log("Estimated server clock offset (ms):", window.serverTimeOffset);
            }
            
            safeStorage.setItem('firebaseConfig', JSON.stringify(config));
        } catch (err) {
            console.warn("API config failed, trying static .env fallback...", err);
            try {
                const res = await fetch('/.env');
                if (!res.ok) throw new Error(".env file not available");
                const envText = await res.text();
                const env = {};
                envText.split(/\r?\n/).forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#')) {
                        const parts = trimmed.split('=');
                        const key = parts[0].trim();
                        const val = parts.slice(1).join('=').trim();
                        env[key] = val;
                    }
                });

                config = {
                    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
                    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
                    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
                };

                if (!config.apiKey) throw new Error("No API key found in .env");
                console.log("Loaded Firebase config from static .env fallback successfully!");
                safeStorage.setItem('firebaseConfig', JSON.stringify(config));
            } catch (fallbackErr) {
                console.warn("Network config fetch failed, checking localStorage fallback...", fallbackErr);
                const cachedConfig = safeStorage.getItem('firebaseConfig');
                if (cachedConfig) {
                    try {
                        const parsed = JSON.parse(cachedConfig);
                        if (parsed && parsed.projectId === 'trax-76836') {
                            config = parsed;
                            console.log("Loaded Firebase config from localStorage cache for offline boot.");
                        }
                    } catch(e) {}
                }
                if (!config) {
                    console.log("Using offline fallback config.");
                    config = {
                        apiKey: "AIzaSyB3esen42Pqg2KzwSbn2N9Af_XpR90Z8Cw",
                        authDomain: "trax-76836.firebaseapp.com",
                        projectId: "trax-76836",
                        storageBucket: "trax-76836.firebasestorage.app",
                        messagingSenderId: "451643537797",
                        appId: "1:451643537797:web:ccd35df69ff56e3320ecec"
                    };
                    safeStorage.setItem('firebaseConfig', JSON.stringify(config));
                }
            }
        }
        return config;
    },

    // 2. Initialize Firebase Client App and Firestore reference
    init: function(config) {
        if (window.location.protocol === 'file:') {
            AppState.db = null;
            console.log("Firebase initialized in mock mode for file:// protocol.");
            return;
        }
        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(config);
                }
                if (typeof firebase.firestore === 'function') {
                    AppState.db = firebase.firestore();
                    try {
                        AppState.db.settings({
                            experimentalAutoDetectLongPolling: true
                        });
                    } catch (e) {
                        console.warn("Could not set Firestore settings:", e);
                    }
                }
                console.log("Firebase initialized successfully.");
            } catch (initErr) {
                console.warn("Firebase initializeApp caught error:", initErr);
                AppState.db = null;
            }
        }
    },

    // 3. Authenticate with Email / Password
    login: async function(email, password) {
        const cleanEmail = (email || '').trim().toLowerCase();

        if (window.location.protocol === 'file:') {
            console.log("Firebase login mocked under file:// protocol.");
            if (cleanEmail === 'ris2k29@gmail.com' && password === '787898') {
                const localUser = { email: 'ris2k29@gmail.com', uid: 'mock-local-user-id', displayName: 'ris2k29 (Local)' };
                safeStorage.setItem('local_auth_user', JSON.stringify(localUser));
                this._notifyAuthListeners(localUser);
                return { user: localUser };
            }
            throw { code: 'auth/wrong-password', message: 'Invalid email or password.' };
        }

        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                const res = await firebase.auth().signInWithEmailAndPassword(cleanEmail, password);
                safeStorage.removeItem('local_auth_user');
                return res;
            } catch (fbErr) {
                console.warn("Firebase Auth sign-in failed:", fbErr);
                if (cleanEmail === 'ris2k29@gmail.com' && password === '787898') {
                    console.log("Falling back to local authentication for test credentials.");
                    const localUser = { email: 'ris2k29@gmail.com', uid: 'mock-local-user-id', displayName: 'ris2k29' };
                    safeStorage.setItem('local_auth_user', JSON.stringify(localUser));
                    this._notifyAuthListeners(localUser);
                    return { user: localUser };
                }
                throw fbErr;
            }
        }

        if (cleanEmail === 'ris2k29@gmail.com' && password === '787898') {
            const localUser = { email: 'ris2k29@gmail.com', uid: 'mock-local-user-id', displayName: 'ris2k29' };
            safeStorage.setItem('local_auth_user', JSON.stringify(localUser));
            this._notifyAuthListeners(localUser);
            return { user: localUser };
        }

        throw { code: 'auth/wrong-password', message: 'Invalid email or password.' };
    },

    _notifyAuthListeners: function(user) {
        if (this._authListeners && this._authListeners.length > 0) {
            this._authListeners.forEach(cb => {
                try { cb(user); } catch(e) {}
            });
        }
    },

    // 4. Log out the current session
    logout: async function() {
        if (this._unsubscribeSnapshot) {
            try { this._unsubscribeSnapshot(); } catch(e) {}
            this._unsubscribeSnapshot = null;
        }
        safeStorage.removeItem('local_auth_user');
        this._notifyAuthListeners(null);
        if (window.location.protocol === 'file:') {
            console.log("Firebase logout mocked under file:// protocol.");
            return;
        }
        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                await firebase.auth().signOut();
            } catch (e) {
                console.warn("Firebase signOut error:", e);
            }
        }
    },

    // 5. Expose current authenticated user reference
    getCurrentUser: function() {
        if (window.location.protocol === 'file:') {
            return { email: 'ris2k29@gmail.com', uid: 'mock-local-user-id', displayName: 'ris2k29 (Local)' };
        }
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            return firebase.auth().currentUser;
        }
        const cached = safeStorage.getItem('local_auth_user');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch(e) {}
        }
        return null;
    },

    // 6. Auth State Changes Listener
    onAuthStateChanged: function(callback) {
        if (!this._authListeners) this._authListeners = [];
        this._authListeners.push(callback);

        if (window.location.protocol === 'file:') {
            console.log("file:// protocol detected in onAuthStateChanged. Emitting mock user.");
            setTimeout(() => {
                callback({
                    email: 'ris2k29@gmail.com',
                    uid: 'mock-local-user-id',
                    displayName: 'ris2k29 (Local)'
                });
            }, 100);
            return () => {
                this._authListeners = this._authListeners.filter(cb => cb !== callback);
            };
        }

        const localUser = this.getCurrentUser();

        if (typeof firebase !== 'undefined' && firebase.auth) {
            const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    callback(user);
                } else if (localUser) {
                    callback(localUser);
                } else {
                    callback(null);
                }
            });
            return () => {
                this._authListeners = this._authListeners.filter(cb => cb !== callback);
                if (typeof unsubscribe === 'function') unsubscribe();
            };
        } else {
            setTimeout(() => callback(localUser), 50);
            return () => {
                this._authListeners = this._authListeners.filter(cb => cb !== callback);
            };
        }
    },

    // 7. Register Firestore Real-time Snapshot Listener
    startSnapshotListener: function(uid, onData, onError) {
        if (!AppState.db || window.location.protocol === 'file:') {
            console.warn("Firestore snapshot listener not active: DB null or offline mode.");
            return function unsubscribe() {};
        }

        try {
            console.log("Registering Firestore real-time snapshot listener for user:", uid);
            const userDocRef = AppState.db.collection('users').doc(uid);
            
            const unsubscribe = userDocRef.onSnapshot((docSnapshot) => {
                if (docSnapshot.metadata && docSnapshot.metadata.hasPendingWrites) {
                    return;
                }

                if (docSnapshot.exists) {
                    const cloudData = docSnapshot.data();
                    console.log("Real-time cloud snapshot received from Firestore.");
                    showSync('saved');
                    if (typeof onData === 'function') {
                        onData(cloudData);
                    }
                } else {
                    console.log("No cloud document found for user. Initializing first cloud save.");
                    this.saveToCloud(true);
                }
            }, (error) => {
                console.error("Firestore onSnapshot error:", error);
                showSync('error');
                if (typeof onError === 'function') {
                    onError(error);
                }
            });

            return unsubscribe;
        } catch (e) {
            console.error("Failed to register snapshot listener:", e);
            return function unsubscribe() {};
        }
    },

    // 8. Save AppState to Cloud & Local Storage
    saveToCloud: async function(immediate = false) {
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }

        showSync('saving');

        if (immediate) {
            await this._executeSave();
        } else {
            this._saveDebounceTimer = setTimeout(async () => {
                await this._executeSave();
            }, 800);
        }
    },

    _executeSave: async function() {
        const payload = {
            tasks: AppState.tasks || [],
            tracks: window.tracks || [],
            customSyllabus: window.syllabusStructure || {},
            customPrograms: window.customPrograms || {},
            customActions: window.customActions || [],
            paceGoals: window.paceGoals || [],
            passedItems: window.passedItems || { programs: [], subjects: [] },
            revisionData: window.revisionData || { active: [], progress: {} },
            programVisibility: window.programVisibility || {},
            subjectTimeLinks: window.subjectTimeLinks || {},
            successResults: window.successResults || [],
            timerLogs: window.timerLogs || [],
            dailyFocusHoursTarget: window.dailyFocusHoursTarget || 4.0,
            dailyFocusHoursTargetDate: window.dailyFocusHoursTargetDate || "",
            dailyFocusHoursTargetHistory: window.dailyFocusHoursTargetHistory || [],
            timerAnalyticsRange: window.timerAnalyticsRange || 180,
            timerAnalyticsGrouping: window.timerAnalyticsGrouping || 'daily',
            timerAnalyticsChartStyle: window.timerAnalyticsChartStyle || 'combo',
            subjectFocusTargets: window.subjectFocusTargets || {},
            dashboardConfig: window.dashboardConfig || {},
            weeklyTargetsDatabase: window.weeklyTargetsDatabase || {},
            dailyTargetsDatabase: window.dailyTargetsDatabase || {},
            scheduleBlocks: window.scheduleBlocks || [],
            scheduleBlocks2: window.scheduleBlocks2 || [],
            scheduleGroups: window.scheduleGroups || [],
            fiscalLedger: AppState.fiscalLedger || { transactions: [], budgets: [], vaults: [] },
            examSessions: AppState.examSessions || [],
            examRoutine: AppState.examRoutine || [],
            selectedCountdownExamId: AppState.selectedCountdownExamId || 'auto'
        };

        // Cache state locally first for offline support
        window.appState = payload;
        try {
            const jsonStr = JSON.stringify(payload);
            safeStorage.setItem('local_app_state', jsonStr);
            safeStorage.setItem('appState', jsonStr);
        } catch(e) {}

        const user = this.getCurrentUser();
        if (AppState.db && user && user.uid && window.location.protocol !== 'file:') {
            try {
                const cleanPayload = JSON.parse(JSON.stringify(payload));
                if (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) {
                    cleanPayload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                } else {
                    cleanPayload.updatedAt = Date.now();
                }

                await AppState.db.collection('users').doc(user.uid).set(cleanPayload, { merge: true });
                showSync('saved');
            } catch (err) {
                console.error("Firestore cloud save error:", err);
                showSync('error');
            }
        } else {
            showSync('saved');
        }
    },

    wipeCloudWorkspace: async function() {
        const user = this.getCurrentUser();
        if (AppState.db && user && user.uid && window.location.protocol !== 'file:') {
            try {
                await AppState.db.collection('users').doc(user.uid).delete();
                console.log("Firestore cloud workspace deleted.");
            } catch(e) {
                console.warn("Failed to delete Firestore cloud document:", e);
            }
        }
        safeStorage.removeItem('local_app_state');
        safeStorage.removeItem('appState');
        console.log("Memory workspace wiped to clean slate.");
    },

    saveTimerToCloud: async function() {
        if (window.TimerService && typeof window.TimerService.saveActiveStateToStore === 'function') {
            window.TimerService.saveActiveStateToStore();
        }
        this.saveToCloud(true);
    },

    // 9. Load workspace from Cloud with real-time Firestore sync
    loadFromCloud: function() {
        const user = this.getCurrentUser();

        if (this._unsubscribeSnapshot) {
            try { this._unsubscribeSnapshot(); } catch(e) {}
            this._unsubscribeSnapshot = null;
        }

        // Synchronously hydrate cached state first for instant data display on refresh
        const cachedStr = safeStorage.getItem('local_app_state') || safeStorage.getItem('appState');
        if (cachedStr) {
            try {
                const cachedData = JSON.parse(cachedStr);
                if (cachedData) window.applyFullAppState(cachedData, false);
            } catch (e) {
                console.warn("Failed to parse cached local app state:", e);
            }
        }

        const handleDataLoad = (data) => {
            if (data) {
                window.applyFullAppState(data, false);
            }
            AppState.hasLoadedFromCloud = true;
            if (typeof window.ensureConfigDefaults === 'function') window.ensureConfigDefaults();
            if (typeof window.migrateLegacyData === 'function') window.migrateLegacyData();
            if (typeof window.sortAllCustomData === 'function') window.sortAllCustomData();
            if (typeof recalculateTotals === 'function') recalculateTotals();

            if (AppState.isInitialLoad) {
                window.dismissLoadingScreen();
                if (typeof renderUI === 'function') renderUI();
            } else {
                requestAnimationFrame(() => {
                    const scrollPos = window.scrollY;
                    if (typeof renderUI === 'function') renderUI();
                    const activePage = document.querySelector('[id^="page-"]:not(.hidden)');
                    if (activePage) {
                        const activePageId = activePage.id.replace('page-', '');
                        if (activePageId && activePageId !== 'dashboard' && typeof window.switchPage === 'function') {
                            window.switchPage(activePageId);
                        }
                    }
                    window.scrollTo(0, scrollPos);
                });
            }
        };

        if (AppState.db && user && user.uid && window.location.protocol !== 'file:') {
            this._unsubscribeSnapshot = this.startSnapshotListener(user.uid, (cloudData) => {
                handleDataLoad(cloudData);
            }, (err) => {
                console.warn("Falling back to local storage due to Firestore listener error:", err);
                const localData = safeStorage.getItem('local_app_state') || safeStorage.getItem('appState');
                if (localData) {
                    try { handleDataLoad(JSON.parse(localData)); } catch(e) { handleDataLoad(null); }
                } else {
                    handleDataLoad(null);
                }
            });
        } else {
            const localData = safeStorage.getItem('local_app_state') || safeStorage.getItem('appState');
            if (localData) {
                try { handleDataLoad(JSON.parse(localData)); } catch(e) { handleDataLoad(null); }
            } else {
                handleDataLoad(null);
            }
        }
    }
};

window.dismissLoadingScreen = function() {
    if (window.setLoadingProgress) window.setLoadingProgress(100, 'Workspace ready!');
    const loadingEl = document.getElementById('auth-loading');
    const wrapperEl = document.getElementById('app-wrapper');
    if (loadingEl) {
        loadingEl.classList.add('transition-all', 'duration-500', 'opacity-0', 'pointer-events-none');
        setTimeout(() => {
            try { loadingEl.remove(); } catch(e){}
        }, 600);
    }
    if (wrapperEl) wrapperEl.classList.remove('hidden');
    AppState.isInitialLoad = false;
};

// Global compatibility aliases
window.saveToCloud = window.FirebaseService.saveToCloud.bind(window.FirebaseService);
window.loadFromCloud = window.FirebaseService.loadFromCloud.bind(window.FirebaseService);
window.saveTimerToCloud = window.FirebaseService.saveTimerToCloud.bind(window.FirebaseService);
window.showSync = showSync;

