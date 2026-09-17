import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    reload,
    applyActionCode,
    confirmPasswordReset,
    verifyPasswordResetCode
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import {
    findUsersByInstitutionalEmail,
    findUsersByStudentCode,
    findUserByContactEmail,
    findStudentByCode,
    findStudentByInstitutionalEmail
} from "./store.js";
import { sendVerificationToUser } from "./provision-auth.js";
import { COL, isAdminEmail } from "./collections.js";

export { auth };

export async function getProfile(uid) {
    const snap = await getDoc(doc(db, COL.users, uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ensureAdminProfile(user) {
    let profile = await getProfile(user.uid);
    if (profile) return profile;
    const email = (user.email || "").toLowerCase();
    if (!isAdminEmail(email)) {
        throw new Error("This Firebase login has no School Portal profile. Use the admin email, or an issued student/staff login.");
    }
    await setDoc(doc(db, COL.users, user.uid), {
        name: user.displayName || "Administrator",
        role: "admin",
        contactEmail: email,
        institutionalEmail: email,
        accountStatus: "active",
        createdAt: serverTimestamp()
    });
    return getProfile(user.uid);
}

export function requireSession({ roles = null, loginPage = "login.html" } = {}) {
    return new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();
            if (!user) {
                window.location.replace(loginPage);
                return;
            }
            let profile = await getProfile(user.uid);
            if (!profile) {
                if (!isAdminEmail(user.email)) {
                    await signOut(auth);
                    window.location.replace(`${loginPage}?noprofile=1`);
                    return;
                }
                profile = await ensureAdminProfile(user);
            }
            const role = profile.role || "student";
            if (role === "student" && profile.studentId && !(await getDoc(doc(db, COL.students, profile.studentId))).exists()) {
                await signOut(auth);
                window.location.replace(`${loginPage}?noprofile=1`);
                return;
            }
            if ((role === "teacher" || role === "staff") && profile.teacherId && !(await getDoc(doc(db, COL.teachers, profile.teacherId))).exists()) {
                await signOut(auth);
                window.location.replace(`${loginPage}?noprofile=1`);
                return;
            }
            if (role !== "admin" && !user.emailVerified) {
                try {
                    await sendVerificationToUser(user);
                } catch (err) {
                    console.warn(err);
                }
                sessionStorage.setItem("olistarVerifyEmail", profile.contactEmail || user.email);
                await signOut(auth);
                window.location.replace(`${loginPage}?verify=1`);
                return;
            }
            if (role !== "admin" && profile.accountStatus !== "active") {
                await updateDoc(doc(db, COL.users, user.uid), {
                    accountStatus: "active",
                    verifiedAt: serverTimestamp()
                });
                profile.accountStatus = "active";
                if (profile.studentId) {
                    await updateDoc(doc(db, COL.students, profile.studentId), { accountStatus: "active" }).catch(() => {});
                }
                if (profile.teacherId) {
                    await updateDoc(doc(db, COL.teachers, profile.teacherId), { accountStatus: "active" }).catch(() => {});
                }
            }
            if (roles && !roles.includes(role)) {
                window.location.replace("dashboard.html");
                return;
            }
            resolve({ user, profile, role });
        });
    });
}

export async function loginAs(roleTab, identifier, password) {
    const emailInput = identifier.trim().toLowerCase();
    if (roleTab === "admin") {
        const cred = await signInWithEmailAndPassword(auth, emailInput, password);
        const profile = await ensureAdminProfile(cred.user);
        if (profile.role && profile.role !== "admin") {
            await signOut(auth);
            throw new Error("This account is not an administrator.");
        }
        if (!isAdminEmail(cred.user.email) && profile.role !== "admin") {
            await signOut(auth);
            throw new Error("Use an authorized admin email for the Admin tab.");
        }
        return cred;
    }

    const profile = await lookupProfileForLogin(emailInput);
    if (roleTab && profile.role && profile.role !== roleTab) {
        throw new Error(`This login belongs to a ${profile.role}. Switch to the "${profile.role.toUpperCase()}" tab.`);
    }

    const authEmail = profile.contactEmail || profile.institutionalEmail;
    if (!authEmail) {
        throw new Error("This profile is missing a registered contact email for authentication.");
    }

    const cred = await signInWithEmailAndPassword(auth, authEmail, password);
    await reload(cred.user);

    if (cred.user.emailVerified) {
        const updates = { accountStatus: "active", verifiedAt: serverTimestamp() };
        await updateDoc(doc(db, COL.users, profile.id), updates).catch(() => {});
        if (profile.studentId) await updateDoc(doc(db, COL.students, profile.studentId), updates).catch(() => {});
        if (profile.teacherId) await updateDoc(doc(db, COL.teachers, profile.teacherId), updates).catch(() => {});
    }

    if (!cred.user.emailVerified) {
        try {
            await sendVerificationToUser(cred.user);
        } catch (e) {
            console.warn("Error sending verification email during login:", e);
        }
        sessionStorage.setItem("olistarVerifyEmail", profile.contactEmail || authEmail);
        await signOut(auth);
        const err = new Error("pending-verification");
        err.contactEmail = profile.contactEmail || authEmail;
        throw err;
    }

    return cred;
}

