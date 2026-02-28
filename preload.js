const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eyeAPI', {
  getScreenSize:  ()            => ipcRenderer.invoke('robot:getScreenSize'),
  moveMouse:      (x, y)        => ipcRenderer.invoke('robot:moveMouse', x, y),
  click:          (btn)         => ipcRenderer.invoke('robot:click', btn),
  scroll:         (dir, amt)    => ipcRenderer.invoke('robot:scroll', dir, amt),
  getMousePos:    ()            => ipcRenderer.invoke('robot:getMousePos'),
  robotStatus:    ()            => ipcRenderer.invoke('robot:status'),
});
