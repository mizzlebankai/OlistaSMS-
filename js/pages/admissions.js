import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { listenAll, boardingLabel, patchRow } from "../store.js";
import { provisionFromApplication } from "../enroll-student.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile } = await requireSession({ roles: ["admin"] });
mountShell(profile, { title: "Admissions inbox", active: "admissions.html" });

const body = document.getElementById("appsBody");
let apps = [];
let students = [];
let users = [];

function renderApplications() {
    body.innerHTML = apps.map((a) => {
        const boarding = boardingLabel(a.boardingStatus);
        const login = a.institutionalEmail || a.studentId || "";
        const student = students.find((item) => item.id === a.studentId);
        const user = users.find((item) => item.id === student?.authUid);
        const accountStatus = user?.accountStatus || student?.accountStatus || "not issued";
        return `<tr>
            <td class="font-monospace">${escapeHtml(a.refCode || a.id.slice(0, 8))}</td>
            <td>${escapeHtml(a.fullName)}</td>
            <td>${escapeHtml(a.programStream || a.stream || "")}</td>
            <td>${escapeHtml(boarding)}</td>
            <td><span class="badge bg-secondary">${escapeHtml(a.status || "Pending")}</span><div class="small text-muted mt-1">Account: ${escapeHtml(accountStatus)}</div></td>
            <td class="small">${escapeHtml(login || "Not issued")}</td>
            <td class="text-end">
                ${a.studentId ? "" : `<button class="btn btn-sm btn-crimson provision-btn" data-id="${a.id}">Issue login</button>`}
                <button class="btn btn-sm btn-outline-danger delete-record-btn" data-id="${a.id}"><i class="bi bi-trash me-1"></i> Delete</button>
            </td>
        </tr>`;
    }).join("") || `<tr><td colspan="7" class="text-muted">No applications yet.</td></tr>`;
}

listenAll("applications", (rows) => {
    apps = rows.sort((a, b) => String(b.refCode || "").localeCompare(String(a.refCode || "")));
    renderApplications();
});

listenAll("students", (rows) => { students = rows; renderApplications(); });
listenAll("users", (rows) => { users = rows; renderApplications(); });

body.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".delete-record-btn");
    if (deleteBtn) {
        const app = apps.find((a) => a.id === deleteBtn.dataset.id);
        await deleteAdminRecord({
            button: deleteBtn,
            collection: "applications",
            id: app?.id,
            label: `admission application for ${app?.fullName || "this student"}`,
            note: app?.studentId ? "The linked student profile will also be removed." : "",
            related: app?.studentId ? [
                { collection: "students", id: app.studentId },
                ...(students.find((item) => item.id === app.studentId)?.authUid ? [{ collection: "users", id: students.find((item) => item.id === app.studentId).authUid }] : [])
            ] : []
        });
        return;
    }
    const btn = e.target.closest(".provision-btn");
    if (!btn) return;
    const app = apps.find((a) => a.id === btn.dataset.id);
    if (!app) return;
    btn.disabled = true;
    try {
        if ((app.status || "Pending") !== "Approved") {
            await patchRow("applications", app.id, { status: "Approved" });
            app.status = "Approved";
        }
        await provisionFromApplication({
            ...app,
            stream: app.programStream || app.stream,
            email: app.guardianEmail || app.email,
            phone: app.guardianPhone || app.phone
        });
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
    }
});
