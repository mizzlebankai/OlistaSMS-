import { escapeHtml } from "./provision-auth.js";
import { boardingLabel } from "./store.js";
import { isShsOrTvet, computeGhanaianGrade } from "./grading.js";

export function printStudentForm(student, grades = [], attendanceSummary = "") {
    const logoUrl = new URL("assets/logo.png", window.location.href).href;
    const win = window.open("", "_blank", "width=920,height=1050");
    if (!win) {
        alert("Allow pop-ups to open the student report card.");
        return;
    }

    const assignedClassName = student.entryLevel || student.classId || "";
    const isShs = isShsOrTvet(student.academicTier, assignedClassName);

    const row = (label, value) => `
        <tr><td class="label">${label}</td><td>${escapeHtml(value || "N/A")}</td></tr>`;

    let totalScoreSum = 0;
    let validSubjectCount = 0;

    const gradeRows = grades.length
        ? grades.map((g) => {
            const rawScore = g.score != null ? Number(g.score) : 0;
            totalScoreSum += rawScore;
            validSubjectCount++;

            // Use stored grade, or re-compute if legacy
            let finalGrade = g.grade;
            let finalRemark = g.remark || g.teacherRemark || "";
            if (!finalGrade) {
                const comp = computeGhanaianGrade(student.academicTier, {
                    ca: g.caScore || rawScore,
                    project: g.projectScore || 0,
                    exam: g.examScore || 0,
                    className: assignedClassName
                });
                finalGrade = comp.grade;
                if (!finalRemark) finalRemark = comp.remark;
            }

            if (isShs) {
                return `
                    <tr>
                        <td><strong>${escapeHtml(g.subjectName || g.subjectId || "")}</strong></td>
                        <td class="text-center">${escapeHtml(g.term || "Term 1")}</td>
                        <td class="text-center">${g.caScore != null ? escapeHtml(g.caScore) : "—"}</td>
                        <td class="text-center">${g.projectScore != null ? escapeHtml(g.projectScore) : "—"}</td>
                        <td class="text-center">${g.examScore != null ? escapeHtml(g.examScore) : "—"}</td>
                        <td class="text-center fw-bold">${rawScore}</td>
                        <td class="text-center fw-bold" style="color:#900C3F">${escapeHtml(finalGrade)}</td>
                        <td>${escapeHtml(finalRemark)}</td>
                    </tr>
                `;
            } else {
                return `
                    <tr>
                        <td><strong>${escapeHtml(g.subjectName || g.subjectId || "")}</strong></td>
                        <td class="text-center">${escapeHtml(g.term || "Term 1")}</td>
                        <td class="text-center">${g.caScore != null ? escapeHtml(g.caScore) : "—"}</td>
                        <td class="text-center">${g.examScore != null ? escapeHtml(g.examScore) : "—"}</td>
                        <td class="text-center fw-bold">${rawScore}</td>
                        <td class="text-center fw-bold" style="color:#900C3F">${escapeHtml(finalGrade)}</td>
                        <td>${escapeHtml(finalRemark)}</td>
                    </tr>
                `;
            }
        }).join("")
        : `<tr><td colspan="${isShs ? 8 : 7}" class="text-center text-muted py-3">No academic term grades recorded yet.</td></tr>`;

    const averageScore = validSubjectCount > 0 ? (totalScoreSum / validSubjectCount).toFixed(1) : "N/A";

    const gradingScaleLegend = isShs
        ? `<div class="legend-box">
             <strong>WASSCE Grading Scale:</strong> 
             A1 (75-100% Excellent) · B2 (70-74% Very Good) · B3 (65-69% Good) · C4-C6 (50-64% Credit) · D7-E8 (40-49% Pass) · F9 (0-39% Fail)
           </div>`
        : `<div class="legend-box">
             <strong>GES / BECE Basic School Scale:</strong> 
             Grade 1 (80-100% Highest Distinction) · Grade 2 (70-79% Very Good) · Grade 3 (65-69% Good) · Grade 4-5 (55-64% Credit) · Grade 6-8 (40-54% Pass) · Grade 9 (0-39% Fail)
           </div>`;

    win.document.write(`<!DOCTYPE html><html><head><title>Academic Report Card - ${escapeHtml(student.fullName || "")} (${escapeHtml(student.studentCode || "")})</title>
    <style>
        body { font-family: 'Segoe UI', Georgia, serif; padding: 36px; color: #1a1a1a; max-width: 900px; margin: auto; }
        .header { display:flex; gap:18px; align-items:center; border-bottom:4px double #900C3F; padding-bottom:14px; margin-bottom:18px; }
        .school-title { font-size:24px; color:#900C3F; font-weight:bold; font-family: Georgia, serif; }
        .school-subtitle { font-size:12px; text-transform:uppercase; color:#555; letter-spacing:1px; }
        .report-badge { background:#900C3F; color:#fff; padding:4px 12px; font-size:11px; text-transform:uppercase; font-weight:bold; display:inline-block; margin-top:4px; }
        h3 { background:#f4ecef; color:#900C3F; border-left:4px solid #900C3F; padding:6px 12px; font-size:13px; text-transform:uppercase; margin-top:20px; margin-bottom:10px; font-family: sans-serif; font-weight:bold; }
        table { width:100%; border-collapse:collapse; margin-bottom:14px; }
        td, th { border:1px solid #bbb; padding:7px 10px; font-size:12px; }
        th { background:#f9f9f9; font-weight:bold; }
        td.label { width:28%; background:#faf6f7; font-weight:bold; font-size:11px; text-transform:uppercase; color:#444; }
        .text-center { text-align:center; }
        .fw-bold { font-weight:bold; }
        .summary-grid { display:flex; gap:16px; margin:16px 0; }
        .summary-card { flex:1; border:1px solid #900C3F; padding:10px; text-align:center; background:#fdfbfa; }
        .summary-card .val { font-size:20px; font-weight:bold; color:#900C3F; font-family:sans-serif; }
        .summary-card .lbl { font-size:10px; text-transform:uppercase; color:#666; font-weight:bold; margin-top:2px; }
        .legend-box { font-size:10px; color:#555; background:#f8f9fa; border:1px solid #ddd; padding:8px; margin-top:12px; font-family:sans-serif; }
        .signatures { display:flex; justify-content:space-between; margin-top:36px; padding-top:20px; }
        .sig-col { width:42%; text-align:center; border-top:1px solid #555; padding-top:6px; font-size:12px; }
        .print-bar { margin-bottom:20px; text-align:right; }
        button { background:#900C3F; color:#fff; border:0; padding:9px 24px; font-size:13px; cursor:pointer; font-weight:bold; }
        @media print { .print-bar { display:none; } body { padding:0; } }
    </style></head><body>
    <div class="print-bar"><button onclick="window.print()">Print Official Report Card</button></div>
    
    <div class="header">
        <img src="${logoUrl}" width="84" onerror="this.style.display='none'">
        <div>
            <div class="school-title">OLISTAR SCHOOL</div>
            <div class="school-subtitle">Sunyani Abesim · Ghana · Est. 1987 · Good Foundation, Firm Building</div>
            <div class="report-badge">Official Student Academic Dossier &amp; Terminal Report</div>
        </div>
    </div>

    <h3>Student Particulars</h3>
    <table>
        ${row("Student Full Name", student.fullName)}
        ${row("Student Code", student.studentCode)}
        ${row("Institutional Login", student.institutionalEmail)}
        ${row("Current Class", assignedClassName || "Unassigned")}
        ${row("Division &amp; Stream", [student.academicTier, student.programStream].filter(Boolean).join(" · "))}
        ${row("Boarding Status", boardingLabel(student.boardingStatus))}
        ${row("Academic Batch", student.yearBatch || "2026/2027")}
        ${row("Guardian Information", `${student.guardianName || "N/A"} (${student.guardianPhone || "N/A"})`)}
    </table>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="val">${validSubjectCount}</div>
            <div class="lbl">Subjects Assessed</div>
        </div>
        <div class="summary-card">
            <div class="val">${totalScoreSum}</div>
            <div class="lbl">Cumulative Marks</div>
        </div>
        <div class="summary-card">
            <div class="val">${averageScore}%</div>
            <div class="lbl">Term Average</div>
        </div>
        <div class="summary-card">
            <div class="val">${isShs ? "WASSCE" : "GES / BECE"}</div>
            <div class="lbl">Grading System</div>
        </div>
    </div>

    <h3>Term Academic Performance</h3>
    <table>
        <thead>
            <tr>
                <th>Subject Name</th>
                <th class="text-center">Term</th>
                <th class="text-center">CA (${isShs ? "30%" : "50%"})</th>
                ${isShs ? `<th class="text-center">Project (20%)</th>` : ""}
                <th class="text-center">Exam (${isShs ? "50%" : "50%"})</th>
                <th class="text-center">Total (/100)</th>
                <th class="text-center">Grade</th>
                <th>Remarks</th>
            </tr>
        </thead>
        <tbody>
            ${gradeRows}
        </tbody>
    </table>

    ${gradingScaleLegend}

    <h3>Attendance &amp; Conduct</h3>
    <p style="font-size:12px; margin: 4px 0 16px 0;">${escapeHtml(attendanceSummary || "Regular attendance recorded for the term.")}</p>

    <div class="signatures">
        <div class="sig-col">
            <div>Class Teacher's Signature &amp; Date</div>
        </div>
        <div class="sig-col">
            <div>Headmaster / Principal Stamp &amp; Signature</div>
        </div>
    </div>

    <div style="margin-top:30px; text-align:center; font-size:10px; color:#888; border-top:1px dotted #ccc; padding-top:10px;">
        Generated by Olistar School Management System (SMS) · Verified Official Academic Document
    </div>
    </body></html>`);
    win.document.close();
}

