const { contextBridge, ipcRenderer } = require('electron')

console.log('[Preload] Initializing preload script')

const apiHandler = {
  selectFolder: () => {
    console.log('[Preload] selectFolder called')
    return ipcRenderer.invoke('select-folder')
  },
  fetchResources: (link, filters) => {
    console.log('[Preload] fetchResources called with link:', link)
    return ipcRenderer.invoke('fetch-resources', link, filters)
  },
  deepSearchWayback: (searchTerm, options) => {
    console.log('[Preload] deepSearchWayback called with term:', searchTerm)
    return ipcRenderer.invoke('deep-search-wayback', searchTerm, options)
  },
  findDeletedYoutubeVideo: (videoId) => {
    console.log('[Preload] findDeletedYoutubeVideo called with ID:', videoId)
    return ipcRenderer.invoke('find-deleted-youtube-video', videoId)
  },
  downloadYoutubeVideo: (videoUrl, title) => {
    console.log('[Preload] downloadYoutubeVideo called')
    return ipcRenderer.invoke('download-youtube-video', videoUrl, title)
  },
  searchYoutubeByTerm: (searchTerm, searchType) => {
    console.log('[Preload] searchYoutubeByTerm called with term:', searchTerm, 'type:', searchType)
    return ipcRenderer.invoke('search-youtube-by-term', searchTerm, searchType)
  },
  downloadResource: (opts) => {
    console.log('[Preload] downloadResource called with opts:', opts)
    return ipcRenderer.invoke('download-resource', opts)
  },
  probeResource: (opts) => {
    console.log('[Preload] probeResource called with opts:', opts)
    return ipcRenderer.invoke('probe-resource', opts)
  },
  openExternal: (url) => {
    console.log('[Preload] openExternal called with url:', url)
    return ipcRenderer.invoke('open-external', url)
  },
  sendNotification: (opts) => {
    console.log('[Preload] sendNotification called')
    ipcRenderer.send('show-notification', opts)
  },
  downloadVideo: (opts) => {
    console.log('[Preload] downloadVideo called with opts:', opts)
    return ipcRenderer.invoke('download-video', opts)
  },
  onVideoDownloadProgress: (cb) => {
    console.log('[Preload] onVideoDownloadProgress listener registered')
    ipcRenderer.on('download-video-progress', (e, data) => cb(data))
  },
  onVideoDownloadComplete: (cb) => {
    console.log('[Preload] onVideoDownloadComplete listener registered')
    ipcRenderer.on('download-video-complete', (e, data) => cb(data))
  },
  onDownloadProgress: (cb) => {
    console.log('[Preload] onDownloadProgress listener registered')
    ipcRenderer.on('download-progress', (e, data) => cb(data))
  }
}

// Expose window controls
try {
  apiHandler.window = {
    minimize: () => ipcRenderer.send('window-minimize'),
    toggleMaximize: () => ipcRenderer.send('window-toggle-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  }
} catch (e) {
  console.error('[Preload] Failed to expose window controls', e)
}

try {
  apiHandler.onWindowState = (cb) => {
    ipcRenderer.on('window-is-maximized', (e, val) => cb(val))
  }
} catch (e) {
  console.error('[Preload] Failed to expose onWindowState', e)
}

// menu-open listener
try {
  apiHandler.onMenuOpen = (cb) => {
    console.log('[Preload] onMenuOpen listener registered')
    ipcRenderer.on('menu-open-mode', (e, mode) => cb(mode))
  }
} catch (e) {
  console.error('[Preload] Failed to register onMenuOpen:', e)
}

// download-complete listener
try {
  apiHandler.onDownloadComplete = (cb) => {
    console.log('[Preload] onDownloadComplete listener registered')
    ipcRenderer.on('download-complete', (e, data) => cb(data))
  }
} catch (err) {
  console.error('[Preload] Failed to register onDownloadComplete:', err)
}

// search-progress listener
try {
  apiHandler.onSearchProgress = (cb) => {
    console.log('[Preload] onSearchProgress listener registered')
    ipcRenderer.on('search-progress', (e, data) => cb(data))
  }
} catch (err) {
  console.error('[Preload] Failed to register onSearchProgress:', err)
}

try {
  contextBridge.exposeInMainWorld('api', apiHandler)
  console.log('[Preload] Successfully exposed window.api')
} catch (err) {
  console.error('[Preload] Failed to expose window.api:', err)
}

// Expose updater API
try {
  contextBridge.exposeInMainWorld('updater', {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    cancelDownload: () => ipcRenderer.invoke('cancel-update-download'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    backupUserData: () => ipcRenderer.invoke('backup-user-data'),
    restoreUserData: (backup) => ipcRenderer.invoke('restore-user-data', backup),
    onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (e, info) => cb(info)),
    onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', (e, info) => cb(info)),
    onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (e, info) => cb(info)),
    onUpdateError: (cb) => ipcRenderer.on('update-error', (e, err) => cb(err)),
    onUpdateDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (e, data) => cb(data))
  })
  console.log('[Preload] Exposed updater API')
} catch (e) {
  console.error('[Preload] Failed to expose updater API', e)
}

// expose additional search APIs
try {
  contextBridge.exposeInMainWorld('searchApi', {
    searchMp3: (opts) => ipcRenderer.invoke('search-mp3', opts)
  })
  console.log('[Preload] Successfully exposed window.searchApi')
} catch (err) {
  console.error('[Preload] Failed to expose window.searchApi:', err)
}

// Expose Soulseek API
try {
  contextBridge.exposeInMainWorld('soulseek', {
    checkServer: (opts) => ipcRenderer.invoke('soulseek-check', opts),
    hasClient: () => ipcRenderer.invoke('soulseek-has-client'),
    search: (opts) => ipcRenderer.invoke('soulseek-search', opts),
    download: (opts) => ipcRenderer.invoke('soulseek-download', opts)
    ,
    // secure credential storage (uses OS keychain via main process)
    storeCreds: (creds) => ipcRenderer.invoke('soulseek-store-creds', creds),
    getCreds: () => ipcRenderer.invoke('soulseek-get-creds'),
    deleteCreds: () => ipcRenderer.invoke('soulseek-delete-creds')
    ,
    // account registration helpers
    canRegister: () => ipcRenderer.invoke('soulseek-can-register'),
    createAccount: (opts) => ipcRenderer.invoke('soulseek-create-account', opts),
    checkUsername: (opts) => ipcRenderer.invoke('soulseek-check-username', opts)
  })
  console.log('[Preload] Exposed window.soulseek')
} catch (err) {
  console.error('[Preload] Failed to expose window.soulseek:', err)
}

// soulseek download progress listener
try {
  contextBridge.exposeInMainWorld('soulseekEvents', {
    onDownloadProgress: (cb) => {
      console.log('[Preload] soulseek onDownloadProgress listener registered')
      ipcRenderer.on('soulseek-download-progress', (e, data) => cb(data))
    }
  })
} catch (e) {
  console.error('[Preload] Failed to expose soulseekEvents:', e)
}