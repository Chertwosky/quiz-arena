import { saveSession, appendScoreLog, resetAnswers } from "../store.js";
import {
  escapeHtml,
  formatScore,
  questionById,
  unansweredQuestions,
  modifierById,
  boardComplete,
  bindHorizontalScroll,
} from "../ui.js";
import { go } from "../router.js";
import { hasMedia, hydrateMedia, isPlayable } from "../media.js";

export async function renderGame(root, pack, session) {
  if (!session.round && boardComplete(pack, session)) {
    session.phase = "results";
    saveSession(session);
    go("/results");
    return;
  }

  root.innerHTML = `
    <div class="game-stage">
      ${renderBoard(pack, session)}
      ${session.round ? renderRound(pack, session) : ""}
      ${hostAdjustPanel(session)}
    </div>
  `;

  await hydrateMedia(root);
  bindBoard(root, pack, session);
  bindRound(root, pack, session);
  bindHostAdjust(root, pack, session);
}

function renderBoard(pack, session) {
  const picker = session.teams.find((team) => team.id === session.pickerTeamId);
  return `
    <div class="board-wrap">
      <header class="game-top">
        <div>
          <p class="eyebrow">${escapeHtml(pack.branding.title)}</p>
          <h1>Игровое поле</h1>
        </div>
        <p class="picker">Выбирает: <strong>${escapeHtml(picker?.name || "—")}</strong></p>
        <div class="game-actions">
          <div class="board-nav">
            <button class="ghost-btn" data-scroll-left type="button" title="Темы слева">←</button>
            <button class="ghost-btn" data-scroll-right type="button" title="Темы справа">→</button>
          </div>
          <button class="ghost-btn" data-open-adjust>Очки ведущего</button>
          <button class="ghost-btn" data-reset-answers type="button">Сбросить ответы</button>
          <a class="ghost-btn" href="#/teams">Команды</a>
          <button class="ghost-btn" data-finish>Итоги</button>
        </div>
      </header>
      <div class="board-scroll">
        <div class="board" style="--cols:${Math.max(pack.categories.length, 1)}">
        ${pack.categories
          .map(
            (category) => `
          <div class="board-col">
            <div class="cat-head">${escapeHtml(category.name)}</div>
            ${category.questions
              .map((question) => cellHtml(session, category, question))
              .join("")}
          </div>`
          )
          .join("")}
        </div>
      </div>
      <footer class="scorebar">
        ${session.teams.map((team) => scoreCard(team, session.pickerTeamId)).join("")}
      </footer>
    </div>
  `;
}

function scoreCard(team, pickerTeamId) {
  return `
    <button class="score-card ${team.id === pickerTeamId ? "is-picker" : ""}" data-open-adjust="${team.id}" style="--team:${team.color}">
      <b>${escapeHtml(team.name)}</b>
      <span data-score-for="${team.id}">${team.score}</span>
      <small>${team.captain ? "кпт. " + escapeHtml(team.captain) : "без капитана"}</small>
    </button>
  `;
}

function cellHtml(session, category, question) {
  const played = session.answered[question.id];
  if (!isPlayable(question)) {
    return `<div class="cell is-empty">—</div>`;
  }
  if (played) {
    return `<div class="cell is-played">${played.delta > 0 ? formatScore(played.delta) : question.value}</div>`;
  }
  const mark = hasMedia(question) ? `<i class="media-dot" title="Есть медиа"></i>` : "";
  return `<button class="cell" data-cat="${category.id}" data-q="${question.id}">${mark}${question.value}</button>`;
}

