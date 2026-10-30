"use strict";
(async () => {
  const video = document.querySelector(".hero-video video");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) video.pause();
  try {
    const response = await fetch("project-data.json");
    if (!response.ok) throw new Error("Summary unavailable");
    const project = await response.json();
    let current = "strength";
    const selected = document.getElementById("show-selected");
    const configs = {
      strength: {data: project.strength, arms: ["lambda10", "lambda25"], labels: ["λ10", "λ25"], slug: "retention-strength", pr: 19, title: "Stronger anchoring recovers the target seed but sacrifices other gains.", conclusion: "λ25 changes final successes by −4, −3 and +5. It fails the criterion because the other seeds lose more than the allowed two successes each. Keep λ10 as the reference."},
      retention: {data: project.retention, arms: ["baseline", "anchored"], labels: ["Baseline PPO", "Teacher-anchored PPO"], slug: "teacher-retention", pr: 18, title: "Teacher anchoring substantially reduces regression, with one unstable seed.", conclusion: "Anchoring improves all three paired baselines and exceeds the teacher in two. Seed 2042 still finishes below the teacher and loses selected-checkpoint performance. The promising rule passes; consistent retention remains unresolved."}
    };
    function renderStudy() {
      const c = configs[current], d = c.data;
      for (const name of ["strength", "retention"]) document.getElementById(`tab-${name}`).setAttribute("aria-pressed", String(name === current));
      document.getElementById("study-label").textContent = `PR #${c.pr} · criterion ${d.criterion_met ? "met" : "not met"}`;
      document.getElementById("study-title").textContent = c.title;
      document.getElementById("study-report").href = `reports/${c.slug}/`;
      document.getElementById("study-context").textContent = `262,144 transitions per learner. Same 50 reset pairs within this study; original PickCube task and 50-step horizon.`;
      document.getElementById("table-caption").textContent = `Test resets ${d.test_seeds[0]}–${d.test_seeds.at(-1)} · BC teacher ${d.teacher}/50 on this list · final success is primary.`;
      const heads = ["Training seed", ...c.labels.map(x => `${x} final`), "Final change"];
      if (selected.checked) heads.push(...c.labels.map(x => `${x} selected`));
      const table = document.getElementById("results-table");
      table.tHead.replaceChildren(); table.tBodies[0].replaceChildren();
      const header = table.tHead.insertRow();
      for (const title of heads) { const th = document.createElement("th"); th.scope = "col"; th.textContent = title; header.append(th); }
      for (const r of d.rows) {
        const change = r[`${c.arms[1]}_final`] - r[`${c.arms[0]}_final`];
        const values = [String(r.seed), ...c.arms.map(a => `${r[`${a}_final`]}/50`), `${change >= 0 ? "+" : ""}${change}`];
        if (selected.checked) values.push(...c.arms.map(a => `${r[`${a}_best`]}/50`));
        const tr = table.tBodies[0].insertRow();
        values.forEach((value, index) => { const cell = tr.insertCell(); cell.textContent = value; if (index === 3) cell.className = change >= 0 ? "gain" : "loss"; });
      }
      document.getElementById("study-conclusion").textContent = c.conclusion;
    }
    for (const name of ["strength", "retention"]) document.getElementById(`tab-${name}`).addEventListener("click", () => {current = name; renderStudy();});
    selected.addEventListener("change", renderStudy);
    renderStudy();
    const grid = document.getElementById("report-grid"), search = document.getElementById("report-search");
    function renderReports() {
      const query = search.value.trim().toLowerCase();
      const reports = project.reports.filter(r => `${r.title} ${r.summary} ${r.slug}`.toLowerCase().includes(query));
      grid.replaceChildren();
      document.getElementById("report-count").textContent = `${reports.length} of ${project.reports.length} reports · newest first`;
      for (const report of reports) {
        const card = document.createElement("a"); card.className = "report-card"; card.href = `reports/${report.slug}/`;
        for (const [tag, value, cls] of [["small", `PR #${report.pr} · ${report.pr === 19 ? "latest study" : "archive"}`, ""], ["h3", report.title, ""], ["p", report.summary, ""], ["span", "Explore evidence ↗", "arrow"]]) {
          const child = document.createElement(tag); child.textContent = value; if (cls) child.className = cls; card.append(child);
        }
        grid.append(card);
      }
      if (!reports.length) { const p = document.createElement("p"); p.textContent = "No reports match. Try a task or method name."; grid.append(p); }
    }
    search.addEventListener("input", renderReports); renderReports();
  } catch (error) {
    document.getElementById("data-error").hidden = false;
    document.getElementById("report-grid").textContent = "Report index unavailable. Use the latest report link above or the GitHub experiment ledger.";
  }
})();
