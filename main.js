const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 760,
    minHeight: 560,
    title: 'Profit Pricer',
    webPreferences: {
      // Simple, single-purpose local tool loading only its own bundled file —
      // nodeIntegration is enabled so the existing app code can use require('xlsx')
      // directly with no bundler step. It never loads remote/untrusted content.
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // "View sold comps" and any other target="_blank" link opens in the user's
  // normal default browser (so it uses their real, logged-in eBay session)
  // instead of a bare Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handles the "Download results as Excel" button: shows a native Save dialog
// and writes the workbook straight to disk. This replaces the Claude-artifact
// "downloads" capability, which only exists inside claude.ai.
ipcMain.handle('save-xlsx', async (event, byteArray) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save priced listings',
    defaultPath: 'ebay-priced-listings.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return { saved: false, canceled: true };
  try {
    fs.writeFileSync(filePath, Buffer.from(byteArray));
    return { saved: true, path: filePath };
  } catch (err) {
    return { saved: false, error: String(err) };
  }
});
