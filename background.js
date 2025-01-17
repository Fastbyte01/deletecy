let sites = {};
const subdomains = [
  "www", "support", "mail", "ssl", "new", "cgi1", "en", "myaccount", "meta",
  "help", "edit", "it", "da", "de", "fr", "es"
];

// Function to update the sites list
async function updateSites() {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/Fastbyte01/Deletecy/master/sites.json"
    );
    if (response.ok) {
      sites = await response.json();
      chrome.storage.local.set({
        sites: sites,
        lastUpdated: Date.now(),
      });
      console.log("Sites updated successfully.");
    } else {
      console.error("Failed to fetch sites:", response.statusText);
    }
  } catch (error) {
    console.error("Error fetching sites.json:", error);
  }
}

// Wrapper function to handle async chrome.storage.local.get
function getStorageData(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
}

// Function to initialize and run the updater
async function runUpdater() {
  try {
    const { sites: cachedSites, lastUpdated } = await getStorageData([
      "sites",
      "lastUpdated",
    ]);

    if (cachedSites) {
      sites = cachedSites;
      if (Date.now() - (lastUpdated || 0) > 86400000) {
        await updateSites();
      }
    } else {
      await updateSites();
    }
  } catch (error) {
    console.error("Error accessing storage:", error);
  }
}

// Function to extract hostname from URL
function getHostname(url, optsStrict = false) {
  const urlObj = new URL(url);

  if (optsStrict) {
    return urlObj.hostname;
  }

  let hostname = urlObj.hostname;
  subdomains.forEach((sub) => {
    hostname = hostname.replace(`${sub}.`, "");
  });

  return hostname;
}

// Function to get site info for a specific URL
function getInfo(url) {
  const strictHostname = getHostname(url, true);

  for (const site of Object.values(sites)) {
    for (const domain of site.domains) {
      if (domain.includes(strictHostname)) {
        return site;
      }
    }
  }

  const relaxedHostname = getHostname(url, false);
  for (const site of Object.values(sites)) {
    for (const domain of site.domains) {
      if (domain.includes(relaxedHostname)) {
        return site;
      }
    }
  }

  return false;
}

// Listener for requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getSiteInfo" && message.url) {
    const info = getInfo(message.url);
    sendResponse({ info });
  }
  return true; // Indicates asynchronous response
});

// Update icon and title on tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    const info = getInfo(tab.url);

    if (info) {
      chrome.action.setTitle({ tabId, title: `${info.name}: ${info.notes || "No notes"}` });
      chrome.action.setIcon({
        tabId,
        path: `img/icon_${info.difficulty}_38.png`, // Assumes icons for difficulty levels
      });
      chrome.action.enable(tabId);
    } else {
      chrome.action.setTitle({ tabId, title: "No account deletion info available" });
      chrome.action.setIcon({ tabId, path: "img/icon_48.png" });
      chrome.action.disable(tabId);
    }
  }
});

// Initialize the updater
runUpdater();
