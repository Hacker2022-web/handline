const { app, BrowserWindow, dialog, shell, session, systemPreferences, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let server;
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { const w=BrowserWindow.getAllWindows()[0]; if(w){if(w.isMinimized())w.restore();w.focus();} });
async function openWindow() {
  const win = new BrowserWindow({width:1280,height:860,minWidth:390,minHeight:600,backgroundColor:'#101c19',title:'Handline',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('http://127.0.0.1:18787/'))event.preventDefault();});
  await win.loadURL('http://127.0.0.1:18787');
}
app.whenReady().then(async()=>{
  const {config}=require('dotenv');config({path:path.join(app.getPath('userData'),'.env.local'),quiet:true});
  session.defaultSession.setPermissionCheckHandler((_wc,permission,origin)=>origin==='http://127.0.0.1:18787/'&&['media','fullscreen'].includes(permission));
  session.defaultSession.setPermissionRequestHandler(async(wc,permission,callback,details)=>{
    if(!wc.getURL().startsWith('http://127.0.0.1:18787/')||permission!=='media'){callback(false);return;}
    try { const types=details.mediaTypes||[]; const approvals=await Promise.all(types.map(t=>systemPreferences.askForMediaAccess(t==='video'?'camera':'microphone')));callback(approvals.every(Boolean)); } catch {callback(false);}
  });
  const {createApp}=await import(pathToFileURL(path.join(__dirname,'server/app.mjs')).href);
  const ollamaURL=process.env.OLLAMA_URL||'http://127.0.0.1:11434';const u=new URL(ollamaURL);
  if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.protocol!=='http:')throw new Error('OLLAMA_URL must be a local HTTP address.');
  await new Promise((resolve,reject)=>{server=createApp({ollamaURL,localModel:process.env.OLLAMA_MODEL||'gemma4:12b',cloudModel:process.env.GEMINI_MODEL||'gemma-4-26b-a4b-it',apiKey:process.env.GEMINI_API_KEY||''}).listen(18787,'127.0.0.1',resolve);server.on('error',reject)});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Handline',submenu:[{role:'about'},{role:'quit'}]},{label:'Demo',submenu:[{label:'Handheld demo',click:()=>{const w=BrowserWindow.getAllWindows()[0];w?.setSize(500,900);w?.loadURL('http://127.0.0.1:18787/?device=handheld')}},{label:'Desktop demo',click:()=>{const w=BrowserWindow.getAllWindows()[0];w?.setSize(1280,860);w?.loadURL('http://127.0.0.1:18787/')}}]}]));
  await openWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)openWindow()});
}).catch(error=>{dialog.showErrorBox('Handline could not start',error.message);app.quit()});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>server?.close());
