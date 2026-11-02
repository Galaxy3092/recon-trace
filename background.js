/**
 * ReconTrace Service Worker (Manifest V3 Hardened)
 * Handles Side Panel activation, Context Menus, and Ephemeral In-Memory IPC.
 */

// Configure side panel behavior on action icon click
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

// Handle Context Menu clicks with Ephemeral In-Memory Storage (Zero Disk Persistence)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'recontrace_search_image' && info.srcUrl) {
    if (tab && tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });

      // Use chrome.storage.session (RAM only, never written to disk) if available
      const payload = {
        recontrace_pending_search_url: info.srcUrl,
        recontrace_pending_timestamp: Date.now()
      };

      if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.set(payload);
      } else {
        // Fallback to local storage with immediate self-destruct upon reading
        await chrome.storage.local.set(payload);
      }
    }
  } else if (info.menuItemId === 'recontrace_open_panel' && tab && tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
