// สัญญา data layer เดียวที่หน้าจอรู้จัก · backend เลือกจาก localStorage 'pms.backend' (ค่าเริ่ม 'demo')
import * as demo from './backend/demo.js';
import { wipe as wipePhotos } from './photos.js';
import * as sharepoint from './backend/sharepoint.js';

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },   // false = พื้นที่เต็ม
};
const be = () => ({ demo, sharepoint }[localStorage.getItem('pms.backend') || 'demo'] || demo);

export const listDocs = p => be().listDocs(p || {});
export const getDocUrl = id => be().getDocUrl(id);
export const listTemplates = () => be().listTemplates();
export const getBlob = id => be().getBlob(id);
export const getCatalog = () => be().getCatalog();

// งาน PM: ค่าที่พิมพ์/รูปเก็บในเครื่อง (localStorage) — ปิดแอปเปิดใหม่ยังอยู่
export const getJob = async id => ls.get('pms.job.' + id) || be().getJob(id);
export const hasJob = id => ls.get('pms.job.' + id) != null;
export const putJob = job => ls.set('pms.job.' + job.id, job);

// ค่าตั้ง/ผู้ใช้/รายการเก็บ offline
export const pref = (k, v) => (v === undefined ? ls.get('pms.' + k) : ls.set('pms.' + k, v));
export const isOffline = (id, dflt) => { const s = ls.get('pms.offline') || {}; return id in s ? s[id] : dflt; };
export const setOffline = (id, on) => ls.set('pms.offline', { ...(ls.get('pms.offline') || {}), [id]: on });
export const offlineCount = () => Object.values(ls.get('pms.offline') || {}).filter(Boolean).length;
// ออกจากระบบ: ลบเฉพาะคีย์ pms.* (+ รูปของ PMS) · ไม่แตะข้อมูลอื่นบนออริจินเดียวกัน
export const signOut = async () => {
  try { Object.keys(localStorage).filter(k => k.startsWith('pms.')).forEach(k => localStorage.removeItem(k)); } catch {}
  await wipePhotos();
};
