import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, patchRow, listenAll } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { computeGhanaianGrade, isShsOrTvet } from "../grading.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile, role } = await requireSession({ roles: ["admin", "teacher", "student"] });
mountShell(profile, { title: "Grades & reports", active: "grades.html" });

let students = [];
let classes = [];
let subjects = [];
let grades = [];

if (role === "student") {
    document.getElementById("gradeFormCard")?.classList.add("d-none");
}

function nameOf(id) { return students.find((s) => s.id === id)?.fullName || id; }
function subjectOf(id) { return subjects.find((s) => s.id === id)?.name || id; }
function classNameOf(id) { return classes.find((c) => c.id === id)?.name || id || ""; }

function getSelectedStudent() {
    const studentId = document.getElementById("gradeStudent")?.value;
    return students.find((s) => s.id === studentId) || null;
}

function syncStudentSubjects() {
    const student = getSelectedStudent();
    const select = document.getElementById("gradeSubject");
    if (!select) return;
    const available = subjects.filter((subject) => !subject.classId || subject.classId === student?.classId);
    select.innerHTML = `<option value="" disabled selected>-- Select subject --</option>` +
        available.map((subject) => `<option value="${subject.id}">${escapeHtml(subject.name)}</option>`).join("");
    syncStudentResultsModal(student);
}

function syncStudentResultsModal(student = getSelectedStudent()) {
    const title = document.getElementById("selectedStudentResultsTitle");
    const body = document.getElementById("selectedStudentResultsBody");
    if (!title || !body) return;
    title.textContent = student ? `${student.fullName} results` : "Student results";
    const rows = student ? grades.filter((grade) => grade.studentId === student.id) : [];
    body.innerHTML = rows.length
        ? rows.map((grade) => `<tr><td>${escapeHtml(grade.subjectName || subjectOf(grade.subjectId))}</td><td>${escapeHtml(grade.term || "Term 1")}</td><td>${escapeHtml(grade.score ?? grade.totalScore ?? "0")} / 100</td><td>${escapeHtml(grade.grade || "N/A")}</td><td>${escapeHtml(grade.remark || grade.teacherRemark || "")}</td></tr>`).join("")
        : `<tr><td colspan="5" class="text-muted text-center">No results recorded for this student.</td></tr>`;
}

function syncStudentAssessmentScheme() {
    const student = getSelectedStudent();
    const hintEl = document.getElementById("studentDivisionHint");
    const projCol = document.getElementById("projectScoreCol");
    const badgeCa = document.getElementById("badgeCaMax");
    const badgeExam = document.getElementById("badgeExamMax");
    const schemeTitle = document.getElementById("gradingSchemeTitle");
    const schemeNote = document.getElementById("gradingSchemeNote");
    const gradeCa = document.getElementById("gradeCa");
    const gradeExam = document.getElementById("gradeExam");

    if (!student) {
        if (hintEl) hintEl.textContent = "";
        return;
    }

    const assignedClassName = classNameOf(student.classId);
    const isShs = isShsOrTvet(student.academicTier, assignedClassName);

    if (hintEl) {
        hintEl.innerHTML = `
            <span class="badge ${isShs ? "bg-primary" : "bg-dark"} me-1">${isShs ? "SHS / TVET" : "Basic / JHS"}</span>
            <span class="text-dark fw-semibold">${escapeHtml(student.academicTier || "General")}</span>
            ${assignedClassName ? ` · Class: <span class="badge bg-light text-dark border">${escapeHtml(assignedClassName)}</span>` : " · <span class='badge bg-warning text-dark'>No class</span>"}
        `;
    }

    if (isShs) {
        if (projCol) projCol.style.display = "";
        if (badgeCa) badgeCa.textContent = "/ 30";
        if (gradeCa) gradeCa.max = 30;
        if (badgeExam) badgeExam.textContent = "/ 50";
        if (gradeExam) gradeExam.max = 50;
        if (schemeTitle) {
            schemeTitle.innerHTML = `<i class="bi bi-award me-1 text-primary"></i> SHS / TVET Assessment Scheme (WASSCE Standard: A1 – F9)`;
        }
        if (schemeNote) {
            schemeNote.textContent = "Weighting: CA (30%) + Project Work (20%) + Exam (50%) = 100%";
        }
    } else {
        if (projCol) projCol.style.display = "none";
        if (badgeCa) badgeCa.textContent = "/ 50";
        if (gradeCa) gradeCa.max = 50;
        if (badgeExam) badgeExam.textContent = "/ 50";
        if (gradeExam) gradeExam.max = 50;
        if (schemeTitle) {
            schemeTitle.innerHTML = `<i class="bi bi-award me-1 text-dark"></i> Basic School Assessment Scheme (GES / BECE Standard: Grade 1 – 9)`;
        }
        if (schemeNote) {
            schemeNote.textContent = "Weighting: CA / Classwork (50%) + Exam (50%) = 100%";
        }
    }

    recalculateGrade();
}

