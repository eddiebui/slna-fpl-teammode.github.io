async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function medalFor(rank) {
  if (rank === 1) return '<span class="medal gold">1</span>';
  if (rank === 2) return '<span class="medal silver">2</span>';
  if (rank === 3) return '<span class="medal bronze">3</span>';
  return rank;
}

function formatUpdatedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function teamDisplayName(teams, teamId) {
  return `Team ${teamId}`;
}

function fplEntryUrl(entryId) {
  return `https://fantasy.premierleague.com/entry/${entryId}/history`;
}

function fplLinkHtml(entryId, label) {
  const url = fplEntryUrl(entryId);
  return `
    <a href="${url}" target="_blank" rel="noopener">${label}</a>
    <button type="button" class="copy-link-btn" data-url="${url}" title="Copy link (dùng nếu app FPL tự mở và hiện sai đội)">⧉</button>
  `;
}

function entryDetailRows(teams, scores, teamId) {
  const entries = teams[teamId] || [];
  return entries
    .map((e) => {
      const total = scores[String(e.entry_id)]?.total ?? "-";
      return `
        <li>
          ${fplLinkHtml(e.entry_id, e.entry_name)}
          <span class="entry-manager">${e.manager}</span>
          <span class="pill entry-points">${total}</span>
        </li>
      `;
    })
    .join("");
}

async function renderHomeStandings() {
  const el = document.getElementById("standings-body");
  if (!el) return;
  const [teams, standings, scores] = await Promise.all([
    fetchJSON("data/teams.json"),
    fetchJSON("data/standings.json"),
    fetchJSON("data/scores.json"),
  ]);

  document.getElementById("updated-at").textContent =
    standings.updated_at ? `Cập nhật lần cuối: ${formatUpdatedAt(standings.updated_at)}` : "";

  el.innerHTML = "";
  standings.standings.forEach((row, idx) => {
    const rank = idx + 1;
    const tr = document.createElement("tr");
    tr.className = "standings-row";
    tr.innerHTML = `
      <td class="rank-cell">${medalFor(rank)}</td>
      <td class="team-name">${teamDisplayName(teams, row.team_id)} <span class="expand-hint">▾</span></td>
      <td><span class="pill">${row.league_points}</span></td>
      <td>${row.raw_points}</td>
    `;

    const detailTr = document.createElement("tr");
    detailTr.className = "standings-detail-row";
    detailTr.style.display = "none";
    const detailTd = document.createElement("td");
    detailTd.colSpan = 4;
    detailTd.innerHTML = `<ul class="entry-detail-list">${entryDetailRows(teams, scores, row.team_id)}</ul>`;
    detailTr.appendChild(detailTd);

    tr.addEventListener("click", () => {
      const showing = detailTr.style.display !== "none";
      detailTr.style.display = showing ? "none" : "table-row";
      tr.classList.toggle("expanded", !showing);
    });

    el.appendChild(tr);
    el.appendChild(detailTr);
  });
}

async function renderTeams() {
  const el = document.getElementById("teams-grid");
  if (!el) return;
  const teams = await fetchJSON("data/teams.json");
  el.innerHTML = "";
  Object.keys(teams)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((teamId) => {
      const entries = teams[teamId];
      const card = document.createElement("div");
      card.className = "card team-card";
      card.innerHTML = `
        <h3>Team ${teamId}</h3>
        <ul>
          ${entries
            .map(
              (e) => `<li>${fplLinkHtml(e.entry_id, e.entry_name)}<br><span class="entry-manager">${e.manager}</span></li>`
            )
            .join("")}
        </ul>
      `;
      el.appendChild(card);
    });
}

async function renderRound() {
  const select = document.getElementById("round-select");
  const body = document.getElementById("round-body");
  if (!select || !body) return;

  const [teams, standings] = await Promise.all([
    fetchJSON("data/teams.json"),
    fetchJSON("data/standings.json"),
  ]);

  const rounds = standings.rounds;
  select.innerHTML = rounds
    .map((r) => `<option value="${r.event}">Vòng ${r.event}</option>`)
    .join("");

  function renderForEvent(event) {
    const roundData = rounds.find((r) => r.event === Number(event));
    body.innerHTML = "";
    if (!roundData) return;

    const rows = Object.entries(roundData.teams)
      .map(([teamId, data]) => ({ teamId, ...data }))
      .sort((a, b) => (b.round_points ?? -1) - (a.round_points ?? -1));

    rows.forEach((row, idx) => {
      const rank = idx + 1;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="rank-cell">${medalFor(rank)}</td>
        <td class="team-name">${teamDisplayName(teams, row.teamId)}</td>
        <td>${row.round_points ?? "-"}</td>
        <td><span class="pill">${row.league_points ?? "-"}</span></td>
        <td>${row.cumulative_league_points}</td>
      `;
      body.appendChild(tr);
    });
  }

  select.addEventListener("change", (e) => renderForEvent(e.target.value));
  if (rounds.length) {
    select.value = rounds[rounds.length - 1].event;
    renderForEvent(select.value);
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-link-btn");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  try {
    await copyToClipboard(btn.dataset.url);
    const original = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1500);
  } catch (err) {
    window.prompt("Copy link này rồi dán vào trình duyệt:", btn.dataset.url);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderHomeStandings().catch(console.error);
  renderTeams().catch(console.error);
  renderRound().catch(console.error);
});
