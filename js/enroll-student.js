import { addRow, patchRow, getAll, findStudentByApplication, findUsersByInstitutionalEmail } from "./store.js";
import {
    createAuthAccount,
    generatePassword,
    institutionalStudentEmail,
    showCredentialsSlip,
    studentCodeFromRef,
    writeUserProfile
} from "./provision-auth.js";

function normalizeBoarding(value) {
    const v = String(value || "").toLowerCase();
    if (v.includes("board")) return "boarding";
    if (v.includes("day")) return "day";
    return v === "boarding" || v === "day" ? v : "";
}

function normalizeClassValue(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function resolveApplicationClass(input) {
    const requestedId = String(input.classId || "").trim();
    const requestedName = normalizeClassValue(
        input.className || input.entryLevel || input.selectedClass || input.class || ""
    );
    if (!requestedId && !requestedName) return null;

    const classes = await getAll("classes");
    if (requestedId) {
        const exactId = classes.find((item) => item.id === requestedId);
        if (exactId) return exactId;
    }
    if (!requestedName) return null;

    const requestedTier = normalizeClassValue(input.academicTier);
    const matches = classes.filter((item) => {
        const names = [item.name, item.className, item.entryLevel].map(normalizeClassValue);
        return names.includes(requestedName);
    });
    const tierMatches = requestedTier
        ? matches.filter((item) => normalizeClassValue(item.academicTier) === requestedTier)
        : matches;
    return (tierMatches.length === 1 ? tierMatches : matches.length === 1 ? matches : [])[0] || null;
}

export async function provisionStudentRecord(input) {
    const contactEmail = String(input.contactEmail || "").trim().toLowerCase();
    if (!contactEmail || !contactEmail.includes("@") || contactEmail.includes("no email")) {
        throw new Error("A real contact email is required before a login can be created.");
    }
    const boardingStatus = normalizeBoarding(input.boardingStatus);
    if (!boardingStatus) {
        throw new Error("Select boarding or day student.");
    }

    const studentCode = input.studentCode || studentCodeFromRef(input.refCode);
    const fullName = input.fullName || [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" ");
    const firstName = input.firstName || fullName.split(" ")[0] || "student";
    const yearBatch = input.yearBatch || "2026/2027";
    const assignedClass = await resolveApplicationClass(input);

    let institutionalEmail = input.institutionalEmail ? input.institutionalEmail.toLowerCase() : "";
    if (!institutionalEmail) {
        let candidate = institutionalStudentEmail({ firstName, yearBatch }).toLowerCase();
        let suffix = 1;
        while (true) {
            const existing = await findUsersByInstitutionalEmail(candidate);
            if (!existing.length) break;
            suffix += 1;
            candidate = institutionalStudentEmail({ firstName, yearBatch, suffix: String(suffix) }).toLowerCase();
        }
        institutionalEmail = candidate;
    }

    const password = input.password || generatePassword();

    const uid = await createAuthAccount({
        contactEmail,
        password,
        displayName: fullName
    });

    const studentPayload = {
        fullName,
        firstName: input.firstName || "",
        middleName: input.middleName || "",
        lastName: input.lastName || "",
        dob: input.dob || "",
        gender: input.gender || "",
        nationality: input.nationality || "",
        prevSchool: input.prevSchool || "",
        academicTier: input.academicTier || "",
        programStream: input.programStream || input.stream || "",
        entryLevel: assignedClass?.name || input.entryLevel || "",
        classId: assignedClass?.id || input.classId || "",
        boardingStatus,
        guardianName: input.guardianName || "",
        relationship: input.relationship || "",
        guardianPhone: input.guardianPhone || input.phone || "",
        contactEmail,
        institutionalEmail,
        studentCode,
        authUid: uid,
        accountStatus: "pending_verification",
        entrySource: input.entrySource || "walk_in",
        applicationId: input.applicationId || null,
        address: input.address || "",
        yearBatch: input.yearBatch || "2026/2027"
    };

    const studentId = await addRow("students", studentPayload);
    await writeUserProfile(uid, {
        name: fullName,
        role: "student",
        studentId,
        studentCode,
        institutionalEmail,
        contactEmail,
        classId: assignedClass?.id || input.classId || "",
        accountStatus: "pending_verification"
    });

    if (input.applicationId) {
        await patchRow("applications", input.applicationId, {
            status: input.keepStatus || "Approved",
            studentId,
            institutionalEmail,
            provisionedAt: new Date().toISOString()
        });
    }

    showCredentialsSlip({
        title: "Student dashboard login",
        name: fullName,
        role: "Student",
        studentCode,
        institutionalEmail,
        contactEmail,
        password
    });

    return { studentId, uid, institutionalEmail, password };
}

export async function provisionFromApplication(app) {
    const existing = await findStudentByApplication(app.id);
    if (existing.length) return existing[0];
    return provisionStudentRecord({
        applicationId: app.id,
        entrySource: "application",
        refCode: app.refCode,
        fullName: app.fullName,
        firstName: app.firstName,
        middleName: app.middleName,
        lastName: app.lastName,
        dob: app.dob,
        gender: app.gender,
        nationality: app.nationality,
        prevSchool: app.prevSchool,
        academicTier: app.academicTier,
        programStream: app.stream || app.programStream,
        classId: app.classId,
        className: app.className || app.selectedClass || app.class,
        entryLevel: app.entryLevel,
        boardingStatus: app.boardingStatus && app.boardingStatus !== "N/A" ? app.boardingStatus : "day",
        guardianName: app.guardianName,
        relationship: app.relationship,
        guardianPhone: app.guardianPhone || app.phone || "",
        contactEmail: app.guardianEmail || app.email || "",
        address: app.address,
        yearBatch: app.yearBatch,
        keepStatus: "Approved"
    });
}
