import { getPacks, getSession } from "../store.js";
import { escapeHtml } from "../ui.js";
import { go } from "../router.js";

export function renderHome(root) {
  const packs = getPacks();
  const session = getSession();
  const resumePack = session ? packs.find((pack) => pack.id === session.packId) : null;

  root.innerHTML = `
    <div class="shell home-shell">
      <header class="topbar">
        <div class="brand-mark">QA</div>
        <div>
          <p class="eyebrow">Локальная викторина</p>
          <h1>Quiz Arena</h1>
        </div>
        <a class="ghost-btn" href="#/admin">Админка</a>
      </header>
      <section class="hero-copy">
        <p>Выберите пакет игры. Экран входа, темы и модификаторы настраиваются отдельно для каждой викторины.</p>
      </section>
      ${
        resumePack
          ? `<button class="resume-card" data-resume>
              <span>Продолжить «${escapeHtml(resumePack.branding.title)}»</span>
              <small>${session.teams.length} команд · ${Object.keys(session.answered).length} сыгранных вопросов</small>
            </button>`
          : ""
      }
      <div class="pack-grid">
        ${packs
          .map(
            (pack) => `
          <button class="pack-card" data-pack="${pack.id}" style="--card-gold:${escapeHtml(pack.theme.gold)}; --card-accent:${escapeHtml(pack.theme.accent)}">
            <span class="pack-kicker">${escapeHtml(pack.branding.kicker || "Пакет")}</span>
            <strong>${escapeHtml(pack.branding.title)}</strong>
            <p>${escapeHtml(pack.branding.subtitle || "")}</p>
            <em>${pack.categories.length} тем · ${pack.categories.reduce((n, c) => n + c.questions.length, 0)} вопросов</em>
          </button>`
          )
          .join("")}
      </div>
    </div>
  `;

  root.querySelector("[data-resume]")?.addEventListener("click", () => {
    go(session.phase === "teams" ? "/teams" : session.phase === "results" ? "/results" : "/play");
  });
  root.querySelectorAll("[data-pack]").forEach((button) => {
    button.addEventListener("click", () => go(`/login/${button.dataset.pack}`));
  });
}
