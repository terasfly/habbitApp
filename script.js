<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>My Streaks</title>

    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Streaks">
    <meta name="theme-color" content="#0f172a">

    <link rel="stylesheet" href="style.css">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">

    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
    <script type="module" src="script.js"></script>
</head>
<body>

    <div id="loading-screen" class="loading-screen">
        <div class="spinner"></div>
        <div style="font-weight: 800; color: var(--sky-blue); font-size: 0.85rem;">Loading...</div>
    </div>

    <div class="container">
        <header><h1>My Streaks</h1></header>
        <div class="sync-status" id="sync-status">Local Storage</div>

        <div class="progress-container">
            <div class="progress-text">
                <span>Daily Progress</span>
                <span id="progress-text">0/0</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" id="progress-fill"></div>
            </div>
        </div>

        <div class="streaks-grid" id="streaks-container"></div>
    </div>

    <!-- New Habit Modal -->
    <div id="modal-overlay" class="overlay">
        <div class="modal">
            <h2 style="margin-bottom: 12px; color: var(--sky-blue); font-size: 1.2rem;">New Habit</h2>
            <div class="icon-selector" id="icon-selector"></div>
            <input type="text" id="new-streak-name" placeholder="Habit Name" maxlength="20">
            <div class="color-picker-wrapper">
                <div class="rainbow-btn" id="rainbow-trigger"><span>🎨</span></div>
                <div class="color-popover" id="color-palette"></div>
            </div>
            <button class="modal-btn save-btn" id="confirm-add">Create</button>
            <button class="modal-btn cancel-btn" id="close-modal">Cancel</button>
        </div>
    </div>

    <!-- Calendar Modal -->
    <div id="calendar-overlay" class="overlay">
        <div class="modal">
            <h2 id="cal-title" style="margin-bottom: 8px; font-size: 1.1rem;">Habit</h2>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <button id="prev-month" style="background:none; border:none; color:var(--sky-blue); font-size:1.5rem;">←</button>
                <span id="cal-month" style="font-weight:800; font-size: 0.9rem;"></span>
                <button id="next-month" style="background:none; border:none; color:var(--sky-blue); font-size:1.5rem;">→</button>
            </div>
            <div class="calendar-days" id="calendar-days"></div>

            <div class="yearly-stats-box">
                <div class="yearly-stats-header">
                    <span>Yearly Progress</span>
                    <span id="yearly-percent">0%</span>
                </div>
                <div class="yearly-progress-bar-bg">
                    <div class="yearly-progress-bar-fill" id="yearly-progress-fill"></div>
                </div>
                <div class="yearly-count-text" id="yearly-count">0 of 365 days</div>
            </div>

            <button class="modal-btn cancel-btn" style="margin-top: 15px;" id="close-cal-modal">Close</button>
        </div>
    </div>

    <!-- Delete Modal -->
    <div id="delete-confirm-overlay" class="overlay">
        <div class="modal">
            <h2 style="color: var(--danger); margin-bottom: 8px; font-size: 1.2rem;">Delete?</h2>
            <p style="margin-bottom: 15px; opacity: 0.8; font-size: 0.85rem;">All history will be lost.</p>
            <div style="display: flex; gap: 8px;">
                <button class="modal-btn cancel-btn" style="flex: 1;" id="cancel-delete">No</button>
                <button class="modal-btn" style="flex: 1; background: var(--danger); color: white;" id="confirm-delete">Yes</button>
            </div>
        </div>
    </div>

    <div id="toast">Notification</div>

</body>
</html>
