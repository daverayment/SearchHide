/* global chrome */

function saveOptions() {
    const sitesArr = [];

    document.getElementById("sites").value.split("\n").forEach((site) => {
        site = site.trim();
        if (!sitesArr.includes(site) && site.length > 0) {
            sitesArr.push(site);
        }
    });

    chrome.storage.sync.set({"hidden_sites": sitesArr}, function() {
        // Update status to let user know options were saved.
        const status = document.getElementById("status");
        status.textContent = "Saved";
        setTimeout(function() {
            status.textContent = "";
        }, 750);
    });
}
  
function restoreOptions() {
    chrome.storage.sync.get(["hidden_sites"], function(items) {
        if (items.hidden_sites !== undefined) {
            document.getElementById("sites").value =
                items.hidden_sites.join("\n");
        }
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
