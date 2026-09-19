import { emptyPack, clonePack } from "../defaults.js";
import {
  getPacks,
  getPack,
  savePack,
  deletePack,
  importPack,
} from "../store.js";
import { escapeHtml, downloadJson, readFileAsJson, bindHorizontalScroll } from "../ui.js";
import { go, parseRoute } from "../router.js";
import {
  MEDIA_ACCEPT,
  MEDIA_LABELS,
  attachFile,
  clearMedia,
  copyQuestionMedia,
  deletePackMedia,
  deletePackFolder,
  emptyMedia,
  hydrateMedia,
  kindFromFile,
  mediaBag,
} from "../media.js";

export function renderAdminList(root) {
  const packs = getPacks();
  root.innerHTML = `
    <div class="shell admin-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Админка</p>
          <h1>Пакеты игр</h1>
        </div>
        <a class="ghost-btn" href="#/home">К играм</a>
      </header>
      <div class="footer-actions">
        <button class="primary-btn" id="create">Новый пакет</button>
        <label class="ghost-btn file-btn">Импорт JSON<input type="file" id="import" accept="application/json" hidden></label>
      </div>
      <div class="admin-list">
        ${packs
          .map(
            (pack) => `
          <article class="admin-card">
            <div>
              <p class="eyebrow">${escapeHtml(pack.branding.kicker || "Пакет")}</p>
              <h2>${escapeHtml(pack.branding.title)}</h2>
              <p>${pack.categories.length} тем · ${pack.categories.reduce((n, c) => n + c.questions.length, 0)} вопросов</p>
            </div>
            <div class="admin-card-actions">
              <a href="#/admin/${pack.id}">Редактировать</a>
              <a href="#/login/${pack.id}">Открыть вход</a>
              <button data-dup="${pack.id}">Копия</button>
              <button data-export="${pack.id}">Экспорт</button>
              <button data-del="${pack.id}">Удалить</button>
            </div>
          </article>`
          )
          .join("")}
      </div>
    </div>
  `;

  root.querySelector("#create").addEventListener("click", () => {
    const pack = emptyPack();
    savePack(pack);
    go(`/admin/${pack.id}`);
  });

  root.querySelector("#import").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await readFileAsJson(file);
      const pack = importPack(data);
      go(`/admin/${pack.id}`);
    } catch {
      alert("Не удалось прочитать JSON пакета.");
    }
  });

  root.querySelectorAll("[data-dup]").forEach((button) => {
    button.addEventListener("click", async () => {
      const source = getPack(button.dataset.dup);
      const copy = clonePack(source);
      for (const [catIndex, category] of copy.categories.entries()) {
        for (const [qIndex, question] of category.questions.entries()) {
          const sourceQuestion = source.categories[catIndex].questions[qIndex];
          await copyQuestionMedia(copy.id, sourceQuestion, question);
        }
      }
      savePack(copy);
      renderAdminList(root);
    });
  });

  root.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const pack = getPack(button.dataset.export);
      downloadJson(`${slug(pack.branding.title)}.json`, pack);
    });
  });

  root.querySelectorAll("[data-del]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Удалить пакет? Это нельзя отменить.")) return;
      await deletePackFolder(button.dataset.del);
      await deletePackMedia(button.dataset.del);
      deletePack(button.dataset.del);
      renderAdminList(root);
    });
  });
}

export async function renderAdminEditor(root, packId) {
  const pack = getPack(packId);
  if (!pack) {
    go("/admin");
    return;
  }
  const tab = parseRoute().query.get("tab") || "brand";

  root.innerHTML = `
    <div class="shell editor-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Редактор пакета</p>
          <h1>${escapeHtml(pack.branding.title || "Без названия")}</h1>
        </div>
        <div class="game-actions">
          <a class="ghost-btn" href="#/admin">Все пакеты</a>
          <a class="primary-btn" href="#/login/${pack.id}">Проверить вход</a>
        </div>
      </header>
      <nav class="tabs">
        <button data-tab="brand" class="${tab === "brand" ? "is-on" : ""}">Вход и оформление</button>
        <button data-tab="board" class="${tab === "board" ? "is-on" : ""}">Сетка вопросов</button>
        <button data-tab="mods" class="${tab === "mods" ? "is-on" : ""}">Модификаторы</button>
      </nav>
      <div id="editor-body">${editorBody(pack, tab)}</div>
    </div>
  `;

  root.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `/admin/${pack.id}?tab=${button.dataset.tab}`;
    });
  });

  bindEditor(root, pack, tab);
  await hydrateMedia(root);
  if (tab === "board" && sessionStorage.getItem("quiz-arena:scroll-new-cat")) {
    sessionStorage.removeItem("quiz-arena:scroll-new-cat");
    const wrap = root.querySelector(".board-edit-wrap");
    if (wrap) wrap.scrollLeft = wrap.scrollWidth;
  }
}

