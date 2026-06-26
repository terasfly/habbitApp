(function () {
    const STORAGE_KEY = "appLanguage";
    const LEGACY_STORAGE_KEY = "habitAppLanguage";
    const supportedLanguages = new Set(["en", "lt"]);

    const translations = {
        en: {
            appTitle: "Habits",
            loading: "Loading...",
            language: "Language switcher",
            languageEnglish: "English",
            languageLithuanian: "Lithuanian",
            myHabits: "My Habits",
            authMode: "Authentication mode",
            logIn: "Log in",
            signUp: "Sign up",
            name: "Name",
            email: "Email",
            password: "Password",
            confirmPassword: "Confirm password",
            signOut: "Sign out",
            dailyProgress: "Daily Progress",
            masteredSectionTitle: "Mastered Habits",
            monthCompleted: "Month completed",
            newHabit: "New Habit",
            habit: "Habit",
            habitName: "Habit Name",
            color: "Color",
            create: "Create",
            cancel: "Cancel",
            close: "Close",
            deleteQuestion: "Delete?",
            deleteWarning: "All history will be lost.",
            no: "No",
            yes: "Yes",
            yearlyProgress: "Yearly Progress",
            yearlyHeatmapLabel: "Yearly habit activity heatmap",
            chooseCustomColor: "Choose custom color",
            changeHabitColor: "Change habit color",
            chooseHabitColor: "Choose habit color",
            targetQuestion: "Goal",
            targetFrequency: "Habit frequency",
            targetEveryDay: "Daily",
            targetTwoPerWeek: "2 / week",
            targetThreePerWeek: "3 / week",
            targetFourPerWeek: "4 / week",
            targetFivePerWeek: "5 / week",
            targetCustom: "Custom",
            targetCustomLabel: "Times / week",
            notification: "Notification",
            dailyReminder: "Daily reminder",
            enableDailyReminder: "Enable daily reminder",
            disableDailyReminder: "Disable daily reminder",
            reminderTime: "Reminder time",
            notificationStatusLabel: "Notification status",
            openApp: "Open app",
            ok: "OK"
        },
        lt: {
            appTitle: "Įpročiai",
            loading: "Kraunama...",
            language: "Kalbos perjungiklis",
            languageEnglish: "Anglų",
            languageLithuanian: "Lietuvių",
            myHabits: "Mano įpročiai",
            authMode: "Prisijungimo režimas",
            logIn: "Prisijungti",
            signUp: "Registruotis",
            name: "Vardas",
            email: "El. paštas",
            password: "Slaptažodis",
            confirmPassword: "Pakartok slaptažodį",
            signOut: "Atsijungti",
            dailyProgress: "Dienos progresas",
            masteredSectionTitle: "Įpročiai įtvirtinti",
            monthCompleted: "Mėnuo įvykdytas",
            newHabit: "Naujas įprotis",
            habit: "Įprotis",
            habitName: "Įpročio pavadinimas",
            color: "Spalva",
            create: "Sukurti",
            cancel: "Atšaukti",
            close: "Uždaryti",
            deleteQuestion: "Ištrinti?",
            deleteWarning: "Visa istorija bus prarasta.",
            no: "Ne",
            yes: "Taip",
            yearlyProgress: "Metų progresas",
            yearlyHeatmapLabel: "Metinis įpročio aktyvumo žemėlapis",
            chooseCustomColor: "Pasirink pasirinktinę spalvą",
            changeHabitColor: "Keisti įpročio spalvą",
            chooseHabitColor: "Pasirink įpročio spalvą",
            targetQuestion: "Tikslas",
            targetFrequency: "Įpročio dažnis",
            targetEveryDay: "Kasdien",
            targetTwoPerWeek: "2 / sav.",
            targetThreePerWeek: "3 / sav.",
            targetFourPerWeek: "4 / sav.",
            targetFivePerWeek: "5 / sav.",
            targetCustom: "Pasirinktinai",
            targetCustomLabel: "Kartai / sav.",
            notification: "Pranešimas",
            dailyReminder: "Dienos priminimas",
            enableDailyReminder: "Įjungti dienos priminimą",
            disableDailyReminder: "Išjungti dienos priminimą",
            reminderTime: "Priminimo laikas",
            notificationStatusLabel: "Pranešimų būsena",
            openApp: "Atidaryti app",
            ok: "OK"
        }
    };

    function normalizeLanguage(lang) {
        return supportedLanguages.has(lang) ? lang : "en";
    }

    function getSavedLanguage() {
        try {
            const savedLanguage = localStorage.getItem(STORAGE_KEY);
            const legacyLanguage = localStorage.getItem(LEGACY_STORAGE_KEY);
            const language = normalizeLanguage(savedLanguage || legacyLanguage);

            if (!savedLanguage && legacyLanguage) {
                localStorage.setItem(STORAGE_KEY, language);
            }

            return language;
        } catch (error) {
            return "en";
        }
    }

    function translate(lang, key) {
        return translations[lang]?.[key] || translations.en[key] || key;
    }

    function setLanguageStorage(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (error) {
            console.warn("Language preference could not be saved:", error);
        }
    }

    function updateLanguage(lang) {
        const language = normalizeLanguage(lang);
        document.documentElement.lang = language;
        document.title = translate(language, "appTitle");
        setLanguageStorage(language);

        document.querySelectorAll("[data-i18n]").forEach(element => {
            element.textContent = translate(language, element.dataset.i18n);
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
            element.setAttribute("placeholder", translate(language, element.dataset.i18nPlaceholder));
        });

        document.querySelectorAll("[data-i18n-aria-label]").forEach(element => {
            element.setAttribute("aria-label", translate(language, element.dataset.i18nAriaLabel));
        });

        document.querySelectorAll(".lang-btn[data-lang], [data-lang-option]").forEach(button => {
            const buttonLanguage = button.dataset.lang || button.dataset.langOption;
            const isActive = buttonLanguage === language;

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });
    }

    function bindLanguageSwitcher() {
        document.querySelectorAll(".language-switcher").forEach(switcher => {
            switcher.addEventListener("click", event => {
                const button = event.target.closest(".lang-btn[data-lang], [data-lang-option]");
                if (!button || !switcher.contains(button)) return;

                event.preventDefault();
                updateLanguage(button.dataset.lang || button.dataset.langOption);
            });
        });
    }

    function initLanguageSwitcher() {
        bindLanguageSwitcher();
        updateLanguage(getSavedLanguage());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initLanguageSwitcher, { once: true });
    } else {
        initLanguageSwitcher();
    }
})();
