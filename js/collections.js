/** Shared names so Olistar SMS never overwrites Slipsmart or other apps in this Firebase project. */
export const COL = {
    apps: "applications",
    applications: "applications",
    admissions_applications: "admissions_applications",
    users: "olistar_users",
    students: "olistar_students",
    teachers: "olistar_teachers",
    classes: "olistar_classes",
    subjects: "olistar_subjects",
    attendance: "olistar_attendance",
    grades: "olistar_grades",
    fees: "olistar_fees",
    timetable: "olistar_timetable",
    announcements: "olistar_announcements"
};

/** Only these Firebase Auth emails may become SMS admins. Slipsmart users must not be auto-promoted. */
export const ADMIN_EMAILS = [
    "mizzlebankai@gmail.com",
    "admin-main@gmail.com",
    "admim-main@gmail.com"
];

export function isAdminEmail(email) {
    return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}
