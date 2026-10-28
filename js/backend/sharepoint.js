// โครงเปล่า — ขั้น 1 จริง: ใส่ MSAL (redirect) + Microsoft Graph ที่นี่ หน้าจอไม่ต้องแก้
const nope = async () => { throw { code: 'auth', retryAfter: 0 }; };
// TODO Graph: GET /sites/{id}/lists/DocIndex/items?$filter=fields/System eq '…'&$expand=fields  (แบ่งหน้าด้วย @odata.nextLink = cursor)
export const listDocs = nope;
// TODO Graph: GET /drives/{id}/items/{itemId}?select=@microsoft.graph.downloadUrl  (ขอใหม่ทุกครั้ง ห้ามเก็บ)
export const getDocUrl = nope;
// TODO Graph: GET /sites/{id}/drive/root:/FormTemplates  → รหัส/Rev/Sha256/FetchedAt
export const listTemplates = nope;
// TODO Graph: GET /drives/{id}/items/{itemId}/content  (ใช้ตอนกดเก็บ offline)
export const getBlob = nope;
// TODO Graph: List PMJobs (ขั้น 2)
export const listJobs = nope;
export const getFiles = nope;
export const genericJob = nope;
export const getCatalog = nope;
