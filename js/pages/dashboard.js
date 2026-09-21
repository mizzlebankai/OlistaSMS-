import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { listenAll, boardingLabel, removeRow } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteStudentData } from "../admin-delete.js";

const { profile, role } = await requireSession();
mountShell(profile, { title: "Dashboard", active: "dashboard.html" });

const cards = document.getElementById("dashCards");
const extra = document.getElementById("dashExtra");
const adminControls = document.getElementById("adminControls");
const batchFilter = document.getElementById("batchFilter");
const batchBadge = document.getElementById("batchBadge");
const deleteBatchSelect = document.getElementById("deleteBatchSelect");
const deleteBatchBtn = document.getElementById("deleteBatchBtn");

if (role === "admin" && adminControls) {
    adminControls.classList.remove("d-none");
}

const state = {
    students: [],
    apps: [],
    teachers: [],
    users: [],
    fees: [],
    grades: [],
    notices: [],
    attendance: [],
    timetable: []
};

let selectedBatch = "all";

function card(label, value, note = "") {
    return `<div class="col-6 col-md-3">
        <div class="card stat-card shadow-sm p-3">
            <div class="small text-uppercase text-muted fw-bold">${label}</div>
            <div class="fs-3 fw-bold sms-brand">${value}</div>
            <div class="small text-muted">${note}</div>
        </div></div>`;
}

function getUniqueBatches() {
    const batches = new Set(["2026/2027"]);
    state.students.forEach((s) => { if (s.yearBatch) batches.add(String(s.yearBatch).trim()); });
    state.apps.forEach((a) => { if (a.yearBatch) batches.add(String(a.yearBatch).trim()); });
    return Array.from(batches).sort().reverse();
}

function syncBatchDropdowns() {
    const batches = getUniqueBatches();
    const currentVal = batchFilter?.value || "all";

    if (batchFilter) {
        batchFilter.innerHTML = `<option value="all">All Batches</option>` +
            batches.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
        batchFilter.value = batches.includes(currentVal) ? currentVal : "all";
    }

    if (deleteBatchSelect) {
        const curDel = deleteBatchSelect.value;
        deleteBatchSelect.innerHTML = `<option value="">Select a batch...</option>` +
            batches.map((b) => {
                const count = state.students.filter((s) => (s.yearBatch || "2026/2027") === b).length;
                return `<option value="${escapeHtml(b)}">${escapeHtml(b)} (${count} students)</option>`;
            }).join("");
        deleteBatchSelect.value = curDel;
    }

    syncModalNotes();
}

function syncModalNotes() {
    const attEl = document.getElementById("attNote");
    const gradesEl = document.getElementById("gradesNote");
    const feesEl = document.getElementById("feesNote");
    const ttEl = document.getElementById("timetableNote");
    const appsEl = document.getElementById("appsNote");

    if (attEl) attEl.textContent = `${state.attendance.length} session records logged.`;
    if (gradesEl) gradesEl.textContent = `${state.grades.length} grade entries recorded.`;
    if (feesEl) feesEl.textContent = `${state.fees.length} fee invoice records.`;
    if (ttEl) ttEl.textContent = `${state.timetable.length} timetable slot entries.`;
    if (appsEl) appsEl.textContent = `${state.apps.length} admissions applications.`;
}

function renderAdmin() {
    const isFiltered = selectedBatch !== "all";
    const students = isFiltered
        ? state.students.filter((s) => (s.yearBatch || "2026/2027") === selectedBatch)
        : state.students;
    const apps = isFiltered
        ? state.apps.filter((a) => (a.yearBatch || "2026/2027") === selectedBatch)
        : state.apps;
    const studentIds = new Set(students.map((s) => s.id));
    const fees = isFiltered
        ? state.fees.filter((f) => studentIds.has(f.studentId))
        : state.fees;

    const boarding = students.filter((s) => s.boardingStatus === "boarding").length;
    const day = students.filter((s) => s.boardingStatus === "day").length;
    const pendingApps = apps.filter((a) => (a.status || "Pending") === "Pending").length;
    const unpaid = fees.filter((f) => f.status !== "paid").length;
    const pendingVerification = state.users.filter((user) => user.role !== "admin" && user.accountStatus !== "active").length;

    const batchNote = isFiltered ? `Batch ${selectedBatch}` : "All batches";
    if (batchBadge) batchBadge.textContent = batchNote;

    cards.innerHTML = [
        card("Students", students.length, `${boarding} boarding · ${day} day`),
        card("Pending applications", pendingApps, isFiltered ? `Batch: ${selectedBatch}` : ""),
        card("Teachers / Staff", state.teachers.length, "Across all batches"),
        card("Open fee bills", unpaid, isFiltered ? `Batch: ${selectedBatch}` : ""),
        card("Pending verification", pendingVerification, "Contact inbox verification required")
    ].join("");
}

