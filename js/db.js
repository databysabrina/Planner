// Armazenamento local no celular (IndexedDB). Tudo fica salvo no aparelho, mesmo sem internet.
const DB_NAME = 'planner';
const DB_VERSION = 1;
export const STORES = ['tasks', 'notes', 'images'];

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(out instanceof IDBRequest ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const db = {
  all: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
  put: (store, obj) => run(store, 'readwrite', (s) => { s.put(obj); return obj; }),
  del: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  putMany: (store, list) => run(store, 'readwrite', (s) => { list.forEach((o) => s.put(o)); return list.length; })
};

// Pede ao Android para não apagar os dados quando faltar espaço.
export async function askPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch (e) { /* ignora */ }
  return false;
}

export async function storageInfo() {
  const info = { persisted: false, usage: 0, quota: 0 };
  try {
    if (navigator.storage) {
      if (navigator.storage.persisted) info.persisted = await navigator.storage.persisted();
      if (navigator.storage.estimate) Object.assign(info, await navigator.storage.estimate());
    }
  } catch (e) { /* ignora */ }
  return info;
}

// ---------- Backup ----------
const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
const dataURLToBlob = async (url) => (await fetch(url)).blob();

export async function exportBackup() {
  const [tasks, notes, images] = await Promise.all(STORES.map((s) => db.all(s)));
  const imgs = [];
  for (const im of images) imgs.push({ ...im, blob: undefined, dataURL: await blobToDataURL(im.blob) });
  return { app: 'planner', version: 1, exportedAt: new Date().toISOString(), tasks, notes, images: imgs };
}

export async function importBackup(data) {
  if (!data || data.app !== 'planner') throw new Error('Este arquivo não é um backup do Planner.');
  const images = [];
  for (const im of data.images || []) {
    const { dataURL, ...rest } = im;
    images.push({ ...rest, blob: await dataURLToBlob(dataURL) });
  }
  for (const s of STORES) await db.clear(s);
  await db.putMany('tasks', data.tasks || []);
  await db.putMany('notes', data.notes || []);
  await db.putMany('images', images);
}