function editorBody(pack, tab) {
  if (tab === "board") return boardEditor(pack);
  if (tab === "mods") return modsEditor(pack);
  return brandEditor(pack);
}

function brandEditor(pack) {
  const b = pack.branding;
  const t = pack.theme;
  return `
    <div class="editor-grid">
      <form class="editor-form" id="brand-form">
        <label class="field"><span>Надзаголовок</span><input name="kicker" value="${escapeHtml(b.kicker)}"></label>
        <label class="field"><span>Название на входе</span><input name="title" value="${escapeHtml(b.title)}"></label>
        <label class="field"><span>Подзаголовок</span><textarea name="subtitle">${escapeHtml(b.subtitle)}</textarea></label>
        <label class="field"><span>Приветственный текст</span><textarea name="welcome">${escapeHtml(b.welcome)}</textarea></label>
        <label class="field"><span>Имя ведущего</span><input name="hostName" value="${escapeHtml(b.hostName)}"></label>
        <label class="field"><span>Текст кнопки</span><input name="buttonLabel" value="${escapeHtml(b.buttonLabel)}"></label>
        <label class="field"><span>Код входа (пусто = без кода)</span><input name="pin" value="${escapeHtml(b.pin)}"></label>
        <label class="field"><span>Монограмма</span><input name="logoText" maxlength="3" value="${escapeHtml(b.logoText)}"></label>
        <label class="field"><span>Фон (URL картинки)</span><input name="backgroundImage" value="${escapeHtml(b.backgroundImage)}"></label>
        <div class="color-row">
          <label>Фон <input type="color" name="background" value="${t.background}"></label>
          <label>Панель <input type="color" name="panel" value="${t.panel}"></label>
          <label>Золото <input type="color" name="gold" value="${t.gold}"></label>
          <label>Акцент <input type="color" name="accent" value="${t.accent}"></label>
          <label>Текст <input type="color" name="text" value="${t.text}"></label>
        </div>
        <button class="primary-btn" type="submit">Сохранить оформление</button>
      </form>
      <aside class="login-preview">
        <div class="login-frame mini">
          <div class="login-logo">${escapeHtml(b.logoText || "QA")}</div>
          <p class="eyebrow">${escapeHtml(b.kicker)}</p>
          <h2>${escapeHtml(b.title)}</h2>
          <p>${escapeHtml(b.subtitle)}</p>
          <button class="primary-btn" type="button">${escapeHtml(b.buttonLabel)}</button>
        </div>
      </aside>
    </div>
  `;
}

function boardEditor(pack) {
  return `
    <div class="board-editor">
      <div class="footer-actions">
        <button class="ghost-btn" id="add-cat">+ Тема</button>
        <button class="ghost-btn" type="button" data-scroll-left>←</button>
        <button class="ghost-btn" type="button" data-scroll-right>→</button>
        <p class="hint">Колёсико мыши и кнопки ← → листают темы вправо-влево. Пустой текст скрывает клетку, если нет медиа.</p>
      </div>
      <div class="board-edit-wrap">
      <div class="board-edit-grid" style="--cols:${Math.max(pack.categories.length, 1)}">
        ${pack.categories
          .map(
            (category, catIndex) => `
          <section class="cat-edit" data-cat="${category.id}">
            <input class="cat-name" value="${escapeHtml(category.name)}">
            <button class="text-btn" data-del-cat="${category.id}" ${pack.categories.length < 2 ? "disabled" : ""}>Удалить тему</button>
            ${category.questions
              .map(
                (question, qIndex) => `
              <article class="q-edit" data-drop-question data-cat-i="${catIndex}" data-q-i="${qIndex}">
                <label>Номинал <input type="number" min="10" step="10" data-field="value" data-cat-i="${catIndex}" data-q-i="${qIndex}" value="${question.value}"></label>
                <label>Вопрос <textarea data-field="prompt" data-cat-i="${catIndex}" data-q-i="${qIndex}">${escapeHtml(question.prompt)}</textarea></label>
                <label>Ответ <textarea data-field="answer" data-cat-i="${catIndex}" data-q-i="${qIndex}">${escapeHtml(question.answer)}</textarea></label>
                <label>Комментарий ведущему <input data-field="comment" data-cat-i="${catIndex}" data-q-i="${qIndex}" value="${escapeHtml(question.comment || "")}"></label>
                <div class="media-group">
                  <p class="eyebrow">Медиа вопроса</p>
                  ${mediaFields(question, catIndex, qIndex, "question")}
                </div>
                <div class="media-group" data-drop-answer data-cat-i="${catIndex}" data-q-i="${qIndex}">
                  <p class="eyebrow">Медиа ответа</p>
                  ${mediaFields(question, catIndex, qIndex, "answer")}
                </div>
                <button class="text-btn" data-del-q="${catIndex}:${qIndex}">Удалить вопрос</button>
              </article>`
              )
              .join("")}
            <button class="ghost-btn" data-add-q="${category.id}">+ Вопрос</button>
          </section>`
          )
          .join("")}
      </div>
      </div>
      <button class="primary-btn" id="save-board">Сохранить сетку</button>
    </div>
  `;
}

