import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, listenAll } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile, role } = await requireSession({ roles: ["admin", "teacher", "student"] });
mountShell(profile, { title: "Attendance", active: "attendance.html" });

let classes = [];
let students = [];
let records = [];

listenAll("classes", (rows) => {
    classes = rows;
    document.getElementById("attClass").innerHTML = rows.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    drawRoster();
});
listenAll("students", (rows) => { students = rows; drawRoster(); drawStudentView(); });
listenAll("attendance", (rows) => { records = rows; drawStudentView(); drawAttendanceRecords(); });

document.getElementById("attDate").valueAsDate = new Date();

function drawRoster() {
    if (role === "student") return;
    const classId = document.getElementById("attClass").value;
    const roster = students.filter((s) => !classId || s.classId === classId);
    document.getElementById("attRoster").innerHTML = roster.map((s) => `
        <div class="d-flex justify-content-between border-bottom py-2">
            <span>${escapeHtml(s.fullName)}</span>
            <select class="form-select form-select-sm rounded-0 w-auto att-status" data-id="${s.id}">
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
            </select>
        </div>
    `).join("") || `<p class="text-muted">No students in this class. Assign students to a class first.</p>`;
}

document.getElementById("attClass").addEventListener("change", drawRoster);

function drawStudentView() {
    if (role !== "student") return;
    document.getElementById("staffAttendance").classList.add("d-none");
    document.getElementById("studentAttendance").classList.remove("d-none");
    const sid = profile.studentId;
    const mine = [];
    records.forEach((a) => {
        (a.records || []).forEach((r) => {
            if (r.studentId === sid) mine.push({ date: a.date, status: r.status });
        });
    });
    document.getElementById("studentAttendance").innerHTML = mine.length
        ? `<ul class="list-group rounded-0">${mine.map((m) => `<li class="list-group-item">${escapeHtml(m.date)} · ${escapeHtml(m.status)}</li>`).join("")}</ul>`
        : `<p class="text-muted">No attendance recorded yet.</p>`;
}

function drawAttendanceRecords() {
    const container = document.getElementById("attendanceRecords");
    if (!container || role !== "admin") return;
    container.innerHTML = records.length
        ? `<h2 class="h5 font-serif">Saved attendance sessions</h2><div class="list-group rounded-0">${records.map((record) => `
            <div class="list-group-item rounded-0 d-flex justify-content-between align-items-center">
                <span>${escapeHtml(record.date || "Undated session")} · ${escapeHtml(classes.find((c) => c.id === record.classId)?.name || record.classId || "No class")}</span>
                <button class="btn btn-sm btn-outline-danger delete-record-btn" data-id="${record.id}"><i class="bi bi-trash me-1"></i> Delete</button>
            </div>`).join("")}</div>`
        : `<p class="text-muted">No attendance sessions recorded yet.</p>`;
}

document.getElementById("attendanceRecords")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn || role !== "admin") return;
    await deleteAdminRecord({ button: btn, collection: "attendance", id: btn.dataset.id, label: "attendance session" });
});

document.getElementById("attForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (role === "student") return;
    const classId = document.getElementById("attClass").value;
    const date = document.getElementById("attDate").value;
    const roll = [...document.querySelectorAll(".att-status")].map((el) => ({
        studentId: el.dataset.id,
        status: el.value
    }));
    await addRow("attendance", { classId, date, records: roll });
    alert("Attendance saved.");
});
