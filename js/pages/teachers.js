import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, listenAll } from "../store.js";
import {
    createAuthAccount,
    generatePassword,
    institutionalStaffEmail,
    showCredentialsSlip,
    writeUserProfile,
    escapeHtml
} from "../provision-auth.js";
import { deleteAdminRecord, deleteTeacherData } from "../admin-delete.js";

const { profile } = await requireSession({ roles: ["admin"] });
mountShell(profile, { title: "Teachers & staff", active: "teachers.html" });

let staff = [];
listenAll("teachers", (rows) => {
    staff = rows;
    document.getElementById("staffBody").innerHTML = rows.map((t) => `
        <tr>
            <td>${escapeHtml(t.name)}</td>
            <td>${escapeHtml(t.role || "teacher")}</td>
            <td class="font-monospace">${escapeHtml(t.institutionalEmail)}</td>
            <td>${escapeHtml(t.contactEmail)}</td>
            <td>${escapeHtml(t.accountStatus || "")}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-danger delete-record-btn" data-id="${t.id}"><i class="bi bi-trash me-1"></i> Delete</button></td>
        </tr>
    `).join("") || `<tr><td colspan="6" class="text-muted">No staff enrolled yet.</td></tr>`;
});

document.getElementById("staffBody").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn) return;
    const member = staff.find((t) => t.id === btn.dataset.id);
    await deleteAdminRecord({
        button: btn,
        collection: "teachers",
        id: member?.id,
        label: `staff record for ${member?.name || "this person"}`,
        note: "The staff profile, assigned timetable slots, class-teacher links, and portal profile will be permanently removed. The Firebase Auth login itself requires server-side deletion.",
        onDelete: () => deleteTeacherData(member)
    });
});

document.getElementById("staffForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get("name").trim();
    const contactEmail = fd.get("contactEmail").trim().toLowerCase();
    const role = fd.get("role");
    const password = generatePassword();
    const institutionalEmail = institutionalStaffEmail(name, String(Date.now()).slice(-4));
    try {
        const uid = await createAuthAccount({ contactEmail, password, displayName: name });
        const teacherId = await addRow("teachers", {
            name,
            phone: fd.get("phone"),
            contactEmail,
            institutionalEmail,
            role,
            authUid: uid,
            accountStatus: "pending_verification",
            classIds: [],
            subjectIds: []
        });
        await writeUserProfile(uid, {
            name,
            role,
            teacherId,
            institutionalEmail,
            contactEmail,
            accountStatus: "pending_verification"
        });
        showCredentialsSlip({
            title: "Staff dashboard login",
            name,
            role,
            institutionalEmail,
            contactEmail,
            password
        });
        bootstrap.Modal.getInstance(document.getElementById("staffModal"))?.hide();
        e.target.reset();
    } catch (err) {
        alert(err.message);
    }
});