function renderRound(pack, session) {
  const round = session.round;
  const found = questionById(pack, round.playQuestionId || round.questionId);
  if (!found) return "";
  const modifier = round.modifierId ? modifierById(pack, round.modifierId) : null;

  if (round.stage === "modifiers") {
    return overlay(`
      <p class="eyebrow">${escapeHtml(found.category.name)} · ${found.question.value}</p>
      <h2>Модификатор</h2>
      <p class="lede">Выберите правило для этого вопроса. Его увидит весь зал.</p>
      <div class="mod-grid">
        ${pack.modifiers
          .map(
            (mod) => `
          <button class="mod-card" data-mod="${mod.id}">
            <strong>${escapeHtml(mod.name)}</strong>
            <p>${escapeHtml(mod.description)}</p>
          </button>`
          )
          .join("")}
      </div>
      <button class="ghost-btn" data-cancel>Отмена</button>
    `);
  }

  if (round.stage === "auction") {
    return overlay(`
      <p class="eyebrow">Аукцион</p>
      <h2>Ставка: ${round.auctionBid}</h2>
      <p class="lede">Номинал ${found.question.value}. Ведущий поднимает ставку за команду или пасует её.</p>
      <div class="auction-teams">
        ${session.teams
          .map((team) => {
            const passed = round.auctionPassed.includes(team.id);
            const lead = round.auctionTeamId === team.id;
            return `<div class="auction-row ${passed ? "is-passed" : ""} ${lead ? "is-lead" : ""}" style="--team:${team.color}">
              <b>${escapeHtml(team.name)}</b>
              <span>${team.score}</span>
              <button data-bid="${team.id}" ${passed ? "disabled" : ""}>+100</button>
              <button data-pass-auction="${team.id}" ${passed ? "disabled" : ""}>Пас</button>
            </div>`;
          })
          .join("")}
      </div>
      <button class="primary-btn" data-lock-auction ${round.auctionTeamId ? "" : "disabled"}>Играть за ${round.auctionBid || found.question.value}</button>
      <button class="ghost-btn" data-cancel>Отмена</button>
    `);
  }

  if (round.stage === "pass") {
    return overlay(`
      <p class="eyebrow">Пас сопернику</p>
      <h2>Кому уходит вопрос?</h2>
      <div class="team-pick">
        ${session.teams
          .map(
            (team) => `
          <button class="team-pick-btn" data-pass-target="${team.id}" style="--team:${team.color}">
            ${escapeHtml(team.name)}
          </button>`
          )
          .join("")}
      </div>
      <button class="ghost-btn" data-cancel>Отмена</button>
    `);
  }

  const play = questionById(pack, round.playQuestionId);
  const original = questionById(pack, round.questionId);
  const swapped = round.playQuestionId !== round.questionId;
  const stake = stakeLabel(round, play.question, modifier);
  const revealed = round.stage === "reveal" || round.stage === "score";

  return overlay(`
    <div class="question-card">
      <div class="q-meta">
        <span>${escapeHtml(swapped ? play.category.name : original.category.name)}</span>
        <span>${stake}</span>
      </div>
      ${
        modifier
          ? `<div class="mod-banner">${escapeHtml(modifier.name)}. ${escapeHtml(modifier.description)}</div>`
          : ""
      }
      ${swapped ? `<p class="swap-note">Кот в мешке: вместо «${escapeHtml(original.category.name)} ${original.question.value}».</p>` : ""}
      ${mediaBlock(play.question.media)}
      <h2 class="prompt">${escapeHtml(play.question.prompt || "Вопрос с медиа")}</h2>
      <button class="primary-btn" data-reveal ${revealed ? "hidden" : ""}>Показать ответ</button>
      <div class="answer-block" ${revealed ? "" : "hidden"}>
        ${mediaBlock(play.question.answerMedia, "q-media answer-media")}
        <p class="answer">${escapeHtml(play.question.answer || "—")}</p>
        ${play.question.comment ? `<p class="comment">${escapeHtml(play.question.comment)}</p>` : ""}
      </div>
      <div class="score-wrap" ${revealed ? "" : "hidden"}>
        ${renderScorePanel(pack, session, modifier)}
      </div>
      <div class="q-host-actions">
        <button class="ghost-btn" data-open-adjust>Накинуть очки</button>
        <button class="ghost-btn" data-cancel>Закрыть без записи</button>
      </div>
    </div>
  `);
}

function mediaBlock(media, className = "q-media") {
  const image = media?.image;
  const audio = media?.audio;
  const video = media?.video;
  if (!image && !audio && !video) return "";
  return `
    <div class="${className}">
      ${
        image
          ? `<img alt="" data-media="image" data-file-id="${escapeHtml(image.fileId || "")}" data-url="${escapeHtml(image.url || "")}">`
          : ""
      }
      ${
        video
          ? `<video controls playsinline data-media="video" data-file-id="${escapeHtml(video.fileId || "")}" data-url="${escapeHtml(video.url || "")}"></video>`
          : ""
      }
      ${
        audio
          ? `<audio controls data-media="audio" data-file-id="${escapeHtml(audio.fileId || "")}" data-url="${escapeHtml(audio.url || "")}"></audio>`
          : ""
      }
    </div>
  `;
}

