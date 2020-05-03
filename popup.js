"use strict";
/* global chrome */

document.getElementById("hide").addEventListener("click", function () {
    chrome.storage.sync.get(["hidden_sites"], (result) => {
        let hiddenSites = result.hidden_sites;
        if (hiddenSites === undefined) {
            hiddenSites = [];
        }

        chrome.tabs.query({ active: true, currentWindow: true },
            function(tabs) {
                let url = new URL(tabs[0].url);
                if (!hiddenSites.includes(url.hostname)) {
                    hiddenSites.push(url.hostname);
                }
                chrome.storage.sync.set({"hidden_sites": hiddenSites});
            }
        );
    });
});