function mediaFields(question, catIndex, qIndex, slot = "question") {
  const bag = slot === "answer" ? question.answerMedia : question.media;
  return ["image", "audio", "video"]
    .map((kind) => {
      const entry = bag?.[kind];
      const thumb =
        kind === "image" && (entry?.fileId || entry?.url)
          ? `<img class="media-thumb" alt="" data-media="image" data-file-id="${escapeHtml(entry.fileId || "")}" data-url="${escapeHtml(entry.url || "")}">`
          : "";
      const fileNote = entry?.name || entry?.url ? `<em>${escapeHtml(entry.name || entry.url)}</em>` : "";
      const hint = entry?.fileId || entry?.url ? "Заменить: перетащите файл сюда" : "Перетащите файл или нажмите, чтобы выбрать";
      return `
        <div class="media-edit" data-drop-kind="${kind}" data-media-slot="${slot}" data-cat-i="${catIndex}" data-q-i="${qIndex}">
          <span>${MEDIA_LABELS[kind]}</span>
          ${thumb}
          ${fileNote}
          <label class="drop-zone">
            <strong>${hint}</strong>
            <small>${kind === "image" ? "PNG, JPG, WEBP, GIF" : kind === "audio" ? "MP3, WAV, OGG, M4A" : "MP4, WEBM, MOV"}</small>
            <input type="file" accept="${MEDIA_ACCEPT[kind]}" data-media-file="${kind}" data-media-slot="${slot}" data-cat-i="${catIndex}" data-q-i="${qIndex}" hidden>
          </label>
          <input placeholder="или вставьте URL" data-media-url="${kind}" data-media-slot="${slot}" data-cat-i="${catIndex}" data-q-i="${qIndex}" value="${escapeHtml(entry?.url || "")}">
          <button type="button" class="text-btn" data-media-clear="${kind}" data-media-slot="${slot}" data-cat-i="${catIndex}" data-q-i="${qIndex}">Убрать</button>
        </div>`;
    })
    .join("");
}

function modsEditor(pack) {
  return `
    <div class="mods-editor">
      <p class="lede">Модификатор выбирается при открытии клетки. Тип определяет механику, множитель — очки.</p>
      ${pack.modifiers
        .map(
          (mod, index) => `
        <article class="mod-edit" data-mod-i="${index}">
          <label class="field"><span>Название</span><input data-m="name" value="${escapeHtml(mod.name)}"></label>
          <label class="field"><span>Описание</span><textarea data-m="description">${escapeHtml(mod.description)}</textarea></label>
          <label class="field"><span>Множитель верного ответа</span><input type="number" min="0" step="0.1" data-m="multiplier" value="${mod.multiplier}"></label>
          <label class="field"><span>Множитель ошибки (пусто = как верный)</span><input type="number" min="0" step="0.1" data-m="wrongMultiplier" value="${mod.wrongMultiplier ?? ""}"></label>
          <label class="field"><span>Тип</span>
            <select data-m="kind">
              ${kindOptions(mod.kind)}
            </select>
          </label>
        </article>`
        )
        .join("")}
      <button class="primary-btn" id="save-mods">Сохранить модификаторы</button>
    </div>
  `;
}

