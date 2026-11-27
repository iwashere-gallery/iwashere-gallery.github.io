import {serviceURL} from './service.js';

const prefix = 'gallery-download:';
const running = new Set();

async function deliver(photo, key) {
 if (running.has(key)) return;
 running.add(key);
 try {
  const response = await fetch(serviceURL('works/' + encodeURIComponent(photo) + '/download'), {
   method: 'POST', credentials: 'omit', keepalive: true,
   headers: {'Content-Type':'application/json'}, body: JSON.stringify({key})
  });
  if (response.ok && (await response.json()).recorded) localStorage.removeItem(prefix + key);
 } catch { /* Each request keeps its unique key until the server acknowledges it. */ }
 finally { running.delete(key); }
}

export function recordDownload(photo) {
 const key = crypto.randomUUID();
 try { localStorage.setItem(prefix + key, photo); } catch { /* Try once with storage disabled. */ }
 void deliver(photo, key);
}

function retryDownloads() {
 try {
  for (const name of Object.keys(localStorage)) {
   if (name.startsWith(prefix)) void deliver(localStorage.getItem(name), name.slice(prefix.length));
  }
 } catch { /* Storage may be disabled in a private browsing session. */ }
}
window.addEventListener('online', retryDownloads);
window.addEventListener('pageshow', retryDownloads);
