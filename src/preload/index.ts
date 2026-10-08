import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('stockIncome', {
  getQuote: (code: string) => ipcRenderer.invoke('market:quote', code),
  searchStock: (keyword: string) => ipcRenderer.invoke('stock:search', keyword),
  loadStocks: () => ipcRenderer.invoke('stocks:load'),
  saveStocks: (data: unknown) => ipcRenderer.invoke('stocks:save', data),
});
