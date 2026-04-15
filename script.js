let streaks = JSON.parse(localStorage.getItem('my-streaks')) || [];
let activeId = null;
let streakToDeleteId = null;
let calDate = new Date();
let selColor = '#63b3ed';
let selEmoji = '📚';

const icons = [
    '📚', '🧘‍♀️', '🏋️‍♂️', '🏃‍♂️', '💧', '🍎', '🛌', '🏋️‍♂️', '🚶‍♀️',
    '✍️', '🎸', '💻', '🧹', '🚴‍♂️', '🌿', '🎨', '🧠', '🧩', '💡', '🤔',
    '🎯', '📱', '🧘‍♂️', '🏊‍♂️', '🚲', '🛒'
];

const generateColorPalette = () => {
    const palette = [];

    for (let i = 0; i < 40; i++) {
        const hue = (i * 360) / 40;
        palette.push(`hsl(${hue}, 75%, 60%)`);
    }

    for (let i = 0; i < 10; i++) {
        const hue = (i * 360) / 10;
        palette.push(`hsl(${hue}, 80%, 85%)`);
    }

    return palette;
};

const customPalette = generateColorPalette();

const sContainer = document.getElementById('streaks-container');
const modal = document.getElementById('modal-overlay');
const calOverlay = document.getElementById('calendar-overlay');
const deleteOverlay = document.getElementById('delete-confirm-overlay');
const toast = document.getElementById('toast');
const inputName = document.getElementById('new-streak-name');
const colorPalette = document.getElementById('color-palette');
const rainbowTrigger = document.getElementById('rainbow-trigger');

function getContrastYIQ(hexOrHsl) {
    return '#000000';
}

function saveToLocal() {
    localStorage.setItem('my-streaks', JSON.stringify(streaks));
    render();

    if (activeId) {
        updateYearlyProgress();
    }
}

function showToast(msg) {
    toast.innerText = msg;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}

function calculateMonthlyRecord(history) {
    if (!history || history.length === 0) return 0;

    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthHistory = history.filter(date => date.startsWith(prefix)).sort();

    if (monthHistory.length === 0) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < monthHistory.length; i++) {
        const prev = new Date(monthHistory[i - 1]);
        const curr = new Date(monthHistory[i]);
        const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

        if (diff === 1) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
            currentStreak = 1;
        }
    }

    return maxStreak;
}

function getYearlyStats(history) {
    const currentYear = new Date().getFullYear();
    const daysInYear =
        (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0))
            ? 366
            : 365;

    const filledThisYear = history.filter(date => date.startsWith(currentYear.toString())).length;
    const percent = ((filledThisYear / daysInYear) * 100).toFixed(1);

    return { filledThisYear, percent, daysInYear };
}

function getMonthProgress(history) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const filledThisMonth = (history || []).filter(date => date.startsWith(prefix)).length;

    const progressPercent = (filledThisMonth / daysInMonth) * 100;

    return {
        percent: progressPercent,
        count: filledThisMonth,
        daysInMonth,
        abbr: now.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
        bestMonthlyStreak: calculateMonthlyRecord(history)
    };
}

function updateYearlyProgress() {
    const streak = streaks.find(s => s.id === activeId);
    if (!streak) return;

    const stats = getYearlyStats(streak.history || []);
    document.getElementById('yearly-percent').innerText = `${stats.percent}%`;
    document.getElementById('yearly-progress-fill').style.width = `${stats.percent}%`;
    document.getElementById('yearly-count').innerText = `${stats.filledThisYear} of ${stats.daysInYear} days`;
}

const iContainer = document.getElementById('icon-selector');

icons.forEach(i => {
    const d = document.createElement('div');
    d.className = 'icon-option' + (i === selEmoji ? ' selected' : '');
    d.innerText = i;
    d.onclick = () => {
        document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
        d.classList.add('selected');
        selEmoji = i;
    };
    iContainer.appendChild(d);
});

customPalette.forEach((c) => {
    const d = document.createElement('div');
    d.className = 'color-option';
    d.style.backgroundColor = c;

    d.onclick = (e) => {
        e.stopPropagation();

        document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        d.classList.add('selected');
        selColor = c;

        inputName.style.borderColor = c;
        document.getElementById('confirm-add').style.backgroundColor = c;

        colorPalette.classList.remove('show');
    };

    colorPalette.appendChild(d);
});

rainbowTrigger.onclick = (e) => {
    e.stopPropagation();
    colorPalette.classList.toggle('show');
};

const getDStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function render() {
    sContainer.innerHTML = '';
    const todayStr = getDStr(new Date());

    streaks.forEach(s => {
        const isDone = s.history?.includes(todayStr);
        const color = s.color || '#63b3ed';
        const monthStats = getMonthProgress(s.history || []);
        const rotation = (monthStats.percent / 100) * 360;

        const card = document.createElement('div');
        card.className = 'streak-card';

        card.innerHTML = `
            <button class="delete-btn" onclick="window.askDelete(event, '${s.id}')">✕</button>
            <div class="ring-wrapper">
                <div class="ring-track"></div>
                <div class="ring-progress" style="background: conic-gradient(${color} ${monthStats.percent}%, transparent 0)"></div>
                <div class="ring-dot-container" style="transform: rotate(${rotation}deg)">
                    <div class="ring-dot" style="box-shadow: 0 0 10px #fff, 0 0 15px ${color};"></div>
                </div>
                <div class="bubble" onclick="window.openStreak('${s.id}')">
                    <div class="icon-badge" style="box-shadow: 0 8px 24px ${color}44, inset 0 4px 4px rgba(255,255,255,0.2);">
                        <div class="streak-emoji">${s.emoji || '📚'}</div>
                    </div>
                    <div class="counter-row">
                        <div class="streak-count" style="color: ${isDone ? color : 'var(--sky-blue)'}">
                            ${Math.round(monthStats.percent)}<span class="percent-sign">%</span>
                        </div>
                        <div class="month-abbr">${monthStats.abbr}</div>
                    </div>
                    <div class="fraction-text">${monthStats.count} / ${monthStats.daysInMonth}</div>
                    <div class="separator"></div>
                    <div class="best-label">🔥 ${monthStats.bestMonthlyStreak} BEST</div>
                </div>
            </div>
            <div class="streak-identity" style="border-color: ${color}" onclick="window.openStreak('${s.id}')">
                <div class="streak-name">${s.name}</div>
            </div>
        `;

        sContainer.appendChild(card);
    });

    const addCard = document.createElement('div');
    addCard.className = 'streak-card';
    addCard.innerHTML = `
        <div class="ring-wrapper">
            <div class="bubble add-bubble" onclick="window.openAddModal()">+</div>
        </div>
        <div class="streak-identity" style="opacity:0.5; border-color: transparent">
            <div class="streak-name">New</div>
        </div>
    `;
    sContainer.appendChild(addCard);

    const completed = streaks.filter(s => s.history?.includes(todayStr)).length;
    document.getElementById('progress-text').innerText = `${completed}/${streaks.length}`;
    document.getElementById('progress-fill').style.width = streaks.length
        ? (completed / streaks.length * 100) + '%'
        : '0%';
}

window.openStreak = (id) => {
    activeId = id;
    calDate = new Date();
    renderCalendar();
    updateYearlyProgress();
    calOverlay.style.display = 'flex';
};

window.openAddModal = () => {
    inputName.style.borderColor = '';
    document.getElementById('confirm-add').style.backgroundColor = '';
    colorPalette.classList.remove('show');
    modal.style.display = 'flex';
};

window.askDelete = (e, id) => {
    e.stopPropagation();
    streakToDeleteId = id;
    deleteOverlay.style.display = 'flex';
};

function renderCalendar() {
    const streak = streaks.find(s => s.id === activeId);
    if (!streak) return;

    document.getElementById('cal-title').innerText = streak.name;
    document.getElementById('cal-month').innerText = calDate.toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    const grid = document.getElementById('calendar-days');
    grid.innerHTML = '';

    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

    const todayStr = getDStr(new Date());
    const streakColor = streak.color || selColor;

    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div')).className = 'calendar-day empty';
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const d = document.createElement('div');
        const isCompleted = streak.history?.includes(dStr);
        const isToday = dStr === todayStr;

        d.className = 'calendar-day';

        if (isToday) d.classList.add('today');
        if (isCompleted) d.classList.add('completed');

        if (isToday) {
            if (isCompleted) {
                d.style.background = streakColor;
                d.style.color = getContrastYIQ(streakColor);
            } else {
                d.style.background = '#000';
                d.style.color = '#fff';
            }
        } else if (isCompleted) {
            d.style.background = streakColor;
            d.style.color = getContrastYIQ(streakColor);
        }

        d.innerText = i;

        const dayDate = new Date(year, month, i);

        if (dayDate > new Date()) {
            d.classList.add('future');
        } else {
            d.onclick = () => {
                const sIndex = streaks.findIndex(st => st.id === activeId);
                let h = [...(streaks[sIndex].history || [])];

                if (h.includes(dStr)) {
                    h = h.filter(x => x !== dStr);
                } else {
                    h.push(dStr);
                    if (dStr === getDStr(new Date())) triggerConfetti();
                }

                streaks[sIndex].history = h;
                saveToLocal();
                renderCalendar();
            };
        }

        grid.appendChild(d);
    }
}

function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

document.getElementById('confirm-add').onclick = () => {
    const name = inputName.value.trim();
    if (!name) return;

    modal.style.display = 'none';

    streaks.push({
        id: crypto.randomUUID(),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        history: [],
        color: selColor,
        emoji: selEmoji,
        createdAt: Date.now()
    });

    saveToLocal();
    showToast('Created! ✨');
    inputName.value = '';
};

document.getElementById('close-modal').onclick = () => {
    colorPalette.classList.remove('show');
    modal.style.display = 'none';
};

document.getElementById('close-cal-modal').onclick = () => {
    calOverlay.style.display = 'none';
    activeId = null;
};

document.getElementById('prev-month').onclick = () => {
    calDate.setMonth(calDate.getMonth() - 1);
    renderCalendar();
};

document.getElementById('next-month').onclick = () => {
    calDate.setMonth(calDate.getMonth() + 1);
    renderCalendar();
};

document.getElementById('cancel-delete').onclick = () => {
    deleteOverlay.style.display = 'none';
};

document.getElementById('confirm-delete').onclick = () => {
    if (streakToDeleteId) {
        streaks = streaks.filter(s => s.id !== streakToDeleteId);
        saveToLocal();
        deleteOverlay.style.display = 'none';
        showToast('Deleted!');
    }
};

document.addEventListener('click', (e) => {
    if (!colorPalette.contains(e.target) && e.target !== rainbowTrigger) {
        colorPalette.classList.remove('show');
    }
});

render();