function overlay(inner) {
  return `<div class="overlay"><div class="overlay-card">${inner}</div></div>`;
}

function stakeLabel(round, question, modifier) {
  if (round.auctionBid) return `ставка ${round.auctionBid}`;
  const mul = modifier?.multiplier || 1;
  return mul === 1 ? String(question.value) : `${question.value} × ${mul}`;
}

function renderScorePanel(pack, session, modifier) {
  const round = session.round;
  const eligible = eligibleTeams(session, modifier, round);
  return `
    <div class="score-panel">
      <p class="eyebrow">Ведущий засчитывает ответ</p>
      <p class="hint">Верно / ошибка — решение ведущего. Можно поставить свои очки вместо номинала.</p>
      ${eligible
        .map((team) => {
          const verdict = round.verdicts?.[team.id];
          const custom = round.customDeltas?.[team.id] ?? "";
          return `<div class="verdict-row" style="--team:${team.color}">
            <b>${escapeHtml(team.name)}</b>
            <button class="${verdict === "correct" ? "is-on" : ""}" data-verdict="${team.id}" data-ok="correct">Верно</button>
            <button class="${verdict === "wrong" ? "is-on wrong" : ""}" data-verdict="${team.id}" data-ok="wrong">Ошибка</button>
            <label class="custom-delta">свои очки <input type="number" data-custom="${team.id}" value="${escapeHtml(custom)}" placeholder="авто"></label>
          </div>`;
        })
        .join("")}
      <button class="primary-btn" data-apply>Записать решение ведущего</button>
    </div>
  `;
}

function hostAdjustPanel(session) {
  return `
    <div class="overlay host-adjust" hidden>
      <div class="overlay-card">
        <p class="eyebrow">Ведущий</p>
        <h2>Накинуть очки</h2>
        <p class="lede">Баллы можно добавить или снять в любой момент, даже между вопросами.</p>
        <div class="adjust-list">
          ${session.teams
            .map(
              (team) => `
            <div class="adjust-row" style="--team:${team.color}">
              <div>
                <b>${escapeHtml(team.name)}</b>
                <span data-score-for="${team.id}">${team.score}</span>
              </div>
              <div class="nudge-btns">
                <button data-nudge="${team.id}" data-delta="-100">-100</button>
                <button data-nudge="${team.id}" data-delta="-50">-50</button>
                <button data-nudge="${team.id}" data-delta="50">+50</button>
                <button data-nudge="${team.id}" data-delta="100">+100</button>
              </div>
              <input type="number" data-custom-nudge="${team.id}" placeholder="своё число">
              <button class="ghost-btn" data-apply-nudge="${team.id}">Ок</button>
            </div>`
            )
            .join("")}
        </div>
        <button class="primary-btn" data-close-adjust>Закрыть</button>
      </div>
    </div>
  `;
}

function eligibleTeams(session, modifier, round) {
  if (modifier?.kind === "all_teams") return session.teams;
  if (modifier?.kind === "pass" && round.passTargetId) {
    return session.teams.filter((team) => team.id === round.passTargetId);
  }
  if (modifier?.kind === "auction" && round.auctionTeamId) {
    return session.teams.filter((team) => team.id === round.auctionTeamId);
  }
  return session.teams;
}

function bindBoard(root, pack, session) {
  bindHorizontalScroll(root.querySelector(".board-scroll"));
  const scroller = root.querySelector(".board-scroll");
  root.querySelector("[data-scroll-left]")?.addEventListener("click", () => {
    scroller?.scrollBy({ left: -280, behavior: "smooth" });
  });
  root.querySelector("[data-scroll-right]")?.addEventListener("click", () => {
    scroller?.scrollBy({ left: 280, behavior: "smooth" });
  });

  root.querySelector("[data-reset-answers]")?.addEventListener("click", () => {
    if (!confirm("Сбросить все ответы и очки? Команды и вопросы останутся.")) return;
    resetAnswers(session);
    renderGame(root, pack, session);
  });

  root.querySelector("[data-finish]")?.addEventListener("click", () => {
    session.phase = "results";
    saveSession(session);
    go("/results");
  });

  root.querySelectorAll("[data-q]").forEach((cell) => {
    cell.addEventListener("click", () => {
      session.round = {
        categoryId: cell.dataset.cat,
        questionId: cell.dataset.q,
        playQuestionId: cell.dataset.q,
        modifierId: null,
        stage: "modifiers",
        auctionBid: 0,
        auctionTeamId: null,
        auctionPassed: [],
        passTargetId: null,
        verdicts: {},
        customDeltas: {},
      };
      saveSession(session);
      renderGame(root, pack, session);
    });
  });
}

