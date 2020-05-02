"use strict";
/* global chrome */

/**
 * How the 'Result hidden' element is added to the DOM. Varies by provider.
 */
const HiddenLinkPlacement = Object.freeze({
    "Prepend": 1,
    "InsertBefore": 2
});

class Provider {
    constructor(name, resultClass, hiddenLinkPlacement = HiddenLinkPlacement.Prepend) {
        this.name = name;
        this.resultClass = resultClass;
        this.hiddenLinkPlacement = hiddenLinkPlacement;
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
        if (this.hiddenLinkPlacement === HiddenLinkPlacement.InsertBefore) {
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
        observer.disconnect();
        const resultElement = this.getResultFromHideLink(ev.target);
        resultElement.classList.remove("hidden");
        resultElement.classList.add("unhidden");
        ev.currentTarget.remove();
        ev.stopPropagation();
        setupObserver();
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
        return new Provider("Duck Duck Go", "result__body links_main",
            HiddenLinkPlacement.Prepend);
    }
    else if (hostname.includes(".bing.")) {
        return new Provider("Bing", "b_algo");
    }
    else if (hostname.includes(".google.")) {
        return new Provider("Google", "rc", HiddenLinkPlacement.Prepend);
    }
    else if (hostname.includes("search.yahoo.com")) {
        return new Provider("Yahoo", "algo-sr");
    }
    else if (hostname.includes(".ask.com")) {
        return new Provider("Ask.com", "PartialSearchResults-item");
    }
    else if (hostname.includes("yandex.ru")) {
        return new Provider("Yandex", "serp-item");
    }
    else if (hostname.includes("searchencrypt.com")) {
        return new Provider("SearchEncrypt", "web-result");
    }
    // else if (hostname.includes(".baidu.com")) {
    //     let p = new Provider("Baidu", "result c-container");
    //     p.getLinkFromResultElement = (result) => {
    //         let hrefs = Array.from(result.getElementsByTagName("a"))
    //             .filter(x => x.classList.contains("c-showurl"))
    //             .map(x => x.innerText);
    //         if (hrefs.length > 0) {
    //             return new URL(hrefs[0].trim()).href.toString();
    //         }
    //     }
    //     return p;
    // }
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
    if (hiddenSites === undefined || hiddenSites.length === 0) { return false; }
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

function processResults(results) {
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
}

function processSearchPage() {
    waitForElements()
        .then(results => processResults(results))
        .catch(reason => console.error(reason));
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

let observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        console.log(mutation.type);
    });
    processSearchPage(); 
});

/**
 * For providers which load new results dynamically.
 */
async function setupObserver() {
    if (searchProvider.name === "Duck Duck Go" ||
        searchProvider.name === "SearchEncrypt") {
        // DDG observation point
        let query = "div.results--main";
        if (searchProvider.name === "SearchEncrypt") {
            query = "div#app";
        }
        while (document.querySelector(query) === null) {
            await new Promise(r => setTimeout(r, 500));
        }
        observer.observe(document.querySelector(query), {
            subtree: true,
            childList: true
        });
        console.log(`Observer setup for ${searchProvider.name}`);
    }
}

setupObserver();
processSearchPage();
