"use strict";
/* global chrome */

// TODO: make generic
/**
 * Returns an HTMLCollectionOf<Element> representing the individual search
 * page elements which require processing.
 */
function getResultElements() {
    return document.getElementsByClassName("result__body links_main");
}

// TODO: make generic
/**
 * Locate and extract the HREF from a single search page result.
 * @param {Element} resultElement - The search page result element.
 */
function getLinkFromResult(resultElement) {
    const resultHrefs = resultElement.getElementsByClassName("result__a");
    return resultHrefs.length === 0 ? "" : resultHrefs[0].href.toString();
}

/**
 * Determine whether a result should be hidden on the page.
 * @param {string} link - The link to examine.
 * @param {*} hiddenSites - The array of site hostnames the user wants to hide.
 */
function shouldHide(link, hiddenSites) {
    return hiddenSites.includes(new URL(link).hostname);
}

/**
 * Wait until the search page has finished rendering and the results are
 * available to process.
 */
async function waitForElements() {
    while(getResultElements().length === 0) {
        await new Promise(r => setTimeout(r, 500));
    }
    return getResultElements();
}

waitForElements()
    .then((results) => {
        const resultElements = results;

        // Get the user's preferences from storage
        chrome.storage.sync.get(["hidden_sites"], (stored) => {
            for (const result of resultElements) {
                const link = getLinkFromResult(result);
                if (shouldHide(link, stored.hidden_sites)) {
                    // Replace the result with 'Result hidden' text.
                    const noteDiv = document.createElement("div");
                    noteDiv.innerHTML = chrome.i18n.getMessage("resultHidden") +
                        ` (${new URL(link).hostname})`;
                    noteDiv.setAttribute('data-resultid', result.id);
                    noteDiv.classList.add('hide-link');
                    // When the 'Result hidden' text is clicked, unhide the
                    // result.
                    noteDiv.addEventListener("click", function(ev) {
                        const target = ev.currentTarget.parentElement.getElementsByClassName("result__body links_main")[0];
                        target.classList.remove("hidden");
                        target.classList.add("unhidden");
                        ev.currentTarget.remove();
                        ev.stopPropagation();
                    });
                    result.parentElement.prepend(noteDiv);
                    result.classList.add("hidden");
                }
                else {
                    result.classList.remove("hidden");
                }
                addLink(result);
            }
        })
    })
    .catch(reason => console.error(reason)
);

/**
 * Add our 'Hide' link to a specific search result.
 * @param {Element} result - The search result element to add our link to.
 */
function addLink(result) {
    const a = document.createElement("a");
    a.appendChild(document.createTextNode(chrome.i18n.getMessage("hidePrompt")));
    a.title = chrome.i18n.getMessage("hidePromptTitle");
    a.href = "javascript:;";
    const result_hrefs = result.getElementsByClassName("result__a");
    if (result_hrefs.length === 0) {
        return;
    }
    a.setAttribute("data-link", result_hrefs[0].href.toString());
    a.addEventListener("click", function(mouse_event) {
        chrome.storage.sync.get(["hidden_sites"], (result) => {
            let hiddenSites = result.hidden_sites;
            if (hiddenSites === undefined) {
                hiddenSites = [];
            }
            const hostname = new URL(mouse_event.target.dataset.link).hostname;
            if (!hiddenSites.includes(hostname)) {
                hiddenSites.push(hostname);
            }
            chrome.storage.sync.set({"hidden_sites": hiddenSites});
        });
        event.stopPropagation();
    });

    // TODO: separate from surrounding clickable div to prevent accidental
    // navigation to the site itself
    result.appendChild(a);
}

chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (var key in changes) {
        var storageChange = changes[key];
        console.log('Storage key "%s" in namespace "%s" changed. ' +
                    'Old value was "%s", new value is "%s".',
                    key,
                    namespace,
                    storageChange.oldValue,
                    storageChange.newValue);
    }
});