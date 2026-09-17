import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { COL } from "./collections.js";

export function resolveCollectionName(name) {
    return COL[name] || name;
}

export function col(name) {
    return collection(db, resolveCollectionName(name));
}

export function listenAll(name, callback, onError) {
    return onSnapshot(col(name), (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(rows);
    }, onError);
}

export async function getById(name, id) {
    const snap = await getDoc(doc(db, resolveCollectionName(name), id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addRow(name, data) {
    const ref = await addDoc(col(name), { ...data, createdAt: serverTimestamp() });
    return ref.id;
}

export async function setRow(name, id, data, merge = true) {
    await setDoc(doc(db, resolveCollectionName(name), id), { ...data, updatedAt: serverTimestamp() }, { merge });
}

export async function patchRow(name, id, data) {
    await updateDoc(doc(db, resolveCollectionName(name), id), { ...data, updatedAt: serverTimestamp() });
}

export async function removeRow(name, id) {
    await deleteDoc(doc(db, resolveCollectionName(name), id));
}

export async function findUsersByInstitutionalEmail(email) {
    const q = query(col(COL.users), where("institutionalEmail", "==", String(email).trim().toLowerCase()));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findUsersByStudentCode(code) {
    const clean = String(code || "").trim().toUpperCase();
    const q = query(col(COL.users), where("studentCode", "==", clean));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findUserByContactEmail(email) {
    const q = query(col(COL.users), where("contactEmail", "==", String(email).trim().toLowerCase()));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findStudentByCode(code) {
    const clean = String(code || "").trim().toUpperCase();
    const q = query(col(COL.students), where("studentCode", "==", clean));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findStudentByInstitutionalEmail(email) {
    const clean = String(email || "").trim().toLowerCase();
    const q = query(col(COL.students), where("institutionalEmail", "==", clean));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function findStudentByApplication(applicationId) {
    const q = query(col(COL.students), where("applicationId", "==", applicationId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function boardingLabel(status) {
    if (status === "boarding") return "Boarding Student";
    if (status === "day") return "Day Student";
    return status || "—";
}

export function timestampToDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    return null;
}
