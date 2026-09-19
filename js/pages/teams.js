import { TEAM_COLORS } from "../defaults.js";
import { saveSession, clearSession } from "../store.js";
import { escapeHtml } from "../ui.js";
import { go } from "../router.js";

export function renderTeams(root, pack, session) {
  const teams = session.teams || [];

  root.innerHTML = `
    <div class="shell teams-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">${escapeHtml(pack.branding.title)}</p>
          <h1>Команды</h1>
        </div>
        <button class="ghost-btn" id="reset">Сменить игру</button>
      </header>
      <p class="lede">До пяти команд. У каждой — название и капитан. Капитан понадобится для модификаторов «без капитана» и «только капитан».</p>
      <div class="team-list" id="team-list">
        ${teams.map(teamCard).join("")}
        ${
          teams.length < 5
            ? `<button class="add-team" id="add-team">+ Добавить команду</button>`
            : ""
        }
      </div>
      <div class="footer-actions">
        <button class="primary-btn" id="start" ${teams.length < 2 ? "disabled" : ""}>Начать игру</button>
        <p class="hint">Нужно минимум две команды.</p>
      </div>
    </div>
  `;

  root.querySelector("#reset")?.addEventListener("click", () => {
    clearSession();
    go("/home");
  });

  root.querySelector("#add-team")?.addEventListener("click", () => {
    const index = teams.length;
    teams.push({
      id: crypto.randomUUID(),
      name: `Команда ${index + 1}`,
      captain: "",
      color: TEAM_COLORS[index],
      score: 0,
    });
    session.teams = teams;
    saveSession(session);
    renderTeams(root, pack, session);
  });

  root.querySelectorAll("[data-team]").forEach((card) => {
    const team = teams.find((item) => item.id === card.dataset.team);
    card.querySelector("[name=name]").addEventListener("input", (event) => {
      team.name = event.target.value;
      saveSession(session);
    });
    card.querySelector("[name=captain]").addEventListener("input", (event) => {
      team.captain = event.target.value;
      saveSession(session);
    });
    card.querySelector("[data-remove]").addEventListener("click", () => {
      session.teams = teams.filter((item) => item.id !== team.id);
      saveSession(session);
      renderTeams(root, pack, session);
    });
  });

  root.querySelector("#start")?.addEventListener("click", () => {
    if (session.teams.length < 2) return;
    session.pickerTeamId = session.teams[0].id;
    session.phase = "board";
    saveSession(session);
    go("/play");
  });
}

function teamCard(team) {
  return `
    <article class="team-card" data-team="${team.id}" style="--team:${team.color}">
      <div class="team-swatch"></div>
      <label class="field"><span>Название</span><input name="name" maxlength="32" value="${escapeHtml(team.name)}"></label>
      <label class="field"><span>Капитан</span><input name="captain" maxlength="32" value="${escapeHtml(team.captain)}" placeholder="Имя капитана"></label>
      <button class="text-btn" data-remove type="button">Убрать</button>
    </article>
  `;
}
