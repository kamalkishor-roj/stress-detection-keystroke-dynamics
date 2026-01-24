const sessionState = {
            sessionId: null,
            easyTaskData: {
                keydownEvents: [],
                keyupEvents: [],
                startTime: null,
                endTime: null,
                difficultyRating: null
            },
            difficultTaskData: {
                keydownEvents: [],
                keyupEvents: [],
                startTime: null,
                endTime: null,
                difficultyRating: null
            },
            currentTask: null, // 'easy' or 'difficult'
            easyTaskCompleted: false,
            difficultTaskCompleted: false
        };

        /**
         * Initialize session with unique ID
         * Uses timestamp + random component for uniqueness
         */
        function initializeSession() {
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            sessionState.sessionId = `session_${timestamp}_${random}`;
        }

        // ============================================================================
        // UI FLOW CONTROL
        // ============================================================================

        /**
         * Show a specific section and hide all others
         * @param {string} sectionId - ID of the section to show
         */
        function showSection(sectionId) {
            const sections = document.querySelectorAll('.section');
            sections.forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(sectionId).classList.add('active');
        }

        /**
         * Update consent button state based on checkbox
         */
        function updateConsentButton() {
            const checkbox = document.getElementById('consent-checkbox');
            const button = document.getElementById('consent-button');
            button.disabled = !checkbox.checked;
        }

        /**
         * Handle consent submission
         */
        function handleConsent() {
            initializeSession();
            showSection('instructions-section');
        }

        /**
         * Start the easy task
         */
        function startEasyTask() {
            sessionState.currentTask = 'easy';
            sessionState.easyTaskData.startTime = performance.now();
            sessionState.easyTaskData.keydownEvents = [];
            sessionState.easyTaskData.keyupEvents = [];
            
            const textarea = document.getElementById('easy-textarea');
            textarea.value = '';
            textarea.focus();
            
            // Start keystroke capture
            startKeystrokeCapture('easy-textarea', 'easy');
            
            // Start time tracking
            startEasyTaskTimer();
            
            showSection('easy-task-section');
        }

        /**
         * Timer for easy task (shows elapsed time, enforces minimum)
         */
        let easyTaskTimerInterval = null;
        let easyTaskStartTime = null;

        function startEasyTaskTimer() {
            easyTaskStartTime = Date.now();
            const timeElapsedEl = document.getElementById('easy-time-elapsed');
            const continueButton = document.getElementById('easy-continue-button');
            
            easyTaskTimerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - easyTaskStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                timeElapsedEl.textContent = `Time elapsed: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                // Enable continue button after 2 minutes (120 seconds)
                if (elapsed >= 120) {
                    continueButton.disabled = false;
                    continueButton.textContent = 'Continue';
                }
            }, 1000);
        }

        /**
         * Finish easy task and proceed to break
         */
        function finishEasyTask() {
            if (easyTaskTimerInterval) {
                clearInterval(easyTaskTimerInterval);
            }
            
            sessionState.easyTaskData.endTime = performance.now();
            sessionState.easyTaskCompleted = true;
            
            // Stop keystroke capture
            stopKeystrokeCapture('easy-textarea');
            
            // Show break screen
            startBreak();
        }

        /**
         * Break screen with countdown (30-45 seconds)
         */
        let breakTimerInterval = null;
        let breakTimeRemaining = 35; // 35 seconds break

        function startBreak() {
            breakTimeRemaining = 35;
            const breakTimerEl = document.getElementById('break-timer');
            showSection('break-section');
            
            breakTimerInterval = setInterval(() => {
                breakTimerEl.textContent = breakTimeRemaining;
                breakTimeRemaining--;
                
                if (breakTimeRemaining < 0) {
                    clearInterval(breakTimerInterval);
                    startDifficultTask();
                }
            }, 1000);
        }

        /**
         * Start the difficult task
         */
        function startDifficultTask() {
            sessionState.currentTask = 'difficult';
            sessionState.difficultTaskData.startTime = performance.now();
            sessionState.difficultTaskData.keydownEvents = [];
            sessionState.difficultTaskData.keyupEvents = [];
            
            const textarea = document.getElementById('difficult-textarea');
            textarea.value = '';
            textarea.focus();
            
            // Start keystroke capture
            startKeystrokeCapture('difficult-textarea', 'difficult');
            
            // Start 2-minute countdown timer
            startDifficultTaskTimer();
            
            showSection('difficult-task-section');
        }

        /**
         * Timer for difficult task (2-minute countdown)
         */
        let difficultTaskTimerInterval = null;
        let difficultTaskTimeRemaining = 120; // 2 minutes in seconds

        function startDifficultTaskTimer() {
            difficultTaskTimeRemaining = 120;
            const timerEl = document.getElementById('difficult-timer');
            const continueButton = document.getElementById('difficult-continue-button');
            
            difficultTaskTimerInterval = setInterval(() => {
                const minutes = Math.floor(difficultTaskTimeRemaining / 60);
                const seconds = difficultTaskTimeRemaining % 60;
                timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                difficultTaskTimeRemaining--;
                
                // Enable continue button when timer reaches 0
                if (difficultTaskTimeRemaining < 0) {
                    clearInterval(difficultTaskTimerInterval);
                    timerEl.textContent = '0:00';
                    continueButton.disabled = false;
                }
            }, 1000);
        }

        /**
         * Finish difficult task and proceed to rating
         */
        function finishDifficultTask() {
            if (difficultTaskTimerInterval) {
                clearInterval(difficultTaskTimerInterval);
            }
            
            sessionState.difficultTaskData.endTime = performance.now();
            sessionState.difficultTaskCompleted = true;
            
            // Stop keystroke capture
            stopKeystrokeCapture('difficult-textarea');
            
            // Show rating section
            showSection('rating-section');
        }

        /**
         * Handle difficulty rating selection
         */
        let selectedRating = null;

        function selectRating(rating) {
            selectedRating = rating;
            
            // Update UI
            const options = document.querySelectorAll('.rating-option');
            options.forEach((opt, index) => {
                if (index + 1 === rating) {
                    opt.classList.add('selected');
                } else {
                    opt.classList.remove('selected');
                }
            });
            
            // Enable continue button
            document.getElementById('rating-continue-button').disabled = false;
        }

        /**
         * Handle rating submission
         */
        function handleRating() {
            if (!selectedRating) return;
            
            // Store rating for current task
            if (sessionState.currentTask === 'easy') {
                sessionState.easyTaskData.difficultyRating = selectedRating;
                // If easy task is done, start difficult task
                if (!sessionState.difficultTaskCompleted) {
                    startBreak();
                } else {
                    sendDataToServer();
                    showSection('completion-section');
                }
            } else if (sessionState.currentTask === 'difficult') {
                sessionState.difficultTaskData.difficultyRating = selectedRating;
                // If easy task not rated yet, go back to rate it
                if (!sessionState.easyTaskData.difficultyRating) {
                    sessionState.currentTask = 'easy';
                    selectedRating = null;
                    document.querySelectorAll('.rating-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    document.getElementById('rating-continue-button').disabled = true;
                    showSection('rating-section');
                } else {
                    showSection('completion-section');
                }
            }
        }

        // ============================================================================
        // KEYSTROKE CAPTURE (PRIVACY-SAFE)
        // ============================================================================

        /**
         * Privacy-safe keystroke capture
         * NEVER stores actual characters or key values
         * Only stores: event type, timestamp, key category
         */
        let keystrokeCaptureActive = false;
        let currentCaptureTarget = null;

        /**
         * Categorize key without storing actual value
         * @param {KeyboardEvent} event - Keyboard event
         * @returns {string} - Key category: 'letter', 'space', 'backspace', 'other'
         */
        function categorizeKey(event) {
            // CRITICAL: We check event properties but NEVER store the actual key value
            // We only use them to determine category, then discard
            
            // Check for backspace (most common editing key)
            if (event.keyCode === 8 || event.which === 8 || event.key === 'Backspace') {
                return 'backspace';
            }
            
            // Check for space
            if (event.keyCode === 32 || event.which === 32 || event.key === ' ') {
                return 'space';
            }
            
            // Check if it's a letter (a-z, A-Z)
            // Using keyCode/which for privacy (we don't store which letter)
            const keyCode = event.keyCode || event.which;
            if ((keyCode >= 65 && keyCode <= 90) || // A-Z
                (keyCode >= 97 && keyCode <= 122)) { // a-z (some browsers)
                return 'letter';
            }
            
            // Everything else (numbers, special chars, etc.)
            return 'other';
        }

        /**
         * Start capturing keystrokes for a textarea
         * @param {string} textareaId - ID of the textarea element
         * @param {string} taskType - 'easy' or 'difficult'
         */
        function startKeystrokeCapture(textareaId, taskType) {
            const textarea = document.getElementById(textareaId);
            if (!textarea) return;
            
            keystrokeCaptureActive = true;
            currentCaptureTarget = taskType;
            
            /**
             * Handle keydown event
             * Store only: timestamp and category (NOT the actual key)
             */
            const handleKeyDown = (event) => {
                if (!keystrokeCaptureActive) return;
                
                const timestamp = performance.now();
                const category = categorizeKey(event);
                
                // Store only anonymized data
                if (taskType === 'easy') {
                    sessionState.easyTaskData.keydownEvents.push({
                        timestamp: timestamp,
                        category: category
                    });
                } else {
                    sessionState.difficultTaskData.keydownEvents.push({
                        timestamp: timestamp,
                        category: category
                    });
                }
            };
            
            /**
             * Handle keyup event
             * Store only: timestamp and category (NOT the actual key)
             */
            const handleKeyUp = (event) => {
                if (!keystrokeCaptureActive) return;
                
                const timestamp = performance.now();
                const category = categorizeKey(event);
                
                // Store only anonymized data
                if (taskType === 'easy') {
                    sessionState.easyTaskData.keyupEvents.push({
                        timestamp: timestamp,
                        category: category
                    });
                } else {
                    sessionState.difficultTaskData.keyupEvents.push({
                        timestamp: timestamp,
                        category: category
                    });
                }
            };
            
            // Attach event listeners
            textarea.addEventListener('keydown', handleKeyDown);
            textarea.addEventListener('keyup', handleKeyUp);
            
            // Store handlers for cleanup
            textarea._keydownHandler = handleKeyDown;
            textarea._keyupHandler = handleKeyUp;
        }

        /**
         * Stop capturing keystrokes for a textarea
         * @param {string} textareaId - ID of the textarea element
         */
        function stopKeystrokeCapture(textareaId) {
            const textarea = document.getElementById(textareaId);
            if (!textarea) return;
            
            keystrokeCaptureActive = false;
            
            // Remove event listeners
            if (textarea._keydownHandler) {
                textarea.removeEventListener('keydown', textarea._keydownHandler);
                delete textarea._keydownHandler;
            }
            if (textarea._keyupHandler) {
                textarea.removeEventListener('keyup', textarea._keyupHandler);
                delete textarea._keyupHandler;
            }
        }

        // ============================================================================
        // FEATURE EXTRACTION ENGINE
        // ============================================================================

        /**
         * Extract all features from keystroke data for a task
         * @param {Object} taskData - Task data object with keydown/keyup events
         * @returns {Object} - Extracted features
         */
        function extractFeatures(taskData) {
            const keydowns = taskData.keydownEvents;
            const keyups = taskData.keyupEvents;
            
            // If insufficient data, return default values
            if (keydowns.length < 2 || keyups.length < 1) {
                return getDefaultFeatures();
            }
            
            // Extract hold times
            const holdTimes = extractHoldTimes(keydowns, keyups);
            
            // Extract inter-key delays
            const delays = extractInterKeyDelays(keydowns, keyups);
            
            // Extract pause information
            const pauses = extractPauses(delays.DD);
            
            // Extract backspace rate
            const backspaceRate = calculateBackspaceRate(keydowns);
            
            // Extract typing speed variance
            const typingSpeedVariance = calculateTypingSpeedVariance(keydowns, taskData.startTime, taskData.endTime);
            
            // Calculate statistics
            const avgHoldTime = calculateMean(holdTimes);
            const stdHoldTime = calculateStdDev(holdTimes, avgHoldTime);
            const avgDD = calculateMean(delays.DD);
            const avgUD = calculateMean(delays.UD);
            const avgPauseDuration = pauses.count > 0 ? calculateMean(pauses.durations) : 0;
            
            return {
                avgHoldTime: avgHoldTime || 0,
                stdHoldTime: stdHoldTime || 0,
                avgDD: avgDD || 0,
                avgUD: avgUD || 0,
                pauseCount: pauses.count,
                avgPauseDuration: avgPauseDuration,
                backspaceRate: backspaceRate,
                typingSpeedVariance: typingSpeedVariance
            };
        }

        /**
         * Extract hold times (keyUpTime - keyDownTime)
         * Filters invalid hold times (20-800ms range)
         * @param {Array} keydowns - Array of keydown events
         * @param {Array} keyups - Array of keyup events
         * @returns {Array} - Valid hold times in milliseconds
         */
        function extractHoldTimes(keydowns, keyups) {
            const holdTimes = [];
            
            // Match keydown/keyup pairs by order and category
            // This is an approximation - in reality, we'd need more sophisticated matching
            // For privacy, we match by sequence order
            let keyupIndex = 0;
            
            for (let i = 0; i < keydowns.length && keyupIndex < keyups.length; i++) {
                const keydown = keydowns[i];
                
                // Find corresponding keyup (next keyup after this keydown)
                while (keyupIndex < keyups.length && keyups[keyupIndex].timestamp < keydown.timestamp) {
                    keyupIndex++;
                }
                
                if (keyupIndex < keyups.length) {
                    const keyup = keyups[keyupIndex];
                    const holdTime = keyup.timestamp - keydown.timestamp;
                    
                    // Filter: valid range is 20-800ms
                    if (holdTime >= 20 && holdTime <= 800) {
                        holdTimes.push(holdTime);
                    }
                    
                    keyupIndex++;
                }
            }
            
            return holdTimes;
        }

        /**
         * Extract inter-key delays (DD and UD)
         * @param {Array} keydowns - Array of keydown events
         * @param {Array} keyups - Array of keyup events
         * @returns {Object} - Object with DD and UD arrays
         */
        function extractInterKeyDelays(keydowns, keyups) {
            const DD = []; // Down-Down delays
            const UD = []; // Up-Down delays
            
            // Calculate DD: keyDown(n) - keyDown(n-1)
            for (let i = 1; i < keydowns.length; i++) {
                const delay = keydowns[i].timestamp - keydowns[i-1].timestamp;
                
                // Filter: discard DD > 5000ms (idle detection)
                if (delay <= 5000) {
                    DD.push(delay);
                }
            }
            
            // Calculate UD: keyDown(n) - keyUp(n-1)
            // Match keyups to keydowns
            let keyupIndex = 0;
            for (let i = 1; i < keydowns.length; i++) {
                const currentKeydown = keydowns[i];
                const previousKeydown = keydowns[i-1];
                
                // Find keyup for previous keydown
                while (keyupIndex < keyups.length && keyups[keyupIndex].timestamp < previousKeydown.timestamp) {
                    keyupIndex++;
                }
                
                if (keyupIndex < keyups.length) {
                    const previousKeyup = keyups[keyupIndex];
                    const delay = currentKeydown.timestamp - previousKeyup.timestamp;
                    UD.push(delay);
                }
            }
            
            return { DD, UD };
        }

        /**
         * Extract pause information from DD delays
         * Pause: DD > 500ms
         * Micro pause: 500-1000ms
         * Long pause: >1000ms
         * @param {Array} DD - Array of Down-Down delays
         * @returns {Object} - Pause count and durations
         */
        function extractPauses(DD) {
            const pauseDurations = [];
            
            for (const delay of DD) {
                if (delay > 500) {
                    pauseDurations.push(delay);
                }
            }
            
            return {
                count: pauseDurations.length,
                durations: pauseDurations
            };
        }

        /**
         * Calculate backspace rate
         * backspaceRate = backspaceCount / totalKeyCount
         * @param {Array} keydowns - Array of keydown events
         * @returns {number} - Backspace rate (0-1)
         */
        function calculateBackspaceRate(keydowns) {
            if (keydowns.length === 0) return 0;
            
            let backspaceCount = 0;
            for (const event of keydowns) {
                if (event.category === 'backspace') {
                    backspaceCount++;
                }
            }
            
            return backspaceCount / keydowns.length;
        }

        /**
         * Calculate typing speed variance using 10-second sliding windows
         * CPM (characters per minute) calculated for each window
         * @param {Array} keydowns - Array of keydown events
         * @param {number} startTime - Task start time (performance.now())
         * @param {number} endTime - Task end time (performance.now())
         * @returns {number} - Variance of CPM values
         */
        function calculateTypingSpeedVariance(keydowns, startTime, endTime) {
            if (keydowns.length < 2) return 0;
            
            const taskDuration = (endTime - startTime) / 1000; // Convert to seconds
            if (taskDuration < 10) return 0; // Need at least 10 seconds for sliding windows
            
            const windowSize = 10; // 10 seconds
            const cpmValues = [];
            
            // Filter out backspace events for character count
            const characterEvents = keydowns.filter(e => e.category !== 'backspace');
            
            // Calculate CPM for each 10-second window
            for (let windowStart = 0; windowStart < taskDuration - windowSize; windowStart += 5) {
                // Slide window by 5 seconds (overlapping windows)
                const windowEnd = windowStart + windowSize;
                const windowStartTime = startTime + (windowStart * 1000);
                const windowEndTime = startTime + (windowEnd * 1000);
                
                // Count characters in this window
                let charCount = 0;
                for (const event of characterEvents) {
                    if (event.timestamp >= windowStartTime && event.timestamp < windowEndTime) {
                        charCount++;
                    }
                }
                
                // Calculate CPM for this window
                const cpm = (charCount / windowSize) * 60;
                cpmValues.push(cpm);
            }
            
            // Calculate variance of CPM values
            if (cpmValues.length < 2) return 0;
            
            const meanCPM = calculateMean(cpmValues);
            return calculateVariance(cpmValues, meanCPM);
        }

        /**
         * Calculate mean of an array
         * @param {Array} values - Array of numbers
         * @returns {number} - Mean value
         */
        function calculateMean(values) {
            if (values.length === 0) return 0;
            const sum = values.reduce((a, b) => a + b, 0);
            return sum / values.length;
        }

        /**
         * Calculate standard deviation
         * @param {Array} values - Array of numbers
         * @param {number} mean - Mean value (pre-calculated)
         * @returns {number} - Standard deviation
         */
        function calculateStdDev(values, mean) {
            if (values.length === 0) return 0;
            const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
            const variance = calculateMean(squaredDiffs);
            return Math.sqrt(variance);
        }

        /**
         * Calculate variance
         * @param {Array} values - Array of numbers
         * @param {number} mean - Mean value (pre-calculated)
         * @returns {number} - Variance
         */
        function calculateVariance(values, mean) {
            if (values.length === 0) return 0;
            const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
            return calculateMean(squaredDiffs);
        }

        /**
         * Get default feature values when insufficient data
         * @returns {Object} - Default feature object
         */
        function getDefaultFeatures() {
            return {
                avgHoldTime: 0,
                stdHoldTime: 0,
                avgDD: 0,
                avgUD: 0,
                pauseCount: 0,
                avgPauseDuration: 0,
                backspaceRate: 0,
                typingSpeedVariance: 0
            };
        }

        async function sendDataToServer() {
    const easyFeatures = extractFeatures(sessionState.easyTaskData);
    const difficultFeatures = extractFeatures(sessionState.difficultTaskData);

    const payload = [
        {
            session_id: sessionState.sessionId,
            task_type: "easy",
            ...easyFeatures,
            stress_label: 0,
            difficulty_rating: sessionState.easyTaskData.difficultyRating
        },
        {
            session_id: sessionState.sessionId,
            task_type: "difficult",
            ...difficultFeatures,
            stress_label: 1,
            difficulty_rating: sessionState.difficultTaskData.difficultyRating
        }
    ];

    try {
        await fetch("/api/save-data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Error sending data to server:", err);
    }
}
