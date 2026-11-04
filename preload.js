const { contextBridge, ipcRenderer: i } = require("electron");
contextBridge.exposeInMainWorld("api", {
  load: () => i.invoke("load"),
  save: (c) => i.invoke("save", c),
  settings: (s) => i.invoke("settings", s),
  ai: (o) => i.invoke("ai", o),
  pdf: (o) => i.invoke("pdf", o),
  nImport: (u) => i.invoke("notion:import", u),
  nExport: (o) => i.invoke("notion:export", o),
  onProgress: (f) => i.on("progress", (_, m) => f(m)),
});
