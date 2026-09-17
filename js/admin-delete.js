import { removeRow } from "./store.js";

export async function deleteAdminRecord({ button, collection, id, label, note = "", related = [] }) {
    if (!id || !button) return false;

    const message = `Permanently delete this ${label}?\n\n${note ? `${note}\n\n` : ""}This action cannot be undone.`;
    if (!confirm(message)) return false;

    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="bi bi-hourglass-split me-1"></i> Deleting...`;

    try {
        await removeRow(collection, id);
        for (const item of related) {
            if (item?.collection && item?.id) await removeRow(item.collection, item.id);
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
