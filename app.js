const REPOSITORY = "caotengde/price-action-review";
const state = {
  manifest: null,
  currentCase: null,
  review: null,
  selectedItemId: null,
  chartPoint: null,
  correctionItemId: null,
  pendingIssueUrl: null,
};

const CATEGORY_NAMES = {
  MARKET_STATE: "市场状态", STRUCTURE: "结构形态", LEVEL_ZONE: "水平区域",
  CHANNEL: "趋势通道", MEASURED_MOVE: "测量移动", CROSS_TIMEFRAME: "周期关系",
};
const CODE_TRANSLATIONS = {
  ACTIVE: "有效", BALANCED: "平衡震荡", BEAR: "空头", BEAR_CHANNEL: "空头通道",
  BEAR_FLAG: "空头旗形", BEAR_MEASURED_MOVE: "空头测量移动", BREAKOUT_PULLBACK_LONG: "向上突破回测",
  BREAKOUT_PULLBACK_SHORT: "向下突破回测", BROKEN_DOWN: "向下跌破", BROKEN_UP: "向上突破",
  BULL: "多头", BULL_CHANNEL: "多头通道", BULL_FLAG: "多头旗形",
  BULL_MEASURED_MOVE: "多头测量移动", CHILD_CONSOLIDATION: "子周期盘整",
  CHILD_INSIDE_PARENT_BALANCE: "子周期位于父周期平衡区", COMPLETE: "已完成K线",
  CONFIRMED: "已确认", CONTEXT_ALIGNED: "背景同向", CONTEXT_COUNTERTREND: "背景逆向",
  CONTEXT_DIRECTION: "背景方向", COUNTERTREND_REVERSAL_ATTEMPT: "逆势反转尝试",
  DEVELOPING: "形成中K线", DOUBLE_BOTTOM: "双底", DOUBLE_TOP: "双顶", EARLY: "早期",
  ESTABLISHED: "已建立", FAILED_BREAKOUT_DOWN: "向下假突破", FAILED_BREAKOUT_UP: "向上假突破",
  IMPULSE: "推动", INTERMEDIATE: "中级别", LEG: "当前运动性质",
  LEG_AGAINST_PARENT_CONTEXT: "当前腿逆父周期背景", LEG_DIRECTION: "当前腿方向",
  LEG_WITH_PARENT_CONTEXT: "当前腿顺父周期背景", LOCATION: "所处位置", LOWER_EDGE: "下沿",
  MAJOR: "大级别", MICRO: "微观级别", MIDDLE: "中部", MINOR: "小级别",
  OVERSHOOT_DOWN: "向下过冲", OVERSHOOT_UP: "向上过冲", PHASE: "市场阶段",
  RANGE: "交易区间", RANGE_EDGE_REVERSAL: "区间边缘反转",
  RANGE_INTERNAL_STRUCTURE: "区间内部结构", REGIME: "市场状态", RESISTANCE: "阻力",
  RETESTED_AS_RESISTANCE: "回测为阻力", RETESTED_AS_SUPPORT: "回测为支撑",
  ROTATION_DOWN: "向下轮转", ROTATION_UP: "向上轮转", SUPPORT: "支撑", TESTING: "正在测试",
  TESTING_TARGET: "正在测试目标", THREE_PUSH_DOWN: "向下三推", THREE_PUSH_UP: "向上三推",
  TOPOLOGY_COMPLETE: "形态结构完成", TRANSITION: "转换／未决", TREND_DOWN: "空头趋势",
  TREND_UP: "多头趋势", UNRESOLVED: "尚未明确", WITH_CONTEXT_CONTINUATION: "顺背景延续",
};
const STATE_LABELS = {
  regime: "市场状态", context_direction: "背景方向", leg_direction: "当前腿",
  phase: "市场阶段", location: "所处位置", confidence: "置信度",
};
const ERROR_TAGS = [
  ["WRONG_MARKET_CYCLE", "市场周期错误"], ["WRONG_CONTEXT", "背景理解错误"],
  ["WRONG_DIRECTION", "方向错误"], ["WRONG_LOCATION", "位置错误"],
  ["WRONG_SCALE", "尺度错误"], ["WRONG_ANCHOR", "锚点错误"],
  ["WRONG_LIFECYCLE", "生命周期错误"], ["OVER_DETECTION", "过度识别"],
  ["OTHER", "其他"],
];
const SELF_AUDIT_REASONS = {
  "confidence_below_0.55": "置信度不足 0.55",
  state_challengers_disagree: "不同状态模型未形成多数共识",
  cross_timeframe_challengers_disagree: "跨周期关系未形成多数共识",
  developing_bar_differs_from_last_closed_bar: "未收盘K线与上一根完整K线结论不同",
  not_robust_to_stricter_thresholds: "收紧识别阈值后不再成立",
  primary_recompute_mismatch: "主模型重算结果不一致",
};
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function translateCode(value) {
  return CODE_TRANSLATIONS[value] || String(value ?? "");
}

