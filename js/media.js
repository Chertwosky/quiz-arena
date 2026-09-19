const DB_NAME = "quiz-arena-media";
const STORE = "files";
const blobUrls = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("packId", "packId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function putMediaFile({ id, packId, blob, name, mime }) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({
    id,
    packId,
    blob,
    name: name || "file",
    mime: mime || blob.type || "application/octet-stream",
  });
  await txDone(tx);
  revokeUrl(id);
  return id;
}

export async function getMediaFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMediaFile(id) {
  if (!id) return;
  revokeUrl(id);
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
}

export async function deletePackMedia(packId) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const index = tx.objectStore(STORE).index("packId");
  const request = index.openCursor(IDBKeyRange.only(packId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    revokeUrl(cursor.value.id);
    cursor.delete();
    cursor.continue();
  };
  await txDone(tx);
}

function revokeUrl(id) {
  const url = blobUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    blobUrls.delete(id);
  }
}

export async function mediaObjectUrl(fileId) {
  if (!fileId) return "";
  if (blobUrls.has(fileId)) return blobUrls.get(fileId);
  const record = await getMediaFile(fileId);
  if (!record?.blob) return "";
  const url = URL.createObjectURL(record.blob);
  blobUrls.set(fileId, url);
  return url;
}

export function safeMediaUrl(value) {
  const src = String(value || "").trim();
  if (!src) return "";
  if (src.startsWith("/media/")) return src;
  if (/^(https?:|blob:|data:image\/|data:audio\/|data:video\/)/i.test(src)) return src;
  return "";
}

export function emptyMedia() {
  return { image: null, audio: null, video: null };
}

export function mediaBag(question, slot = "question") {
  if (slot === "answer") {
    question.answerMedia = question.answerMedia || emptyMedia();
    return question.answerMedia;
  }
  question.media = question.media || emptyMedia();
  return question.media;
}

export function hasMedia(question) {
  return Boolean(mediaEntry(question, "image") || mediaEntry(question, "audio") || mediaEntry(question, "video"));
}

export function isPlayable(question) {
  return Boolean(question?.prompt?.trim() || hasMedia(question));
}

function mediaEntry(question, kind) {
  return question?.media?.[kind] || null;
}

export async function resolveMediaSrc(entry) {
  if (!entry) return "";
  if (entry.fileId) return mediaObjectUrl(entry.fileId);
  return safeMediaUrl(entry.url);
}

export async function hydrateMedia(root) {
  const nodes = [...root.querySelectorAll("[data-media]")];
  await Promise.all(
    nodes.map(async (node) => {
      const src = await resolveMediaSrc({
        fileId: node.dataset.fileId || "",
        url: node.dataset.url || "",
      });
      if (!src) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      if (node.dataset.media === "image") node.src = src;
      else node.src = src;
    })
  );
}

export async function attachFile(packId, question, kind, file, slot = "question") {
  const bag = mediaBag(question, slot);
  const previous = bag[kind]?.url;
  const form = new FormData();
  form.append("file", file);
  form.append("packId", packId);
  form.append("questionId", question.id);
  form.append("kind", kind);
  form.append("slot", slot === "answer" ? "answer" : "question");
  try {
    const response = await fetch("/api/upload", { method: "POST", body: form });
    if (response.ok) {
      const data = await response.json();
      if (previous && previous.startsWith("/media/") && previous !== data.url) {
        deleteLocalFile(previous);
      }
      if (bag[kind]?.fileId) {
        await deleteMediaFile(bag[kind].fileId);
      }
      bag[kind] = {
        fileId: "",
        name: data.name || file.name,
        url: data.url,
      };
      return data.url;
    }
  } catch {
    // Hosted static deploy has no Python /api/upload.
  }
  const fileId = crypto.randomUUID();
  await putMediaFile({ id: fileId, packId, blob: file, name: file.name, mime: file.type });
  if (bag[kind]?.fileId) await deleteMediaFile(bag[kind].fileId);
  bag[kind] = { fileId, name: file.name, url: "" };
  return fileId;
}

export async function clearMedia(question, kind, slot = "question") {
  const bag = slot === "answer" ? question.answerMedia : question.media;
  const entry = bag?.[kind];
  if (entry?.fileId) await deleteMediaFile(entry.fileId);
  if (entry?.url?.startsWith("/media/")) deleteLocalFile(entry.url);
  if (bag) bag[kind] = null;
}

async function copyBag(packId, toQuestion, fromBag, slot) {
  if (!fromBag) return;
  for (const kind of ["image", "audio", "video"]) {
    const entry = fromBag[kind];
    if (!entry) continue;
    if (entry.url?.startsWith("/media/")) {
      const response = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUrl: entry.url,
          packId,
          questionId: toQuestion.id,
          kind,
          slot,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        mediaBag(toQuestion, slot)[kind] = { url: data.url, fileId: "", name: entry.name || data.name };
        continue;
      }
    }
    if (entry.fileId) {
      const record = await getMediaFile(entry.fileId);
      if (record?.blob) {
        const file = new File([record.blob], record.name || `${kind}`, { type: record.mime });
        await attachFile(packId, toQuestion, kind, file, slot);
        continue;
      }
    }
    if (entry.url) mediaBag(toQuestion, slot)[kind] = { url: entry.url, fileId: "", name: entry.name || "" };
  }
}

export async function copyQuestionMedia(packId, fromQuestion, toQuestion) {
  toQuestion.media = emptyMedia();
  toQuestion.answerMedia = emptyMedia();
  await copyBag(packId, toQuestion, fromQuestion.media, "question");
  await copyBag(packId, toQuestion, fromQuestion.answerMedia, "answer");
}

function deleteLocalFile(url) {
  fetch("/api/media", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}

export async function deletePackFolder(packId) {
  await fetch("/api/pack-media", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packId }),
  }).catch(() => {});
}

export const MEDIA_ACCEPT = {
  image: "image/*",
  audio: "audio/*",
  video: "video/*",
};

export const MEDIA_LABELS = {
  image: "Картинка",
  audio: "Аудио",
  video: "Видео",
};

export function kindFromFile(file) {
  const type = String(file?.type || "");
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  const name = String(file?.name || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/.test(name)) return "image";
  if (/\.(mp3|wav|ogg|m4a|flac|aac)$/.test(name)) return "audio";
  if (/\.(mp4|webm|mov|mkv|avi|m4v)$/.test(name)) return "video";
  return null;
}
