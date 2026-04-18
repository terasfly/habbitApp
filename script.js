import { app, db } from "./firebase.js";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";

console.log("Firebase connected:", app);
console.log("Firestore connected:", db);

const STORAGE_KEY = "myStreaksHabits";

let streaks = [];
let activeId = null;
let streakToDeleteId = null;
let calDate = new Date();
let selColor = "#63b3ed";
let selEmoji = "🌅";
let selectedIconElement = null;
let recentCompletionId = null;
let recentCompletionMessage = null;

const rewardMessages = [
    "Nice 👌",
    "Good job 🔥",
    "Keep going 💪",
    "Day %d 🔥"
];

function getCompletionMessage(streak) {
    const doneCount = (streak.history || []).length;
    const available = rewardMessages.map(msg => msg.includes("%d") ? msg.replace("%d", doneCount || 1) : msg);
    const index = Math.floor(Math.random() * available.length);
    return available[index];
}

const habitTemplates = [
    { emoji: "🌅", name: "Wake up early" },
    { emoji: "💧", name: "Drink water" },
    { emoji: "🛌", name: "Make bed" },
    { emoji: "🙆‍♀️", name: "Morning stretch" },
    { emoji: "📚", name: "Read books" },
    { emoji: "🧘‍♂️", name: "Meditate daily" },
    { emoji: "🌳", name: "Walk outside" },
    { emoji: "🏋️‍♂️", name: "Exercise daily" },
    { emoji: "✍️", name: "Journal thoughts" },
    { emoji: "🙏", name: "Practice gratitude" },
    { emoji: "🥗", name: "Eat slowly" },
    { emoji: "🗓️", name: "Plan tomorrow" },
    { emoji: "🍬", name: "Limit sugar" },
    { emoji: "🥤", name: "Avoid soda" },
    { emoji: "🌬️", name: "Breathe deeply" },
    { emoji: "💻", name: "Learn coding" },
    { emoji: "🗣️", name: "Practice English" },
    { emoji: "🧹", name: "Tidy room" },
    { emoji: "💰", name: "Track spending" },
    { emoji: "😴", name: "Sleep earlier" },
    { emoji: "📵", name: "No scrolling" },
    { emoji: "🍳", name: "Cook dinner" },
    { emoji: "🧘", name: "Check posture" },
    { emoji: "🧼", name: "Wash dishes" },
    { emoji: "🦷", name: "Floss teeth" },
    { emoji: "🎯", name: "Review goals" },
    { emoji: "☀️", name: "Get sunlight" },
    { emoji: "🤝", name: "Help someone" },
    { emoji: "🌙", name: "Evening reflection" },
    { emoji: "💊", name: "Take vitamins" },
    { emoji: "🚿", name: "Cold shower" },
    { emoji: "🖥️", name: "Clean desk" },
    { emoji: "📖", name: "Study consistently" },
    { emoji: "🏦", name: "Save money" },
    { emoji: "🎧", name: "Listen podcasts" },
    { emoji: "💡", name: "Write ideas" },
    { emoji: "🤲", name: "Daily prayer" },
    { emoji: "🥣", name: "Healthy breakfast" },
    { emoji: "🥩", name: "Protein intake" },
    { emoji: "👁️", name: "Screen break" },
    { emoji: "📞", name: "Call family" },
    { emoji: "⏳", name: "Practice patience" },
    { emoji: "📦", name: "Declutter space" },
    { emoji: "📑", name: "Learn vocabulary" },
    { emoji: "🤝", name: "Keep promises" },
    { emoji: "🌙", name: "Early bedtime" },
    { emoji: "🚫", name: "No junkfood" },
    { emoji: "😊", name: "Smile often" }
];

const colorOptions = [
    "#63b3ed", "#f687b3", "#48bb78", "#f6ad55", "#a78bfa",
    "#f56565", "#38b2ac", "#ed8936", "#4299e1", "#9f7aea",
    "#ecc94b", "#4fd1c5", "#fc8181", "#68d391", "#90cdf4",
    "#fbb6ce", "#c084fc", "#fbd38d", "#81e6d9", "#b794f4",
    "#2dd4bf", "#22c55e", "#fb7185", "#60a5fa", "#f97316",
    "#e879f9", "#facc15", "#34d399", "#818cf8", "#fb923c"
];