function bindRound(root, pack, session) {
  const round = session.round;
  if (!round) return;

  root.querySelector("[data-cancel]")?.addEventListener("click", () => {
    session.round = null;
    saveSession(session);
    renderGame(root, pack, session);
  });

  root.querySelectorAll("[data-mod]").forEach((button) => {
    button.addEventListener("click", () => chooseModifier(root, pack, session, button.dataset.mod));
  });

  root.querySelectorAll("[data-bid]").forEach((button) => {
    button.addEventListener("click", () => {
      const team = session.teams.find((item) => item.id === button.dataset.bid);
      const step = 100;
      const next = (round.auctionBid || faceValue(pack, round)) + step;
      if (team.score < next && team.score > 0) {
        round.auctionBid = Math.max(faceValue(pack, round), team.score);
      } else {
        round.auctionBid = next;
      }
      round.auctionTeamId = team.id;
      round.auctionPassed = round.auctionPassed.filter((id) => id !== team.id);
      saveSession(session);
      renderGame(root, pack, session);
    });
  });

  root.querySelectorAll("[data-pass-auction]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.passAuction;
      if (!round.auctionPassed.includes(id)) round.auctionPassed.push(id);
      if (round.auctionTeamId === id) round.auctionTeamId = null;
      const active = session.teams.filter((team) => !round.auctionPassed.includes(team.id));
      if (active.length === 1) round.auctionTeamId = active[0].id;
      saveSession(session);
      renderGame(root, pack, session);
    });
  });

  root.querySelector("[data-lock-auction]")?.addEventListener("click", () => {
    if (!round.auctionTeamId) return;
    if (!round.auctionBid) round.auctionBid = faceValue(pack, round);
    round.stage = "question";
    saveSession(session);
    renderGame(root, pack, session);
  });

  root.querySelectorAll("[data-pass-target]").forEach((button) => {
    button.addEventListener("click", () => {
      round.passTargetId = button.dataset.passTarget;
      round.stage = "question";
      saveSession(session);
      renderGame(root, pack, session);
    });
  });

  root.querySelector("[data-reveal]")?.addEventListener("click", () => {
    round.stage = "score";
    saveSession(session);
    root.querySelector("[data-reveal]").hidden = true;
    root.querySelector(".answer-block").hidden = false;
    root.querySelector(".score-wrap").hidden = false;
  });

  root.querySelectorAll("[data-verdict]").forEach((button) => {
    button.addEventListener("click", () => {
      round.verdicts = round.verdicts || {};
      const teamId = button.dataset.verdict;
      const next = button.dataset.ok;
      round.verdicts[teamId] = round.verdicts[teamId] === next ? null : next;
      saveSession(session);
      const row = button.closest(".verdict-row");
      row.querySelectorAll("[data-verdict]").forEach((item) => {
        item.classList.toggle("is-on", round.verdicts[teamId] === item.dataset.ok);
        item.classList.toggle("wrong", item.dataset.ok === "wrong" && round.verdicts[teamId] === "wrong");
      });
    });
  });

  root.querySelectorAll("[data-custom]").forEach((input) => {
    input.addEventListener("input", () => {
      round.customDeltas = round.customDeltas || {};
      round.customDeltas[input.dataset.custom] = input.value;
      saveSession(session);
    });
  });

  root.querySelector("[data-apply]")?.addEventListener("click", () => applyRound(root, pack, session));
}

