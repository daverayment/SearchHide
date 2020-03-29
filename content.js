"use strict";
/* global chrome */

class Provider {
    constructor(name, resultClass) {
        this.name = name;
        this.resultClass = resultClass;
    }
    /**
     * Returns an HTMLCollectionOf<Element> representing the individual search
     * page elements which require processing, i.e. those which have not already
     * been hidden.
     */
    getResultElements() {
        return Array.from(document.getElementsByClassName(this.resultClass))
            .filter((element) => !element.classList.contains("hidden"));
    }
    /**
     * Locate and extract the HREF from a single search page result.
     * @param {Element} resultElement - The search page result element.
     * @param {string} [linkClass] - The link element's class. If present, this will be used instead of just looking for anchor tags.
     * @returns {string} - The URL, or "" if not found.
     */
    getLinkFromResultElement(resultElement, linkClass) {
        let resultHrefs = undefined;
        if (typeof(linkClass) === "undefined") {
            resultHrefs = resultElement.getElementsByTagName("a");
        }
        else {
            resultHrefs = resultElement.getElementsByClassName(linkClass);
        }
        return resultHrefs.length === 0 ? "" : resultHrefs[0].href.toString();
    }
    /**
     * Locate the search result associated with a 'Hide result' link.
     * @param {Element} linkElement - The 'Hide result' link.
     */
    getResultFromHideLink(linkElement) {
        let result = undefined;
        if (this.name === "Bing" || this.name === "Yahoo") {
            result = linkElement.nextElementSibling;
        }
        else {
            result = linkElement.parentElement.getElementsByClassName(this.resultClass)[0];
        }
        return result;
    }
    /**
     * Replace a result with 'Result hidden' text.
     * @param {Element} result - The result element.
     */
    hideResult(result) {
        const noteDiv = this.createResultHiddenElement(result);
        // TODO: messy
        if (this.name === "Bing" || this.name === "Yahoo") {
            result.parentElement.insertBefore(noteDiv, result);
        }
        else {
            result.parentElement.prepend(noteDiv);
        }
        result.classList.add("hidden");
    }
    /**
     * Create the 'Result hidden (<domain>)' element.
     * @param {Element} result - The search result element.
     */
    createResultHiddenElement(result) {
        const noteDiv = document.createElement("div");
        noteDiv.innerHTML = chrome.i18n.getMessage("resultHidden") +
            ` (${new URL(this.getLinkFromResultElement(result)).hostname})`;
        noteDiv.classList.add('result-hidden');
        // When the 'Result hidden' text is clicked, unhide the
        // result.
        noteDiv.addEventListener("click", ev => this.unhideResult(ev));
        return noteDiv;
    }
    /**
     * Show a previously-hidden result when our message is clicked.
     * @param {Event} ev - The mouse click event trigger.
     */
    unhideResult(ev) {
        const resultElement = this.getResultFromHideLink(ev.target);
        resultElement.classList.remove("hidden");
        resultElement.classList.add("unhidden");
        ev.currentTarget.remove();
        ev.stopPropagation();
    }
    /**
     * Add our 'Hide' link to a specific search result.
     * @param {Element} result - The search result element to add our link to.
     */
    addLink(result) {
        const a = document.createElement("a");
        a.appendChild(document.createTextNode(chrome.i18n.getMessage("hidePrompt")));
        a.title = chrome.i18n.getMessage("hidePromptTitle");
        a.href = "javascript:;";
        a.className = "hide-result-link";
        const resultLink = this.getLinkFromResultElement(result);
        if (resultLink.length === 0) {
            return;
        }
        a.setAttribute("data-link", resultLink);
        // When the user clicks on the link, add to the list of hidden sites.
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
}

let searchProvider = function () {
    const hostname = document.domain;
    if (hostname.startsWith("duckduckgo.")) {
        return new Provider("Duck Duck Go", "result__body links_main");
    }
    else if (hostname.includes(".bing.")) {
        return new Provider("Bing", "b_algo");
    }
    else if (hostname.includes(".google.")) {
        return new Provider("Google", "rc");
    }
    else if (hostname.includes("search.yahoo.com")) {
        let p = new Provider("Yahoo", "algo-sr");
        p.getResultElements = () => {
            return Array.from(document.querySelectorAll("div.algo-sr"))
                .map(x => x.parentElement)
                .filter(x => !x.classList.contains("hidden"));
        }
        return p;
    }
    else {
        return new Provider("Unknown", "");
    }
}();

Object.freeze(searchProvider);

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
    while(searchProvider.getResultElements().length === 0) {
        await new Promise(r => setTimeout(r, 500));
    }
    return searchProvider.getResultElements();
}

function processSearchPage() {
    waitForElements()
        .then((results) => {
            const resultElements = results;

            // Get the user's preferences from storage
            chrome.storage.sync.get(["hidden_sites"], (stored) => {
                for (const result of resultElements) {
                    const link = searchProvider.getLinkFromResultElement(result);
                    if (shouldHide(link, stored.hidden_sites)) {
                        searchProvider.hideResult(result);
                    }
                    else {
                        result.classList.remove("hidden");
                    }
                    // Add the link if it is not present already
                    if (result.lastChild.text === undefined ||
                        result.lastChild.text !== chrome.i18n.getMessage("hidePrompt")) {
                        searchProvider.addLink(result);
                    }
                }
            })
        })
        .catch(reason => console.error(reason)
    );
}

/**
 * When the hidden sites list is altered, process the page again.
 */
chrome.storage.onChanged.addListener((changes) => {
    if (changes.hidden_sites !== undefined &&
        changes.hidden_sites.newValue !== undefined) {
        changes.hidden_sites.newValue.forEach((site) => {
            console.log(site);
        });
    }

    processSearchPage();
});

processSearchPage();
