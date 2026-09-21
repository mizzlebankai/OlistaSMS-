import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    reload,
    applyActionCode,
    confirmPasswordReset,
    verifyPasswordResetCode
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
    const p = await getProfile(user.uid);
    syncLoginIndex().catch(() => {});
    return p;
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
    const rawInput = String(identifier || "").trim();
    if (!rawInput) throw new Error("Please enter your login ID or email.");
    if (!password) throw new Error("Please enter your password.");

    const emailInput = rawInput.toLowerCase();

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

    let authEmail = "";
    let expectedRole = null;
    let studentId = null;
    let teacherId = null;

    const isInstitutional = emailInput.endsWith("@students.olistar.edu.gh") ||
                            emailInput.endsWith("@student.olistar.edu.gh") ||
                            emailInput.endsWith("@staff.olistar.edu.gh");

    if (!isInstitutional && emailInput.includes("@")) {
        authEmail = emailInput;
    } else {
        const profile = await resolveProfileForLogin(emailInput);
        if (!profile || !profile.authEmail) {
            throw new Error("No account found for that login ID. Check the spelling or enter your student code.");
        }
        authEmail = profile.authEmail;
        expectedRole = profile.role;
        studentId = profile.studentId;
        teacherId = profile.teacherId;
    }

    if (roleTab && expectedRole && expectedRole !== roleTab) {
        throw new Error(`This login belongs to a ${expectedRole}. Switch to the "${expectedRole.toUpperCase()}" tab.`);
    }

    const cred = await signInWithEmailAndPassword(auth, authEmail, password);

    let profile = await getProfile(cred.user.uid);
    if (!profile) {
        profile = {
            id: cred.user.uid,
            role: expectedRole || roleTab,
            contactEmail: authEmail,
            studentId,
            teacherId
        };
    }

    const effectiveRole = profile.role || expectedRole || roleTab;
    if (roleTab && effectiveRole && effectiveRole !== roleTab) {
        await signOut(auth);
        throw new Error(`This login belongs to a ${effectiveRole}. Switch to the "${effectiveRole.toUpperCase()}" tab.`);
    }

    await reload(cred.user);

    if (cred.user.emailVerified) {
        const updates = { accountStatus: "active", verifiedAt: serverTimestamp() };
        await updateDoc(doc(db, COL.users, cred.user.uid), updates).catch(() => {});
        const sid = profile.studentId || studentId;
        const tid = profile.teacherId || teacherId;
        if (sid) await updateDoc(doc(db, COL.students, sid), updates).catch(() => {});
        if (tid) await updateDoc(doc(db, COL.teachers, tid), updates).catch(() => {});
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

export async function resolveProfileForLogin(identifier) {
    const normalizedInput = String(identifier || "").trim().toLowerCase();
    if (!normalizedInput) return null;

    // 1. Try serverless backend endpoint
    try {
        const response = await fetch("api/resolve-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: normalizedInput })
        });
        if (response.ok) {
            const result = await response.json();
            if (result && result.authEmail) return result;
        }
    } catch (_) {
        // Backend not available or offline; proceed to Firestore index
    }

    // 2. Try Firestore loginIndex collection (single-document get, rules permit allow get: if true)
    try {
        const candidates = [
            normalizedInput,
            normalizedInput.toUpperCase(),
            normalizedInput.replace("@student.olistar.edu.gh", "@students.olistar.edu.gh"),
            normalizedInput.replace("@students.olistar.edu.gh", "@student.olistar.edu.gh")
        ];
        for (const key of candidates) {
            if (!key) continue;
            const snap = await getDoc(doc(db, COL.loginIndex, key));
            if (snap.exists()) {
                const data = snap.data();
                if (data && data.authEmail) {
                    return {
                        id: data.uid || snap.id,
                        authEmail: String(data.authEmail || "").trim().toLowerCase(),
                        role: data.role || "student"
                    };
                }
            }
        }
    } catch (_) {
        // Index not reachable
    }

    // 3. Fallback to signed-in lookup or return null gracefully without throwing permission error
    try {
        return await lookupProfileForLogin(normalizedInput);
    } catch (_) {
        return null;
    }
}

export async function resendVerification(identifier, password) {
    const input = String(identifier || "").trim().toLowerCase();
    if (!input) throw new Error("Please enter your login ID or registered contact email.");
    if (!password) throw new Error("Please enter your password.");

    const isInstitutional = input.endsWith("@students.olistar.edu.gh") ||
                            input.endsWith("@student.olistar.edu.gh") ||
                            input.endsWith("@staff.olistar.edu.gh");

    let authEmail = "";
    if (!isInstitutional && input.includes("@")) {
        authEmail = input;
    } else {
        const profile = await resolveProfileForLogin(input);
        if (!profile || !profile.authEmail) {
            throw new Error("No account found for that login ID. Check the spelling or enter your registered contact email address.");
        }
        authEmail = profile.authEmail;
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

export async function syncLoginIndex() {
    try {
        const usersSnap = await getDocs(collection(db, COL.users));
        const tasks = [];
        for (const d of usersSnap.docs) {
            const u = d.data();
            const authEmail = String(u.contactEmail || "").trim().toLowerCase();
            const instEmail = String(u.institutionalEmail || "").trim().toLowerCase();
            const code = String(u.studentCode || "").trim();
            const role = u.role || "student";
            if (!authEmail) continue;
            const info = { authEmail, role, uid: d.id, updatedAt: serverTimestamp() };
            if (instEmail) {
                tasks.push(setDoc(doc(db, COL.loginIndex, instEmail), info, { merge: true }));
            }
            if (code) {
                tasks.push(setDoc(doc(db, COL.loginIndex, code.toUpperCase()), info, { merge: true }));
                tasks.push(setDoc(doc(db, COL.loginIndex, code.toLowerCase()), info, { merge: true }));
            }
        }
        await Promise.allSettled(tasks);
    } catch (err) {
        console.warn("syncLoginIndex note:", err?.message || err);
    }
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
