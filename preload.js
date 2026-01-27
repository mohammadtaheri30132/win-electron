const { contextBridge, ipcRenderer } = require('electron');
console.log('Preload script loaded');

contextBridge.exposeInMainWorld('api', {
  getBooks: () => {
        console.log('getBooks called from renderer');

    return ipcRenderer.invoke('get-books')
},
  getBook: (slug) => ipcRenderer.invoke('get-book', slug),
  saveBook: (data) => ipcRenderer.invoke('save-book', data),
  downloadFile: (filename) => ipcRenderer.invoke('download-file', filename),
  addInfoJson: (slug, jsonData) => ipcRenderer.invoke('add-info-json', { slug, jsonData }), // تغییر این خط
  addTextJson: (slug, pages) => ipcRenderer.invoke('add-text-json', { slug, pages })
});