function codeWithOriginal(value) {
  const code = String(value ?? ""); const translated = translateCode(code);
  if (!code || translated === code) return escapeHtml(code);
  return `<span class="translated-code">${escapeHtml(translated)}<small>${escapeHtml(code)}</small></span>`;
}

function translateStatement(value) {
  return String(value ?? "").replace(/\b[A-Z][A-Z0-9_]*\b/g, (code) => {
    const translated = CODE_TRANSLATIONS[code];
    return translated ? `${translated}（${code}）` : code;
  });
}

function translateStatementHtml(value) {
  const source = String(value ?? ""); let output = ""; let cursor = 0;
  for (const match of source.matchAll(/\b[A-Z][A-Z0-9_]*\b/g)) {
    output += escapeHtml(source.slice(cursor, match.index));
    const code = match[0]; const translated = CODE_TRANSLATIONS[code];
    output += translated
      ? `${escapeHtml(translated)}<small class="inline-code">（${escapeHtml(code)}）</small>`
      : escapeHtml(code);
    cursor = match.index + code.length;
  }
  return output + escapeHtml(source.slice(cursor));
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function storageKey(caseItem) { return `price-action-review:v1:${caseItem.case_fingerprint}`; }
function emptyReview() { return { annotations: {}, custom_items: [], updated_utc: null }; }
function loadStoredReview(caseItem) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(caseItem)) || "null");
    return value && value.annotations && Array.isArray(value.custom_items) ? value : emptyReview();
  } catch { return emptyReview(); }
}
function saveReview() {
  state.review.updated_utc = new Date().toISOString();
  localStorage.setItem(storageKey(state.currentCase), JSON.stringify(state.review));
  $("#saveState").textContent = `已自动保存 · ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
  renderGlobalProgress();
  renderCaseList();
}

async function loadManifest() {
  const response = await fetch("./data/cases.json", { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取公开案例清单");
  state.manifest = await response.json();
  if (state.manifest.schema_version !== 1 || !Array.isArray(state.manifest.cases)) {
    throw new Error("案例清单版本不受支持");
  }
  $("#caseCount").textContent = state.manifest.cases.length;
  restoreReviewerProfile();
  renderGlobalProgress();
  renderCaseList();
  if (state.manifest.cases.length) loadCase(state.manifest.cases[0].case_id);
}

function reviewCounts(caseItem) {
  const review = loadStoredReview(caseItem);
  return {
    reviewed: Object.keys(review.annotations).length,
    missing: review.custom_items.length,
    total: caseItem.items.length,
  };
}

function selfAuditCounts(caseItem) {
  return caseItem.items.reduce((result, item) => {
    if (item.self_audit?.decision === "AUTO_ACCEPTED") result.accepted += 1;
    if (item.self_audit?.decision === "EXCLUDED") result.excluded += 1;
    return result;
  }, { accepted: 0, excluded: 0, total: caseItem.items.length });
}

function renderGlobalProgress() {
  if (!state.manifest) return;
  const totals = state.manifest.self_audit?.summary || state.manifest.cases.reduce((result, item) => {
    const counts = selfAuditCounts(item);
    result.auto_accepted += counts.accepted; result.total_items += counts.total;
    return result;
  }, { auto_accepted: 0, total_items: 0 });
  const percent = totals.total_items ? Math.round(totals.auto_accepted / totals.total_items * 100) : 0;
  $("#globalProgressText").textContent = `自审通过 ${totals.auto_accepted} / ${totals.total_items} 条 · ${percent}%`;
  $("#globalProgressBar").style.width = `${percent}%`;
}

function renderCaseList() {
  if (!state.manifest) return;
  $("#caseList").innerHTML = state.manifest.cases.map((item) => {
    const counts = selfAuditCounts(item);
    const percent = counts.total ? Math.round(counts.accepted / counts.total * 100) : 0;
    return `<button class="case-button ${item.case_id === state.currentCase?.case_id ? "active" : ""}" data-case-id="${escapeHtml(item.case_id)}">
      <div class="case-button-top"><span class="case-symbol">${escapeHtml(item.symbol)}</span><span class="case-tf">${escapeHtml(item.timeframe)}</span></div>
      <p>${escapeHtml(translateCode(item.summary.regime))} · 通过 ${counts.accepted} · 隔离 ${counts.excluded}</p>
      <div class="mini-track"><i style="width:${percent}%"></i></div></button>`;
  }).join("");
  document.querySelectorAll(".case-button").forEach((button) => button.addEventListener("click", () => loadCase(button.dataset.caseId)));
}

function loadCase(caseId) {
  state.currentCase = state.manifest.cases.find((item) => item.case_id === caseId);
  if (!state.currentCase) return;
  state.review = loadStoredReview(state.currentCase);
  state.selectedItemId = state.currentCase.items[0]?.item_id || null;
  state.chartPoint = null;
  $("#chartMarker").hidden = true;
  renderCaseList(); renderCaseHeader(); populateCategoryFilter(); renderReviewItems(); renderCustomItems();
  const image = $("#caseImage");
  $("#chartLoading").hidden = false;
  image.onload = () => { $("#chartLoading").hidden = true; };
  image.onerror = () => { $("#chartLoading").textContent = "图表载入失败"; };
  image.src = state.currentCase.image_url;
  $("#submitReviewButton").disabled = false;
  $("#clearCaseButton").disabled = false;
}

function renderCaseHeader() {
  const item = state.currentCase;
  $("#symbolBadge").textContent = item.symbol; $("#timeframeBadge").textContent = item.timeframe;
  $("#barStatus").innerHTML = codeWithOriginal(item.bar_status); $("#caseTitle").textContent = item.title;
  $("#caseTimestamp").textContent = `数据截止 ${new Date(item.data_end_utc).toLocaleString("zh-CN", { hour12: false })} · ${item.interpreter_name}`;
  const summary = item.summary;
  const cells = [["regime", summary.regime], ["context_direction", summary.context_direction], ["leg_direction", summary.leg_direction], ["phase", summary.phase], ["location", summary.location], ["confidence", Number(summary.confidence).toFixed(2)]];
  $("#stateStrip").innerHTML = cells.map(([field, value]) => `<div class="state-cell"><span>${STATE_LABELS[field]}</span><strong>${field === "confidence" ? escapeHtml(value) : codeWithOriginal(value)}</strong></div>`).join("");
  const auditCounts = selfAuditCounts(item);
  $("#caseProgress").textContent = `通过 ${auditCounts.accepted} · 隔离 ${auditCounts.excluded}`;
  $("#saveState").textContent = state.review.updated_utc ? `上次保存 ${new Date(state.review.updated_utc).toLocaleString("zh-CN", { hour12: false })}` : "自动保存在本浏览器";
}

function populateCategoryFilter() {
  const filter = $("#categoryFilter"); const prior = filter.value;
  const categories = [...new Set(state.currentCase.items.map((item) => item.category))];
  filter.innerHTML = '<option value="ALL">全部类别</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(CATEGORY_NAMES[category] || category)}</option>`).join("");
  if ([...filter.options].some((option) => option.value === prior)) filter.value = prior;
}

