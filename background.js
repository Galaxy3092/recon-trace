/**
 * ReconTrace Service Worker (Manifest V3)
 * Handles Side Panel activation, Context Menus, and Proxy Configuration.
 */

// Open side panel on action icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Side panel behavior error:', error));

// Register Context Menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'recontrace_search_image',
    title: '🎯 Investigate with ReconTrace',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'recontrace_open_panel',
    title: '📂 Open ReconTrace Mission Panel',
    contexts: ['page']
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'recontrace_search_image' && info.srcUrl) {
    // Open side panel for the active window
    if (tab && tab.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
        // Send message to side panel with image URL
        chrome.storage.local.set({
          recontrace_pending_search_url: info.srcUrl,
          recontrace_pending_timestamp: Date.now()
        });
      });
    }
  } else if (info.menuItemId === 'recontrace_open_panel' && tab && tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