function recalculateGrade() {
    const student = getSelectedStudent();
    const assignedClassName = classNameOf(student?.classId);
    const tier = student?.academicTier || "";

    const ca = parseFloat(document.getElementById("gradeCa")?.value) || 0;
    const project = parseFloat(document.getElementById("gradeProject")?.value) || 0;
    const exam = parseFloat(document.getElementById("gradeExam")?.value) || 0;

    const result = computeGhanaianGrade(tier, {
        ca,
        project,
        exam,
        className: assignedClassName
    });

    const totalInput = document.getElementById("gradeTotalDisplay");
    const resultDisplay = document.getElementById("gradeResultDisplay");
    const remarkDisplay = document.getElementById("gradeRemarkDisplay");
    const previewBadge = document.getElementById("gradePreviewBadge");

    if (totalInput) totalInput.value = `${result.totalScore} / 100`;
    if (resultDisplay) resultDisplay.textContent = result.grade;
    if (remarkDisplay) remarkDisplay.textContent = result.remark;
    if (previewBadge) {
        previewBadge.textContent = `Calculated Grade: ${result.grade} (${result.remark})`;
    }
}

// Listeners for live score calculation
document.querySelectorAll(".score-input").forEach((inp) => {
    inp.addEventListener("input", recalculateGrade);
});

document.getElementById("gradeStudent")?.addEventListener("change", () => {
    syncStudentAssessmentScheme();
    syncStudentSubjects();
    if (role !== "student" && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(document.getElementById("selectedStudentResultsModal")).show();
    }
});

listenAll("students", (rows) => {
    students = rows;
    const sel = document.getElementById("gradeStudent");
    if (sel) {
        sel.innerHTML = `<option value="" disabled selected>-- Select a student --</option>` +
            rows.map((s) => `<option value="${s.id}">${escapeHtml(s.fullName)} (${escapeHtml(s.studentCode || "")})</option>`).join("");
    }
    syncStudentSubjects();
    paint();
});

listenAll("classes", (rows) => {
    classes = rows;
    const filter = document.getElementById("gradeClassFilter");
    if (filter) {
        const curr = filter.value;
        filter.innerHTML = `<option value="all">All Classes</option>` +
            rows.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
        filter.value = curr || "all";
    }
    paint();
});

listenAll("subjects", (rows) => {
    subjects = rows;
    const sel = document.getElementById("gradeSubject");
    syncStudentSubjects();
    const filter = document.getElementById("gradeSubjectFilter");
    if (filter) {
        const curr = filter.value;
        filter.innerHTML = `<option value="all">All Subjects</option>` +
            rows.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
        filter.value = curr || "all";
    }
    paint();
});

listenAll("grades", (rows) => {
    grades = rows;
    syncStudentResultsModal();
    paint();
});

document.getElementById("gradeClassFilter")?.addEventListener("change", paint);
document.getElementById("gradeSubjectFilter")?.addEventListener("change", paint);
document.getElementById("gradeTermFilter")?.addEventListener("change", paint);

