import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, listenAll } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile, role } = await requireSession();
mountShell(profile, { title: "Timetable", active: "timetable.html" });

let classes = [];
let subjects = [];
let teachers = [];
let slots = [];
let students = [];

if (role === "student" || role === "teacher" || role === "staff") {
    document.getElementById("ttForm").classList.add("d-none");
}

listenAll("classes", (rows) => {
    classes = rows;
    document.getElementById("ttClass").innerHTML = rows.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    paint();
});
listenAll("subjects", (rows) => {
    subjects = rows;
    document.getElementById("ttSubject").innerHTML = rows.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
});
listenAll("teachers", (rows) => {
    teachers = rows;
    document.getElementById("ttTeacher").innerHTML = rows.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    paint();
});
listenAll("students", (rows) => { students = rows; paint(); });
listenAll("timetable", (rows) => { slots = rows; paint(); });

function paint() {
    let visible = slots;
    if (role === "student") {
        const me = students.find((s) => s.id === profile.studentId);
        visible = slots.filter((s) => s.classId === me?.classId);
    }
    if (role === "teacher") {
        visible = slots.filter((s) => s.teacherId === profile.teacherId);
    }
    document.getElementById("ttBody").innerHTML = visible.map((s) => `
        <tr>
            <td>${escapeHtml(classes.find((c) => c.id === s.classId)?.name || s.classId)}</td>
            <td>${escapeHtml(s.day)}</td>
            <td>${escapeHtml(s.period)}</td>
            <td>${escapeHtml(subjects.find((x) => x.id === s.subjectId)?.name || s.subjectId)}</td>
            <td>${escapeHtml(teachers.find((t) => t.id === s.teacherId)?.name || s.teacherId)}</td>
            ${role === "admin" ? `<td class="text-end"><button class="btn btn-sm btn-outline-danger delete-record-btn" data-id="${s.id}"><i class="bi bi-trash"></i></button></td>` : ""}
        </tr>
    `).join("") || `<tr><td colspan="5" class="text-muted">No timetable slots yet.</td></tr>`;
}

document.getElementById("ttBody").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn || role !== "admin") return;
    await deleteAdminRecord({ button: btn, collection: "timetable", id: btn.dataset.id, label: "timetable slot" });
});

document.getElementById("ttForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await addRow("timetable", {
        classId: document.getElementById("ttClass").value,
        day: document.getElementById("ttDay").value,
        period: document.getElementById("ttPeriod").value.trim(),
        subjectId: document.getElementById("ttSubject").value,
        teacherId: document.getElementById("ttTeacher").value
    });
    e.target.reset();
});