function kindOptions(current) {
  const kinds = [
    ["plain", "Обычный"],
    ["no_captain", "Без капитана"],
    ["captain_only", "Только капитан"],
    ["double", "Двойная ставка"],
    ["all_in", "Ва-банк"],
    ["cat_bag", "Кот в мешке"],
    ["auction", "Аукцион"],
    ["pass", "Пас сопернику"],
    ["all_teams", "Все команды"],
    ["no_error", "Без права на ошибку"],
  ];
  return kinds
    .map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`)
    .join("");
}

function bindEditor(root, pack, tab) {
  if (tab === "brand") {
    root.querySelector("#brand-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      pack.branding = {
        ...pack.branding,
        kicker: data.get("kicker"),
        title: data.get("title"),
        subtitle: data.get("subtitle"),
        welcome: data.get("welcome"),
        hostName: data.get("hostName"),
        buttonLabel: data.get("buttonLabel"),
        pin: String(data.get("pin") || "").trim(),
        logoText: data.get("logoText"),
        backgroundImage: data.get("backgroundImage"),
      };
      pack.theme = {
        background: data.get("background"),
        panel: data.get("panel"),
        gold: data.get("gold"),
        accent: data.get("accent"),
        text: data.get("text"),
      };
      savePack(pack);
      renderAdminEditor(root, pack.id);
    });
    return;
  }

  if (tab === "board") {
    const wrap = root.querySelector(".board-edit-wrap");
    bindHorizontalScroll(wrap);
    root.querySelector("[data-scroll-left]")?.addEventListener("click", () => {
      wrap?.scrollBy({ left: -300, behavior: "smooth" });
    });
    root.querySelector("[data-scroll-right]")?.addEventListener("click", () => {
      wrap?.scrollBy({ left: 300, behavior: "smooth" });
    });
    root.querySelectorAll(".cat-name").forEach((input, index) => {
      input.addEventListener("input", () => {
        pack.categories[index].name = input.value;
      });
    });
    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const cat = pack.categories[Number(input.dataset.catI)];
        const question = cat.questions[Number(input.dataset.qI)];
        const field = input.dataset.field;
        question[field] = field === "value" ? Number(input.value) || 0 : input.value;
      });
    });
    root.querySelector("#add-cat").addEventListener("click", () => {
      pack.categories.push({
        id: crypto.randomUUID(),
        name: `Тема ${pack.categories.length + 1}`,
        questions: [100, 200, 300, 400, 500].map((value) => ({
          id: crypto.randomUUID(),
          value,
          prompt: "",
          answer: "",
          comment: "",
          media: emptyMedia(),
          answerMedia: emptyMedia(),
        })),
      });
      savePack(pack);
      sessionStorage.setItem("quiz-arena:scroll-new-cat", "1");
      location.hash = `/admin/${pack.id}?tab=board`;
      renderAdminEditor(root, pack.id);
    });
    root.querySelectorAll("[data-del-q]").forEach((button) => {
      button.addEventListener("click", async () => {
        const [catI, qI] = button.dataset.delQ.split(":").map(Number);
        const question = pack.categories[catI].questions[qI];
        for (const kind of ["image", "audio", "video"]) {
          await clearMedia(question, kind, "question");
          await clearMedia(question, kind, "answer");
        }
        pack.categories[catI].questions.splice(qI, 1);
        savePack(pack);
        renderAdminEditor(root, pack.id);
      });
    });
    root.querySelectorAll("[data-del-cat]").forEach((button) => {
      button.addEventListener("click", async () => {
        const category = pack.categories.find((cat) => cat.id === button.dataset.delCat);
        if (category) {
          for (const question of category.questions) {
            for (const kind of ["image", "audio", "video"]) {
              await clearMedia(question, kind, "question");
              await clearMedia(question, kind, "answer");
            }
          }
        }
        pack.categories = pack.categories.filter((cat) => cat.id !== button.dataset.delCat);
        savePack(pack);
        renderAdminEditor(root, pack.id);
      });
    });
    root.querySelectorAll("[data-media-url]").forEach((input) => {
      input.addEventListener("change", () => {
        const question = pack.categories[Number(input.dataset.catI)].questions[Number(input.dataset.qI)];
        const slot = input.dataset.mediaSlot || "question";
        const bag = mediaBag(question, slot);
        const kind = input.dataset.mediaUrl;
        const url = input.value.trim();
        const prev = bag[kind] || {};
        bag[kind] = url || prev.fileId ? { url, fileId: prev.fileId || "", name: prev.name || "" } : null;
        if (!url && !prev.fileId) bag[kind] = null;
        savePack(pack);
      });
    });
    root.querySelectorAll("[data-media-file]").forEach((input) => {
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const question = pack.categories[Number(input.dataset.catI)].questions[Number(input.dataset.qI)];
        await saveDroppedFile(root, pack, question, input.dataset.mediaFile, file, input.dataset.mediaSlot || "question");
      });
    });
    bindDropTargets(root, pack);
    root.querySelectorAll("[data-media-clear]").forEach((button) => {
      button.addEventListener("click", async () => {
        const question = pack.categories[Number(button.dataset.catI)].questions[Number(button.dataset.qI)];
        await clearMedia(question, button.dataset.mediaClear, button.dataset.mediaSlot || "question");
        savePack(pack);
        renderAdminEditor(root, pack.id);
      });
    });
    root.querySelectorAll("[data-add-q]").forEach((button) => {
      button.addEventListener("click", () => {
        const cat = pack.categories.find((item) => item.id === button.dataset.addQ);
        const last = cat.questions[cat.questions.length - 1];
        cat.questions.push({
          id: crypto.randomUUID(),
          value: (last?.value || 100) + 100,
          prompt: "",
          answer: "",
          comment: "",
          media: emptyMedia(),
          answerMedia: emptyMedia(),
        });
        savePack(pack);
        renderAdminEditor(root, pack.id);
      });
    });
    root.querySelector("#save-board").addEventListener("click", () => {
      savePack(pack);
      const btn = root.querySelector("#save-board");
      btn.textContent = "Сохранено";
      setTimeout(() => {
        btn.textContent = "Сохранить сетку";
      }, 1200);
    });
    return;
  }

  root.querySelectorAll(".mod-edit").forEach((card) => {
    card.querySelectorAll("[data-m]").forEach((input) => {
      input.addEventListener("input", () => {
        const mod = pack.modifiers[Number(card.dataset.modI)];
        const key = input.dataset.m;
        if (key === "multiplier" || key === "wrongMultiplier") {
          const value = input.value === "" ? undefined : Number(input.value);
          if (key === "wrongMultiplier" && input.value === "") delete mod.wrongMultiplier;
          else mod[key] = value;
        } else {
          mod[key] = input.value;
        }
      });
    });
  });
  root.querySelector("#save-mods").addEventListener("click", () => {
    savePack(pack);
    const btn = root.querySelector("#save-mods");
    btn.textContent = "Сохранено";
    setTimeout(() => {
      btn.textContent = "Сохранить модификаторы";
    }, 1200);
  });
}

async function saveDroppedFile(root, pack, question, kind, file, slot = "question") {
  try {
    await attachFile(pack.id, question, kind, file, slot);
    savePack(pack);
    await renderAdminEditor(root, pack.id);
  } catch (error) {
    alert(error.message || "Не удалось сохранить файл в папку проекта.");
  }
}

function enableDrop(el, onFiles) {
  if (!el) return;
  let depth = 0;
  el.addEventListener("dragenter", (event) => {
    event.preventDefault();
    event.stopPropagation();
    depth += 1;
    el.classList.add("is-drag");
  });
  el.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  });
  el.addEventListener("dragleave", () => {
    depth = Math.max(0, depth - 1);
    if (!depth) el.classList.remove("is-drag");
  });
  el.addEventListener("drop", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    depth = 0;
    el.classList.remove("is-drag");
    const files = [...(event.dataTransfer?.files || [])];
    if (files.length) await onFiles(files);
  });
}

function bindDropTargets(root, pack) {
  enableDrop(root.querySelector(".board-editor"), async () => {});
  root.querySelectorAll("[data-drop-kind]").forEach((zone) => {
    enableDrop(zone, async (files) => {
      const question = pack.categories[Number(zone.dataset.catI)].questions[Number(zone.dataset.qI)];
      const wanted = zone.dataset.dropKind;
      const file = files[0];
      const detected = kindFromFile(file);
      if (detected && detected !== wanted) {
        alert(`В этот слот нужно ${MEDIA_LABELS[wanted].toLowerCase()}, а файл похож на ${MEDIA_LABELS[detected].toLowerCase()}.`);
        return;
      }
      await saveDroppedFile(root, pack, question, wanted, file, zone.dataset.mediaSlot || "question");
    });
  });
  root.querySelectorAll("[data-drop-question]").forEach((card) => {
    enableDrop(card, async (files) => {
      const question = pack.categories[Number(card.dataset.catI)].questions[Number(card.dataset.qI)];
      for (const file of files) {
        const kind = kindFromFile(file);
        if (!kind) {
          alert(`Непонятный тип файла: ${file.name}`);
          continue;
        }
        await saveDroppedFile(root, pack, question, kind, file, "question");
      }
    });
  });
  root.querySelectorAll("[data-drop-answer]").forEach((card) => {
    enableDrop(card, async (files) => {
      const question = pack.categories[Number(card.dataset.catI)].questions[Number(card.dataset.qI)];
      for (const file of files) {
        const kind = kindFromFile(file);
        if (!kind) {
          alert(`Непонятный тип файла: ${file.name}`);
          continue;
        }
        await saveDroppedFile(root, pack, question, kind, file, "answer");
      }
    });
  });
}

function slug(value) {
  return String(value || "pack")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "pack";
}
