// Function to determine the category based on event title
function getCategoryForTitle(title) {
    if (!title) return null; // Return null if no title is provided
    const t = title.toLowerCase(); // Convert title to lowercase for case-insensitive matching

    console.log(`[AutoCategorizeCalendar] Checking title: "${title}"`);

    // Match specific keywords in the event title to assign a category
    if (t.includes("running")) {
        console.log(`[AutoCategorizeCalendar] Matched category: Private`);
        return "Private";
    }
    if (t.includes("nm")) {
        console.log(`[AutoCategorizeCalendar] Matched category: Studies`);
        return "Studies";
    }

    console.log(`[AutoCategorizeCalendar] No category matched.`);
    return null; // Return null if no category matches
}

/**
 * Handles automatic categorization of calendar events.
 * This function is triggered when an event is created or updated.
 */
async function autoCategorizeEvent(eventItem) {
    try {
        console.log(`[AutoCategorizeCalendar] Processing event:`, eventItem);

        // I am using this version of ical.js: https://unpkg.com/ical.js/dist/ical.es5.cjs
        
        // Convert the event's jCal data to an ICAL component
        const comp = new ICAL.Component(eventItem.item);
        const vevent = comp.getFirstSubcomponent("vevent");

        if (!vevent) {
            console.warn(`[AutoCategorizeCalendar] No VEVENT found in the event item.`);
            return;
        }

        // Extract the event title (summary)
        const summary = vevent.getFirstPropertyValue("summary");
        if (!summary) {
            console.warn(`[AutoCategorizeCalendar] Event has no summary, skipping categorization.`);
            return;
        }

        // Determine the category based on the title
        const category = getCategoryForTitle(summary);
        if (!category) return; // Skip if no category is matched

        // Remove existing 'categories' properties to prevent duplicates
        vevent.removeAllProperties("categories");
        // Add the determined category
        vevent.addPropertyWithValue("categories", category);

        // Convert the updated event back to jCal format
        const updatedItem = comp.toJSON();
        console.log("[AutoCategorizeCalendar] Updated jCal item:", updatedItem);

        // Update the event in the calendar
        await browser.calendar.items.update(eventItem.calendarId, eventItem.id, {
            format: "jcal",
            item: updatedItem
        });

        console.log(`[AutoCategorizeCalendar] Successfully added category "${category}" to event`);
    } catch (error) {
        // More detailed error handling for debugging
        if (error instanceof DOMException) {
            console.error("[AutoCategorizeCalendar] DOMException:", error.name, "-", error.message);
        } else {
            console.error("[AutoCategorizeCalendar] General error:", error);
        }
    }
}

// Listen for newly created events and categorize them
browser.calendar.items.onCreated.addListener(autoCategorizeEvent, { returnFormat: "jcal" });

// Listen for updated events and reapply categorization
browser.calendar.items.onUpdated.addListener(autoCategorizeEvent, { returnFormat: "jcal" });

