const ALARM_NAME = "autosort";
const INTERVAL_MINUTES = 5;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: INTERVAL_MINUTES });
  // Run once immediately on install
  sortAndGroupTabs();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    sortAndGroupTabs();
  }
});

// Allow the popup to trigger a manual sort
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "sortNow") {
    sortAndGroupTabs().then(() => sendResponse({ done: true }));
    return true; // keep channel open for async response
  }
});

async function sortAndGroupTabs() {
  const { keywords = [] } = await chrome.storage.sync.get("keywords");

  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });

  for (const win of windows) {
    await sortAndGroupWindow(win.id, keywords);
  }
}

async function sortAndGroupWindow(windowId, keywords) {
  const tabs = await chrome.tabs.query({ windowId });

  // --- 1. Assign each tab to a keyword bucket (or "ungrouped") ---
  // keyword → [tab, …]  (first matching keyword wins)
  const buckets = new Map();
  const ungrouped = [];

  for (const tab of tabs) {
    const title = tab.title || "";
    let matched = false;
    for (const pattern of keywords) {
      try {
        const re = new RegExp(pattern, "i");
        const m = title.match(re);
        if (m) {
          const key = m[0].toLowerCase();
          if (!buckets.has(key)) buckets.set(key, { display: m[0], tabs: [] });
          buckets.get(key).tabs.push(tab);
          matched = true;
          break;
        }
      } catch {
        // Invalid regex — skip this pattern
      }
    }
    if (!matched) {
      ungrouped.push(tab);
    }
  }

  // --- 2. Sort tabs within each bucket alphabetically by title ---
  const sortByTitle = (a, b) =>
    (a.title || "").localeCompare(b.title || "", undefined, {
      sensitivity: "base",
    });

  for (const bucket of buckets.values()) {
    bucket.tabs.sort(sortByTitle);
  }
  ungrouped.sort(sortByTitle);

  // Sort the keyword buckets themselves alphabetically by keyword
  const sortedKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b));

  // --- 3. Build the desired tab order: keyword groups first, then ungrouped ---
  const desiredOrder = [];
  for (const key of sortedKeys) {
    desiredOrder.push(...buckets.get(key).tabs);
  }
  desiredOrder.push(...ungrouped);

  // --- 4. Move tabs into the desired order ---
  for (let i = 0; i < desiredOrder.length; i++) {
    const tab = desiredOrder[i];
    if (tab.index !== i) {
      await chrome.tabs.move(tab.id, { index: i });
    }
  }

  // --- 5. Create / update tab groups for each keyword ---
  // Track which group IDs we've assigned so we can ungroup the rest
  const usedGroupIds = new Set();

  // Re-query tabs to get updated indices after moves
  const refreshedTabs = await chrome.tabs.query({ windowId });
  const tabIdToRefreshed = new Map(refreshedTabs.map((t) => [t.id, t]));

  for (const key of sortedKeys) {
    const bucket = buckets.get(key);
    const tabIds = bucket.tabs.map((t) => t.id);
    if (tabIds.length === 0) continue;

    // Group these tabs together
    const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    usedGroupIds.add(groupId);

    // Set group title and a consistent colour
    await chrome.tabGroups.update(groupId, {
      title: bucket.display,
      color: pickColor(key),
      collapsed: false,
    });
  }

  // --- 6. Ungroup tabs that don't belong to any keyword group ---
  for (const tab of ungrouped) {
    const fresh = tabIdToRefreshed.get(tab.id);
    if (fresh && fresh.groupId !== -1 && !usedGroupIds.has(fresh.groupId)) {
      try {
        await chrome.tabs.ungroup(tab.id);
      } catch {
        // Tab may have been closed in the meantime
      }
    }
  }
}

// Deterministic colour assignment based on keyword
const GROUP_COLORS = [
  "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange",
];

function pickColor(keywordLower) {
  let hash = 0;
  for (let i = 0; i < keywordLower.length; i++) {
    hash = (hash * 31 + keywordLower.charCodeAt(i)) | 0;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}
