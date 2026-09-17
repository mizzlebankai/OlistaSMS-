import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, listenAll } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile } = await requireSession({ roles: ["admin"] });
mountShell(profile, { title: "Classes & subjects", active: "classes.html" });

let classes = [];
let teachers = [];
let students = [];
let subjects = [];

function renderSubjects() {
    const rows = subjects;
    document.getElementById("subjectList").innerHTML = rows.length
        ? Array.from(rows.reduce((groups, subject) => {
            const key = subject.classId || "unassigned";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(subject);
            return groups;
        }, new Map()).entries()).map(([classId, items]) => `
            <li class="list-group-item rounded-0 p-0">
                <div class="bg-light border-bottom px-3 py-2 fw-bold">${escapeHtml(classes.find((c) => c.id === classId)?.name || "All classes / Unassigned")}</div>
                ${items.map((s) => `<div class="px-3 py-2 d-flex justify-content-between align-items-center border-bottom"><span>${escapeHtml(s.name)}</span><button class="btn btn-sm btn-outline-danger delete-subject-btn" data-id="${s.id}"><i class="bi bi-trash"></i></button></div>`).join("")}
            </li>`).join("")
        : `<li class="list-group-item text-muted">No subjects yet.</li>`;
}

function fillSelects() {
    document.getElementById("classTeacher").innerHTML =
        `<option value="">None</option>` + teachers.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    document.getElementById("subjectClass").innerHTML =
        `<option value="">All classes</option>` + classes.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
}

function renderClasses() {
    const unassigned = students.filter((s) => !s.classId);
    const unassignedHtml = unassigned.length
        ? `<div class="alert alert-warning py-2 mb-3 rounded-0 small d-flex justify-content-between align-items-center">
             <span><i class="bi bi-exclamation-triangle me-1"></i> <strong>${unassigned.length}</strong> student(s) currently unassigned to any class.</span>
             <a href="students.html" class="btn btn-sm btn-dark rounded-0 py-0" style="font-size:0.75rem">Assign in Students</a>
           </div>`
        : "";

    const listHtml = classes.map((c) => {
        const count = students.filter((s) => s.classId === c.id).length;
        const teacherName = teachers.find((t) => t.id === c.teacherId)?.name;
        return `
            <li class="list-group-item rounded-0 d-flex justify-content-between align-items-center">
                <div>
                    <strong>${escapeHtml(c.name)}</strong>
                    <div class="small text-muted">
                        ${escapeHtml(c.academicTier || "General")} · Batch: ${escapeHtml(c.yearBatch || "N/A")}
                        ${teacherName ? ` · Class Teacher: <span class="text-dark fw-semibold">${escapeHtml(teacherName)}</span>` : ""}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge ${count > 0 ? "bg-primary" : "bg-secondary"} rounded-pill">${count} student${count === 1 ? "" : "s"}</span>
                    <button class="btn btn-sm btn-outline-danger delete-class-btn" data-id="${c.id}"><i class="bi bi-trash"></i></button>
                </div>
            </li>
        `;
    }).join("") || `<li class="list-group-item text-muted">No classes yet.</li>`;

    document.getElementById("classList").innerHTML = unassignedHtml + listHtml;
}

listenAll("students", (rows) => { students = rows; renderClasses(); });
listenAll("teachers", (rows) => { teachers = rows; fillSelects(); renderClasses(); });
listenAll("classes", (rows) => {
    classes = rows;
    renderClasses();
    fillSelects();
    renderSubjects();
});
listenAll("subjects", (rows) => {
    subjects = rows;
    renderSubjects();
});

document.getElementById("classList").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-class-btn");
    if (!btn) return;
    const item = classes.find((c) => c.id === btn.dataset.id);
    await deleteAdminRecord({ button: btn, collection: "classes", id: item?.id, label: `class ${item?.name || "record"}`, note: "Students assigned to this class will remain enrolled and keep their current class reference." });
});

document.getElementById("subjectList").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-subject-btn");
    if (!btn) return;
    await deleteAdminRecord({ button: btn, collection: "subjects", id: btn.dataset.id, label: "subject" });
});

document.getElementById("classForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addRow("classes", {
        name: fd.get("name").trim(),
        academicTier: fd.get("academicTier").trim(),
        yearBatch: fd.get("yearBatch").trim(),
        teacherId: fd.get("teacherId") || ""
    });
    e.target.reset();
});

document.getElementById("subjectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addRow("subjects", {
        name: fd.get("name").trim(),
        classId: fd.get("classId") || ""
    });
    e.target.reset();
});