function renderStudent() {
    const me = state.students.find((s) => s.id === profile.studentId) || state.students.find((s) => s.authUid === profile.id);
    extra.innerHTML = me ? `<div class="card rounded-0 p-3">
        <h2 class="h5 font-serif">Welcome, ${escapeHtml(me.fullName)}</h2>
        <p class="mb-1">Status: <span class="badge ${me.boardingStatus === "boarding" ? "badge-boarding" : "badge-day"}">${escapeHtml(boardingLabel(me.boardingStatus))}</span>
        · Batch: <span class="badge bg-secondary font-monospace">${escapeHtml(me.yearBatch || "2026/2027")}</span>
        · Account: ${escapeHtml(me.accountStatus || profile.accountStatus)}</p>
        <p class="small text-muted mb-0">Login ID: ${escapeHtml(me.institutionalEmail)}</p>
    </div>` : "";
    const myGrades = state.grades.filter((g) => g.studentId === (me?.id || profile.studentId));
    const myFees = state.fees.filter((f) => f.studentId === (me?.id || profile.studentId));
    cards.innerHTML = [
        card("My reports", myGrades.length),
        card("Fee records", myFees.length),
        card("Notices", state.notices.length),
        card("Boarding", me ? boardingLabel(me.boardingStatus) : "—")
    ].join("");
}

function paint() {
    syncBatchDropdowns();
    if (role === "student") renderStudent();
    else renderAdmin();
}

// Listen to all relevant collections
listenAll("students", (rows) => { state.students = rows; paint(); });
listenAll("applications", (rows) => { state.apps = rows; paint(); });
listenAll("teachers", (rows) => { state.teachers = rows; paint(); });
listenAll("users", (rows) => { state.users = rows; paint(); });
listenAll("fees", (rows) => { state.fees = rows; paint(); });
listenAll("grades", (rows) => { state.grades = rows; paint(); });
listenAll("announcements", (rows) => { state.notices = rows; paint(); });
listenAll("attendance", (rows) => { state.attendance = rows; syncModalNotes(); });
listenAll("timetable", (rows) => { state.timetable = rows; syncModalNotes(); });

// Batch Filter change
batchFilter?.addEventListener("change", (e) => {
    selectedBatch = e.target.value;
    paint();
});

// Delete Batch Selection handler
deleteBatchSelect?.addEventListener("change", (e) => {
    if (deleteBatchBtn) {
        deleteBatchBtn.disabled = !e.target.value;
    }
});

deleteBatchBtn?.addEventListener("click", async () => {
    const targetBatch = deleteBatchSelect?.value;
    if (!targetBatch) return;

    const matchingStudents = state.students.filter((s) => (s.yearBatch || "2026/2027") === targetBatch);
    const count = matchingStudents.length;

    const confirmMsg = `Are you sure you want to permanently delete all records for academic batch "${targetBatch}"?\n\nThis will remove ${count} student(s), their portal logins, and their linked grades and fee records.\n\nThis action cannot be undone!`;
    if (!confirm(confirmMsg)) return;

    deleteBatchBtn.disabled = true;
    deleteBatchBtn.textContent = "Deleting batch...";

    try {
        for (const s of matchingStudents) {
            await deleteStudentData(s);
        }

        alert(`Batch "${targetBatch}" and its ${count} student records have been permanently deleted.`);
        deleteBatchSelect.value = "";
        deleteBatchBtn.disabled = true;
        if (selectedBatch === targetBatch) {
            selectedBatch = "all";
            if (batchFilter) batchFilter.value = "all";
        }
        paint();
    } catch (err) {
        alert("Batch deletion error: " + err.message);
    } finally {
        deleteBatchBtn.textContent = "Delete Batch Records";
    }
});

// Helper for bulk clearing a collection
async function clearCollection(btn, colName, label, getRecords) {
    const records = getRecords();
    if (!records.length) {
        alert(`No ${label} records to delete.`);
        return;
    }
    if (!confirm(`Are you sure you want to permanently delete ALL ${records.length} ${label} records?\n\nThis action cannot be undone!`)) {
        return;
    }

    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Clearing...";

    try {
        await Promise.all(records.map((r) => removeRow(colName, r.id)));
        alert(`Successfully deleted all ${records.length} ${label} records.`);
    } catch (err) {
        alert(`Error clearing ${label}: ` + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
}

// Module cleanup event listeners
document.getElementById("clearAttendanceBtn")?.addEventListener("click", (e) => {
    clearCollection(e.target, "attendance", "attendance", () => state.attendance);
});

document.getElementById("clearGradesBtn")?.addEventListener("click", (e) => {
    clearCollection(e.target, "grades", "grade and report", () => state.grades);
});

document.getElementById("clearFeesBtn")?.addEventListener("click", (e) => {
    clearCollection(e.target, "fees", "fee invoice", () => state.fees);
});

document.getElementById("clearTimetableBtn")?.addEventListener("click", (e) => {
    clearCollection(e.target, "timetable", "timetable slot", () => state.timetable);
});

document.getElementById("clearAppsBtn")?.addEventListener("click", (e) => {
    clearCollection(e.target, "applications", "admissions application", () => state.apps);
});