function filteredItems() {
  const category = $("#categoryFilter").value; const status = $("#statusFilter").value; const audit = $("#selfAuditFilter").value;
  return state.currentCase.items.filter((item) => {
    const itemStatus = state.review.annotations[item.item_id]?.verdict || "UNREVIEWED";
    const auditStatus = item.self_audit?.decision || "NOT_AUDITED";
    return (category === "ALL" || item.category === category) && (status === "ALL" || itemStatus === status) && (audit === "ALL" || auditStatus === audit);
  });
}

function renderReviewItems() {
  const items = filteredItems();
  if (!items.length) { $("#reviewItems").innerHTML = '<div class="empty-state">当前筛选下没有判断项</div>'; return; }
  if (!items.some((item) => item.item_id === state.selectedItemId)) state.selectedItemId = items[0].item_id;
  $("#reviewItems").innerHTML = items.map((item) => {
    const annotation = state.review.annotations[item.item_id]; const status = annotation?.verdict || "UNREVIEWED";
    const confidence = item.confidence == null ? "—" : Number(item.confidence).toFixed(2);
    const audit = item.self_audit; const accepted = audit?.decision === "AUTO_ACCEPTED";
    const auditLabel = accepted ? "✓ 自动通过" : audit?.decision === "EXCLUDED" ? "⚑ 自动隔离" : "尚未自审";
    const auditReasons = audit?.reasons?.length ? `<div class="audit-reasons">${audit.reasons.map((reason) => escapeHtml(SELF_AUDIT_REASONS[reason] || reason)).join(" · ")}</div>` : "";
    return `<article class="review-item status-${status} ${item.item_id === state.selectedItemId ? "focused" : ""}" data-item-id="${escapeHtml(item.item_id)}">
      <div class="claim-body"><div class="claim-meta"><span class="category-label">${escapeHtml(CATEGORY_NAMES[item.category] || item.category)} · ${codeWithOriginal(item.object_type)}</span><span class="audit-badge ${accepted ? "accepted" : "excluded"}">${auditLabel}</span></div>
      <p>${translateStatementHtml(item.statement_cn)}</p><div class="claim-audit-meta"><span>模型置信 ${confidence}</span>${audit?.support != null ? `<span>交叉支持 ${audit.support}</span>` : ""}</div>${auditReasons}${annotation?.verdict === "INCORRECT" ? `<div class="saved-correction"><strong>你的修正：</strong>${escapeHtml(annotation.corrected_value)}</div>` : ""}</div>
      <div class="claim-actions"><button class="verdict-button correct ${status === "CORRECT" ? "selected" : ""}" data-verdict="CORRECT">✓ 正确</button><button class="verdict-button incorrect ${status === "INCORRECT" ? "selected" : ""}" data-verdict="INCORRECT">× 错误</button><button class="verdict-button uncertain ${status === "UNCERTAIN" ? "selected" : ""}" data-verdict="UNCERTAIN">? 不确定</button></div></article>`;
  }).join("");
  document.querySelectorAll(".review-item").forEach((element) => element.addEventListener("click", (event) => { state.selectedItemId = element.dataset.itemId; if (!event.target.closest(".verdict-button")) renderReviewItems(); }));
  document.querySelectorAll(".verdict-button").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); const itemId = button.closest(".review-item").dataset.itemId; state.selectedItemId = itemId; chooseVerdict(itemId, button.dataset.verdict); }));
}

