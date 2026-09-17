import { getAll, patchRow, removeRow } from "./store.js";

async function deleteRows(collection, rows) {
    await Promise.all(rows.filter((row) => row?.id).map((row) => removeRow(collection, row.id)));
}

export async function deleteStudentData(student) {
    const [grades, fees, attendance, applications] = await Promise.all([
        getAll("grades"),
        getAll("fees"),
        getAll("attendance"),
        getAll("applications")
    ]);

    await deleteRows("grades", grades.filter((row) => row.studentId === student.id));
    await deleteRows("fees", fees.filter((row) => row.studentId === student.id));
    await deleteRows("applications", applications.filter((row) => row.studentId === student.id));

    await Promise.all(attendance.map(async (row) => {
        const records = Array.isArray(row.records) ? row.records.filter((item) => item.studentId !== student.id) : [];
        if (records.length === (row.records || []).length) return;
        if (records.length) await patchRow("attendance", row.id, { records });
        else await removeRow("attendance", row.id);
    }));

    await removeRow("students", student.id);
    if (student.authUid) await removeRow("users", student.authUid);
}

export async function deleteTeacherData(member) {
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
