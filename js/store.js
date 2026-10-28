// สัญญา data layer เดียวที่หน้าจอรู้จัก · backend เลือกจาก localStorage 'pms.backend' (ค่าเริ่ม 'demo')
import * as demo from './backend/demo.js';
import { wipe as wipePhotos } from './photos.js';
import * as sharepoint from './backend/sharepoint.js';
import * as supabase from './backend/supabase.js';
import { CONFIG } from './config.js';

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },   // false = พื้นที่เต็ม
};
const BE = { demo, sharepoint, supabase };
export const backendName = () => { let v; try { v = localStorage.getItem('pms.backend'); } catch {} return BE[v] ? v : BE[CONFIG.backend] ? CONFIG.backend : 'demo'; };   // ค่าดิบ ไม่ใช่ JSON
const be = () => BE[backendName()];
export const setBackend = n => { try { localStorage.setItem('pms.backend', n); } catch {} };
export const auth = () => be();   // signIn / changePassword / me (เฉพาะ backend จริง)

export const listDocs = p => be().listDocs(p || {});
export const getDocUrl = id => be().getDocUrl(id);
export const listTemplates = () => be().listTemplates();
export const getBlob = id => be().getBlob(id);
export const getCatalog = () => be().getCatalog();

export const getFiles = () => be().getFiles();

// งาน PM = jobs[]: ค่าที่พิมพ์/รูปเก็บในเครื่อง (localStorage 'pms.job.<id>') · งานที่ผู้ใช้สร้างเก็บรายการ id ไว้ที่ 'pms.jobx'
export const listJobs = async () => {
  const hid = ls.get('pms.jobhid') || [], seed = (await be().listJobs()).filter(j => !hid.includes(j.id)), mine = (ls.get('pms.jobx') || []).map(id => ls.get('pms.job.' + id)).filter(Boolean);
  return [...seed.map(j => ({ ...j, ...ls.get('pms.job.' + j.id) })), ...mine];
};
// ลบงาน (demo): งานที่ผู้ใช้สร้างลบจริง · งานตัวอย่างจาก backend ซ่อนไว้ (pms.jobhid)
export const dropJob = id => { ls.set('pms.jobhid', [...(ls.get('pms.jobhid') || []), id]); ls.set('pms.jobx', (ls.get('pms.jobx') || []).filter(x => x !== id)); try { localStorage.removeItem('pms.job.' + id); } catch {} };
export const putJob = job => ls.set('pms.job.' + job.id, job);
export const newJob = async (sys, round, dates) => {
  const ids = new Set((await listJobs()).map(j => j.id)); let id = `${sys.id}-${round.replace('/', '-')}`; if (ids.has(id)) id += '-' + Date.now().toString(36);
  const j = be().genericJob(id, `${sys.name} ${round}`, sys.id, round, dates, 'todo', new Date().toISOString());
  if (!putJob(j)) return null;
  if (!ls.set('pms.jobx', [...(ls.get('pms.jobx') || []), id])) { localStorage.removeItem('pms.job.' + id); return null; }   // ดัชนีเขียนไม่ได้ = ไม่ถือว่าสร้างสำเร็จ
  return j;
};

// ค่าตั้ง/ผู้ใช้/รายการเก็บ offline
export const pref = (k, v) => (v === undefined ? ls.get('pms.' + k) : ls.set('pms.' + k, v));
export const isOffline = (id, dflt) => { const s = ls.get('pms.offline') || {}; return id in s ? s[id] : dflt; };
export const setOffline = (id, on) => ls.set('pms.offline', { ...(ls.get('pms.offline') || {}), [id]: on });
export const offlineCount = () => Object.values(ls.get('pms.offline') || {}).filter(Boolean).length;
// ออกจากระบบ: ลบเฉพาะคีย์ pms.* (+ รูปของ PMS) · ไม่แตะข้อมูลอื่นบนออริจินเดียวกัน
export const signOut = async () => {
  try { Object.keys(localStorage).filter(k => k.startsWith('pms.') && k !== 'pms.backend').forEach(k => localStorage.removeItem(k)); } catch {}
  await wipePhotos();
};
