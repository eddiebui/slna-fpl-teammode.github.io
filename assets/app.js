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

function entryDetailRows(teams, scores, teamId, event) {
  const entries = teams[teamId] || [];
  return entries
    .map((e) => {
      const scoreEntry = scores[String(e.entry_id)];
      const points =
        event == null
          ? scoreEntry?.total ?? "-"
          : scoreEntry?.event_points?.[String(event)] ?? "-";
      return `
        <li>
          ${fplLinkHtml(e.entry_id, e.entry_name)}
          <span class="entry-manager">${e.manager}</span>
          <span class="pill entry-points">${points}</span>
        </li>
      `;
    })
    .join("");
}

async function renderStandings() {
  const body = document.getElementById("standings-body");
  if (!body) return;
  const head = document.getElementById("standings-head");
  const gwSelect = document.getElementById("gw-select");
  const toggleWrap = document.getElementById("view-toggle");

  const [teams, standings, scores] = await Promise.all([
    fetchJSON("data/teams.json"),
    fetchJSON("data/standings.json"),
    fetchJSON("data/scores.json"),
  ]);

  document.getElementById("updated-at").textContent =
    standings.updated_at ? `Cập nhật lần cuối: ${formatUpdatedAt(standings.updated_at)}` : "";

  const rounds = standings.rounds;
  gwSelect.innerHTML =
    `<option value="all">Tất cả các vòng</option>` +
    rounds.map((r) => `<option value="${r.event}">Vòng ${r.event}</option>`).join("");

  const expanded = new Set();

  function computeRows(mode) {
    if (mode === "all") {
      return standings.standings.map((row, idx) => ({
        teamId: row.team_id,
        rank: idx + 1,
        leaguePoints: row.league_points,
        rawPoints: row.raw_points,
        event: null,
      }));
    }
    const event = Number(mode);
    const roundData = rounds.find((r) => r.event === event);
    if (!roundData) return [];
    const arr = Object.entries(roundData.teams)
      .map(([teamId, d]) => ({ teamId, ...d }))
      .sort((a, b) => (b.round_points ?? -1) - (a.round_points ?? -1));
    return arr.map((row, idx) => ({
      teamId: row.teamId,
      rank: idx + 1,
      roundPoints: row.round_points,
      leaguePoints: row.league_points,
      cumulative: row.cumulative_league_points,
      event,
    }));
  }

  function render() {
    const mode = gwSelect.value;
    const isAll = mode === "all";
    head.innerHTML = isAll
      ? `<tr><th>Hạng</th><th>Team</th><th>Điểm League</th><th>Tổng điểm FPL</th></tr>`
      : `<tr><th>Hạng</th><th>Team</th><th>Điểm vòng</th><th>Điểm League</th><th>Tổng lũy kế</th></tr>`;
    const colSpan = isAll ? 4 : 5;

    const rows = computeRows(mode);
    body.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.className = "standings-row";
      tr.innerHTML = isAll
        ? `
          <td class="rank-cell">${medalFor(row.rank)}</td>
          <td class="team-name">${teamDisplayName(teams, row.teamId)} <span class="expand-hint">▾</span></td>
          <td><span class="pill">${row.leaguePoints}</span></td>
          <td>${row.rawPoints}</td>
        `
        : `
          <td class="rank-cell">${medalFor(row.rank)}</td>
          <td class="team-name">${teamDisplayName(teams, row.teamId)} <span class="expand-hint">▾</span></td>
          <td>${row.roundPoints ?? "-"}</td>
          <td><span class="pill">${row.leaguePoints ?? "-"}</span></td>
          <td>${row.cumulative}</td>
        `;

      const detailTr = document.createElement("tr");
      detailTr.className = "standings-detail-row";
      const isExpanded = expanded.has(row.teamId);
      detailTr.style.display = isExpanded ? "table-row" : "none";
      tr.classList.toggle("expanded", isExpanded);
      const detailTd = document.createElement("td");
      detailTd.colSpan = colSpan;
      detailTd.innerHTML = `<ul class="entry-detail-list">${entryDetailRows(teams, scores, row.teamId, row.event)}</ul>`;
      detailTr.appendChild(detailTd);

      tr.addEventListener("click", () => {
        const showing = detailTr.style.display !== "none";
        detailTr.style.display = showing ? "none" : "table-row";
        tr.classList.toggle("expanded", !showing);
        if (showing) expanded.delete(row.teamId);
        else expanded.add(row.teamId);
      });

      body.appendChild(tr);
      body.appendChild(detailTr);
    });
  }

  gwSelect.addEventListener("change", () => {
    expanded.clear();
    render();
  });

  if (toggleWrap) {
    toggleWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn");
      if (!btn) return;
      toggleWrap.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b === btn));
      expanded.clear();
      if (btn.dataset.mode === "full") {
        computeRows(gwSelect.value).forEach((row) => expanded.add(row.teamId));
      }
      render();
    });
  }

  gwSelect.value = "all";
  render();
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
  renderStandings().catch(console.error);
  renderTeams().catch(console.error);
});
