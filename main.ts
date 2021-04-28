import { app, BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import * as url from 'url';
const ElectronStore = require("electron-store");
const HID = require('node-hid');

let win: BrowserWindow = null;
let relay = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createWindow(): BrowserWindow {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
      contextIsolation: false,  // false if you want to run 2e2 test with Spectron
      enableRemoteModule : true // true if you want to run 2e2 test  with Spectron or use remote module in renderer context (ie. Angular)
    },
  });

  if (serve) {

    win.webContents.openDevTools();

    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
    win.loadURL('http://localhost:4200');

  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, 'dist/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => setTimeout(createWindow, 400));

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });
} catch (e) {
  // Catch Error
  // throw e;
}


// Store
console.log("Get config from: ", app.getPath('userData'));
const store = new ElectronStore();

try {
  const devices = HID.devices();
  const connectedRelays = devices.filter(device => {
    return device.product && device.product.indexOf("USBRelay") !== -1;
  });
  if (!connectedRelays.length) {
    console.error('No USB Relays are connected.');
  } else {
    console.log(connectedRelays);
    relay = new HID.HID(connectedRelays[0].path);
    console.log("Connected to relay:", connectedRelays[0].product);
  }
} catch (e) {
  console.log("Could not switch relay:", e);
}

function setState(port, state) {
  // Byte 0 = Report ID
  // Byte 1 = State
  // Byte 2 = Relay
  // Bytes 3-8 = Padding

  // index 0 turns all the relays on or off
  const relayOn = [
    [0x00, 0xFE, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFF, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  ];

  const relayOff = [
    [0x00, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    [0x00, 0xFD, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
  ];

  let command = null;

  if (state)
  {
    command = relayOn[port];
  }
  else
  {
    command = relayOff[port];
  }

  relay.sendFeatureReport(command);
}

ipcMain.on('findRelays', (event) => {
  try {
    console.log('Search relays');
    const devices = HID.devices();
    const connectedRelays = devices.filter(device => {
      return device.product && device.product.indexOf("USBRelay") !== -1;
    });
    event.returnValue = connectedRelays;
  } catch (e) {
    console.log("Search failed: ", e);
    event.returnValue = 'error';
  }
});

ipcMain.on('setActiveRelay', (event, path) => {
  try {
    console.log('Search relay by path:', path);
    const devices = HID.devices();
    const connectedRelays = devices.filter(device => device.path === path);
    if (!connectedRelays.length) {
      console.error('No USB Relays are connected.');
      event.returnValue = 'error';
    } else {
      if (relay) {
        relay.close();
      }
      console.log(connectedRelays);
      relay = new HID.HID(connectedRelays[0].path);
      console.log("Connected to relay:", connectedRelays[0].product);
      event.returnValue = 'ok';
    }
  } catch (e) {
    console.log("Search failed: ", e);
    event.returnValue = 'error';
  }
});

ipcMain.on('switchActiveRelayOff', (event, slot) => {
  try {
    console.log('Deactivate ', slot);
    if (relay != undefined) {
      setState(slot, false);
      event.returnValue = 'ok';
    } else {
      event.returnValue = 'nok';
    }
  } catch (e) {
    console.log("switchActiveRelayOff failed: ", e);
    relay = undefined;
    event.returnValue = 'nok';
  }
});

ipcMain.on('switchActiveRelayOn', (event, slot) => {
  try {
    console.log('Activate ', slot);
    if (relay != undefined) {
      setState(slot, true);
      event.returnValue = 'ok';
    } else {
      event.returnValue = 'nok';
    }
  } catch (e) {
    console.log("switchActiveRelayOn failed: ", e);
    relay = undefined;
    event.returnValue = 'nok';
  }
});


// Storage commands
ipcMain.on('setKey', (event, update) => {
  try {
    store.set(update.key, update.value);
    event.returnValue = 'ok';
  } catch (e) {
    event.returnValue = 'nok';
  }
});

ipcMain.on('getKey', (event, key) => {
  try {
    event.returnValue = store.get(key);
  } catch (e) {
    event.returnValue = null;
  }
});

ipcMain.on('hasKey', (event, key) => {
  try {
    event.returnValue = store.has(key);
  } catch (e) {
    event.returnValue = false;
  }
});

ipcMain.on('deleteKey', (event, key) => {
  try {
    event.returnValue = store.delete(key)
  } catch (e) {
    event.returnValue = false;
  }
})
