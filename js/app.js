import { getPacks, getPack, getSession } from "./store.js";
import { applyTheme } from "./ui.js";
import { parseRoute } from "./router.js";
import { renderHome } from "./pages/home.js";
import { renderLogin } from "./pages/login.js";
import { renderTeams } from "./pages/teams.js";
import { renderGame } from "./pages/game.js";
import { renderResults } from "./pages/results.js";
import { renderAdminList, renderAdminEditor } from "./pages/admin.js";

const app = document.getElementById("app");

async function render() {
  const { parts } = parseRoute();
  const session = getSession();
  const route = parts[0] || "home";

  if (route === "admin") {
    applyTheme(getPacks()[0]?.theme);
    if (parts[1]) await renderAdminEditor(app, parts[1]);
    else renderAdminList(app);
    return;
  }

  if (route === "login" && parts[1]) {
    const pack = getPack(parts[1]);
    if (!pack) {
      location.hash = "#/home";
      return;
    }
    applyTheme(pack.theme);
    renderLogin(app, pack);
    return;
  }

  if (route === "teams") {
    const pack = session ? getPack(session.packId) : null;
    if (!pack) {
      location.hash = "#/home";
      return;
    }
    applyTheme(pack.theme);
    renderTeams(app, pack, session);
    return;
  }

  if (route === "play") {
    const pack = session ? getPack(session.packId) : null;
    if (!pack || !session?.teams?.length) {
      location.hash = "#/home";
      return;
    }
    applyTheme(pack.theme);
    await renderGame(app, pack, session);
    return;
  }

  if (route === "results") {
    const pack = session ? getPack(session.packId) : null;
    if (!pack) {
      location.hash = "#/home";
      return;
    }
    applyTheme(pack.theme);
    renderResults(app, pack, session);
    return;
  }

  applyTheme(getPacks()[0]?.theme);
  renderHome(app);
}

window.addEventListener("hashchange", () => {
  render();
});
render();
