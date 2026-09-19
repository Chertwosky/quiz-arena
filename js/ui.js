import { isPlayable } from "./media.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function applyTheme(theme = {}) {
  const root = document.documentElement;
  const map = {
    background: "--bg",
    panel: "--panel",
    gold: "--gold",
    accent: "--accent",
    text: "--text",
  };
  Object.entries(map).forEach(([key, cssVar]) => {
    if (theme[key]) root.style.setProperty(cssVar, theme[key]);
  });
}

export function formatScore(value) {
  const n = Number(value) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

export function questionById(pack, questionId) {
  for (const category of pack.categories) {
    const question = category.questions.find((item) => item.id === questionId);
    if (question) return { category, question };
  }
  return null;
}

export function bindHorizontalScroll(scroller) {
  if (!scroller) return;
  scroller.addEventListener(
    "wheel",
    (event) => {
      if (event.shiftKey) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      scroller.scrollLeft += event.deltaY;
      event.preventDefault();
    },
    { passive: false }
  );
}

export function unansweredQuestions(pack, session, exceptId = null) {
  return pack.categories.flatMap((category) =>
    category.questions
      .filter((question) => question.id !== exceptId && !session.answered[question.id] && isPlayable(question))
      .map((question) => ({ category, question }))
  );
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function readFileAsJson(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function modifierById(pack, id) {
  return pack.modifiers.find((item) => item.id === id) || pack.modifiers[0];
}

export function boardComplete(pack, session) {
  const playable = pack.categories.flatMap((cat) => cat.questions.filter(isPlayable));
  return playable.length > 0 && playable.every((q) => session.answered[q.id]);
}
