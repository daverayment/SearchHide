// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//     // console.log(request);
//     // console.log(sender);

//     if (request.cmd == "link_click") {
//         self.hiddenSites.push(new URL(request.href).hostname);
//         chrome.storage.sync.set({"hidden_sites": hiddenSites});
//     }
// });

// chrome.runtime.onMessage.addListener(function(request) {
//     console.log(request);
//     if(request.cmd == "create_menu") {
//         chrome.contextMenus.removeAll(function() {
//             console.log("Trying to create context menu...");
//             chrome.contextMenus.create({
//                 "title" : "TEST BLOCK",
//                 "type" : "normal",
//                 "contexts" : ["link"],
//                 "onclick" : getClickHandler()
//             });
//         });
//     }
//     else if(request.cmd == "delete_menu") {
//         chrome.contextMenus.removeAll();
//     }
// });