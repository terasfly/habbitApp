import { app, auth, db } from "./firebase.js";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";
import {
    deleteDoc,
    doc,
    collection,
    getDocs,
    setDoc
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
let selectedTemplateIndex = 0;
let selectedIconElement = null;
let selectedColorDisplay = "#63b3ed";
let suggestedColor = "#63b3ed";
let userHasPickedColor = false;
let colorPickerMode = "create";
let colorSyncTimeout = null;
let recentCompletionId = null;
let currentUser = null;
let authMode = "login";
let appEventsBound = false;

function isTouchDevice() {
    return Boolean(
        navigator.maxTouchPoints > 0 ||
        window.matchMedia?.("(hover: none), (pointer: coarse)").matches
    );
}

const emojiSegmenter = typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

function isCompoundEmoji(emoji) {
    if (!emoji) return false;

    if (emojiSegmenter) {
        return [...emojiSegmenter.segment(emoji)].length > 1;
    }

    const pictographs = emoji.match(/\p{Extended_Pictographic}/gu) || [];
    return pictographs.length > 1 && !emoji.includes("\u200d");
}

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
    { emoji: "🧠", name: "Daily Brain Exercise" },
    { emoji: "🧘‍♂️", name: "Meditate daily" },
    { emoji: "🌳", name: "Walk outside" },
    { emoji: "🎣", name: "Fishing" },
    { emoji: "🏋️‍♂️", name: "Exercise daily" },
    { emoji: "✍️", name: "Journal thoughts" },
    { emoji: "🙏", name: "Practice gratitude" },
    { emoji: "🥗", name: "Eat slowly" },
    { emoji: "🗓️", name: "Plan tomorrow" },
    { emoji: "🍬", name: "Limit sugar" },
    { emoji: "🥤", name: "Avoid soda" },
    { emoji: "⏳", name: "Fasting" },
    { emoji: "🌬️", name: "Breathe deeply" },
    { emoji: "💻", name: "Learn coding" },
    { emoji: "🗣️", name: "Practice English" },
    { emoji: "🧹", name: "Tidy room" },
    { emoji: "💰", name: "Track spending" },
    { emoji: "💰", name: "Money" },
    { emoji: "😴", name: "Sleep earlier" },
    { emoji: "📵", name: "No scrolling" },
    { emoji: "🚫📱", name: "No Shorts" },
    { emoji: "🍳", name: "Cook dinner" },
    { emoji: "🧘", name: "Check posture" },
    { emoji: "🧼", name: "Wash dishes" },
    { emoji: "🦷", name: "Floss teeth" },
    { emoji: "🎯", name: "Review goals" },
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

const RECENT_COLORS_KEY = "myStreaksRecentColors";

const colorGroups = [
    {
        name: "Cool",
        colors: [
            { value: "#bae6fd", label: "Frost" },
            { value: "#7dd3fc", label: "Ice" },
            { value: "#63b3ed", label: "Sky" },
            { value: "#60a5fa", label: "Azure" },
            { value: "#818cf8", label: "Periwinkle" },
            { value: "#4f46e5", label: "Indigo" }
        ]
    },
    {
        name: "Energy",
        colors: [
            { value: "#fecaca", label: "Blush" },
            { value: "#fca5a5", label: "Rose Red" },
            { value: "#fb7185", label: "Coral Pink" },
            { value: "#f87171", label: "Coral" },
            { value: "#f56565", label: "Flame" },
            { value: "#dc2626", label: "Ember" }
        ]
    },
    {
        name: "Nature",
        colors: [
            { value: "#bbf7d0", label: "Seedling" },
            { value: "#86efac", label: "Meadow" },
            { value: "#34d399", label: "Mint" },
            { value: "#48bb78", label: "Leaf" },
            { value: "#16a34a", label: "Forest" },
            { value: "#166534", label: "Pine" }
        ]
    },
    {
        name: "Mind",
        colors: [
            { value: "#ddd6fe", label: "Mist" },
            { value: "#c4b5fd", label: "Lavender" },
            { value: "#c084fc", label: "Orchid" },
            { value: "#a78bfa", label: "Violet" },
            { value: "#8b5cf6", label: "Amethyst" },
            { value: "#5b21b6", label: "Deep Violet" }
        ]
    },
    {
        name: "Focus",
        colors: [
            { value: "#fef3c7", label: "Glow" },
            { value: "#fde68a", label: "Butter" },
            { value: "#fbd38d", label: "Warm Gold" },
            { value: "#ecc94b", label: "Gold" },
            { value: "#facc15", label: "Sun" },
            { value: "#ca8a04", label: "Amber" }
        ]
    },
    {
        name: "Sunset",
        colors: [
            { value: "#ffedd5", label: "Peach" },
            { value: "#fed7aa", label: "Apricot" },
            { value: "#fdba74", label: "Golden Hour" },
            { value: "#fb923c", label: "Sunset" },
            { value: "#f97316", label: "Tangerine" },
            { value: "#c2410c", label: "Burnt Orange" }
        ]
    },
    {
        name: "Ocean",
        colors: [
            { value: "#ccfbf1", label: "Seafoam" },
            { value: "#99f6e4", label: "Aqua" },
            { value: "#5eead4", label: "Tide" },
            { value: "#2dd4bf", label: "Lagoon" },
            { value: "#4fd1c5", label: "Teal" },
            { value: "#0f766e", label: "Deep Teal" }
        ]
    },
    {
        name: "Berry",
        colors: [
            { value: "#fce7f3", label: "Petal" },
            { value: "#fbcfe8", label: "Candy" },
            { value: "#f9a8d4", label: "Bubblegum" },
            { value: "#f687b3", label: "Berry Pink" },
            { value: "#ec4899", label: "Raspberry" },
            { value: "#be185d", label: "Wine" }
        ]
    },
    {
        name: "Earth",
        colors: [
            { value: "#f3e8c7", label: "Sand" },
            { value: "#d8bf83", label: "Clay Light" },
            { value: "#b58b4c", label: "Clay" },
            { value: "#a16207", label: "Ochre" },
            { value: "#7c4a1e", label: "Bark" },
            { value: "#4a2c17", label: "Umber" }
        ]
    }
];

const colorSuggestions = [
    { keywords: ["brain", "learn", "vocabulary", "idea"], color: "#a78bfa" },
    { keywords: ["exercise", "stretch", "posture", "walk"], color: "#63b3ed" },
    { keywords: ["read", "book", "study"], color: "#f687b3" },
    { keywords: ["meditate", "prayer", "gratitude", "breathe"], color: "#ecc94b" },
    { keywords: ["food", "eat", "cook", "protein", "breakfast", "sugar", "soda"], color: "#f97316" },
    { keywords: ["water", "shower"], color: "#4fd1c5" },
    { keywords: ["money", "save", "spending"], color: "#48bb78" }
];

const LANGUAGE_STORAGE_KEY = "appLanguage";
const LEGACY_LANGUAGE_STORAGE_KEY = "habitAppLanguage";
const supportedLanguages = new Set(["en", "lt"]);

const translations = {
    en: {
        appTitle: "Habits",
        loading: "Loading...",
        language: "Language",
        languageEnglish: "English",
        languageLithuanian: "Lithuanian",
        myHabits: "My Habits",
        authMode: "Authentication mode",
        logIn: "Log in",
        signUp: "Sign up",
        name: "Name",
        email: "Email",
        password: "Password",
        passwordLabel: "password",
        confirmPassword: "Confirm password",
        confirmPasswordLabel: "confirm password",
        show: "Show",
        hide: "Hide",
        signOut: "Sign out",
        signedIn: "Signed in",
        dailyProgress: "Daily Progress",
        today: "Today",
        thisMonth: "This Month",
        bestStreak: "Best Streak",
        addHabit: "Add Habit",
        newHabit: "New Habit",
        new: "New",
        habit: "Habit",
        habitName: "Habit Name",
        create: "Create",
        save: "Save",
        cancel: "Cancel",
        done: "Done",
        close: "Close",
        delete: "Delete",
        deleteQuestion: "Delete?",
        deleteWarning: "All history will be lost.",
        no: "No",
        yes: "Yes",
        notification: "Notification",
        color: "Color",
        chooseIcon: "Choose icon",
        chooseColor: "Choose color",
        chooseCustomColor: "Choose custom color",
        changeHabitColor: "Change habit color",
        chooseHabitColor: "Choose habit color",
        closeColorPicker: "Close color picker",
        editColorSavedAccent: "Saved accent",
        editColorSavedLocally: "Saved locally",
        editColorSaving: "Saving...",
        accent: "Accent",
        selectedColor: "Selected color",
        recent: "Recent",
        recentColor: "Recent color",
        yearlyProgress: "Yearly Progress",
        yearlyHeatmapLabel: "Yearly habit activity heatmap",
        yearlyCount: "{count} of {days} days",
        completed: "completed",
        notCompleted: "not completed",
        heatmapCell: "{date}: {status}",
        currentStreakAria: "{count} day{plural} current streak",
        bestStreakAria: "{count} day{plural} streak",
        lastSevenDaysActivity: "Last 7 days activity",
        insightDone: "Done",
        insightDonePerfectWeek: "Done - Perfect week",
        insightDoneWeek: "Done - Week {count}/{days}",
        insightDoneOnTrack: "Done - On track",
        insightDoneGreatJob: "Done - Great job",
        insightStart: "Start",
        insightKeepGoing: "Keep it going",
        insightAlmostBest: "Almost best",
        insightWeek: "Week {count}/{days}",
        statusSavedToFirebase: "Saved to Firebase",
        statusSavedLocallyOnly: "Saved locally only",
        statusSavedLocally: "Saved locally",
        statusLoadedLocalBackup: "Loaded local backup",
        toastSignOutFailed: "Sign out failed",
        toastFirebaseSyncFailed: "Firebase sync failed",
        toastStorageError: "Storage error",
        toastAlreadyExists: "Already exists!",
        toastSavedToFirebase: "Saved to Firebase 🔥",
        toastSavedLocallyOnly: "Saved locally only",
        toastDeleteFailed: "Delete failed",
        toastDeleted: "Deleted",
        authEnterPassword: "Enter a password.",
        authConfirmPassword: "Confirm your password.",
        authPasswordsDoNotMatch: "Passwords do not match",
        authEnterName: "Enter a name.",
        authEmailAlreadyInUse: "This email already has an account{detail}.",
        authInvalidEmail: "Enter a valid email address{detail}.",
        authWeakPassword: "Use at least 6 password characters{detail}.",
        authEnableEmailPassword: "Enable Email/Password sign-in in Firebase Auth{detail}.",
        authEnableFirebaseAuth: "Enable Firebase Authentication for this project{detail}.",
        authUnauthorizedDomain: "Add this domain in Firebase Auth authorized domains{detail}.",
        authNetworkFailed: "Check your internet connection{detail}.",
        authTooManyRequests: "Too many attempts. Try again later{detail}.",
        authPermissionDenied: "Account created, but Firestore rules need updating{detail}.",
        authCheckCredentials: "Check your email and password{detail}.",
        authFailed: "Authentication failed{detail}.",
        rawMessage: "{message}",
        weekdaysShort: ["M", "T", "W", "T", "F", "S", "S"],
        monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        colorGroups: {
            Cool: "Cool",
            Energy: "Energy",
            Nature: "Nature",
            Mind: "Mind",
            Focus: "Focus",
            Sunset: "Sunset",
            Ocean: "Ocean",
            Berry: "Berry",
            Earth: "Earth"
        },
        colorLabels: {
            Frost: "Frost",
            Ice: "Ice",
            Sky: "Sky",
            Azure: "Azure",
            Periwinkle: "Periwinkle",
            Indigo: "Indigo",
            Blush: "Blush",
            "Rose Red": "Rose Red",
            "Coral Pink": "Coral Pink",
            Coral: "Coral",
            Flame: "Flame",
            Ember: "Ember",
            Seedling: "Seedling",
            Meadow: "Meadow",
            Mint: "Mint",
            Leaf: "Leaf",
            Forest: "Forest",
            Pine: "Pine",
            Mist: "Mist",
            Lavender: "Lavender",
            Orchid: "Orchid",
            Violet: "Violet",
            Amethyst: "Amethyst",
            "Deep Violet": "Deep Violet",
            Glow: "Glow",
            Butter: "Butter",
            "Warm Gold": "Warm Gold",
            Gold: "Gold",
            Sun: "Sun",
            Peach: "Peach",
            Apricot: "Apricot",
            "Golden Hour": "Golden Hour",
            Sunset: "Sunset",
            Tangerine: "Tangerine",
            "Burnt Orange": "Burnt Orange",
            Seafoam: "Seafoam",
            Aqua: "Aqua",
            Tide: "Tide",
            Lagoon: "Lagoon",
            Teal: "Teal",
            "Deep Teal": "Deep Teal",
            Petal: "Petal",
            Candy: "Candy",
            Bubblegum: "Bubblegum",
            "Berry Pink": "Berry Pink",
            Raspberry: "Raspberry",
            Wine: "Wine",
            Sand: "Sand",
            "Clay Light": "Clay Light",
            Ochre: "Ochre",
            Bark: "Bark",
            Umber: "Umber",
            Amber: "Amber",
            Clay: "Clay"
        },
        habitTemplates: {
            "Wake up early": "Wake up early",
            "Drink water": "Drink water",
            "Make bed": "Make bed",
            "Morning stretch": "Morning stretch",
            "Read books": "Read books",
            "Daily Brain Exercise": "Daily Brain Exercise",
            "Meditate daily": "Meditate daily",
            "Walk outside": "Walk outside",
            "Fishing": "Fishing",
            "Exercise daily": "Exercise daily",
            "Journal thoughts": "Journal thoughts",
            "Practice gratitude": "Practice gratitude",
            "Eat slowly": "Eat slowly",
            "Plan tomorrow": "Plan tomorrow",
            "Limit sugar": "Limit sugar",
            "Avoid soda": "Avoid soda",
            "Fasting": "Fasting",
            "Breathe deeply": "Breathe deeply",
            "Learn coding": "Learn coding",
            "Practice English": "Practice English",
            "Tidy room": "Tidy room",
            "Track spending": "Track spending",
            "Money": "Money",
            "Sleep earlier": "Sleep earlier",
            "No scrolling": "No scrolling",
            "No Shorts": "No Shorts",
            "Cook dinner": "Cook dinner",
            "Check posture": "Check posture",
            "Wash dishes": "Wash dishes",
            "Floss teeth": "Floss teeth",
            "Review goals": "Review goals",
            "Help someone": "Help someone",
            "Evening reflection": "Evening reflection",
            "Take vitamins": "Take vitamins",
            "Cold shower": "Cold shower",
            "Clean desk": "Clean desk",
            "Study consistently": "Study consistently",
            "Save money": "Save money",
            "Listen podcasts": "Listen podcasts",
            "Write ideas": "Write ideas",
            "Daily prayer": "Daily prayer",
            "Healthy breakfast": "Healthy breakfast",
            "Protein intake": "Protein intake",
            "Screen break": "Screen break",
            "Call family": "Call family",
            "Practice patience": "Practice patience",
            "Declutter space": "Declutter space",
            "Learn vocabulary": "Learn vocabulary",
            "Keep promises": "Keep promises",
            "Early bedtime": "Early bedtime",
            "No junkfood": "No junkfood",
            "Smile often": "Smile often"
        }
    },
    lt: {
        appTitle: "Įpročiai",
        loading: "Kraunama...",
        language: "Kalba",
        languageEnglish: "Anglų",
        languageLithuanian: "Lietuvių",
        myHabits: "Mano įpročiai",
        authMode: "Prisijungimo režimas",
        logIn: "Prisijungti",
        signUp: "Registruotis",
        name: "Vardas",
        email: "El. paštas",
        password: "Slaptažodis",
        passwordLabel: "slaptažodį",
        confirmPassword: "Pakartok slaptažodį",
        confirmPasswordLabel: "pakartotą slaptažodį",
        show: "Rodyti",
        hide: "Slėpti",
        signOut: "Atsijungti",
        signedIn: "Prisijungta",
        dailyProgress: "Dienos progresas",
        today: "Šiandien",
        thisMonth: "Šis mėnuo",
        bestStreak: "Geriausias streakas",
        addHabit: "Pridėti įprotį",
        newHabit: "Naujas įprotis",
        new: "Naujas",
        habit: "Įprotis",
        habitName: "Įpročio pavadinimas",
        create: "Sukurti",
        save: "Išsaugoti",
        cancel: "Atšaukti",
        done: "Atlikta",
        close: "Uždaryti",
        delete: "Ištrinti",
        deleteQuestion: "Ištrinti?",
        deleteWarning: "Visa istorija bus prarasta.",
        no: "Ne",
        yes: "Taip",
        notification: "Pranešimas",
        color: "Spalva",
        chooseIcon: "Pasirink ikoną",
        chooseColor: "Pasirink spalvą",
        chooseCustomColor: "Pasirink pasirinktinę spalvą",
        changeHabitColor: "Keisti įpročio spalvą",
        chooseHabitColor: "Pasirink įpročio spalvą",
        closeColorPicker: "Uždaryti spalvų parinkiklį",
        editColorSavedAccent: "Akcentas išsaugotas",
        editColorSavedLocally: "Išsaugota lokaliai",
        editColorSaving: "Saugoma...",
        accent: "Akcentas",
        selectedColor: "Pasirinkta spalva",
        recent: "Naujausios",
        recentColor: "Naujausia spalva",
        yearlyProgress: "Metų progresas",
        yearlyHeatmapLabel: "Metinis įpročio aktyvumo žemėlapis",
        yearlyCount: "{count} iš {days} dienų",
        completed: "atlikta",
        notCompleted: "neatlikta",
        heatmapCell: "{date}: {status}",
        currentStreakAria: "Dabartinis streakas: {count} d.",
        bestStreakAria: "Geriausias streakas: {count} d.",
        lastSevenDaysActivity: "Paskutinių 7 dienų aktyvumas",
        insightDone: "Atlikta",
        insightDonePerfectWeek: "Atlikta - tobula savaitė",
        insightDoneWeek: "Atlikta - savaitė {count}/{days}",
        insightDoneOnTrack: "Atlikta - pagal planą",
        insightDoneGreatJob: "Atlikta - puikiai",
        insightStart: "Pradėk",
        insightKeepGoing: "Tęsk",
        insightAlmostBest: "Beveik rekordas",
        insightWeek: "Savaitė {count}/{days}",
        statusSavedToFirebase: "Išsaugota Firebase",
        statusSavedLocallyOnly: "Išsaugota tik lokaliai",
        statusSavedLocally: "Išsaugota lokaliai",
        statusLoadedLocalBackup: "Įkelta vietinė kopija",
        toastSignOutFailed: "Atsijungti nepavyko",
        toastFirebaseSyncFailed: "Firebase sinchronizacija nepavyko",
        toastStorageError: "Saugyklos klaida",
        toastAlreadyExists: "Jau yra!",
        toastSavedToFirebase: "Išsaugota Firebase 🔥",
        toastSavedLocallyOnly: "Išsaugota tik lokaliai",
        toastDeleteFailed: "Ištrinti nepavyko",
        toastDeleted: "Ištrinta",
        authEnterPassword: "Įvesk slaptažodį.",
        authConfirmPassword: "Patvirtink slaptažodį.",
        authPasswordsDoNotMatch: "Slaptažodžiai nesutampa",
        authEnterName: "Įvesk vardą.",
        authEmailAlreadyInUse: "Šis el. paštas jau turi paskyrą{detail}.",
        authInvalidEmail: "Įvesk teisingą el. pašto adresą{detail}.",
        authWeakPassword: "Naudok bent 6 slaptažodžio simbolius{detail}.",
        authEnableEmailPassword: "Įjunk Email/Password prisijungimą Firebase Auth{detail}.",
        authEnableFirebaseAuth: "Įjunk Firebase Authentication šiam projektui{detail}.",
        authUnauthorizedDomain: "Pridėk šį domeną Firebase Auth leidžiamų domenų sąraše{detail}.",
        authNetworkFailed: "Patikrink interneto ryšį{detail}.",
        authTooManyRequests: "Per daug bandymų. Pabandyk vėliau{detail}.",
        authPermissionDenied: "Paskyra sukurta, bet reikia atnaujinti Firestore taisykles{detail}.",
        authCheckCredentials: "Patikrink el. paštą ir slaptažodį{detail}.",
        authFailed: "Autentifikacija nepavyko{detail}.",
        rawMessage: "{message}",
        weekdaysShort: ["P", "A", "T", "K", "P", "Š", "S"],
        monthsShort: ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Gru"],
        colorGroups: {
            Cool: "Vėsios",
            Energy: "Energija",
            Nature: "Gamta",
            Mind: "Mintys",
            Focus: "Fokusas",
            Sunset: "Saulėlydis",
            Ocean: "Vandenynas",
            Berry: "Uogos",
            Earth: "Žemė"
        },
        colorLabels: {
            Frost: "Šerkšnas",
            Ice: "Ledas",
            Sky: "Dangus",
            Azure: "Žydra",
            Periwinkle: "Melsvai violetinė",
            Indigo: "Indigo",
            Blush: "Rausva",
            "Rose Red": "Rožių raudona",
            "Coral Pink": "Koralų rožinė",
            Coral: "Koralinė",
            Flame: "Liepsna",
            Ember: "Žarija",
            Seedling: "Daigelis",
            Meadow: "Pieva",
            Mint: "Mėta",
            Leaf: "Lapas",
            Forest: "Miškas",
            Pine: "Pušis",
            Mist: "Migla",
            Lavender: "Levanda",
            Orchid: "Orchidėja",
            Violet: "Violetinė",
            Amethyst: "Ametistas",
            "Deep Violet": "Tamsi violetinė",
            Glow: "Švytėjimas",
            Butter: "Sviestas",
            "Warm Gold": "Šiltas auksas",
            Gold: "Auksas",
            Sun: "Saulė",
            Peach: "Persikas",
            Apricot: "Abrikosas",
            "Golden Hour": "Auksinė valanda",
            Sunset: "Saulėlydis",
            Tangerine: "Mandarinas",
            "Burnt Orange": "Deginta oranžinė",
            Seafoam: "Jūros puta",
            Aqua: "Akva",
            Tide: "Potvynis",
            Lagoon: "Lagūna",
            Teal: "Melsvai žalia",
            "Deep Teal": "Tamsi melsvai žalia",
            Petal: "Žiedlapis",
            Candy: "Saldainis",
            Bubblegum: "Kramtomoji guma",
            "Berry Pink": "Uogų rožinė",
            Raspberry: "Avietė",
            Wine: "Vynas",
            Sand: "Smėlis",
            "Clay Light": "Šviesus molis",
            Ochre: "Ochra",
            Bark: "Žievė",
            Umber: "Umbra",
            Amber: "Gintaras",
            Clay: "Molis"
        },
        habitTemplates: {
            "Wake up early": "Keltis anksti",
            "Drink water": "Gerti vandenį",
            "Make bed": "Pasikloti lovą",
            "Morning stretch": "Rytinis tempimas",
            "Read books": "Skaityti knygas",
            "Daily Brain Exercise": "Kasdienė smegenų mankšta",
            "Meditate daily": "Medituoti kasdien",
            "Walk outside": "Pasivaikščioti lauke",
            "Fishing": "Žvejyba",
            "Exercise daily": "Sportuoti kasdien",
            "Journal thoughts": "Rašyti mintis",
            "Practice gratitude": "Praktikuoti dėkingumą",
            "Eat slowly": "Valgyti lėtai",
            "Plan tomorrow": "Planuoti rytojų",
            "Limit sugar": "Riboti cukrų",
            "Avoid soda": "Vengti limonado",
            "Fasting": "Pasninkas",
            "Breathe deeply": "Giliai kvėpuoti",
            "Learn coding": "Mokytis programuoti",
            "Practice English": "Mokytis anglų",
            "Tidy room": "Susitvarkyti kambarį",
            "Track spending": "Sekti išlaidas",
            "Money": "Pinigai",
            "Sleep earlier": "Eiti miegoti anksčiau",
            "No scrolling": "Nescrollinti",
            "No Shorts": "Jokių Shorts",
            "Cook dinner": "Gaminti vakarienę",
            "Check posture": "Patikrinti laikyseną",
            "Wash dishes": "Išplauti indus",
            "Floss teeth": "Valyti tarpdančius",
            "Review goals": "Peržiūrėti tikslus",
            "Help someone": "Kam nors padėti",
            "Evening reflection": "Vakaro refleksija",
            "Take vitamins": "Gerti vitaminus",
            "Cold shower": "Šaltas dušas",
            "Clean desk": "Sutvarkyti stalą",
            "Study consistently": "Mokytis nuosekliai",
            "Save money": "Taupyti pinigus",
            "Listen podcasts": "Klausyti tinklalaidžių",
            "Write ideas": "Rašyti idėjas",
            "Daily prayer": "Kasdienė malda",
            "Healthy breakfast": "Sveiki pusryčiai",
            "Protein intake": "Baltymų kiekis",
            "Screen break": "Pertrauka nuo ekrano",
            "Call family": "Paskambinti šeimai",
            "Practice patience": "Praktikuoti kantrybę",
            "Declutter space": "Apsitvarkyti erdvę",
            "Learn vocabulary": "Mokytis žodžių",
            "Keep promises": "Laikytis pažadų",
            "Early bedtime": "Ankstyvas miegas",
            "No junkfood": "Jokio greito maisto",
            "Smile often": "Dažniau šypsotis"
        }
    }
};

const messageKeyAliases = {
    "Loading...": "loading",
    "Signed in": "signedIn",
    "Saved to Firebase": "statusSavedToFirebase",
    "Saved locally only": "statusSavedLocallyOnly",
    "Saved locally": "statusSavedLocally",
    "Loaded local backup": "statusLoadedLocalBackup",
    "Sign out failed": "toastSignOutFailed",
    "Firebase sync failed": "toastFirebaseSyncFailed",
    "Storage error": "toastStorageError",
    "Already exists!": "toastAlreadyExists",
    "Delete failed": "toastDeleteFailed",
    "Deleted": "toastDeleted"
};

function normalizeLanguage(lang) {
    return supportedLanguages.has(lang) ? lang : "en";
}

function getInitialLanguage() {
    try {
        const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        const legacyLanguage = localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
        const language = normalizeLanguage(savedLanguage || legacyLanguage);

        if (!savedLanguage && legacyLanguage) {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        }

        return language;
    } catch (error) {
        return "en";
    }
}

let currentLanguage = getInitialLanguage();

function t(key, vars = {}) {
    const source = translations[currentLanguage]?.[key] ?? translations.en[key] ?? key;
    if (typeof source !== "string") return source;

    return source.replace(/\{(\w+)\}/g, (_, name) => (
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : ""
    ));
}

function getLanguageLocale() {
    return currentLanguage === "lt" ? "lt-LT" : "en-US";
}

function resolveMessageKey(keyOrText) {
    return messageKeyAliases[keyOrText] || keyOrText;
}

function setTranslatedMessage(element, keyOrText = "", vars = {}) {
    if (!element) return;

    if (!keyOrText) {
        element.textContent = "";
        delete element.dataset.messageKey;
        delete element.dataset.messageVars;
        return;
    }

    const key = resolveMessageKey(keyOrText);
    element.dataset.messageKey = key;
    element.dataset.messageVars = JSON.stringify(vars);
    element.textContent = t(key, vars);
}

function refreshTranslatedMessage(element) {
    if (!element?.dataset.messageKey) return;

    let vars = {};
    try {
        vars = JSON.parse(element.dataset.messageVars || "{}");
    } catch (error) {
        vars = {};
    }

    element.textContent = t(element.dataset.messageKey, vars);
}

function translateHabitTemplateName(template, lang = currentLanguage) {
    return translations[lang]?.habitTemplates?.[template.name]
        || translations.en.habitTemplates[template.name]
        || template.name;
}

function isHabitTemplateDisplayName(name) {
    if (!name) return false;

    return habitTemplates.some(template => (
        template.name.toLowerCase() === name.toLowerCase()
        || Object.values(translations).some(language => (
            language.habitTemplates?.[template.name]?.toLowerCase() === name.toLowerCase()
        ))
    ));
}

function translateColorGroupName(name) {
    return translations[currentLanguage]?.colorGroups?.[name]
        || translations.en.colorGroups[name]
        || name;
}

function translateColorLabel(label) {
    return translations[currentLanguage]?.colorLabels?.[label]
        || translations.en.colorLabels[label]
        || label;
}

function updateStaticLanguageText() {
    document.documentElement.lang = currentLanguage;
    document.title = t("appTitle");

    document.querySelectorAll("[data-i18n]").forEach(element => {
        element.textContent = t(element.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
        element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
        element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
    });

    document.querySelectorAll("[data-i18n-title]").forEach(element => {
        element.setAttribute("title", t(element.dataset.i18nTitle));
    });
}

function updateLanguageControls() {
    document.querySelectorAll(".lang-btn[data-lang], [data-lang-option]").forEach(button => {
        const buttonLanguage = button.dataset.lang || button.dataset.langOption;
        const isActive = buttonLanguage === currentLanguage;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function getLanguageFromButton(button) {
    return button?.dataset.lang || button?.dataset.langOption || "en";
}

function updateCalendarWeekdays() {
    const labels = translations[currentLanguage].weekdaysShort;
    document.querySelectorAll(".calendar-weekdays span").forEach((span, index) => {
        span.textContent = labels[index] || "";
    });
}

function updateAuthModeCopy() {
    authSubmit.textContent = t(authMode === "signup" ? "signUp" : "logIn");
    updatePasswordToggleLabels();
}

function updateSessionUserCopy() {
    sessionUser.innerText = currentUser
        ? currentUser.displayName || currentUser.email || t("signedIn")
        : "";
}

function setSyncStatus(keyOrText = "", vars = {}) {
    setTranslatedMessage(syncStatus, keyOrText, vars);
}

function setEditColorStatus(keyOrText = "editColorSavedAccent", vars = {}) {
    setTranslatedMessage(editColorStatus, keyOrText, vars);
}

function setAuthMessage(keyOrText = "", vars = {}) {
    setTranslatedMessage(authMessage, keyOrText, vars);
}

function refreshTranslatedMessages() {
    [syncStatus, editColorStatus, authMessage, toast].forEach(refreshTranslatedMessage);

    if (!editColorStatus.dataset.messageKey) {
        setEditColorStatus("editColorSavedAccent");
    }
}

function refreshTemplateInputLanguage() {
    if (modal.style.display !== "flex") return;
    if (!isHabitTemplateDisplayName(inputName.value.trim())) return;

    const template = habitTemplates[selectedTemplateIndex] || habitTemplates[0];
    inputName.value = translateHabitTemplateName(template);
}

function updateLanguage(lang, options = {}) {
    const nextLanguage = normalizeLanguage(lang);
    const shouldPersist = options.persist !== false;
    const shouldRefreshDynamic = options.refreshDynamic !== false;

    currentLanguage = nextLanguage;

    if (shouldPersist) {
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
            localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
        } catch (error) {
            console.warn("Language preference could not be saved:", error);
        }
    }

    updateStaticLanguageText();
    updateLanguageControls();
    updateCalendarWeekdays();
    updateAuthModeCopy();
    updateSessionUserCopy();
    refreshTranslatedMessages();
    refreshTemplateInputLanguage();

    if (!shouldRefreshDynamic) return;

    createIcons();
    createColors(colorPalette);
    createColors(editColorPalette);

    if (!appShell.hidden) {
        render();
    }

    if (calOverlay.style.display === "flex") {
        renderCalendar();
        updateYearlyProgress();
    }
}

const sContainer = document.getElementById("streaks-container");
const modal = document.getElementById("modal-overlay");
const calOverlay = document.getElementById("calendar-overlay");
const deleteOverlay = document.getElementById("delete-confirm-overlay");
const toast = document.getElementById("toast");
const inputName = document.getElementById("new-streak-name");
const iconContainer = document.getElementById("icon-selector");
const colorPalette = document.getElementById("color-palette");
const rainbowTrigger = document.getElementById("rainbow-trigger");
const customColorInput = document.getElementById("custom-color-input");
const editColorPalette = document.getElementById("edit-color-palette");
const editColorTrigger = document.getElementById("edit-color-trigger");
const editCustomColorInput = document.getElementById("edit-custom-color-input");
const editColorStatus = document.getElementById("edit-color-status");
const confirmAddBtn = document.getElementById("confirm-add");
const syncStatus = document.getElementById("sync-status");
const loadingScreen = document.getElementById("loading-screen");
const appShell = document.getElementById("app-shell");
const authScreen = document.getElementById("auth-screen");
const authForm = document.getElementById("auth-form");
const authName = document.getElementById("auth-name");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authConfirmWrap = document.getElementById("auth-confirm-wrap");
const authConfirmPassword = document.getElementById("auth-confirm-password");
const authMessage = document.getElementById("auth-message");
const authSubmit = document.getElementById("auth-submit");
const sessionUser = document.getElementById("session-user");
const signOutBtn = document.getElementById("sign-out-btn");

function showToast(messageKey, vars = {}) {
    setTranslatedMessage(toast, messageKey, vars);
    toast.style.opacity = "1";

    clearTimeout(showToast.timeoutId);
    showToast.timeoutId = setTimeout(() => {
        toast.style.opacity = "0";
    }, 3000);
}

function getAllColorOptions() {
    return colorGroups.flatMap(group => group.colors);
}

function getColorOption(color) {
    return getAllColorOptions().find(option => option.value.toLowerCase() === color.toLowerCase());
}

function getRecentColorsKey(uid = currentUser?.uid) {
    return uid ? `${RECENT_COLORS_KEY}:${uid}` : RECENT_COLORS_KEY;
}

function getRecentColors() {
    try {
        const parsed = JSON.parse(localStorage.getItem(getRecentColorsKey()) || "[]");
        return Array.isArray(parsed)
            ? parsed.filter(color => typeof color === "string" && color.startsWith("#")).slice(0, 5)
            : [];
    } catch (error) {
        return [];
    }
}

function saveRecentColor(color) {
    const recent = [color, ...getRecentColors().filter(item => item.toLowerCase() !== color.toLowerCase())].slice(0, 5);
    localStorage.setItem(getRecentColorsKey(), JSON.stringify(recent));
}

function getSuggestedColorForTemplate(template) {
    const haystack = `${template.name} ${template.emoji}`.toLowerCase();
    const match = colorSuggestions.find(suggestion => suggestion.keywords.some(keyword => haystack.includes(keyword)));
    return match ? match.color : "#63b3ed";
}

function getActiveStreak() {
    return streaks.find(item => item.id === activeId);
}

function updateEditColorControl() {
    const streak = getActiveStreak();
    if (!streak || !editColorTrigger || !editCustomColorInput) return;

    const color = streak.color || "#63b3ed";
    editColorTrigger.style.setProperty("--edit-color", color);
    editColorTrigger.style.setProperty("--edit-rgb", hexToRgb(color));
    editColorTrigger.style.background = `
        radial-gradient(circle at 28% 24%, rgba(255,255,255,0.72), rgba(255,255,255,0.08) 36%, rgba(255,255,255,0) 58%),
        ${color}
    `;
    editColorTrigger.style.boxShadow = `0 12px 24px rgba(${hexToRgb(color)}, 0.30), inset 0 1px 3px rgba(255,255,255,0.36)`;
    editCustomColorInput.value = color;
}

function scheduleHabitColorSync(streak) {
    if (colorSyncTimeout) {
        window.clearTimeout(colorSyncTimeout);
    }

    const user = currentUser;

    colorSyncTimeout = window.setTimeout(async () => {
        if (!user || currentUser?.uid !== user.uid) return;

        try {
            await syncHabitToFirebase(streak, user);
            if (currentUser?.uid === user.uid) {
                saveHabits("statusSavedToFirebase");
                setEditColorStatus("editColorSavedAccent");
            }
        } catch (error) {
            console.error("Firebase color sync error:", error);
            if (currentUser?.uid === user.uid) {
                saveHabits("statusSavedLocallyOnly");
                setEditColorStatus("editColorSavedLocally");
                showToast("toastFirebaseSyncFailed");
            }
        }
    }, 350);
}

function updateActiveHabitColor(color) {
    const streak = getActiveStreak();
    if (!streak) return;

    streak.color = color;
    saveRecentColor(color);
    saveHabits("statusSavedLocally");
    render();
    renderCalendar();
    updateYearlyProgress();
    updateEditColorControl();
    renderRecentColors();
    updateColorSelection();
    updateColorPreview();
    setEditColorStatus("editColorSaving");
    scheduleHabitColorSync(streak);
}

function applySelectedColor(color, options = {}) {
    const colorOption = getColorOption(color);

    selColor = color;
    selectedColorDisplay = options.display || colorOption?.display || color;
    colorPickerMode = options.mode || colorPickerMode;

    if (colorPickerMode === "edit") {
        editCustomColorInput.value = selColor;
    } else {
        inputName.style.borderColor = selColor;
        confirmAddBtn.style.backgroundColor = selColor;
        confirmAddBtn.style.boxShadow = `0 10px 26px rgba(${hexToRgb(selColor)}, 0.28)`;
        customColorInput.value = selColor;
    }

    updateColorSelection();
    updateColorPreview();

    if (options.remember) {
        saveRecentColor(selColor);
        renderRecentColors();
    }

    if (colorPickerMode === "edit" && options.persist) {
        updateActiveHabitColor(selColor);
    }
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

function requireCurrentUser() {
    if (!currentUser) {
        throw new Error("You must be signed in to access habits.");
    }

    return currentUser;
}

function getHabitsStorageKey(uid = currentUser?.uid) {
    return uid ? `${STORAGE_KEY}:${uid}` : STORAGE_KEY;
}

function getUserDocRef(user = requireCurrentUser()) {
    return doc(db, "users", user.uid);
}

function getUserHabitsCollection(user = requireCurrentUser()) {
    return collection(db, "users", user.uid, "habits");
}

function getUserHabitDocRef(streak, user = requireCurrentUser()) {
    const habitId = streak.firebaseDocId || streak.id;

    if (!habitId) {
        throw new Error("Habit is missing an id.");
    }

    return doc(db, "users", user.uid, "habits", habitId);
}

function setLoadingVisible(isVisible) {
    loadingScreen.style.display = isVisible ? "flex" : "none";
}

function closeAllOverlays() {
    modal.style.display = "none";
    calOverlay.style.display = "none";
    deleteOverlay.style.display = "none";
    hideColorPopover(colorPalette);
    hideColorPopover(editColorPalette);
}

function resetHabitState() {
    streaks = [];
    activeId = null;
    streakToDeleteId = null;
    recentCompletionId = null;
    sContainer.innerHTML = "";
    document.getElementById("progress-text").innerText = "0/0";
    document.getElementById("progress-fill").style.width = "0%";
    renderRecentColors();
}

function setAuthMode(mode) {
    authMode = mode;
    authName.hidden = mode !== "signup";
    authName.required = mode === "signup";
    authConfirmWrap.hidden = mode !== "signup";
    authConfirmPassword.required = mode === "signup";
    authConfirmPassword.value = "";
    authConfirmPassword.type = "password";
    authPassword.autocomplete = mode === "signup" ? "new-password" : "current-password";
    authPassword.type = "password";
    updateAuthModeCopy();
    setAuthMessage("");

    document.querySelectorAll("[data-auth-mode]").forEach(button => {
        button.classList.toggle("active", button.dataset.authMode === mode);
    });
}

function setAuthBusy(isBusy) {
    authSubmit.disabled = isBusy;
    authEmail.disabled = isBusy;
    authPassword.disabled = isBusy;
    authConfirmPassword.disabled = isBusy;
    authName.disabled = isBusy;
}

function updatePasswordToggleLabels() {
    document.querySelectorAll("[data-password-toggle]").forEach(button => {
        const input = document.getElementById(button.dataset.passwordToggle);
        const isVisible = input?.type === "text";
        const label = button.dataset.passwordLabelKey
            ? t(button.dataset.passwordLabelKey)
            : button.dataset.passwordLabel || t("passwordLabel");
        const action = t(isVisible ? "hide" : "show");

        button.textContent = action;
        button.setAttribute("aria-label", `${action} ${label}`);
        button.setAttribute("aria-pressed", String(isVisible));
    });
}

function togglePasswordVisibility(targetId) {
    const input = document.getElementById(targetId);
    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";
    updatePasswordToggleLabels();
}

function validateSignupPasswords(password, confirmPassword) {
    if (!password) return "authEnterPassword";
    if (!confirmPassword) return "authConfirmPassword";
    if (password !== confirmPassword) return "authPasswordsDoNotMatch";
    return "";
}

function getAuthErrorMessage(error) {
    const code = error?.code || "";
    const detail = code ? ` (${code})` : "";

    if (code.includes("email-already-in-use")) return { key: "authEmailAlreadyInUse", vars: { detail } };
    if (code.includes("invalid-email")) return { key: "authInvalidEmail", vars: { detail } };
    if (code.includes("weak-password")) return { key: "authWeakPassword", vars: { detail } };
    if (code.includes("operation-not-allowed") || code.includes("admin-restricted-operation")) {
        return { key: "authEnableEmailPassword", vars: { detail } };
    }
    if (code.includes("configuration-not-found")) return { key: "authEnableFirebaseAuth", vars: { detail } };
    if (code.includes("unauthorized-domain")) return { key: "authUnauthorizedDomain", vars: { detail } };
    if (code.includes("network-request-failed")) return { key: "authNetworkFailed", vars: { detail } };
    if (code.includes("too-many-requests")) return { key: "authTooManyRequests", vars: { detail } };
    if (code.includes("permission-denied")) return { key: "authPermissionDenied", vars: { detail } };
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
        return { key: "authCheckCredentials", vars: { detail } };
    }

    return error?.message
        ? { key: "rawMessage", vars: { message: error.message } }
        : { key: "authFailed", vars: { detail } };
}

async function saveUserProfile(user, extra = {}) {
    const now = Date.now();
    const displayName = extra.displayName ?? user.displayName ?? "";

    await setDoc(getUserDocRef(user), {
        uid: user.uid,
        email: user.email || "",
        displayName,
        ...extra,
        updatedAt: now
    }, { merge: true });
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = authEmail.value.trim();
    const password = authPassword.value;
    const confirmPassword = authConfirmPassword.value;
    const name = authName.value.trim();

    if (authMode === "signup" && !name) {
        setAuthMessage("authEnterName");
        return;
    }

    if (authMode === "signup") {
        const passwordError = validateSignupPasswords(password, confirmPassword);
        if (passwordError) {
            setAuthMessage(passwordError);
            return;
        }
    }

    setAuthBusy(true);
    setAuthMessage("");

    try {
        if (authMode === "signup") {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(credential.user, { displayName: name });

            try {
                await saveUserProfile(credential.user, {
                    displayName: name,
                    createdAt: Date.now()
                });
            } catch (profileError) {
                console.warn("User profile write failed:", profileError);
            }
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (error) {
        console.error("Auth error:", error);
        const authError = getAuthErrorMessage(error);
        setAuthMessage(authError.key, authError.vars);
    } finally {
        setAuthBusy(false);
    }
}

async function handleSignOut() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Sign out error:", error);
        showToast("toastSignOutFailed");
    }
}

function saveHabits(statusText = "statusSavedLocally") {
    if (currentUser) {
        localStorage.setItem(getHabitsStorageKey(), JSON.stringify(streaks));
    }

    setSyncStatus(statusText);
}

function loadHabitsFromLocal(uid = currentUser?.uid) {
    try {
        const raw = localStorage.getItem(getHabitsStorageKey(uid));
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            streaks = [];
            return;
        }

        streaks = parsed.map(item => normalizeHabit(item, item.firebaseDocId));
    } catch (error) {
        streaks = [];
        showToast("toastStorageError");
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

function normalizeHabitIdentity(data) {
    const name = data.name || "Unnamed habit";
    const emoji = data.emoji || "📚";

    if (name.toLowerCase() === "get sunlight" && (emoji === "☀️" || emoji === "☀")) {
        return {
            name: "Daily Brain Exercise",
            emoji: "🧠"
        };
    }

    return { name, emoji };
}

function normalizeHabit(data, firebaseDocId) {
    const identity = normalizeHabitIdentity(data);

    return {
        id: data.id || firebaseDocId || createId(),
        name: identity.name,
        history: normalizeHistory(data.history),
        color: data.color || "#63b3ed",
        emoji: identity.emoji,
        createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
        firebaseDocId
    };
}

async function loadHabitsFromFirebase(user = requireCurrentUser()) {
    try {
        const querySnapshot = await getDocs(getUserHabitsCollection(user));

        if (currentUser?.uid !== user.uid) return;

        streaks = querySnapshot.docs.map(docSnap => normalizeHabit(docSnap.data(), docSnap.id));
        sortHabitsByPerformance();

        saveHabits("");
        render();
        console.log("Loaded user habits from Firebase:", streaks);
    } catch (error) {
        console.error("Firebase load error:", error);
        if (currentUser?.uid !== user.uid) return;
        loadHabitsFromLocal(user.uid);
        render();
        saveHabits("statusLoadedLocalBackup");
        showToast("statusLoadedLocalBackup");
    }
}

async function syncHabitToFirebase(streak, user = requireCurrentUser()) {
    const habitId = streak.firebaseDocId || streak.id;
    const payload = {
        id: streak.id,
        name: streak.name,
        history: normalizeHistory(streak.history),
        color: streak.color || "#63b3ed",
        emoji: streak.emoji || "📚",
        createdAt: typeof streak.createdAt === "number" ? streak.createdAt : Date.now()
    };

    streak.firebaseDocId = habitId;
    await setDoc(getUserHabitDocRef(streak, user), payload, { merge: true });
    return habitId;
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

function getCompletedDaysThisMonth(history) {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return (history || []).filter(date => date.startsWith(prefix)).length;
}

function getMonthlyCompletionRate(history) {
    const today = new Date();
    const daysPassedThisMonth = today.getDate();
    return daysPassedThisMonth > 0
        ? getCompletedDaysThisMonth(history) / daysPassedThisMonth
        : 0;
}

function getCurrentStreak(history) {
    const completedDays = new Set(history || []);
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    if (!completedDays.has(getDStr(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
    }

    let count = 0;

    while (completedDays.has(getDStr(cursor))) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
    }

    return count;
}

function getBestStreak(history) {
    const completedDays = [...new Set(history || [])].sort();
    let bestStreak = 0;
    let currentStreak = 0;
    let previousTime = null;

    completedDays.forEach(dateKey => {
        const [year, month, day] = dateKey.split("-").map(Number);
        const currentTime = Date.UTC(year, month - 1, day);

        if (!Number.isFinite(currentTime)) return;

        currentStreak = previousTime !== null && currentTime - previousTime === 86400000
            ? currentStreak + 1
            : 1;
        bestStreak = Math.max(bestStreak, currentStreak);
        previousTime = currentTime;
    });

    return bestStreak;
}

const streakLevels = [
    { min: 100, id: "immortal" },
    { min: 61, id: "beast-mode" },
    { min: 41, id: "elite" },
    { min: 31, id: "legendary" },
    { min: 15, id: "strong-flame" },
    { min: 8, id: "on-fire" },
    { min: 4, id: "warm" },
    { min: 1, id: "spark" },
    { min: 0, id: "cold" }
];

function getStreakLevel(days) {
    const value = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
    return streakLevels.find(level => value >= level.min) || streakLevels[streakLevels.length - 1];
}

function getHabitPerformance(streak) {
    const history = streak.history || [];

    return {
        completionRate: getMonthlyCompletionRate(history),
        currentStreak: getCurrentStreak(history),
        completedThisMonth: getCompletedDaysThisMonth(history)
    };
}

function sortHabitsByPerformance() {
    streaks = streaks
        .map((streak, index) => ({
            streak,
            index,
            performance: getHabitPerformance(streak)
        }))
        .sort((a, b) => {
            if (b.performance.completionRate !== a.performance.completionRate) {
                return b.performance.completionRate - a.performance.completionRate;
            }

            if (b.performance.currentStreak !== a.performance.currentStreak) {
                return b.performance.currentStreak - a.performance.currentStreak;
            }

            if (b.performance.completedThisMonth !== a.performance.completedThisMonth) {
                return b.performance.completedThisMonth - a.performance.completedThisMonth;
            }

            const aCreatedAt = typeof a.streak.createdAt === "number" ? a.streak.createdAt : Number.MAX_SAFE_INTEGER;
            const bCreatedAt = typeof b.streak.createdAt === "number" ? b.streak.createdAt : Number.MAX_SAFE_INTEGER;

            if (aCreatedAt !== bCreatedAt) {
                return aCreatedAt - bCreatedAt;
            }

            return a.index - b.index;
        })
        .map(item => item.streak);
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
        messages.push(t("insightDone"));
        if (week.days > 0) {
            if (week.count === week.days) {
                messages.push(t("insightDonePerfectWeek"));
            } else if (week.count > 0) {
                messages.push(t("insightDoneWeek", { count: week.count, days: week.days }));
            } else {
                messages.push(t("insightDoneOnTrack"));
            }
        } else {
            messages.push(t("insightDoneGreatJob"));
        }
    } else {
        if (didYesterday) {
            messages.push(t("insightStart"));
        } else {
            messages.push(t("insightKeepGoing"));
        }

        if (week.days > 0) {
            if (week.count >= Math.max(1, week.days - 1)) {
                messages.push(t("insightAlmostBest"));
            } else {
                messages.push(t("insightWeek", { count: week.count, days: week.days }));
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

function parseHexColor(hex) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map(ch => ch + ch).join("") : clean;
    const int = parseInt(full, 16);
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255
    };
}

function hexToRgb(hex) {
    const { r, g, b } = parseHexColor(hex);
    return `${r}, ${g}, ${b}`;
}

function getReadableTextColor(backgroundColor) {
    const { r, g, b } = parseHexColor(backgroundColor);
    const toLinear = value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
    const whiteContrast = (1.05) / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / 0.055;

    return darkContrast > whiteContrast ? "#0b1220" : "#ffffff";
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

const habitPercentTones = [
    { max: 9, color: "#b8f7ff", glow: "rgba(125, 211, 252, 0.30)", edge: "rgba(184, 247, 255, 0.18)" },
    { max: 19, color: "#7dd3fc", glow: "rgba(56, 189, 248, 0.32)", edge: "rgba(125, 211, 252, 0.18)" },
    { max: 29, color: "#38bdf8", glow: "rgba(14, 165, 233, 0.34)", edge: "rgba(56, 189, 248, 0.20)" },
    { max: 39, color: "#22d3ee", glow: "rgba(34, 211, 238, 0.34)", edge: "rgba(34, 211, 238, 0.20)" },
    { max: 49, color: "#2dd4bf", glow: "rgba(45, 212, 191, 0.34)", edge: "rgba(45, 212, 191, 0.20)" },
    { max: 59, color: "#34d399", glow: "rgba(52, 211, 153, 0.34)", edge: "rgba(52, 211, 153, 0.20)" },
    { max: 69, color: "#a3e635", glow: "rgba(163, 230, 53, 0.34)", edge: "rgba(163, 230, 53, 0.20)" },
    { max: 79, color: "#facc15", glow: "rgba(250, 204, 21, 0.38)", edge: "rgba(250, 204, 21, 0.22)" },
    { max: 89, color: "#fb923c", glow: "rgba(251, 146, 60, 0.42)", edge: "rgba(251, 146, 60, 0.24)" },
    { max: 99, color: "#ff6b35", glow: "rgba(255, 107, 53, 0.46)", edge: "rgba(255, 107, 53, 0.26)" },
    { max: 100, color: "#ffd166", glow: "rgba(255, 76, 32, 0.54)", edge: "rgba(255, 209, 102, 0.32)" }
];

function getHabitPercentTone(percent) {
    const value = Number.isFinite(percent) ? percent : 0;
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return habitPercentTones.find(tone => clamped <= tone.max) || habitPercentTones[habitPercentTones.length - 1];
}

function animateMobileRingDot(card, rotation) {
    if (!isTouchDevice()) return;

    const dotContainer = card.querySelector(".ring-dot-container");
    if (!dotContainer) return;

    dotContainer.classList.add("mobile-dot-moving");
    window.setTimeout(() => dotContainer.classList.remove("mobile-dot-moving"), 900);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            dotContainer.style.transform = `rotate(${rotation}deg)`;
        });
    });
}

function pulseMobileRingDot(target) {
    if (!isTouchDevice()) return;

    const card = target.closest(".streak-card");
    const dot = card?.querySelector(".ring-dot");
    if (!dot) return;

    dot.classList.remove("tap-pulse");
    void dot.offsetWidth;
    dot.classList.add("tap-pulse");
    dot.addEventListener("animationend", () => dot.classList.remove("tap-pulse"), { once: true });
}

function addCompletionRewardToArea(area, currentStreak, colorRgb) {
    if (!area) return;

    if (colorRgb) {
        area.style.setProperty("--habit-rgb", colorRgb);
    }

    area.querySelector(".streak-dots-reward")?.remove();

    const reward = document.createElement("span");
    reward.className = "streak-dots-reward";
    reward.setAttribute("aria-label", t("currentStreakAria", {
        count: currentStreak,
        plural: currentStreak === 1 ? "" : "s"
    }));
    reward.textContent = `🔥 ${currentStreak}`;

    const bubble = area.closest(".bubble");
    bubble?.classList.add("has-completion-reward");

    area.appendChild(reward);
    reward.addEventListener("animationend", () => {
        reward.remove();
        bubble?.classList.remove("has-completion-reward");
    }, { once: true });
}

function showCompletionRewardForHabit(id, currentStreak) {
    const streak = streaks.find(item => item.id === id);
    const colorRgb = hexToRgb(streak?.color || "#63b3ed");

    if (calOverlay.style.display === "flex" && activeId === id) {
        addCompletionRewardToArea(document.getElementById("calendar-days"), currentStreak, colorRgb);
        return;
    }

    const identity = [...sContainer.querySelectorAll(".streak-identity[data-habit-id]")]
        .find(item => item.dataset.habitId === id);
    const dots = identity?.closest(".streak-card")?.querySelector(".streak-dots");

    addCompletionRewardToArea(dots, currentStreak, colorRgb);
}

function render() {
    sortHabitsByPerformance();
    sContainer.innerHTML = "";
    const todayStr = getDStr(new Date());
    const currentMonthLabel = new Date().toLocaleString(getLanguageLocale(), { month: "short" });

    streaks.forEach(streak => {
        const isDone = (streak.history || []).includes(todayStr);
        const color = streak.color || "#63b3ed";
        const colorRgb = hexToRgb(color);
        const stats = getMonthProgress(streak.history || []);
        const currentStreak = getCurrentStreak(streak.history || []);
        const bestStreak = getBestStreak(streak.history || []);
        const streakLevel = getStreakLevel(currentStreak);
        const displayedPercent = Math.max(0, Math.min(100, Math.round(stats.percent)));
        const percentTone = getHabitPercentTone(displayedPercent);
        const recentWeekDays = getRecentWeekDays(streak.history || []);
        const rotation = (stats.percent / 100) * 360;
        const dotRotation = isTouchDevice() ? 0 : rotation;
        const streakDots = recentWeekDays.map(day => {
            const dotBackground = day.completed ? color : "#030712";
            const dotTextColor = getReadableTextColor(dotBackground);

            return `
                <span class="streak-dot-mini${day.completed ? " filled" : ""}${day.isToday ? " is-today" : ""}${streak.id === recentCompletionId && day.isToday && day.completed ? " recent-hit" : ""}" style="--dot-text-color: ${dotTextColor};" aria-label="${day.dateKey} ${day.completed ? t("completed") : t("notCompleted")}">${day.dayNumber}</span>
            `;
        }).join("");

        const card = document.createElement("div");
        card.className = "streak-card";

        card.innerHTML = `
            <button class="delete-btn" data-action="delete" data-id="${streak.id}">✕</button>
            <div class="ring-wrapper" style="--habit-color: ${color}; --habit-rgb: ${colorRgb};">
                <div class="ring-track"></div>
                <div class="ring-progress" style="background: conic-gradient(${color} ${stats.percent}%, transparent 0)"></div>
                <div class="ring-dot-container" style="transform: rotate(${dotRotation}deg)">
                    <div class="ring-dot${isDone ? " done-today" : ""}"></div>
                </div>
                <div class="bubble${isDone ? " done-today" : ""}" data-action="open" data-id="${streak.id}" style="--habit-color: ${color}; --habit-rgb: ${colorRgb};">
                    ${isDone ? `<div class="check-badge" aria-hidden="true">✓</div>` : ""}
                    <div class="icon-badge">
                        <div class="streak-emoji${isCompoundEmoji(streak.emoji) ? " is-compound" : ""}">${streak.emoji || "📚"}</div>
                    </div>
                    <div class="streak-count" style="--percent-color: ${percentTone.color}; --percent-glow: ${percentTone.glow}; --percent-edge: ${percentTone.edge};">
                        <span class="streak-percent-value">${displayedPercent}<span class="percent-sign">%</span></span><span class="month-label">${currentMonthLabel}</span>
                    </div>
                    <div class="streak-dots" aria-label="Last 7 days activity">
                        ${streakDots}
                    </div>
                    <div class="separator"></div>
                    <div class="best-label streak-fire streak-fire-${streakLevel.id}" aria-label="${bestStreak} day${bestStreak === 1 ? "" : "s"} streak">
                        <span class="streak-fire-count">${bestStreak}</span>
                        <span class="streak-fire-icon" aria-hidden="true">🔥</span>
                    </div>
                </div>
            </div>
            <div class="streak-identity${isDone ? " done-today" : ""}" style="border-color: ${color}; --habit-rgb: ${colorRgb}; --today-progress: ${isDone ? 1 : 0};" data-action="open" data-id="${streak.id}" data-habit-id="${streak.id}" data-insight-index="0">
                <div class="streak-name">${streak.name}</div>
                <div class="streak-insight">${getInsightMessages(streak, isDone)[0]}</div>
            </div>
        `;

        const deleteButton = card.querySelector(".delete-btn");
        if (deleteButton) {
            deleteButton.setAttribute("aria-label", t("delete"));
            deleteButton.innerHTML = "&times;";
        }
        card.querySelector(".streak-dots")?.setAttribute("aria-label", t("lastSevenDaysActivity"));
        card.querySelector(".best-label")?.setAttribute("aria-label", t("bestStreakAria", {
            count: bestStreak,
            plural: bestStreak === 1 ? "" : "s"
        }));
        card.querySelector(".streak-count")?.after(card.querySelector(".best-label"));

        insightMessagesById[streak.id] = getInsightMessages(streak, isDone);

        sContainer.appendChild(card);
        animateMobileRingDot(card, rotation);
    });

    const addCard = document.createElement("div");
    addCard.className = "streak-card";
    addCard.innerHTML = `
        <div class="ring-wrapper">
            <div class="bubble add-bubble" data-action="add" role="button" aria-label="${t("addHabit")}">+</div>
        </div>
        <div class="streak-identity" style="opacity:0.5; border-color: transparent">
            <div class="streak-name">${t("new")}</div>
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
    colorPickerMode = "edit";
    const streak = getActiveStreak();
    if (streak) {
        selColor = streak.color || "#63b3ed";
        selectedColorDisplay = getColorOption(selColor)?.display || selColor;
        suggestedColor = selColor;
    }
    updateEditColorControl();
    updateColorSelection();
    updateColorPreview();
    calDate = new Date();
    renderCalendar();
    updateYearlyProgress();
    calOverlay.style.display = "flex";
}

function openAddModal() {
    colorPickerMode = "create";
    modal.style.display = "flex";
    const defaultTemplate = habitTemplates[0];
    selectedTemplateIndex = 0;
    inputName.value = translateHabitTemplateName(defaultTemplate);
    selEmoji = defaultTemplate.emoji;
    suggestedColor = getSuggestedColorForTemplate(defaultTemplate);
    userHasPickedColor = false;

    updateIconSelection(iconContainer.querySelector('[data-template-index="0"]'));
    applySelectedColor(suggestedColor);
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
    document.getElementById("cal-month").innerText = calDate.toLocaleString(getLanguageLocale(), {
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
    const user = currentUser;
    const streak = streaks.find(item => item.id === id);
    if (!user || !streak) return;

    const history = [...(streak.history || [])];
    const existingIndex = history.indexOf(dStr);
    const completedToday = existingIndex < 0 && dStr === getDStr(new Date());

    if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
    } else {
        history.push(dStr);
        if (completedToday) {
            recentCompletionId = id;
            triggerConfetti();
        }
    }

    history.sort();
    streak.history = history;
    sortHabitsByPerformance();

    saveHabits("statusSavedLocally");
    render();
    renderCalendar();
    updateYearlyProgress();

    if (completedToday) {
        showCompletionRewardForHabit(id, getCurrentStreak(history));
        recentCompletionId = null;
    }

    try {
        await syncHabitToFirebase(streak, user);
        if (currentUser?.uid === user.uid) {
            saveHabits("statusSavedToFirebase");
        }
    } catch (error) {
        console.error("Firebase calendar sync error:", error);
        if (currentUser?.uid === user.uid) {
            saveHabits("statusSavedLocallyOnly");
            showToast("toastFirebaseSyncFailed");
        }
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

    const historySet = new Set(streak.history || []);
    const count = (streak.history || []).filter(date => date.startsWith(String(currentYear))).length;
    const percent = ((count / daysInYear) * 100).toFixed(1);
    const heatmap = document.getElementById("yearly-heatmap");
    const monthLabels = document.getElementById("yearly-month-labels");
    const firstDay = new Date(currentYear, 0, 1);
    const leadingEmptyCells = (firstDay.getDay() + 6) % 7;
    const totalWeekColumns = Math.ceil((leadingEmptyCells + daysInYear) / 7);
    const monthShortNames = translations[currentLanguage].monthsShort;

    document.getElementById("yearly-percent").innerText = `${percent}%`;
    document.getElementById("yearly-count").innerText = t("yearlyCount", { count, days: daysInYear });

    heatmap.innerHTML = "";
    monthLabels.innerHTML = "";
    heatmap.style.setProperty("--habit-color", streak.color || "#63b3ed");
    heatmap.style.setProperty("--habit-rgb", hexToRgb(streak.color || "#63b3ed"));
    monthLabels.style.gridTemplateColumns = `repeat(${totalWeekColumns}, 9px)`;

    for (let i = 0; i < leadingEmptyCells; i++) {
        const emptyCell = document.createElement("span");
        emptyCell.className = "yearly-heatmap-cell empty";
        emptyCell.setAttribute("aria-hidden", "true");
        heatmap.appendChild(emptyCell);
    }

    for (let month = 0; month < 12; month++) {
        const monthStart = new Date(currentYear, month, 1);
        const dayIndex = Math.floor((monthStart - firstDay) / 86400000);
        const columnStart = Math.floor((leadingEmptyCells + dayIndex) / 7) + 1;
        const label = document.createElement("span");

        label.className = "yearly-month-label";
        label.textContent = monthShortNames[month];
        label.style.gridColumnStart = columnStart;
        monthLabels.appendChild(label);
    }

    for (let day = 1; day <= daysInYear; day++) {
        const date = new Date(currentYear, 0, day);
        const dateKey = getDStr(date);
        const isCompleted = historySet.has(dateKey);
        const cell = document.createElement("span");

        cell.className = `yearly-heatmap-cell${isCompleted ? " completed" : ""}`;
        cell.title = t("heatmapCell", {
            date: dateKey,
            status: isCompleted ? t("completed") : t("notCompleted")
        });
        cell.setAttribute("aria-label", cell.title);
        heatmap.appendChild(cell);
    }
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
        const isSelected = el.dataset.color === selColor;
        const isSuggested = el.dataset.color === suggestedColor;

        el.classList.toggle("selected", isSelected);
        el.classList.toggle("suggested", isSuggested && !isSelected);
        el.style.setProperty("--swatch-rgb", hexToRgb(el.dataset.color));
    });
}

function updateColorPreview() {
    document.querySelectorAll(".color-preview").forEach(preview => {
        const palette = preview.closest(".color-popover");
        const mode = palette?.dataset.mode || "create";
        const streak = getActiveStreak();
        const previewColor = mode === "edit" && streak ? streak.color || "#63b3ed" : selColor;
        const previewDisplay = getColorOption(previewColor)?.display || previewColor;
        const previewEmoji = mode === "edit" && streak ? streak.emoji || "📚" : selEmoji;
        const previewRing = preview.querySelector(".color-preview-ring");
        const previewBubble = preview.querySelector(".color-preview-bubble");
        const previewIcon = preview.querySelector(".color-preview-icon");

        if (!previewRing || !previewBubble || !previewIcon) return;

        preview.style.setProperty("--preview-color", previewColor);
        preview.style.setProperty("--preview-rgb", hexToRgb(previewColor));
        previewRing.style.background = `conic-gradient(${previewColor} 72%, rgba(255,255,255,0.08) 0)`;
        previewBubble.style.background = `
            radial-gradient(circle at 30% 24%, rgba(255,255,255,0.24), rgba(255,255,255,0.08) 28%, rgba(255,255,255,0) 50%),
            ${mode === "create" ? selectedColorDisplay : previewDisplay}
        `;
        previewIcon.textContent = previewEmoji;
        previewIcon.classList.toggle("is-compound", isCompoundEmoji(previewEmoji));
    });
}


function createColorButton(color, display = color, label = "") {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "color-option";
    item.dataset.color = color;
    item.style.background = display;
    item.style.setProperty("--swatch-rgb", hexToRgb(color));
    item.setAttribute("aria-label", label || t("color"));

    item.addEventListener("click", event => {
        event.stopPropagation();
        const palette = item.closest(".color-popover");
        const mode = palette?.dataset.mode || "create";
        userHasPickedColor = true;
        colorPickerMode = mode;
        applySelectedColor(color, { display, remember: true, persist: mode === "edit", mode });
        if (palette) hideColorPopover(palette);
    });

    return item;
}

function renderRecentColors() {
    const recentColors = getRecentColors();
    document.querySelectorAll(".color-section-recent").forEach(recentSection => {
        const recentRow = recentSection.querySelector(".recent-colors-row");
        if (!recentRow) return;

        recentRow.innerHTML = "";
        recentSection.hidden = recentColors.length === 0;

        recentColors.forEach(color => {
            const option = getColorOption(color);
            recentRow.appendChild(createColorButton(color, option?.display || color, t("recentColor")));
        });
    });

    updateColorSelection();
}

function createIcons() {
    iconContainer.innerHTML = "";
    selectedIconElement = null;

    habitTemplates.forEach((template, index) => {
        const item = document.createElement("div");
        item.className = "icon-option";
        item.dataset.templateIndex = String(index);
        item.innerText = template.emoji;
        item.setAttribute("aria-label", `${t("chooseIcon")}: ${translateHabitTemplateName(template)}`);

        if (isCompoundEmoji(template.emoji)) {
            item.classList.add("is-compound");
        }

        if (index === selectedTemplateIndex) {
            item.classList.add("selected");
            selectedIconElement = item;
        }

        item.addEventListener("pointerdown", () => {
            if (selectedIconElement !== item) {
                updateIconSelection(item);
            }
        });

        item.addEventListener("click", () => {
            selectedTemplateIndex = index;
            selEmoji = template.emoji;
            suggestedColor = getSuggestedColorForTemplate(template);

            const currentName = inputName.value.trim();
            const isTemplateName = isHabitTemplateDisplayName(currentName);

            if (currentName === "" || isTemplateName) {
                inputName.value = translateHabitTemplateName(template);
            }

            updateIconSelection(item);
            updateColorSelection();

            if (!userHasPickedColor) {
                applySelectedColor(suggestedColor);
            }
        });

        iconContainer.appendChild(item);
    });
}

function createColors(palette = colorPalette) {
    const mode = palette.dataset.mode || "create";
    palette.innerHTML = "";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "color-popover-close";
    closeButton.setAttribute("aria-label", t("closeColorPicker"));
    closeButton.textContent = "x";
    closeButton.addEventListener("click", event => {
        event.stopPropagation();
        hideColorPopover(palette);
    });
    palette.appendChild(closeButton);

    const preview = document.createElement("div");
    preview.className = "color-preview";
    preview.innerHTML = `
        <div class="color-preview-ring">
            <div class="color-preview-bubble">
                <span class="color-preview-icon${isCompoundEmoji(selEmoji) ? " is-compound" : ""}">${selEmoji}</span>
            </div>
        </div>
        <div class="color-preview-copy">
            <div class="color-preview-title">${t("accent")}</div>
            <div class="color-preview-subtitle">${t("selectedColor")}</div>
        </div>
    `;
    palette.appendChild(preview);

    const recentSection = document.createElement("div");
    recentSection.className = "color-section color-section-recent";
    recentSection.innerHTML = `
        <div class="color-section-label">${t("recent")}</div>
        <div class="color-row recent-colors-row"></div>
    `;
    palette.appendChild(recentSection);

    colorGroups.forEach(group => {
        const section = document.createElement("div");
        const label = document.createElement("div");
        const row = document.createElement("div");

        section.className = "color-section";
        label.className = "color-section-label";
        label.textContent = translateColorGroupName(group.name);
        row.className = "color-row";

        group.colors.forEach(color => {
            row.appendChild(createColorButton(color.value, color.display, translateColorLabel(color.label)));
        });

        section.appendChild(label);
        section.appendChild(row);
        palette.appendChild(section);
    });

    renderRecentColors();
    updateColorSelection();
    updateColorPreview();
}

function mountColorPopover(popover) {
    if (popover && popover.parentElement !== document.body) {
        document.body.appendChild(popover);
    }
}

function positionColorPopover(popover, trigger) {
    if (!popover || !trigger) return;

    popover.classList.add("mobile-modal");
    popover.classList.remove("open-above");
    popover.style.setProperty("--popover-left", "50%");
    popover.style.setProperty("--popover-top", "50%");
}

function showColorPopover(popover, trigger) {
    mountColorPopover(popover);
    positionColorPopover(popover, trigger);
    popover.classList.add("show");
    requestAnimationFrame(() => positionColorPopover(popover, trigger));
}

function hideColorPopover(popover) {
    popover.classList.remove("show");
    window.setTimeout(() => {
        if (!popover.classList.contains("show")) {
            popover.classList.remove("open-above");
        }
    }, 240);
}

function toggleColorPopover(popover, trigger) {
    if (popover.classList.contains("show")) {
        hideColorPopover(popover);
        return;
    }

    showColorPopover(popover, trigger);
}

async function addHabit() {
    const user = currentUser;
    const name = inputName.value.trim();
    if (!user || !name) return;

    if (streaks.some(streak => streak.name.toLowerCase() === name.toLowerCase())) {
        showToast("toastAlreadyExists");
        return;
    }

    saveRecentColor(selColor);
    renderRecentColors();

    const habitId = createId();
    const newHabit = {
        id: habitId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        history: [],
        color: selColor,
        emoji: selEmoji,
        createdAt: Date.now(),
        firebaseDocId: habitId
    };

    try {
        await syncHabitToFirebase(newHabit, user);
        if (currentUser?.uid !== user.uid) return;

        streaks.push(newHabit);
        sortHabitsByPerformance();
        saveHabits("statusSavedToFirebase");
        render();

        modal.style.display = "none";
        hideColorPopover(colorPalette);
        inputName.value = "";

        console.log("FIREBASE SAVED OK, doc id:", habitId);
        showToast("toastSavedToFirebase");
    } catch (error) {
        console.error("Firestore save error full:", error);
        if (currentUser?.uid !== user.uid) return;

        streaks.push(newHabit);
        sortHabitsByPerformance();
        saveHabits("statusSavedLocallyOnly");
        render();

        modal.style.display = "none";
        hideColorPopover(colorPalette);
        inputName.value = "";

        showToast("toastSavedLocallyOnly");
    }
}

async function deleteHabit() {
    const user = currentUser;
    if (!user || !streakToDeleteId) return;

    const habitToDelete = streaks.find(streak => streak.id === streakToDeleteId);

    try {
        if (habitToDelete) {
            await deleteDoc(getUserHabitDocRef(habitToDelete, user));
            console.log("Deleted from Firebase:", habitToDelete.firebaseDocId || habitToDelete.id);
        }
        if (currentUser?.uid !== user.uid) return;
    } catch (error) {
        console.error("Firebase delete error:", error);
        showToast("toastDeleteFailed");
        return;
    }

    streaks = streaks.filter(streak => streak.id !== streakToDeleteId);

    if (activeId === streakToDeleteId) {
        activeId = null;
        calOverlay.style.display = "none";
    }

    streakToDeleteId = null;
    sortHabitsByPerformance();
    saveHabits("statusSavedToFirebase");
    render();
    deleteOverlay.style.display = "none";
    showToast("toastDeleted");
}

function bindEvents() {
    if (appEventsBound) return;
    appEventsBound = true;

    authForm.addEventListener("submit", handleAuthSubmit);
    signOutBtn.addEventListener("click", handleSignOut);
    document.querySelectorAll(".language-switcher").forEach(switcher => {
        switcher.addEventListener("click", event => {
            const button = event.target.closest(".lang-btn[data-lang], [data-lang-option]");
            if (!button || !switcher.contains(button)) return;

            event.preventDefault();
            updateLanguage(getLanguageFromButton(button));
        });
    });
    document.querySelectorAll("[data-auth-mode]").forEach(button => {
        button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
    });
    document.querySelectorAll("[data-password-toggle]").forEach(button => {
        button.addEventListener("click", () => togglePasswordVisibility(button.dataset.passwordToggle));
    });

    sContainer.addEventListener("pointerdown", event => {
        const target = event.target.closest('[data-action="open"]');
        if (!target) return;
        if (event.pointerType && event.pointerType !== "touch") return;
        if (!event.pointerType && !isTouchDevice()) return;

        pulseMobileRingDot(target);
    });

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
        colorPickerMode = "create";
        hideColorPopover(editColorPalette);
        toggleColorPopover(colorPalette, rainbowTrigger);
    });

    customColorInput.addEventListener("input", event => {
        userHasPickedColor = true;
        colorPickerMode = "create";
        applySelectedColor(event.target.value, { remember: true, mode: "create" });
    });

    editColorTrigger.addEventListener("click", event => {
        event.stopPropagation();
        const streak = getActiveStreak();
        if (!streak) return;

        colorPickerMode = "edit";
        selColor = streak.color || "#63b3ed";
        selectedColorDisplay = getColorOption(selColor)?.display || selColor;
        suggestedColor = selColor;
        hideColorPopover(colorPalette);
        updateColorSelection();
        updateColorPreview();
        toggleColorPopover(editColorPalette, editColorTrigger);
    });

    editCustomColorInput.addEventListener("input", event => {
        colorPickerMode = "edit";
        applySelectedColor(event.target.value, { remember: true, persist: true, mode: "edit" });
    });

    confirmAddBtn.addEventListener("click", addHabit);

    document.getElementById("close-modal").addEventListener("click", () => {
        modal.style.display = "none";
        hideColorPopover(colorPalette);
    });

    document.getElementById("close-cal-modal").addEventListener("click", () => {
        calOverlay.style.display = "none";
        hideColorPopover(editColorPalette);
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
        if (event.target === modal) {
            modal.style.display = "none";
            hideColorPopover(colorPalette);
        }
        if (event.target === calOverlay) {
            calOverlay.style.display = "none";
            hideColorPopover(editColorPalette);
        }
        if (event.target === deleteOverlay) deleteOverlay.style.display = "none";

        if (!colorPalette.contains(event.target) && !rainbowTrigger.contains(event.target)) {
            hideColorPopover(colorPalette);
        }

        if (!editColorPalette.contains(event.target) && !editColorTrigger.contains(event.target)) {
            hideColorPopover(editColorPalette);
        }
    });

    window.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        hideColorPopover(colorPalette);
        hideColorPopover(editColorPalette);
    });

    window.addEventListener("resize", () => {
        if (colorPalette.classList.contains("show")) positionColorPopover(colorPalette, rainbowTrigger);
        if (editColorPalette.classList.contains("show")) positionColorPopover(editColorPalette, editColorTrigger);
    });

    window.addEventListener("scroll", () => {
        if (colorPalette.classList.contains("show")) positionColorPopover(colorPalette, rainbowTrigger);
        if (editColorPalette.classList.contains("show")) positionColorPopover(editColorPalette, editColorTrigger);
    }, { passive: true });

    window.visualViewport?.addEventListener("resize", () => {
        if (colorPalette.classList.contains("show")) positionColorPopover(colorPalette, rainbowTrigger);
        if (editColorPalette.classList.contains("show")) positionColorPopover(editColorPalette, editColorTrigger);
    });

    window.visualViewport?.addEventListener("scroll", () => {
        if (colorPalette.classList.contains("show")) positionColorPopover(colorPalette, rainbowTrigger);
        if (editColorPalette.classList.contains("show")) positionColorPopover(editColorPalette, editColorTrigger);
    });
}

function loadHabitsFromFirebaseWithTimeout(user = requireCurrentUser(), timeoutMs = 8000) {
    return Promise.race([
        loadHabitsFromFirebase(user),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase timeout")), timeoutMs))
    ]);
}

function showSignedOutScreen() {
    if (colorSyncTimeout) {
        window.clearTimeout(colorSyncTimeout);
        colorSyncTimeout = null;
    }

    currentUser = null;
    closeAllOverlays();
    resetHabitState();
    setSyncStatus("");
    updateSessionUserCopy();
    authPassword.value = "";
    authScreen.hidden = false;
    appShell.hidden = true;
    setLoadingVisible(false);
}

async function showSignedInScreen(user) {
    if (colorSyncTimeout) {
        window.clearTimeout(colorSyncTimeout);
        colorSyncTimeout = null;
    }

    currentUser = user;
    authScreen.hidden = true;
    appShell.hidden = false;
    updateSessionUserCopy();
    setSyncStatus("loading");
    renderRecentColors();
    setLoadingVisible(true);

    try {
        await saveUserProfile(user, { lastLoginAt: Date.now() });
    } catch (error) {
        console.warn("User profile sync failed:", error);
    }

    try {
        await loadHabitsFromFirebaseWithTimeout(user);
    } catch (error) {
        console.warn("Firebase load failed or timed out:", error);
        if (currentUser?.uid !== user.uid) return;
        loadHabitsFromLocal(user.uid);
        render();
        saveHabits("statusLoadedLocalBackup");
        showToast("statusLoadedLocalBackup");
    } finally {
        if (currentUser?.uid === user.uid) {
            setLoadingVisible(false);
        }
    }
}

function watchAuthState() {
    onAuthStateChanged(auth, user => {
        if (user) {
            showSignedInScreen(user);
            return;
        }

        showSignedOutScreen();
    });
}

function init() {
    setAuthMode("login");
    createIcons();
    createColors(colorPalette);
    createColors(editColorPalette);
    mountColorPopover(colorPalette);
    mountColorPopover(editColorPalette);
    bindEvents();
    updateLanguage(currentLanguage, { persist: false, refreshDynamic: false });
    watchAuthState();
}

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(error => {
            console.warn("Service worker registration failed:", error);
        });
    });
}

init();
