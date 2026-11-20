/* Navigation and motion stay optional. The cards, notes and star links are HTML. */
"use strict";

function setupSample() {
  const fixtures = document.getElementById("sample-data");
  if (!fixtures) return;
  const { upcs, products } = JSON.parse(fixtures.textContent);
  const editedSku = document.getElementById("demo-sku");
  const run = document.getElementById("clean-sample");
  const reset = document.getElementById("reset-sample");
  const result = document.getElementById("sample-result");
  const rows = document.getElementById("result-rows");
  const status = document.getElementById("demo-status");
  const originalSku = products[products.length - 1][0];
  let ran = false;

  function calculate() {
    const catalog = new Map();
    for (let i = 0; i < products.length; i++) {
      const [rawSku, name, color] = products[i];
      const sku = (i === products.length - 1 ? editedSku.value : rawSku).trim();
      if (sku && !catalog.has(sku)) catalog.set(sku, [name, color]);
    }
    const seen = new Set();
    const output = document.createDocumentFragment();
    let matched = 0;
    for (const [rawSku, rawUpc] of upcs) {
      const sku = rawSku.trim();
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      const upc = rawUpc.replace(/\s+/g, "").replace(/\.0+$/, "");
      const product = catalog.get(sku);
      if (product) matched++;
      const row = document.createElement("tr");
      for (const value of [sku, upc, ...(product || ["", ""])]) {
        const cell = document.createElement("td");
        cell.textContent = value || "—";
        if (!value) { cell.className = "empty"; cell.setAttribute("aria-label", "无匹配资料"); }
        row.append(cell);
      }
      output.append(row);
    }
    rows.replaceChildren(output);
    result.hidden = false;
    ran = true;
    status.textContent = "已保留 " + seen.size + " 条有效 SKU，其中 " + matched + " 条匹配到商品资料。";
  }

  run.addEventListener("click", calculate);
  editedSku.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); calculate(); }
  });
  editedSku.addEventListener("input", () => {
    if (!ran) return;
    result.hidden = true;
    status.textContent = "样本已修改，再次运行即可查看新结果。";
  });
  reset.addEventListener("click", () => {
    editedSku.value = originalSku;
    rows.replaceChildren();
    result.hidden = true;
    ran = false;
    status.textContent = "已还原原始样本。";
  });
}

function setupFlow() {
  const controls = document.querySelector(".flow-tabs");
  if (!controls) return;
  const buttons = [...controls.querySelectorAll("button")];
  function select(selected) {
    for (const button of buttons) {
      const active = button === selected;
      button.setAttribute("aria-pressed", String(active));
      document.getElementById(button.getAttribute("aria-controls")).hidden = !active;
    }
  }
  for (const button of buttons) button.addEventListener("click", () => select(button));
  select(buttons[0]);
  controls.hidden = false;
}

setupSample();
setupFlow();
