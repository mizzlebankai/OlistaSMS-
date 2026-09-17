import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { listenAll, boardingLabel, patchRow } from "../store.js";
import { provisionStudentRecord } from "../enroll-student.js";
import { printStudentForm } from "../print-student.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile, role } = await requireSession({ roles: ["admin", "teacher"] });
mountShell(profile, { title: "Students", active: "students.html" });

if (role !== "admin") {
    document.getElementById("walkInBtn")?.classList.add("d-none");
}

let students = [];
let classes = [];
let grades = [];
let attendance = [];

function className(id) {
    return classes.find((c) => c.id === id)?.name || id || "";
}

function render() {
    const board = document.getElementById("boardFilter").value;
    const classFilterVal = document.getElementById("classFilter")?.value || "all";
    const q = document.getElementById("studentSearch").value.trim().toLowerCase();
    const rows = students.filter((s) => {
        const matchBoard = board === "all" || s.boardingStatus === board;
        const matchClass = classFilterVal === "all" || (classFilterVal === "unassigned" ? !s.classId : s.classId === classFilterVal);
        const matchQ = !q || [s.fullName, s.studentCode, s.institutionalEmail, className(s.classId)].some((v) => String(v || "").toLowerCase().includes(q));
        return matchBoard && matchClass && matchQ;
    });
    document.getElementById("studentBody").innerHTML = rows.map((s) => {
        const assignedName = className(s.classId);
        return `
        <tr>
            <td class="font-monospace">${escapeHtml(s.studentCode)}</td>
            <td>
                <strong>${escapeHtml(s.fullName)}</strong>
                <div class="small text-muted">${escapeHtml(s.institutionalEmail || "")}</div>
            </td>
            <td>
                ${assignedName 
                    ? `<span class="badge bg-light text-dark border border-secondary">${escapeHtml(assignedName)}</span>`
                    : `<span class="badge bg-warning text-dark">Unassigned</span>`
                }
                <button class="btn btn-sm btn-link p-0 text-decoration-none ms-1 assign-btn" data-id="${s.id}" title="Change Class">
                    <i class="bi bi-pencil-square"></i>
                </button>
            </td>
            <td><span class="badge ${s.boardingStatus === "boarding" ? "badge-boarding" : "badge-day"}">${escapeHtml(boardingLabel(s.boardingStatus))}</span></td>
            <td>${escapeHtml(s.entrySource || "")}</td>
            <td>${escapeHtml(s.accountStatus || "")}</td>
            <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-outline-crimson rounded-0 assign-btn me-1" data-id="${s.id}">Assign Class</button>
                <button class="btn btn-sm btn-outline-dark rounded-0 form-btn" data-id="${s.id}">View form</button>
                ${role === "admin" ? `<button class="btn btn-sm btn-outline-danger rounded-0 delete-record-btn ms-1" data-id="${s.id}"><i class="bi bi-trash"></i></button>` : ""}
            </td>
        </tr>
    `;
    }).join("") || `<tr><td colspan="7" class="text-muted">No students match.</td></tr>`;
}

listenAll("students", (rows) => { students = rows; render(); });
listenAll("classes", (rows) => {
    classes = rows;
    const sel = document.getElementById("walkInClass");
    if (sel) {
        sel.innerHTML = `<option value="">Unassigned</option>` + rows.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    }
    const filterSel = document.getElementById("classFilter");
    if (filterSel) {
        const currentVal = filterSel.value;
        filterSel.innerHTML = `<option value="all">All Classes</option><option value="unassigned">Unassigned</option>` + rows.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
        filterSel.value = currentVal || "all";
    }
    const assignSel = document.getElementById("assignClassSelect");
    if (assignSel) {
        assignSel.innerHTML = `<option value="">-- Remove Class (Unassigned) --</option>` + rows.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    }
    render();
});
listenAll("grades", (rows) => { grades = rows; });
listenAll("attendance", (rows) => { attendance = rows; });

document.getElementById("boardFilter").addEventListener("change", render);
document.getElementById("classFilter")?.addEventListener("change", render);
document.getElementById("studentSearch").addEventListener("input", render);

