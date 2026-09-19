import { clearSession, saveSession } from "../store.js";
import { escapeHtml } from "../ui.js";
import { go } from "../router.js";

export function renderResults(root, pack, session) {
  const ranked = [...session.teams].sort((a, b) => b.score - a.score);
  const winner = ranked[0];

  root.innerHTML = `
    <div class="shell results-shell">
      <p class="eyebrow">${escapeHtml(pack.branding.title)}</p>
      <h1>Итоги</h1>
      <p class="lede">Победа: <strong>${escapeHtml(winner?.name || "—")}</strong></p>
      <ol class="podium">
        ${ranked
          .map(
            (team, index) => `
          <li style="--team:${team.color}">
            <span class="place">${index + 1}</span>
            <div>
              <b>${escapeHtml(team.name)}</b>
              <small>${team.captain ? "капитан " + escapeHtml(team.captain) : ""}</small>
            </div>
            <strong>${team.score}</strong>
          </li>`
          )
          .join("")}
      </ol>
      <div class="footer-actions">
        <button class="primary-btn" id="again">Новая партия этим пакетом</button>
        <button class="ghost-btn" id="home">К списку игр</button>
      </div>
    </div>
  `;

  root.querySelector("#again").addEventListener("click", () => {
    session.teams.forEach((team) => {
      team.score = 0;
    });
    session.answered = {};
    session.round = null;
    session.phase = "board";
    session.pickerTeamId = session.teams[0]?.id || null;
    saveSession(session);
    go("/play");
  });

  root.querySelector("#home").addEventListener("click", () => {
    clearSession();
    go("/home");
  });
}
