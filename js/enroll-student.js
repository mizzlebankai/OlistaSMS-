import { addRow, patchRow, findStudentByApplication, findUsersByInstitutionalEmail } from "./store.js";
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
        entryLevel: input.entryLevel || "",
        classId: input.classId || "",
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
