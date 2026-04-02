const listEl = document.getElementById("keywordList");
const inputEl = document.getElementById("newKeyword");
const addBtn = document.getElementById("addBtn");
const sortNowBtn = document.getElementById("sortNowBtn");

// --- Render ---
async function render() {
  const { keywords = [] } = await chrome.storage.sync.get("keywords");
  listEl.innerHTML = "";
  for (const kw of keywords) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = kw;

    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "\u00d7";
    btn.addEventListener("click", () => removeKeyword(kw));

    li.appendChild(span);
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

// --- Add ---
async function addKeyword() {
  const value = inputEl.value.trim();
  if (!value) return;

  const { keywords = [] } = await chrome.storage.sync.get("keywords");
  if (keywords.some((k) => k.toLowerCase() === value.toLowerCase())) {
    inputEl.value = "";
    return; // duplicate
  }
  keywords.push(value);
  await chrome.storage.sync.set({ keywords });
  inputEl.value = "";
  render();
}

// --- Remove ---
async function removeKeyword(kw) {
  const { keywords = [] } = await chrome.storage.sync.get("keywords");
  const updated = keywords.filter((k) => k !== kw);
  await chrome.storage.sync.set({ keywords: updated });
  render();
}

// --- Sort Now ---
sortNowBtn.addEventListener("click", () => {
  sortNowBtn.textContent = "Sorting\u2026";
  sortNowBtn.disabled = true;
  chrome.runtime.sendMessage({ action: "sortNow" }, () => {
    sortNowBtn.textContent = "Done!";
    setTimeout(() => {
      sortNowBtn.textContent = "Sort Now";
      sortNowBtn.disabled = false;
    }, 1000);
  });
});

addBtn.addEventListener("click", addKeyword);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addKeyword();
});

render();