function bindHostAdjust(root, pack, session) {
  const panel = root.querySelector(".host-adjust");

  const open = () => {
    panel.hidden = false;
  };

  root.querySelectorAll("[data-open-adjust]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      open();
    });
  });

  panel.querySelector("[data-close-adjust]")?.addEventListener("click", () => {
    panel.hidden = true;
  });

  panel.querySelectorAll("[data-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      applyHostDelta(root, session, button.dataset.nudge, Number(button.dataset.delta));
    });
  });

  panel.querySelectorAll("[data-apply-nudge]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = panel.querySelector(`[data-custom-nudge="${button.dataset.applyNudge}"]`);
      const delta = Number(input.value);
      if (!delta) return;
      applyHostDelta(root, session, button.dataset.applyNudge, delta);
      input.value = "";
    });
  });
}

function applyHostDelta(root, session, teamId, delta) {
  const team = session.teams.find((item) => item.id === teamId);
  if (!team || !delta) return;
  team.score += delta;
  appendScoreLog(session, teamId, delta, "host-adjust");
  saveSession(session);
  root.querySelectorAll(`[data-score-for="${teamId}"]`).forEach((node) => {
    node.textContent = String(team.score);
  });
}

function faceValue(pack, round) {
  return questionById(pack, round.questionId).question.value;
}

function chooseModifier(root, pack, session, modifierId) {
  const round = session.round;
  const modifier = modifierById(pack, modifierId);
  round.modifierId = modifier.id;

  if (modifier.kind === "cat_bag") {
    const pool = unansweredQuestions(pack, session, round.questionId).filter(
      (item) => item.category.id !== round.categoryId
    );
    const pick = pool.length ? pool : unansweredQuestions(pack, session, round.questionId);
    if (pick.length) {
      const chosen = pick[Math.floor(Math.random() * pick.length)];
      round.playQuestionId = chosen.question.id;
    }
    round.stage = "question";
  } else if (modifier.kind === "auction") {
    round.auctionBid = faceValue(pack, round);
    round.stage = "auction";
  } else if (modifier.kind === "pass") {
    round.stage = "pass";
  } else {
    round.stage = "question";
  }

  saveSession(session);
  renderGame(root, pack, session);
}

function computeDelta(team, correct, pack, round) {
  const modifier = modifierById(pack, round.modifierId);
  const question = questionById(pack, round.playQuestionId).question;
  const face = round.auctionBid || question.value;

  if (modifier.kind === "all_in") {
    return correct ? team.score : -team.score;
  }
  if (correct) return Math.round(face * (modifier.multiplier || 1));
  const wrongMul = modifier.wrongMultiplier ?? modifier.multiplier ?? 1;
  return -Math.round(face * wrongMul);
}

function applyRound(root, pack, session) {
  const round = session.round;
  const modifier = modifierById(pack, round.modifierId);
  const verdicts = round.verdicts || {};
  const customDeltas = round.customDeltas || {};
  const teamIds = new Set([...Object.keys(verdicts), ...Object.keys(customDeltas)]);
  const updates = [];

  for (const teamId of teamIds) {
    const team = session.teams.find((item) => item.id === teamId);
    if (!team) continue;
    const verdict = verdicts[teamId];
    const customRaw = customDeltas[teamId];
    const hasCustom = customRaw !== "" && customRaw != null && !Number.isNaN(Number(customRaw));
    if (!verdict && !hasCustom) continue;
    const delta = hasCustom
      ? Number(customRaw)
      : computeDelta(team, verdict === "correct", pack, round);
    updates.push({ team, verdict: verdict || (delta >= 0 ? "correct" : "wrong"), delta });
  }

  if (!updates.length) return;

  let lastCorrect = session.pickerTeamId;
  for (const { team, verdict, delta } of updates) {
    team.score += delta;
    appendScoreLog(session, team.id, delta, verdict);
    if (verdict === "correct" || delta > 0) lastCorrect = team.id;
  }

  const first = updates[0];
  session.answered[round.questionId] = {
    teamId: first.team.id,
    delta: first.delta,
    modifierId: modifier.id,
    host: true,
  };
  if (round.playQuestionId !== round.questionId) {
    session.answered[round.playQuestionId] = session.answered[round.questionId];
  }

  session.pickerTeamId = lastCorrect;
  session.round = null;
  session.phase = boardComplete(pack, session) ? "results" : "board";
  saveSession(session);
  if (session.phase === "results") go("/results");
  else renderGame(root, pack, session);
}