function paint() {
    const classFilter = document.getElementById("gradeClassFilter")?.value || "all";
    const subjectFilter = document.getElementById("gradeSubjectFilter")?.value || "all";
    const termFilter = document.getElementById("gradeTermFilter")?.value || "all";

    const baseVisible = role === "student"
        ? grades.filter((g) => g.studentId === profile.studentId)
        : grades;

    const filtered = baseVisible.filter((g) => {
        const matchClass = classFilter === "all" || g.classId === classFilter;
        const matchSubject = subjectFilter === "all" || g.subjectId === subjectFilter;
        const matchTerm = termFilter === "all" || g.term === termFilter;
        return matchClass && matchSubject && matchTerm;
    });

    document.getElementById("gradeBody").innerHTML = filtered.map((g) => {
        const student = students.find((s) => s.id === g.studentId);
        const studentName = student?.fullName || g.studentName || nameOf(g.studentId);
        const subjName = g.subjectName || subjectOf(g.subjectId);
        const clsName = classNameOf(g.classId || student?.classId);
        const total = g.score != null ? g.score : (g.totalScore || 0);

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(studentName)}</strong>
                    <div class="small text-muted font-monospace">${escapeHtml(student?.studentCode || g.studentCode || "")}</div>
                </td>
                <td>
                    <div>${clsName ? `<span class="badge bg-light text-dark border">${escapeHtml(clsName)}</span>` : "<span class='text-muted small'>Unassigned</span>"}</div>
                    <div class="small text-muted">${escapeHtml(g.academicTier || student?.academicTier || "")}</div>
                </td>
                <td><strong>${escapeHtml(subjName)}</strong></td>
                <td>${escapeHtml(g.term || "Term 1")}</td>
                <td>${g.caScore != null ? escapeHtml(g.caScore) : "—"}</td>
                <td>${g.projectScore != null ? escapeHtml(g.projectScore) : "<span class='text-muted'>N/A</span>"}</td>
                <td>${g.examScore != null ? escapeHtml(g.examScore) : "—"}</td>
                <td class="fw-bold fs-6">${escapeHtml(total)} / 100</td>
                <td>
                    <span class="badge bg-dark">${escapeHtml(g.grade || "N/A")}</span>
                </td>
                <td>
                    <span class="small text-muted">${escapeHtml(g.remark || g.teacherRemark || "")}</span>
                </td>
                <td class="text-end text-nowrap">
                    ${(role === "admin" || role === "teacher") ? `
                        <button class="btn btn-sm btn-outline-crimson rounded-0 edit-grade-btn" data-id="${g.id}">
                            <i class="bi bi-pencil me-1"></i> Edit Mark
                        </button>
                        ${role === "admin" ? `<button class="btn btn-sm btn-outline-danger rounded-0 delete-record-btn ms-1" data-id="${g.id}"><i class="bi bi-trash"></i></button>` : ""}
                    ` : ""}
                </td>
            </tr>
        `;
    }).join("") || `<tr><td colspan="11" class="text-muted text-center py-4">No grades recorded matching filters.</td></tr>`;
}

// Form submit: Record new grade
document.getElementById("gradeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentId = document.getElementById("gradeStudent").value;
    const subjectId = document.getElementById("gradeSubject").value;

    if (!studentId || !subjectId) {
        alert("Please select both a student and a subject.");
        return;
    }

    const student = students.find((s) => s.id === studentId);
    const subject = subjects.find((s) => s.id === subjectId);
    const assignedClassName = classNameOf(student?.classId);
    const tier = student?.academicTier || "";
    const isShs = isShsOrTvet(tier, assignedClassName);

    const ca = parseFloat(document.getElementById("gradeCa").value) || 0;
    const project = isShs ? (parseFloat(document.getElementById("gradeProject").value) || 0) : null;
    const exam = parseFloat(document.getElementById("gradeExam").value) || 0;
    const teacherRemark = document.getElementById("gradeRemark").value.trim();
    const term = document.getElementById("gradeTerm").value.trim();
    const yearBatch = document.getElementById("gradeYearBatch").value.trim() || "2026/2027";

    const computed = computeGhanaianGrade(tier, {
        ca,
        project: project || 0,
        exam,
        className: assignedClassName
    });

    const saveBtn = document.getElementById("saveGradeBtn");
    const alertEl = document.getElementById("gradeAlert");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        await addRow("grades", {
            studentId,
            studentName: student?.fullName || "",
            studentCode: student?.studentCode || "",
            classId: student?.classId || "",
            className: assignedClassName,
            academicTier: tier,
            subjectId,
            subjectName: subject?.name || subjectOf(subjectId),
            term,
            yearBatch,
            caScore: ca,
            projectScore: project,
            examScore: exam,
            score: computed.totalScore,
            maxScore: 100,
            grade: computed.grade,
            remark: computed.remark,
            teacherRemark,
            gradingSystem: computed.systemName,
            recordedBy: profile.name || profile.contactEmail || "Teacher",
            recordedByRole: role,
            createdAt: new Date().toISOString()
        });

        if (alertEl) {
            alertEl.className = "alert alert-success rounded-0";
            alertEl.textContent = `Grade saved for ${student?.fullName || "Student"} in ${subject?.name || "Subject"}: Total ${computed.totalScore}/100 (${computed.grade} - ${computed.remark}).`;
            alertEl.classList.remove("d-none");
            setTimeout(() => alertEl.classList.add("d-none"), 5000);
        }

        document.getElementById("gradeCa").value = "";
        if (document.getElementById("gradeProject")) document.getElementById("gradeProject").value = "";
        document.getElementById("gradeExam").value = "";
        document.getElementById("gradeRemark").value = "";
        document.getElementById("gradeTotalDisplay").value = "0";
        document.getElementById("gradePreviewBadge").textContent = "Calculated Grade: --";
    } catch (err) {
        if (alertEl) {
            alertEl.className = "alert alert-danger rounded-0";
            alertEl.textContent = err.message || "Failed to record grade.";
            alertEl.classList.remove("d-none");
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check-circle me-1"></i> Save Grade`;
    }
});

// Edit Mark Modal Logic (Teachers & Admins)
const editModalEl = document.getElementById("editGradeModal");
let activeEditingGrade = null;

