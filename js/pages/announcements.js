import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, listenAll } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile, role } = await requireSession();
mountShell(profile, { title: "Announcements", active: "announcements.html" });

if (role !== "admin") document.getElementById("noticeForm").classList.add("d-none");

listenAll("announcements", (rows) => {
    const sorted = [...rows].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    document.getElementById("noticeList").innerHTML = sorted.map((n) => `
        <article class="card rounded-0 mb-3 p-3" data-id="${n.id}">
            <div class="small text-muted text-uppercase">${escapeHtml(n.audience || "all")}</div>
            <h2 class="h5 font-serif">${escapeHtml(n.title)}</h2>
            <p class="mb-0">${escapeHtml(n.body)}</p>
            ${role === "admin" ? `<div class="text-end mt-2"><button class="btn btn-sm btn-outline-danger delete-record-btn" data-id="${n.id}"><i class="bi bi-trash me-1"></i> Delete</button></div>` : ""}
        </article>
    `).join("") || `<p class="text-muted">No notices yet.</p>`;
});

document.getElementById("noticeList").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn || role !== "admin") return;
    await deleteAdminRecord({ button: btn, collection: "announcements", id: btn.dataset.id, label: "announcement" });
});

document.getElementById("noticeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await addRow("announcements", {
        title: document.getElementById("noticeTitle").value.trim(),
        body: document.getElementById("noticeBody").value.trim(),
        audience: document.getElementById("noticeAudience").value,
        authorUid: profile.id
    });
    e.target.reset();
});
