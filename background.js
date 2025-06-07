import ICAL from './libs/ical.js';

/**
 * Mapping of category names to their associated keywords.
 */
const CATEGORY_MAP = {
    Studies: ["ods", "eem", "sidi", "fe", "csp", "eün", "pe", "nm", "lsd", "rls", "sst", "bbzs", "esuemv", "wfem"],
    Private: ["unterhaltung"],
    Sport: ["laufen", "gehen", "statischer sport"],
    Organization: ["Organisation"],
    Household: ["Haushalt"],
    Health: ["Gesundheit"],
    SelfCare: ["Selbstpflege"],
    Food: ["Nahrung"]
};

/**
 * Determines the category for a given item title based on predefined keywords.
 * @param {string} title - The item title.
 * @returns {string|null} - The determined category or null if no match is found.
 */
function getCategoryForTitle(title) {
    if (!title) return null;

    const normalizedTitle = title.toLowerCase();
    const words = normalizedTitle.split(/[^a-zäöüß]+/u).filter(Boolean);

    return Object.entries(CATEGORY_MAP).find(([_, keywords]) =>
        keywords.some(keyword => {
            const k = keyword.toLowerCase();
            // Match exact word or full phrase
            return words.includes(k) || normalizedTitle.includes(` ${k} `) ||
                normalizedTitle.startsWith(`${k} `) || normalizedTitle.endsWith(` ${k}`) ||
                normalizedTitle === k;
        })
    )?.[0] || null;
}

/**
 * Categorizes a calendar item (event or task) by updating its categories based on the title.
 * @param {Object} item - The calendar item.
 */
async function autoCategorizeItem(item) {
    try {
        const comp = new ICAL.Component(item.item);
        const subcomponents = ["vevent", "vtodo"];

        for (const type of subcomponents) {
            const entry = comp.getFirstSubcomponent(type);
            if (!entry) continue;

            const summary = entry.getFirstPropertyValue("summary");
            if (!summary) continue;

            const category = getCategoryForTitle(summary);
            if (!category) continue;

            const existingCategories = entry.getAllProperties("categories").map(p => p.getFirstValue());
            if (existingCategories.includes(category)) continue;

            entry.removeAllProperties("categories");
            entry.addPropertyWithValue("categories", category);

            await browser.calendar.items.update(item.calendarId, item.id, {
                format: "jcal",
                item: comp.toJSON()
            });

            break; // stop after categorizing first matching subcomponent
        }
    } catch (error) {
        console.error("[AutoCategorizer] Error:", error);
    }
}

/**
 * Converts a JavaScript Date object to jCal-compatible date-time format.
 * @param {Date} date - The JavaScript Date object.
 * @returns {string} - The formatted jCal date string.
 */
function toJCalDate(date) {
    return date.toISOString().replace(/[-:]/g, "");
}

/**
 * Categorizes past calendar items from the last 7 days upon Thunderbird startup.
 */
async function autoCategorizePastItems() {
    try {
        const now = new Date();
        const pastWeek = new Date(now);
        pastWeek.setDate(now.getDate() - 7);

        const items = await browser.calendar.items.query({
            rangeStart: toJCalDate(pastWeek),
            rangeEnd: toJCalDate(now),
            returnFormat: "jcal"
        });

        if (!items?.length) return;

        for (const item of items) {
            await autoCategorizeItem(item);
        }
    } catch (error) {
        console.error("[AutoCategorizer] Error fetching past items:", error);
    }
}

// Register event listeners for newly created and updated calendar items
browser.calendar.items.onCreated.addListener(autoCategorizeItem, { returnFormat: "jcal" });
browser.calendar.items.onUpdated.addListener(autoCategorizeItem, { returnFormat: "jcal" });

// Run past event categorization once when Thunderbird starts
autoCategorizePastItems().catch(error => console.error("[AutoCategorizer] Startup Error:", error));
