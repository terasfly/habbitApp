import { app, db } from "./firebase.js";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDocs
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
        streaks = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(streaks)) {
            streaks = [];
        }
    } catch (error) {
        streaks = [];
        showToast("Storage error");
    }
}

async function loadHabitsFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "habits"));

        streaks = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();

            return {
                ...data,
                firebaseDocId: docSnap.id
            };
        });

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

function getMonthProgress(history) {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const filledCount = (history || []).filter(date => date.startsWith(prefix)).length;

    return {
        percent: (filledCount / daysInMonth) * 100,
        count: filledCount,
        daysInMonth,
        abbr: now.toLocaleString("en-US", { month: "short" }).toUpperCase(),
        best: calculateMonthlyRecord(history)
    };
}

function render() {
    sContainer.innerHTML = "";
    const todayStr = getDStr(new Date());

    streaks.forEach(streak => {
        const isDone = (streak.history || []).includes(todayStr);
        const color = streak.color || "#63b3ed";
        const stats = getMonthProgress(streak.history || []);
        const rotation = (stats.percent / 100) * 360;

        const card = document.createElement("div");
        card.className = "streak-card";

        card.innerHTML = `
            <button class="delete-btn" data-action="delete" data-id="${streak.id}">✕</button>
            <div class="ring-wrapper">
                <div class="ring-track"></div>
                <div class="ring-progress" style="background: conic-gradient(${color} ${stats.percent}%, transparent 0)"></div>
                <div class="ring-dot-container" style="transform: rotate(${rotation}deg)">
                    <div class="ring-dot" style="box-shadow: 0 0 5px #fff, 0 0 10px ${color};"></div>
                </div>
                <div class="bubble" data-action="open" data-id="${streak.id}">
                    <div class="icon-badge" style="box-shadow: 0 4px 10px ${color}33;">
                        <div class="streak-emoji">${streak.emoji || "📚"}</div>
                    </div>
                    <div class="counter-row">
                        <div class="streak-count" style="color: ${isDone ? color : "var(--sky-blue)"}">
                            ${Math.round(stats.percent)}<span class="percent-sign">%</span><span class="month-abbr">${stats.abbr}</span>
                        </div>
                    </div>
                    <div class="fraction-text">${stats.count} / ${stats.daysInMonth}</div>
                    <div class="separator"></div>
                    <div class="best-label">🔥 ${stats.best}</div>
                </div>
            </div>
            <div class="streak-identity" style="border-color: ${color}" data-action="open" data-id="${streak.id}">
                <div class="streak-name">${streak.name}</div>
            </div>
        `;

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

    const completed = streaks.filter(streak => (streak.history || []).includes(todayStr)).length;
    document.getElementById("progress-text").innerText = `${completed}/${streaks.length}`;
    document.getElementById("progress-fill").style.width = streaks.length
        ? `${(completed / streaks.length) * 100}%`
        : "0%";
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
            dayEl.addEventListener("click", () => toggleDay(activeId, dStr));
        } else {
            dayEl.classList.add("future");
        }

        grid.appendChild(dayEl);
    }
}

function toggleDay(id, dStr) {
    const streak = streaks.find(item => item.id === id);
    if (!streak) return;

    const history = [...(streak.history || [])];
    const existingIndex = history.indexOf(dStr);

    if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
    } else {
        history.push(dStr);
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

function updateIconSelection() {
    document.querySelectorAll(".icon-option").forEach(el => {
        el.classList.toggle("selected", el.innerText === selEmoji);
    });
}

function updateColorSelection() {
    document.querySelectorAll(".color-option").forEach(el => {
        el.classList.toggle("selected", el.dataset.color === selColor);
    });
}

function createIcons() {
    iconContainer.innerHTML = "";

    habitTemplates.forEach(template => {
        const item = document.createElement("div");
        item.className = `icon-option${template.emoji === selEmoji ? " selected" : ""}`;
        item.innerText = template.emoji;

        item.addEventListener("click", () => {
            selEmoji = template.emoji;

            const currentName = inputName.value.trim();
            const isTemplateName = habitTemplates.some(habit => habit.name.toLowerCase() === currentName.toLowerCase());

            if (currentName === "" || isTemplateName) {
                inputName.value = template.name;
            }

            updateIconSelection();
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

async function init() {
    syncStatus.innerText = "Loading...";
    createIcons();
    createColors();
    bindEvents();
    await loadHabitsFromFirebase();
    loadingScreen.style.display = "none";
}

init();