function chooseVerdict(itemId, verdict) {
  if (!itemId) return;
  if (verdict === "INCORRECT") { openCorrection(itemId); return; }
  state.review.annotations[itemId] = { item_id: itemId, verdict, corrected_value: "", comment: "", error_tags: [], updated_utc: new Date().toISOString() };
  saveReview(); renderCaseHeader(); renderReviewItems(); focusNextUnreviewed();
  showToast(verdict === "CORRECT" ? "已保存为正确样本" : "已保存为不确定样本");
}

function openCorrection(itemId) {
  const item = state.currentCase.items.find((candidate) => candidate.item_id === itemId); const prior = state.review.annotations[itemId];
  state.correctionItemId = itemId; $("#systemStatement").textContent = translateStatement(item.statement_cn);
  $("#correctedValue").value = prior?.corrected_value || ""; $("#correctionComment").value = prior?.comment || "";
  $("#errorTags").innerHTML = ERROR_TAGS.map(([value, label]) => `<label class="tag-check"><input type="checkbox" value="${value}" ${prior?.error_tags?.includes(value) ? "checked" : ""}><span>${label}</span></label>`).join("");
  $("#correctionDialog").showModal(); $("#correctedValue").focus();
}

function saveCorrection(event) {
  event.preventDefault(); const corrected = $("#correctedValue").value.trim(); if (!corrected) return;
  state.review.annotations[state.correctionItemId] = { item_id: state.correctionItemId, verdict: "INCORRECT", corrected_value: corrected, comment: $("#correctionComment").value.trim(), error_tags: [...document.querySelectorAll("#errorTags input:checked")].map((input) => input.value), updated_utc: new Date().toISOString() };
  saveReview(); $("#correctionDialog").close(); renderCaseHeader(); renderReviewItems(); focusNextUnreviewed(); showToast("错误样本和修正已保存");
}