const sContainer = document.getElementById("streaks-container");
const modal = document.getElementById("modal-overlay");
const calOverlay = document.getElementById("calendar-overlay");
const deleteOverlay = document.getElementById("delete-confirm-overlay");
const toast = document.getElementById("toast");
const inputName = document.getElementById("new-streak-name");
const iconContainer = document.getElementById("icon-selector");
const colorPalette = document.getElementById("color-palette");
const rainbowTrigger = document.getElementById("rainbow-trigger");
const confirmAddBtn = document.getElementById("confirm-add");
const syncStatus = document.getElementById("sync-status");
const loadingScreen = document.getElementById("loading-screen");

function showToast(msg) {
    toast.innerText = msg;
    toast.style.opacity = "1";

    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => {
        toast.style.opacity = "0";
    }, 2000);
}

function getDStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `habit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveHabits(statusText = "Saved locally") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(streaks));
    syncStatus.innerText = statusText;
}

function loadHabitsFromLocal() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            streaks = [];
            return;
        }

        streaks = parsed.map(item => normalizeHabit(item, item.firebaseDocId));
    } catch (error) {
        streaks = [];
        showToast("Storage error");
    }
}

function normalizeHistory(history) {
    if (Array.isArray(history)) {
        return history
            .filter(item => typeof item === "string")
            .sort();
    }

    if (history && Array.isArray(history.days)) {
        return history.days
            .filter(item => typeof item === "string")
            .sort();
    }

    return [];
}

function normalizeHabit(data, firebaseDocId) {
    return {
        id: data.id || createId(),
        name: data.name || "Unnamed habit",
        history: normalizeHistory(data.history),
        color: data.color || "#63b3ed",
        emoji: data.emoji || "📚",
        createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
        firebaseDocId
    };
}

async function loadHabitsFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "habits"));

        streaks = querySnapshot.docs.map(docSnap => normalizeHabit(docSnap.data(), docSnap.id));

        saveHabits("Loaded from Firebase");
        render();
        console.log("Loaded habits from Firebase:", streaks);
    } catch (error) {
        console.error("Firebase load error:", error);
        loadHabitsFromLocal();
        render();
        saveHabits("Loaded local backup");
        showToast("Loaded local backup");
    }
}

async function syncHabitToFirebase(streak) {
    const payload = {
        id: streak.id,
        name: streak.name,
        history: normalizeHistory(streak.history),
        color: streak.color || "#63b3ed",
        emoji: streak.emoji || "📚",
        createdAt: typeof streak.createdAt === "number" ? streak.createdAt : Date.now()
    };

    if (streak.firebaseDocId) {
        await updateDoc(doc(db, "habits", streak.firebaseDocId), payload);
        return streak.firebaseDocId;
    }

    const docRef = await addDoc(collection(db, "habits"), payload);
    streak.firebaseDocId = docRef.id;
    return docRef.id;
}

function calculateMonthlyRecord(history) {
    if (!history || !history.length) return 0;

    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const monthHistory = history.filter(date => date.startsWith(prefix)).sort();

    if (!monthHistory.length) return 0;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < monthHistory.length; i++) {
        const prev = new Date(monthHistory[i - 1]);
        const current = new Date(monthHistory[i]);
        const diff = Math.round((current - prev) / 86400000);

        if (diff === 1) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
            currentStreak = 1;
        }
    }

    return maxStreak;
}

function getRecentWeekDays(history) {
    const historySet = new Set(history || []);
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = 6; offset >= 0; offset--) {
        const day = new Date(today);
        day.setDate(today.getDate() - offset);
        const dateKey = getDStr(day);

        days.push({
            dateKey,
            dayNumber: day.getDate(),
            completed: historySet.has(dateKey),
            isToday: offset === 0
        });
    }

    return days;
}

function getMonthProgress(history) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const filledCount = (history || []).filter(date => date.startsWith(prefix)).length;

    return {
        percent: (filledCount / daysInMonth) * 100,
        best: calculateMonthlyRecord(history)
    };
}

function getWeekProgress(history) {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);

    const count = (history || []).filter(date => {
        const d = new Date(date);
        return d >= weekStart && d <= now;
    }).length;

    return {
        count,
        days: 7
    };
}

const insightMessagesById = {};
let insightRotationTimer = null;

function getInsightMessages(streak, isDone) {
    const week = getWeekProgress(streak.history || []);
    const history = streak.history || [];
    const lastDone = history.slice().sort().pop();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDStr(yesterday);
    const didYesterday = lastDone === yesterdayStr;
    const messages = [];

    if (isDone) {
        messages.push("🔥 Done today 🔥");
        if (week.days > 0) {
            if (week.count === week.days) {
                messages.push("Perfect week");
            } else if (week.count > 0) {
                messages.push(`Week ${week.count}/${week.days}`);
            } else {
                messages.push("On track");
            }
        } else {
            messages.push("Great job");
        }
    } else {
        if (didYesterday) {
            messages.push("❄️ Do today ❄️");
        } else {
            messages.push("Keep it going");
        }

        if (week.days > 0) {
            if (week.count >= Math.max(1, week.days - 1)) {
                messages.push("Almost best");
            } else {
                messages.push(`Week ${week.count}/${week.days}`);
            }
        }
    }

    return messages.slice(0, 2);
}

function fadeInsightText(el, text) {
    if (!el) return;
    el.classList.add("insight-fade-out");
    window.setTimeout(() => {
        el.textContent = text;
        el.classList.remove("insight-fade-out");
    }, 240);
}

function updateAllInsights() {
    document.querySelectorAll(".streak-identity[data-habit-id]").forEach(identity => {
        const habitId = identity.dataset.habitId;
        const messages = insightMessagesById[habitId];
        if (!messages || messages.length < 2) return;

        const nextIndex = (Number(identity.dataset.insightIndex || 0) + 1) % messages.length;
        identity.dataset.insightIndex = nextIndex;
        const insightEl = identity.querySelector(".streak-insight");
        if (insightEl) {
            fadeInsightText(insightEl, messages[nextIndex]);
        }
    });
}

function startInsightRotation() {
    if (insightRotationTimer) {
        window.clearInterval(insightRotationTimer);
    }
    insightRotationTimer = window.setInterval(updateAllInsights, 4600);
}

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map(ch => ch + ch).join("") : clean;
    const int = parseInt(full, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `${r}, ${g}, ${b}`;
}

function mixChannel(start, end, ratio) {
    return Math.round(start + (end - start) * ratio);
}

function getProgressColors(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const start = {
        r: mixChannel(255, 255, clamped),
        g: mixChannel(59, 160, clamped),
        b: mixChannel(48, 220, clamped)
    };
    const end = {
        r: mixChannel(248, 125, clamped),
        g: mixChannel(113, 211, clamped),
        b: mixChannel(113, 252, clamped)
    };

    return {
        start: `rgb(${start.r}, ${start.g}, ${start.b})`,
        end: `rgb(${end.r}, ${end.g}, ${end.b})`
    };
}

function render() {
    sContainer.innerHTML = "";
    const todayStr = getDStr(new Date());

    streaks.forEach(streak => {
        const isDone = (streak.history || []).includes(todayStr);
        const color = streak.color || "#63b3ed";
        const colorRgb = hexToRgb(color);
        const stats = getMonthProgress(streak.history || []);
        const recentWeekDays = getRecentWeekDays(streak.history || []);
        const rotation = (stats.percent / 100) * 360;
        const streakDots = recentWeekDays.map(day => `
            <span class="streak-dot-mini${day.completed ? " filled" : ""}${day.isToday ? " is-today" : ""}${streak.id === recentCompletionId && day.isToday && day.completed ? " recent-hit" : ""}" aria-label="${day.dateKey} ${day.completed ? "completed" : "not completed"}">${day.dayNumber}</span>
        `).join("");

        const card = document.createElement("div");
        card.className = "streak-card";

        card.innerHTML = `
            <button class="delete-btn" data-action="delete" data-id="${streak.id}">✕</button>
            <div class="ring-wrapper" style="--habit-color: ${color}; --habit-rgb: ${colorRgb};">
                <div class="ring-track"></div>
                <div class="ring-progress" style="background: conic-gradient(${color} ${stats.percent}%, transparent 0)"></div>
                <div class="ring-dot-container" style="transform: rotate(${rotation}deg)">
                    <div class="ring-dot${isDone ? " done-today" : ""}"></div>
                </div>
                <div class="bubble${isDone ? " done-today" : ""}" data-action="open" data-id="${streak.id}" style="--habit-color: ${color}; --habit-rgb: ${colorRgb};">
                    ${isDone ? `<div class="check-badge" aria-hidden="true">✓</div>` : ""}
                    <div class="icon-badge">
                        <div class="streak-emoji">${streak.emoji || "📚"}</div>
                    </div>
                    <div class="streak-count" style="color: ${isDone ? "var(--bubble-done-text, #f8fafc)" : "var(--sky-blue)"}">
                        ${Math.round(stats.percent)}<span class="percent-sign">%</span>
                    </div>
                    <div class="streak-dots" aria-label="Last 7 days activity">
                        ${streakDots}
                    </div>
                    <div class="separator"></div>
                    <div class="best-label">🔥 ${stats.best}</div>
                </div>
            </div>
            <div class="streak-identity${isDone ? " done-today" : ""}" style="border-color: ${color}; --habit-rgb: ${colorRgb};" data-action="open" data-id="${streak.id}" data-habit-id="${streak.id}" data-insight-index="0">
                <div class="streak-name">${streak.name}</div>
                <div class="streak-insight">${getInsightMessages(streak, isDone)[0]}</div>
            </div>
        `;

        insightMessagesById[streak.id] = getInsightMessages(streak, isDone);

        if (streak.id === recentCompletionId) {
            const bubble = card.querySelector(".bubble");
            if (bubble) {
                bubble.classList.add("recent-complete");
                bubble.addEventListener("animationend", () => bubble.classList.remove("recent-complete"), { once: true });
            }

            const feedback = document.createElement("div");
            feedback.className = "completion-feedback";
            feedback.innerText = recentCompletionMessage || "Nice 👌";
            card.appendChild(feedback);
            feedback.addEventListener("animationend", () => {
                if (feedback.parentNode) feedback.parentNode.removeChild(feedback);
            }, { once: true });

            recentCompletionId = null;
            recentCompletionMessage = null;
        }

        sContainer.appendChild(card);
    });

    const addCard = document.createElement("div");
    addCard.className = "streak-card";
    addCard.innerHTML = `
        <div class="ring-wrapper">
            <div class="bubble add-bubble" data-action="add">+</div>
        </div>
        <div class="streak-identity" style="opacity:0.5; border-color: transparent">
            <div class="streak-name">New</div>
        </div>
    `;
    sContainer.appendChild(addCard);

    startInsightRotation();

    const completed = streaks.filter(streak => (streak.history || []).includes(todayStr)).length;
    const progressRatio = streaks.length ? completed / streaks.length : 0;
    const progressColors = getProgressColors(progressRatio);

    document.getElementById("progress-text").innerText = `${completed}/${streaks.length}`;
    document.getElementById("progress-fill").style.width = streaks.length
        ? `${progressRatio * 100}%`
        : "0%";
    document.getElementById("progress-fill").style.setProperty("--progress-start", progressColors.start);
    document.getElementById("progress-fill").style.setProperty("--progress-end", progressColors.end);
}

function openStreak(id) {
    activeId = id;
    calDate = new Date();
    renderCalendar();
    updateYearlyProgress();
    calOverlay.style.display = "flex";
}

function openAddModal() {
    modal.style.display = "flex";
    inputName.value = habitTemplates[0].name;
    selEmoji = habitTemplates[0].emoji;
    selColor = "#63b3ed";

    inputName.style.borderColor = selColor;
    confirmAddBtn.style.backgroundColor = selColor;

    updateIconSelection();
    updateColorSelection();
    iconContainer.scrollTop = 0;
}

function askDelete(id) {
    streakToDeleteId = id;
    deleteOverlay.style.display = "flex";
}

function renderCalendar() {
    const streak = streaks.find(item => item.id === activeId);
    if (!streak) return;

    document.getElementById("cal-title").innerText = streak.name;
    document.getElementById("cal-month").innerText = calDate.toLocaleString("en-US", {
        month: "long",
        year: "numeric"
    });

    const grid = document.getElementById("calendar-days");
    grid.innerHTML = "";

    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-day empty";
        grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayEl = document.createElement("div");
        const dayDate = new Date(year, month, day);
        const isCompleted = (streak.history || []).includes(dStr);
        const isToday = dStr === getDStr(new Date());

        dayEl.className = "calendar-day";
        dayEl.innerText = day;

        if (isToday) dayEl.classList.add("today");

        if (isCompleted) {
            dayEl.style.background = streak.color || selColor;
            dayEl.style.color = "#fff";
        }

        if (dayDate <= today) {
            dayEl.addEventListener("click", () => {
                dayEl.classList.add("flash-on");
                window.setTimeout(() => dayEl.classList.remove("flash-on"), 280);
                requestAnimationFrame(() => toggleDay(activeId, dStr));
            });
        } else {
            dayEl.classList.add("future");
        }

        grid.appendChild(dayEl);
    }
}

async function toggleDay(id, dStr) {
    const streak = streaks.find(item => item.id === id);
    if (!streak) return;

    const history = [...(streak.history || [])];
    const existingIndex = history.indexOf(dStr);

    if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
    } else {
        history.push(dStr);
        recentCompletionId = id;
        const streak = streaks.find(item => item.id === id);
        recentCompletionMessage = streak ? getCompletionMessage({ ...streak, history }) : "Nice 👌";
        if (dStr === getDStr(new Date())) {
            triggerConfetti();
        }
    }

    history.sort();
    streak.history = history;

    saveHabits("Saved locally");
    render();
    renderCalendar();
    updateYearlyProgress();

    try {
        await syncHabitToFirebase(streak);
        saveHabits("Saved to Firebase");
    } catch (error) {
        console.error("Firebase calendar sync error:", error);
        saveHabits("Saved locally only");
        showToast("Firebase sync failed");
    }
}

function updateYearlyProgress() {
    const streak = streaks.find(item => item.id === activeId);
    if (!streak) return;

    const currentYear = new Date().getFullYear();
    const daysInYear =
        (currentYear % 4 === 0 && (currentYear % 100 !== 0 || currentYear % 400 === 0))
            ? 366
            : 365;

    const count = (streak.history || []).filter(date => date.startsWith(String(currentYear))).length;
    const percent = ((count / daysInYear) * 100).toFixed(1);

    document.getElementById("yearly-percent").innerText = `${percent}%`;
    document.getElementById("yearly-progress-fill").style.width = `${percent}%`;
    document.getElementById("yearly-count").innerText = `${count} of ${daysInYear} days`;
}

function triggerConfetti() {
    if (typeof confetti === "function") {
        confetti({
            particleCount: 100,
            spread: 60,
            origin: { y: 0.7 }
        });
    }
}

function updateIconSelection(newSelectedElement) {
    if (selectedIconElement === newSelectedElement) return;
    if (selectedIconElement) {
        selectedIconElement.classList.remove("selected");
    }
    selectedIconElement = newSelectedElement;
    if (selectedIconElement) {
        selectedIconElement.classList.add("selected");
    }
}

function updateColorSelection() {
    document.querySelectorAll(".color-option").forEach(el => {
        el.classList.toggle("selected", el.dataset.color === selColor);
    });
}

function createIcons() {
    iconContainer.innerHTML = "";
    selectedIconElement = null;

    habitTemplates.forEach(template => {
        const item = document.createElement("div");
        item.className = `icon-option${template.emoji === selEmoji ? " selected" : ""}`;
        item.innerText = template.emoji;

        if (template.emoji === selEmoji) {
            selectedIconElement = item;
        }

        item.addEventListener("pointerdown", () => {
            if (selectedIconElement !== item) {
                updateIconSelection(item);
            }
        });

        item.addEventListener("click", () => {
            selEmoji = template.emoji;

            const currentName = inputName.value.trim();
            const isTemplateName = habitTemplates.some(habit => habit.name.toLowerCase() === currentName.toLowerCase());

            if (currentName === "" || isTemplateName) {
                inputName.value = template.name;
            }

            updateIconSelection(item);
        });

        iconContainer.appendChild(item);
    });
}

function createColors() {
    colorPalette.innerHTML = "";

    colorOptions.forEach(color => {
        const item = document.createElement("div");
        item.className = "color-option";
        item.dataset.color = color;
        item.style.backgroundColor = color;

        item.addEventListener("click", event => {
            event.stopPropagation();
            selColor = color;
            inputName.style.borderColor = color;
            confirmAddBtn.style.backgroundColor = color;
            updateColorSelection();
            colorPalette.classList.remove("show");
        });

        colorPalette.appendChild(item);
    });

    updateColorSelection();
}

async function addHabit() {
    const name = inputName.value.trim();
    if (!name) return;

    if (streaks.some(streak => streak.name.toLowerCase() === name.toLowerCase())) {
        showToast("Already exists!");
        return;
    }

    const newHabit = {
        id: createId(),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        history: [],
        color: selColor,
        emoji: selEmoji,
        createdAt: Date.now()
    };

    try {
        const docRef = await addDoc(collection(db, "habits"), newHabit);

        const habitWithFirebaseId = {
            ...newHabit,
            firebaseDocId: docRef.id
        };

        streaks.push(habitWithFirebaseId);
        saveHabits("Saved to Firebase");
        render();

        modal.style.display = "none";
        inputName.value = "";

        console.log("FIREBASE SAVED OK, doc id:", docRef.id);
        showToast("Saved to Firebase 🔥");
    } catch (error) {
        console.error("Firestore save error full:", error);

        streaks.push(newHabit);
        saveHabits("Saved locally only");
        render();

        modal.style.display = "none";
        inputName.value = "";

        alert("Firebase error: " + error.message);
        showToast("Saved locally only");
    }
}

async function deleteHabit() {
    if (!streakToDeleteId) return;

    const habitToDelete = streaks.find(streak => streak.id === streakToDeleteId);

    try {
        if (habitToDelete?.firebaseDocId) {
            await deleteDoc(doc(db, "habits", habitToDelete.firebaseDocId));
            console.log("Deleted from Firebase:", habitToDelete.firebaseDocId);
        }
    } catch (error) {
        console.error("Firebase delete error:", error);
        alert("Firebase delete error: " + error.message);
    }

    streaks = streaks.filter(streak => streak.id !== streakToDeleteId);

    if (activeId === streakToDeleteId) {
        activeId = null;
        calOverlay.style.display = "none";
    }

    streakToDeleteId = null;
    saveHabits("Saved locally");
    render();
    deleteOverlay.style.display = "none";
    showToast("Deleted");
}

function bindEvents() {
    sContainer.addEventListener("click", event => {
        const target = event.target.closest("[data-action]");
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === "open") openStreak(id);
        if (action === "delete") askDelete(id);
        if (action === "add") openAddModal();
    });

    rainbowTrigger.addEventListener("click", event => {
        event.stopPropagation();
        colorPalette.classList.toggle("show");
    });

    confirmAddBtn.addEventListener("click", addHabit);

    document.getElementById("close-modal").addEventListener("click", () => {
        modal.style.display = "none";
    });

    document.getElementById("close-cal-modal").addEventListener("click", () => {
        calOverlay.style.display = "none";
    });

    document.getElementById("cancel-delete").addEventListener("click", () => {
        deleteOverlay.style.display = "none";
    });

    document.getElementById("confirm-delete").addEventListener("click", deleteHabit);

    document.getElementById("prev-month").addEventListener("click", () => {
        calDate.setMonth(calDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById("next-month").addEventListener("click", () => {
        calDate.setMonth(calDate.getMonth() + 1);
        renderCalendar();
    });

    window.addEventListener("click", event => {
        if (event.target === modal) modal.style.display = "none";
        if (event.target === calOverlay) calOverlay.style.display = "none";
        if (event.target === deleteOverlay) deleteOverlay.style.display = "none";

        if (!colorPalette.contains(event.target) && !rainbowTrigger.contains(event.target)) {
            colorPalette.classList.remove("show");
        }
    });
}

function loadHabitsFromFirebaseWithTimeout(timeoutMs = 8000) {
    return Promise.race([
        loadHabitsFromFirebase(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase timeout")), timeoutMs))
    ]);
}

async function init() {
    syncStatus.innerText = "Loading...";
    createIcons();
    createColors();
    bindEvents();

    try {
        await loadHabitsFromFirebaseWithTimeout();
    } catch (error) {
        console.warn("Firebase load failed or timed out:", error);
        loadHabitsFromLocal();
        render();
        saveHabits("Loaded local backup");
        showToast("Loaded local backup");
    } finally {
        loadingScreen.style.display = "none";
    }
}

init();
