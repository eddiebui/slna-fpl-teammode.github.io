async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function rankChip(rank) {
  const cls = rank <= 3 ? ` r${rank}` : "";
  return `<span class="rank-chip${cls}">${rank}</span>`;
}

function formatUpdatedAt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function teamDisplayName(teams, teamId) {
  return teams[teamId]?.name ?? `Team ${teamId}`;
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

const CHEVRON_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Entry detail rows reuse the same grid columns as the team row above them,
// so an entry's own FPL points line up under the team's FPL points column.
function entryDetailRows(teams, scores, teamId, event) {
  const entries = teams[teamId]?.entries ?? [];
  return entries
    .map((e) => {
      const scoreEntry = scores[String(e.entry_id)];
      const points =
        event == null
          ? scoreEntry?.total ?? "-"
          : scoreEntry?.event_points?.[String(event)] ?? "-";
      const url = fplEntryUrl(e.entry_id);
      return `
        <div class="entry-row">
          <span class="entry-dot"><span></span></span>
          <span class="entry-name-cell">
            <a href="${url}" target="_blank" rel="noopener">${e.entry_name}</a>
            <span class="entry-manager">${e.manager}</span>
          </span>
          <span class="entry-fpl">${points}</span>
          <span></span>
          <button type="button" class="copy-link-btn" data-url="${url}" title="Copy link (dùng nếu app FPL tự mở và hiện sai đội)">⧉</button>
        </div>
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

  document.getElementById("updated-at").textContent = standings.updated_at
    ? `Cập nhật ${formatUpdatedAt(standings.updated_at)} — tự động mỗi giờ`
    : "";

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
        fplPoints: row.raw_points,
        leaguePoints: row.league_points,
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
      fplPoints: row.round_points,
      leaguePoints: row.league_points,
      event,
    }));
  }

  function render() {
    const mode = gwSelect.value;
    const isAll = mode === "all";
    head.innerHTML = `
      <span>Hạng</span>
      <span>Team</span>
      <span style="text-align:right">${isAll ? "Tổng điểm FPL" : "Điểm FPL vòng"}</span>
      <span style="text-align:right">${isAll ? "Tổng điểm League" : "Điểm League vòng"}</span>
      <span></span>
    `;

    const rows = computeRows(mode);
    body.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("div");
      tr.className = "standings-row";
      tr.innerHTML = `
        ${rankChip(row.rank)}
        <span class="team-cell">
          <span class="team-name">${teamDisplayName(teams, row.teamId)}</span>
          <span class="team-meta">${(teams[row.teamId]?.entries ?? []).length} đội</span>
        </span>
        <span class="metric-fpl">${row.fplPoints ?? "-"}</span>
        <span class="pill">${row.leaguePoints ?? "-"}</span>
        <span class="chev">${CHEVRON_SVG}</span>
      `;

      const detailWrap = document.createElement("div");
      detailWrap.className = "detail-wrap";
      const isExpanded = expanded.has(row.teamId);
      if (isExpanded) detailWrap.classList.add("open");
      tr.classList.toggle("expanded", isExpanded);
      detailWrap.innerHTML = entryDetailRows(teams, scores, row.teamId, row.event);

      tr.addEventListener("click", () => {
        const showing = detailWrap.classList.contains("open");
        detailWrap.classList.toggle("open", !showing);
        tr.classList.toggle("expanded", !showing);
        if (showing) expanded.delete(row.teamId);
        else expanded.add(row.teamId);
      });

      body.appendChild(tr);
      body.appendChild(detailWrap);
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
  const [teams, standings] = await Promise.all([
    fetchJSON("data/teams.json"),
    fetchJSON("data/standings.json"),
  ]);
  const totalByTeam = Object.fromEntries(
    standings.standings.map((row) => [row.team_id, row.raw_points])
  );
  el.innerHTML = "";
  Object.keys(teams)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((teamId) => {
      const entries = teams[teamId].entries;
      const card = document.createElement("div");
      card.className = "team-card";
      card.innerHTML = `
        <div class="card-head">
          <span class="team-tag">${teamDisplayName(teams, teamId)}</span>
          <span class="team-total">${totalByTeam[teamId] ?? "-"} đ</span>
        </div>
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
