import { getAll, patchRow, removeRow } from "./store.js";
import { auth } from "./auth.js";

async function deleteAuthAccount(uid) {
    if (!uid) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Your administrator session has expired. Sign in again before deleting data.");

    const response = await fetch("api/delete-auth-user", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ uid })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Firebase Auth account could not be deleted.");
}

async function deleteRows(collection, rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    await Promise.all(safeRows.filter((row) => row?.id).map((row) => removeRow(collection, row.id)));
}

export async function deleteStudentData(student) {
    if (!student?.id) throw new Error("The selected student record is unavailable. Refresh the page and try again.");
    if (student.authUid) await deleteAuthAccount(student.authUid);

    const [grades, fees, attendance, applications] = await Promise.all([
        getAll("grades"),
        getAll("fees"),
        getAll("attendance"),
        getAll("applications")
    ]);

    await deleteRows("grades", (Array.isArray(grades) ? grades : []).filter((row) => row.studentId === student.id));
    await deleteRows("fees", (Array.isArray(fees) ? fees : []).filter((row) => row.studentId === student.id));
    await deleteRows("applications", (Array.isArray(applications) ? applications : []).filter((row) => row.studentId === student.id));

    await Promise.all((Array.isArray(attendance) ? attendance : []).map(async (row) => {
        const existingRecords = Array.isArray(row.records) ? row.records : [];
        const records = existingRecords.filter((item) => item?.studentId !== student.id);
        if (records.length === existingRecords.length) return;
        if (records.length) await patchRow("attendance", row.id, { records });
        else await removeRow("attendance", row.id);
    }));

    await removeRow("students", student.id);
    if (student.authUid) await removeRow("users", student.authUid);
}

export async function deleteTeacherData(member) {
    if (member.authUid) await deleteAuthAccount(member.authUid);

    const [timetable, classes] = await Promise.all([getAll("timetable"), getAll("classes")]);
    await deleteRows("timetable", timetable.filter((row) => row.teacherId === member.id));
    await Promise.all(classes.filter((row) => row.teacherId === member.id).map((row) => patchRow("classes", row.id, { teacherId: "" })));
    await removeRow("teachers", member.id);
    if (member.authUid) await removeRow("users", member.authUid);
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