function focusNextUnreviewed() {
  const items = filteredItems(); const currentIndex = items.findIndex((item) => item.item_id === state.selectedItemId);
  const next = [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex)].find((item) => !state.review.annotations[item.item_id]);
  if (next) { state.selectedItemId = next.item_id; renderReviewItems(); document.querySelector(`[data-item-id="${CSS.escape(next.item_id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

function chartClicked(event) {
  const image = $("#caseImage"); const rect = image.getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)); const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  state.chartPoint = { x, y }; const marker = $("#chartMarker"); const stageRect = $("#chartStage").getBoundingClientRect();
  marker.style.left = `${event.clientX - stageRect.left + $("#chartStage").scrollLeft}px`; marker.style.top = `${event.clientY - stageRect.top + $("#chartStage").scrollTop}px`; marker.hidden = false;
  $("#missingStatement").focus(); showToast(`已记录图表位置 ${Math.round(x * 100)}%, ${Math.round(y * 100)}%`);
}

function addMissingItem(event) {
  event.preventDefault(); const expected = $("#missingStatement").value.trim(); if (!expected) return;
  state.review.custom_items.push({ item_id: crypto.randomUUID(), category: $("#missingCategory").value, expected_statement: expected, comment: $("#missingComment").value.trim(), chart_x: state.chartPoint?.x ?? null, chart_y: state.chartPoint?.y ?? null, created_utc: new Date().toISOString() });
  saveReview(); $("#missingForm").reset(); state.chartPoint = null; $("#chartMarker").hidden = true; renderCustomItems(); showToast("遗漏理解已加入本次审核");
}
function renderCustomItems() { $("#customItems").innerHTML = state.review.custom_items.map((item) => `<span class="custom-chip">遗漏 · ${escapeHtml(item.expected_statement)}</span>`).join(""); }

function restoreReviewerProfile() {
  try { const profile = JSON.parse(localStorage.getItem("price-action-review:profile") || "{}"); $("#reviewerName").value = profile.reviewer_name || ""; $("#experienceLevel").value = profile.experience_level || "UNSPECIFIED"; } catch { /* ignore */ }
}
function saveReviewerProfile() { localStorage.setItem("price-action-review:profile", JSON.stringify({ reviewer_name: $("#reviewerName").value.trim(), experience_level: $("#experienceLevel").value })); }

async function gzipBase64(value) {
  if (!("CompressionStream" in window)) throw new Error("当前浏览器不支持安全压缩，请使用最新版 Chrome、Edge、Safari 或 Firefox");
  const compressed = new Blob([new TextEncoder().encode(value)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
  let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function submissionPayload() {
  const annotations = Object.values(state.review.annotations).sort((a, b) => a.item_id.localeCompare(b.item_id));
  return { schema_version: 1, submission_id: crypto.randomUUID(), case_id: state.currentCase.case_id, case_fingerprint: state.currentCase.case_fingerprint, contributor: { claimed_name: $("#reviewerName").value.trim(), experience_level: $("#experienceLevel").value }, created_utc: new Date().toISOString(), annotations, missing_interpretations: state.review.custom_items };
}

async function openSubmitDialog() {
  const reviewed = Object.keys(state.review.annotations).length; const missing = state.review.custom_items.length;
  if (!reviewed && !missing) { showToast("请至少审核一条判断或添加一个遗漏理解", true); return; }
  saveReviewerProfile();
  $("#submitSummary").innerHTML = `<strong>${escapeHtml(state.currentCase.title)}</strong><br>已判断 ${reviewed} / ${state.currentCase.items.length} 条，其中错误 ${Object.values(state.review.annotations).filter((item) => item.verdict === "INCORRECT").length} 条、不确定 ${Object.values(state.review.annotations).filter((item) => item.verdict === "UNCERTAIN").length} 条；补充遗漏 ${missing} 条。`;
  $("#submitDialog").showModal();
}

async function confirmSubmission() {
  try {
    const payload = submissionPayload(); const compressed = await gzipBase64(JSON.stringify(payload));
    const title = `[Semantic Review] ${state.currentCase.symbol} ${state.currentCase.timeframe} · ${payload.submission_id.slice(0, 8)}`;
    const incorrect = payload.annotations.filter((item) => item.verdict === "INCORRECT").length;
    const body = `## Price Action Semantic Review\n\n- Case: \`${payload.case_id}\`\n- Fingerprint: \`${payload.case_fingerprint}\`\n- Reviewed claims: **${payload.annotations.length}**\n- Incorrect claims: **${incorrect}**\n- Missing interpretations: **${payload.missing_interpretations.length}**\n- Experience: \`${payload.contributor.experience_level}\`\n\nPlease submit this issue without editing the machine payload below. A validation workflow will add it to the public dataset.\n\n<!-- PRICE_ACTION_REVIEW_GZIP_BASE64\n${compressed}\n-->`;
    const issueUrl = `https://github.com/${REPOSITORY}/issues/new?template=semantic-review.md&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    if (issueUrl.length > 30000) throw new Error("本次标签过多，提交包超出安全长度，请分周期提交");
    state.pendingIssueUrl = issueUrl; window.open(issueUrl, "_blank", "noopener,noreferrer");
    $("#submitDialog").close(); showToast("已打开 GitHub，请登录并点击 Submit new issue");
  } catch (error) { showToast(error.message, true); }
}

function clearCurrentCase() {
  if (!confirm("确定清空当前图在本浏览器中的所有标签和遗漏理解吗？")) return;
  localStorage.removeItem(storageKey(state.currentCase)); state.review = emptyReview(); renderCaseHeader(); renderReviewItems(); renderCustomItems(); renderGlobalProgress(); renderCaseList(); showToast("当前图的本地标签已清空");
}

function moveSelection(delta) {
  const items = filteredItems(); if (!items.length) return; const index = Math.max(0, items.findIndex((item) => item.item_id === state.selectedItemId));
  state.selectedItemId = items[(index + delta + items.length) % items.length].item_id; renderReviewItems(); document.querySelector(`[data-item-id="${CSS.escape(state.selectedItemId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindEvents() {
  $("#categoryFilter").addEventListener("change", renderReviewItems); $("#selfAuditFilter").addEventListener("change", renderReviewItems); $("#statusFilter").addEventListener("change", renderReviewItems);
  $("#caseImage").addEventListener("click", chartClicked); $("#missingForm").addEventListener("submit", addMissingItem);
  $("#correctionForm").addEventListener("submit", saveCorrection); $("#closeDialog").addEventListener("click", () => $("#correctionDialog").close()); $("#cancelCorrection").addEventListener("click", () => $("#correctionDialog").close());
  $("#submitReviewButton").addEventListener("click", openSubmitDialog); $("#closeSubmitDialog").addEventListener("click", () => $("#submitDialog").close()); $("#cancelSubmit").addEventListener("click", () => $("#submitDialog").close()); $("#confirmSubmit").addEventListener("click", confirmSubmission);
  $("#clearCaseButton").addEventListener("click", clearCurrentCase); $("#reviewerName").addEventListener("change", saveReviewerProfile); $("#experienceLevel").addEventListener("change", saveReviewerProfile);
  document.addEventListener("keydown", (event) => { if (!state.currentCase || $("#correctionDialog").open || $("#submitDialog").open || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return; if (event.key === "1") chooseVerdict(state.selectedItemId, "CORRECT"); if (event.key === "2") chooseVerdict(state.selectedItemId, "INCORRECT"); if (event.key === "3") chooseVerdict(state.selectedItemId, "UNCERTAIN"); if (event.key.toLowerCase() === "j") moveSelection(1); if (event.key.toLowerCase() === "k") moveSelection(-1); });
}

async function main() { bindEvents(); try { await loadManifest(); } catch (error) { showToast(error.message, true); $("#caseList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; } }
main();