function recalculateEditGrade() {
    if (!activeEditingGrade) return;
    const isShs = isShsOrTvet(activeEditingGrade.academicTier, activeEditingGrade.className);
    const ca = parseFloat(document.getElementById("editCa")?.value) || 0;
    const project = isShs ? (parseFloat(document.getElementById("editProject")?.value) || 0) : 0;
    const exam = parseFloat(document.getElementById("editExam")?.value) || 0;

    const result = computeGhanaianGrade(activeEditingGrade.academicTier, {
        ca,
        project,
        exam,
        className: activeEditingGrade.className
    });

    document.getElementById("editTotalScore").textContent = result.totalScore;
    document.getElementById("editGrade").textContent = result.grade;
    document.getElementById("editRemark").textContent = result.remark;
}

document.querySelectorAll(".edit-score-input").forEach((inp) => {
    inp.addEventListener("input", recalculateEditGrade);
});

document.getElementById("gradeBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".edit-grade-btn");
    if (!btn) return;
    const grade = grades.find((g) => g.id === btn.dataset.id);
    if (!grade) return;
    activeEditingGrade = grade;

    const student = students.find((s) => s.id === grade.studentId);
    const isShs = isShsOrTvet(grade.academicTier || student?.academicTier, grade.className || classNameOf(student?.classId));

    document.getElementById("editGradeId").value = grade.id;
    document.getElementById("editStudentName").textContent = student?.fullName || grade.studentName || "Student";
    document.getElementById("editSubjectName").textContent = grade.subjectName || subjectOf(grade.subjectId);
    document.getElementById("editClassName").textContent = grade.className || classNameOf(grade.classId) || "Unassigned";
    document.getElementById("editTermName").textContent = `${grade.term || "Term 1"} (${grade.yearBatch || "2026/2027"})`;

    const caInput = document.getElementById("editCa");
    const projCol = document.getElementById("editProjectCol");
    const projInput = document.getElementById("editProject");
    const examInput = document.getElementById("editExam");

    caInput.value = grade.caScore != null ? grade.caScore : (grade.score || 0);
    examInput.value = grade.examScore != null ? grade.examScore : 0;
    document.getElementById("editTeacherRemark").value = grade.teacherRemark || grade.remark || "";

    if (isShs) {
        projCol.style.display = "";
        projInput.value = grade.projectScore != null ? grade.projectScore : 0;
        document.getElementById("editLabelCa").textContent = "Continuous Assessment (/30)";
        document.getElementById("editLabelExam").textContent = "End of Term Exam (/50)";
        caInput.max = 30;
        examInput.max = 50;
    } else {
        projCol.style.display = "none";
        document.getElementById("editLabelCa").textContent = "Continuous Assessment (/50)";
        document.getElementById("editLabelExam").textContent = "End of Term Exam (/50)";
        caInput.max = 50;
        examInput.max = 50;
    }

    recalculateEditGrade();
    document.getElementById("editGradeAlert").classList.add("d-none");

    if (window.bootstrap?.Modal && editModalEl) {
        window.bootstrap.Modal.getOrCreateInstance(editModalEl).show();
    }
});

document.getElementById("gradeBody").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn || role !== "admin") return;
    const grade = grades.find((g) => g.id === btn.dataset.id);
    await deleteAdminRecord({ button: btn, collection: "grades", id: grade?.id, label: `grade record for ${grade?.studentName || "this student"}` });
});

document.getElementById("editGradeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeEditingGrade) return;

    const gradeId = document.getElementById("editGradeId").value;
    const isShs = isShsOrTvet(activeEditingGrade.academicTier, activeEditingGrade.className);
    const ca = parseFloat(document.getElementById("editCa").value) || 0;
    const project = isShs ? (parseFloat(document.getElementById("editProject").value) || 0) : null;
    const exam = parseFloat(document.getElementById("editExam").value) || 0;
    const teacherRemark = document.getElementById("editTeacherRemark").value.trim();

    const computed = computeGhanaianGrade(activeEditingGrade.academicTier, {
        ca,
        project: project || 0,
        exam,
        className: activeEditingGrade.className
    });

    const submitBtn = document.getElementById("saveEditGradeBtn");
    const alertEl = document.getElementById("editGradeAlert");
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating...";

    try {
        await patchRow("grades", gradeId, {
            caScore: ca,
            projectScore: project,
            examScore: exam,
            score: computed.totalScore,
            maxScore: 100,
            grade: computed.grade,
            remark: computed.remark,
            teacherRemark,
            lastEditedBy: profile.name || profile.contactEmail,
            lastEditedAt: new Date().toISOString()
        });

        if (window.bootstrap?.Modal && editModalEl) {
            window.bootstrap.Modal.getOrCreateInstance(editModalEl).hide();
        }
    } catch (err) {
        if (alertEl) {
            alertEl.className = "alert alert-danger rounded-0";
            alertEl.textContent = err.message || "Failed to update mark.";
            alertEl.classList.remove("d-none");
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Update Mark";
    }
});

