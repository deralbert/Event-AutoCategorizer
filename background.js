import ICAL from './libs/ical.js';

/**
 * Mapping of category names to their associated keywords.
 */
const CATEGORY_MAP = {
    Studies: ["ods", "eem", "sidi", "fe", "csp", "eün", "pe", "nm", "lsd"],
    Private: ["unterhaltung"]
};

/**
 * Determines the category for a given event title based on predefined keywords.
 * @param {string} title - The event title.
 * @returns {string|null} - The determined category or null if no match is found.
 */
function getCategoryForTitle(title) {
    if (!title) return null;
    const t = title.toLowerCase();
    return Object.entries(CATEGORY_MAP).find(([_, keywords]) => keywords.some(k => t.includes(k)))?.[0] || null;
}

/**
 * Categorizes a calendar event by updating its categories based on the title.
 * @param {Object} eventItem - The calendar event item.
 */
async function autoCategorizeEvent(eventItem) {
    try {
        const comp = new ICAL.Component(eventItem.item);
        const vevent = comp.getFirstSubcomponent("vevent");
        if (!vevent) return;

        const summary = vevent.getFirstPropertyValue("summary");
        if (!summary) return;

        const category = getCategoryForTitle(summary);
        if (!category) return;

        const existingCategories = vevent.getAllProperties("categories").map(prop => prop.getFirstValue());
        if (existingCategories.includes(category)) return;

        vevent.removeAllProperties("categories");
        vevent.addPropertyWithValue("categories", category);

        await browser.calendar.items.update(eventItem.calendarId, eventItem.id, {
            format: "jcal",
            item: comp.toJSON()
        });
    } catch (error) {
        console.error("[Event-AutoCategorizer] Error:", error);
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
 * Categorizes past calendar events from the last 7 days upon Thunderbird startup.
 */
async function autoCategorizePastEvents() {
    try {
        const now = new Date();
        const pastWeek = new Date(now);
        pastWeek.setDate(now.getDate() - 7);

        const events = await browser.calendar.items.query({
            rangeStart: toJCalDate(pastWeek),
            rangeEnd: toJCalDate(now),
            returnFormat: "jcal"
        });

        if (!events?.length) return;

        for (const eventItem of events) {
            await autoCategorizeEvent(eventItem);
        }
    } catch (error) {
        console.error("[Event-AutoCategorizer] Error fetching past events:", error);
    }
}

// Register event listeners for newly created and updated calendar events
browser.calendar.items.onCreated.addListener(autoCategorizeEvent, { returnFormat: "jcal" });
browser.calendar.items.onUpdated.addListener(autoCategorizeEvent, { returnFormat: "jcal" });

// Run past event categorization once when Thunderbird starts
(async () => await autoCategorizePastEvents())();