export async function lookupProfileForLogin(identifier) {
    let matches = [];
    const normalizedInput = String(identifier || "").trim().toLowerCase();

    // 1. Exact match in users collection
    matches = await findUsersByInstitutionalEmail(normalizedInput);

    // 2. Handle domain singular vs plural typos (@student.olistar.edu.gh <-> @students.olistar.edu.gh)
    if (!matches.length && normalizedInput.includes("@student.olistar.edu.gh")) {
        matches = await findUsersByInstitutionalEmail(normalizedInput.replace("@student.olistar.edu.gh", "@students.olistar.edu.gh"));
    }
    if (!matches.length && normalizedInput.includes("@students.olistar.edu.gh")) {
        matches = await findUsersByInstitutionalEmail(normalizedInput.replace("@students.olistar.edu.gh", "@student.olistar.edu.gh"));
    }

    // 3. Handle raw student code input (e.g. "ols94543")
    if (!matches.length && !normalizedInput.includes("@")) {
        matches = await findUsersByStudentCode(normalizedInput);
        if (!matches.length) matches = await findUsersByInstitutionalEmail(`${normalizedInput}@students.olistar.edu.gh`);
        if (!matches.length) matches = await findUsersByInstitutionalEmail(`${normalizedInput}@student.olistar.edu.gh`);
    }

    // 4. Try contact email lookup
    if (!matches.length) {
        matches = await findUserByContactEmail(normalizedInput);
    }

    // 5. Fallback directly to students collection in case user profile lookup needs bridging
    if (!matches.length) {
        const rawCode = normalizedInput.split("@")[0].toUpperCase();
        let studentMatches = await findStudentByCode(rawCode);
        if (!studentMatches.length) {
            studentMatches = await findStudentByInstitutionalEmail(normalizedInput);
        }
        if (!studentMatches.length && normalizedInput.includes("@student.olistar.edu.gh")) {
            studentMatches = await findStudentByInstitutionalEmail(normalizedInput.replace("@student.olistar.edu.gh", "@students.olistar.edu.gh"));
        }
        if (studentMatches.length) {
            const st = studentMatches[0];
            if (st.authUid) {
                const p = await getProfile(st.authUid);
                if (p) matches = [p];
            }
        }
    }

    if (!matches.length) {
        throw new Error("No account found for that login ID. Check the spelling or enter your student code.");
    }
    return matches[0];
}

export async function resendVerification(identifier, password) {
    const profile = await lookupProfileForLogin(identifier);
    const authEmail = profile.contactEmail || profile.institutionalEmail;
    if (!authEmail) {
        throw new Error("This profile has no registered contact email on file.");
    }
    const cred = await signInWithEmailAndPassword(auth, authEmail, password);
    if (cred.user.emailVerified) {
        await signOut(auth);
        return { alreadyVerified: true, contactEmail: authEmail };
    }
    await sendVerificationToUser(cred.user);
    await signOut(auth);
    return { alreadyVerified: false, contactEmail: authEmail };
}

export function logout(loginPage = "login.html") {
    return signOut(auth).then(() => window.location.replace(loginPage));
}

export async function handleEmailAction(mode, oobCode, newPassword) {
    if (mode === "verifyEmail") {
        await applyActionCode(auth, oobCode);
        return "Your email is verified. You can log in to the dashboard.";
    }
    if (mode === "resetPassword") {
        await verifyPasswordResetCode(auth, oobCode);
        if (!newPassword) return "code-ok";
        await confirmPasswordReset(auth, oobCode, newPassword);
        return "Password updated. You can log in with your new password.";
    }
    throw new Error("Unsupported email action.");
}
