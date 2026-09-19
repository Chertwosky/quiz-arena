import { createSession, getSession } from "../store.js";
import { escapeHtml } from "../ui.js";
import { go } from "../router.js";

export function renderLogin(root, pack) {
  const { branding } = pack;
  const bg = branding.backgroundImage
    ? `url("${branding.backgroundImage.replaceAll('"', "")}")`
    : "none";
  const session = getSession();

  root.innerHTML = `
    <div class="login-stage" style="--login-image:${bg === "none" ? "none" : bg}">
      <div class="login-vignette"></div>
      <div class="login-frame">
        <div class="login-logo">${escapeHtml(branding.logoText || "QA")}</div>
        <p class="eyebrow">${escapeHtml(branding.kicker)}</p>
        <h1>${escapeHtml(branding.title)}</h1>
        <p class="lede">${escapeHtml(branding.subtitle)}</p>
        <p class="welcome">${escapeHtml(branding.welcome)}</p>
        <div class="host-pill">Ведёт: <strong>${escapeHtml(branding.hostName || "Ведущий")}</strong></div>
        ${
          branding.pin
            ? `<label class="field"><span>Код входа</span><input id="pin" type="password" inputmode="numeric" autocomplete="off"></label>`
            : ""
        }
        <p class="error" id="login-error" hidden></p>
        <button class="primary-btn" id="enter">${escapeHtml(branding.buttonLabel || "Войти")}</button>
        <div class="login-links">
          <a href="#/home">К списку игр</a>
          <a href="#/admin">Редактировать пакет</a>
        </div>
      </div>
    </div>
  `;

  root.querySelector("#enter").addEventListener("click", () => {
    const error = root.querySelector("#login-error");
    if (branding.pin) {
      const value = root.querySelector("#pin").value.trim();
      if (value !== branding.pin) {
        error.hidden = false;
        error.textContent = "Неверный код входа.";
        return;
      }
    }
    if (!session || session.packId !== pack.id) {
      createSession(pack.id);
    }
    go("/teams");
  });
}
