import { auth } from "./auth.js";

export async function deleteStudentData(student) {
    if (!student?.id) throw new Error("The selected student record is unavailable. Refresh the page and try again.");
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error("Your administrator session has expired. Sign in again before deleting data.");
    const response = await fetch("api/delete-auth-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ student })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Firebase records could not be purged.");
}

export async function deleteTeacherData(member) {
    if (!member?.id) throw new Error("The selected staff record is unavailable. Refresh the page and try again.");
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error("Your administrator session has expired. Sign in again before deleting data.");
    const response = await fetch("api/delete-auth-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacher: member })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Firebase staff records could not be purged.");
}

export async function deleteAdminRecord({ button, collection, id, label, note = "", related = [], onDelete = null }) {
    if (!id || !button) return false;

    const message = `Permanently delete this ${label}?\n\n${note ? `${note}\n\n` : ""}This action cannot be undone.`;
    if (!confirm(message)) return false;

    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="bi bi-hourglass-split me-1"></i> Deleting...`;

    try {
        if (onDelete) await onDelete();
        else {
            await removeRow(collection, id);
            for (const item of related) {
                if (item?.collection && item?.id) await removeRow(item.collection, item.id);
            }
        }
        return true;
    } catch (error) {
        alert(`Unable to delete ${label}: ${error.message}`);
        return false;
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}