document.getElementById("studentBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".form-btn");
    if (!btn) return;
    const student = students.find((s) => s.id === btn.dataset.id);
    const studentGrades = grades.filter((g) => g.studentId === student.id).map((g) => ({
        ...g,
        subjectName: g.subjectName
    }));
    const related = attendance.filter((a) => (a.records || []).some((r) => r.studentId === student.id));
    let present = 0;
    let total = 0;
    related.forEach((a) => {
        (a.records || []).forEach((r) => {
            if (r.studentId === student.id) {
                total += 1;
                if (r.status === "present") present += 1;
            }
        });
    });
    const summary = total ? `${present} present of ${total} recorded sessions.` : "";
    printStudentForm(student, studentGrades, summary);
});

document.getElementById("studentBody").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn || role !== "admin") return;
    const student = students.find((s) => s.id === btn.dataset.id);
    await deleteAdminRecord({
        button: btn,
        collection: "students",
        id: student?.id,
        label: `student profile for ${student?.fullName || "this student"}`,
        note: "Linked grades, fees, and attendance remain preserved. The Firebase Auth login remains, but its portal profile is removed so dashboard access is blocked.",
        related: student?.authUid ? [{ collection: "users", id: student.authUid }] : []
    });
});

const tierSelect = document.getElementById("walkInTier");
const streamSelect = document.getElementById("walkInStream");
tierSelect?.addEventListener("change", () => {
    const tier = tierSelect.value;
    if (streamSelect) {
        streamSelect.value = "";
        streamSelect.querySelectorAll("optgroup").forEach((group) => {
            group.hidden = Boolean(tier && group.dataset.tier !== tier);
        });
    }
});

document.getElementById("walkInForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const firstName = fd.get("firstName").trim();
    const lastName = fd.get("lastName").trim();
    try {
        await provisionStudentRecord({
            firstName,
            middleName: fd.get("middleName").trim(),
            lastName,
            fullName: [firstName, fd.get("middleName").trim(), lastName].filter(Boolean).join(" "),
            dob: fd.get("dob"),
            gender: fd.get("gender"),
            academicTier: fd.get("academicTier"),
            programStream: fd.get("programStream"),
            classId: fd.get("classId"),
            boardingStatus: fd.get("boardingStatus"),
            guardianName: fd.get("guardianName"),
            guardianPhone: fd.get("guardianPhone"),
            contactEmail: fd.get("contactEmail"),
            address: fd.get("address"),
            yearBatch: fd.get("yearBatch")?.trim() || "2026/2027",
            entrySource: "walk_in",
            entryLevel: className(fd.get("classId"))
        });
        bootstrap.Modal.getInstance(document.getElementById("walkInModal"))?.hide();
        e.target.reset();
    } catch (err) {
        alert(err.message);
    }
});

// --- Assign Class Modal Logic ---
const assignModalEl = document.getElementById("assignClassModal");
const assignForm = document.getElementById("assignClassForm");

document.getElementById("studentBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".assign-btn");
    if (!btn) return;
    const student = students.find((s) => s.id === btn.dataset.id);
    if (!student) return;

    document.getElementById("assignStudentId").value = student.id;
    document.getElementById("assignStudentName").textContent = student.fullName || "Student";
    document.getElementById("assignStudentCode").textContent = student.studentCode || "";
    const sel = document.getElementById("assignClassSelect");
    if (sel) {
        sel.value = student.classId || "";
    }
    const alertEl = document.getElementById("assignAlert");
    if (alertEl) alertEl.classList.add("d-none");

    if (window.bootstrap?.Modal && assignModalEl) {
        window.bootstrap.Modal.getOrCreateInstance(assignModalEl).show();
    }
});

if (assignForm) {
    assignForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const studentId = document.getElementById("assignStudentId").value;
        const newClassId = document.getElementById("assignClassSelect").value;
        const submitBtn = document.getElementById("assignClassSubmitBtn");
        const alertEl = document.getElementById("assignAlert");

        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        try {
            const student = students.find((s) => s.id === studentId);
            const assignedClassName = className(newClassId);

            await patchRow("students", studentId, {
                classId: newClassId || "",
                entryLevel: assignedClassName || ""
            });

            if (student?.authUid) {
                await patchRow("users", student.authUid, {
                    classId: newClassId || ""
                }).catch(() => {});
            }

            if (window.bootstrap?.Modal && assignModalEl) {
                window.bootstrap.Modal.getOrCreateInstance(assignModalEl).hide();
            }
        } catch (err) {
            if (alertEl) {
                alertEl.className = "alert alert-danger rounded-0";
                alertEl.textContent = err.message || "Failed to update class assignment.";
                alertEl.classList.remove("d-none");
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Class Assignment";
        }
    });
}

