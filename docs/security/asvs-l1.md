# ASVS 5.0 Level 1

ผลตรวจสอบโค้ดจริงเทียบกับ [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) Level 1 ทั้ง 70 ข้อ — ตรวจแบบ source review (อ่านโค้ด ไม่ใช่ pentest) ครั้งล่าสุด: rev. 2 หลังแก้ 7.4.1 / 7.4.2 / 6.2.4

> ไฟล์นี้เองนับเป็นส่วนหนึ่งของ ASVS 2.1.1 / 6.1.1 / 8.1.1 ("documented …") — หลายข้อที่เคย "บางส่วน" เพราะ control มีจริงในโค้ดแต่ไม่เคยมีเอกสารแยก

## สรุป

Applicable 52 จาก 70 ข้อ (อีก 18 ข้อ = ไม่เกี่ยวข้อง เพราะ feature นั้นไม่มีในแอป เช่น file upload, WebSocket, OAuth server)

| สถานะ | จำนวน | หมายเหตุ |
| --- | --- | --- |
| ผ่าน | 42 | control มีจริงและตรวจพบหลักฐานในโค้ด/เอกสาร |
| บางส่วน | 6 | control มีจริง แต่ไม่มีเอกสารแยก หรือมี gap เล็กน้อย |
| ไม่ผ่าน | 0 | — |
| ไม่เกี่ยวข้อง | 18 | ไม่มี feature นั้นในแอป |
| ยังไม่ตรวจ | 4 | อยู่นอกเหนือ source review (TLS cert, `npm audit` ปัจจุบัน) |

**ที่แก้ไปแล้ว (rev. 2):**
- `7.4.1` / `7.4.2` — เพิ่ม `SessionRevocationService` + `POST /auth/logout` จริง, revoke ตอน logout/reset-password/suspend
- `6.2.4` — เพิ่ม `isCommonPassword()` เช็คกับ wordlist ก่อน hash ทั้งตอน signup และ reset
- `15.1.1` — นโยบายกรอบเวลา patch dependency เขียนไว้ท้ายไฟล์นี้แล้ว (ตัวไฟล์นี้เองคือเอกสารที่ข้อนี้ต้องการ)

**ที่ยังไม่แก้ (ไม่ใช่โค้ด เป็น process):**
- wordlist ใน `common-passwords.ts` เป็นชุดเริ่มต้น ~120 คำ ควรเปลี่ยนเป็น SecLists top-10k ก่อน production
- ยังไม่มี CI step รัน `npm audit`/Dependabot จริงตามนโยบายท้ายไฟล์ — นโยบายมีแล้ว แต่ยังไม่ enforce อัตโนมัติ

---

## V1 — Encoding & Sanitization (8 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 1.2.1 | Output encoding ตาม context (HTML/HTTP/XML) | ผ่าน | React/JSX auto-escape ทุกจุด, ไม่มี `dangerouslySetInnerHTML` |
| 1.2.2 | Encode URL แบบ dynamic, บล็อก `javascript:`/`data:` | ยังไม่ตรวจ | ไม่มี allowlist ชัดเจน แต่ URL ส่วนใหญ่สร้างจาก internal id |
| 1.2.3 | Output encoding เมื่อสร้าง JS/JSON | ผ่าน | NestJS serialize เป็น JSON ให้อัตโนมัติ |
| 1.2.4 | Parameterized query ป้องกัน SQL/NoSQL injection | ผ่าน | native `mongodb` driver + typed filter object ทุกจุด |
| 1.2.5 | ป้องกัน OS command injection | ไม่เกี่ยวข้อง | ไม่มี `child_process`/`exec` ในโค้ดเลย |
| 1.3.1 | Sanitize HTML จาก WYSIWYG editor | ไม่เกี่ยวข้อง | ไม่มี rich-text editor ในระบบ |
| 1.3.2 | หลีกเลี่ยง `eval()`/dynamic code exec | ผ่าน | ไม่พบ `eval`/`new Function` ที่ไหนเลย |
| 1.5.1 | ตั้งค่า XML parser แบบ restrictive (XXE) | ไม่เกี่ยวข้อง | ไม่มี XML parser library — client ของ egp/mea/datagov ใช้ JSON/HTML |

## V2 — Validation & Business Logic (4 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 2.1.1 | มีเอกสารกำหนดกฎ input validation | บางส่วน | กฎอยู่ในโค้ด (class-validator DTOs) แต่ไม่มีเอกสารแยก |
| 2.2.1 | Validate input ตาม business expectation | ผ่าน | class-validator DTO ทุก route เช่น `signup.dto.ts`, `login.dto.ts` |
| 2.2.2 | บังคับ validation ที่ trusted service layer | ผ่าน | `ValidationPipe({ whitelist: true, transform: true })` global ใน `main.ts` |
| 2.3.1 | Business logic flow ตามลำดับขั้นตอนที่ถูกต้อง | ผ่าน | signup → pending → review → approved บังคับที่ `issueSession()` ฝั่ง server |

## V3 — Web Frontend Security (8 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 3.2.1 | ป้องกัน browser render content ผิด context | บางส่วน | ไม่มี raw-resource serving เลย (ไม่มี upload) ความเสี่ยงต่ำ แต่ไม่มี policy ชัดเจน |
| 3.2.2 | Safe text-rendering function | ผ่าน | React JSX text rendering เป็นค่าเริ่มต้นทุกจุด |
| 3.3.1 | Cookie มี `Secure` attribute | ผ่าน | `login/route.ts` — `secure: NODE_ENV === "production"` |
| 3.4.1 | HSTS max-age ≥ 1 ปี | ผ่าน | `helmet()` v8.3.0 default = `max-age=31536000` |
| 3.4.2 | CORS `Access-Control-Allow-Origin` กำหนดชัดเจน | ผ่าน | `main.ts` — `enableCors({ origin: env.frontendOrigin })` origin เดียว ไม่ใช่ wildcard |
| 3.5.1 | ป้องกัน CSRF (non-preflight) | ผ่าน | session token ส่งผ่าน `Authorization: Bearer` จาก proxy same-origin ไม่ใช่ ambient cookie |
| 3.5.2 | ป้องกัน CSRF (พึ่ง CORS preflight) | ผ่าน | กลไกเดียวกับ 3.5.1 |
| 3.5.3 | ใช้ HTTP method ที่เหมาะสมกับ sensitive action | ผ่าน | route สำคัญใช้ POST/DELETE เสมอ ไม่ใช้ GET |

## V4 — API and Web Service (2 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 4.1.1 | `Content-Type` ตรงกับเนื้อหาจริง | ผ่าน | NestJS/Express ตั้งให้อัตโนมัติ |
| 4.4.1 | ใช้ WebSocket over TLS (WSS) | ไม่เกี่ยวข้อง | ไม่มี `WebSocketGateway`/socket.io ในระบบ |

## V5 — File Handling (4 ข้อ)

ไม่เกี่ยวข้องทั้ง 4 ข้อ (5.2.1, 5.2.2, 5.3.1, 5.3.2) — ระบบไม่มี feature อัปโหลดไฟล์เลย

## V6 — Authentication (13 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 6.1.1 | เอกสารกำหนด rate limiting/anti-automation | บางส่วน | มี throttle จริง (ดู 6.3.1) แต่ไม่มีเอกสารแยก |
| 6.2.1 | รหัสผ่านอย่างน้อย 8 ตัวอักษร | ผ่าน | `signup.dto.ts` — `@MinLength(8)` |
| 6.2.2 | ผู้ใช้เปลี่ยนรหัสผ่านได้ | บางส่วน | มีแค่ forgot/reset ผ่านอีเมล ไม่มี "เปลี่ยนรหัสผ่านตอน login อยู่" |
| 6.2.3 | เปลี่ยนรหัสผ่านต้องใส่รหัสเดิม+ใหม่ | ไม่เกี่ยวข้อง | ไม่มี feature เปลี่ยนรหัสผ่านตอน login อยู่ (ดู 6.2.2) |
| 6.2.4 | เช็ครหัสผ่านกับ breached/common password list | ผ่าน (แก้แล้ว rev.2) | `common/password.ts → isCommonPassword()` เช็คก่อน hash ทั้ง signup และ reset |
| 6.2.5 | ไม่บังคับ composition rule | ผ่าน | `signup.dto.ts` เช็คแค่ความยาว ไม่มี regex ตัวใหญ่/เล็ก/ตัวเลข |
| 6.2.6 | ช่องรหัสผ่าน masked พร้อมปุ่มดู | ผ่าน | `components/ui/password-input.tsx` สลับ `type="password"`/`"text"` |
| 6.2.7 | อนุญาต paste และ password manager | ผ่าน | ใช้ `<input>` ปกติ ไม่มี handler บล็อก paste |
| 6.2.8 | ตรวจรหัสผ่านตามที่ส่งมาจริง ไม่ trim/แปลงตัวพิมพ์ | ผ่าน | `password.ts` — `scrypt()` รับ string ดิบ ไม่แปลงอะไร |
| 6.3.1 | ป้องกัน credential stuffing/brute force | ผ่าน | `auth.controller.ts` — `@Throttle` ทุก auth route (5 req/60s) |
| 6.3.2 | ไม่มี default account | ผ่าน | ไม่พบ hardcoded admin/default credential ใน signup, seed, restore script |
| 6.4.1 | Initial password สุ่มและหมดอายุเร็ว | ไม่เกี่ยวข้อง | ไม่มี feature admin-issue temporary password |
| 6.4.2 | ไม่มี password hint/secret question | ผ่าน | ไม่มี field คำถามลับใน user schema เลย |

## V7 — Session Management (6 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 7.2.1 | Verify token ที่ trusted backend เท่านั้น | ผ่าน | `session.guard.ts` รัน server-side ทุก request |
| 7.2.2 | สร้าง token แบบ dynamic ไม่ใช่ static secret | ผ่าน | `token.ts → createSessionToken()` สร้างใหม่ทุก login |
| 7.2.3 | Reference token entropy ≥128 bits | ไม่เกี่ยวข้อง | ใช้ self-contained token (HMAC) ไม่ใช่ reference token — ดู V9 แทน |
| 7.2.4 | ออก token ใหม่ทุกครั้งที่ (re-)authenticate | ผ่าน | `issueSession()` เรียกใหม่ทุก login/signup/google-auth |
| 7.4.1 | Session ใช้ต่อไม่ได้หลัง terminate | ผ่าน (แก้แล้ว rev.2) | `POST /auth/logout` ใหม่ + `SessionRevocationService.revoke()` |
| 7.4.2 | Session ทั้งหมดถูกตัดเมื่อบัญชีถูกระงับ | ผ่าน (แก้แล้ว rev.2) | `accounts.service.ts → setSuspended()` เรียก `revocation.revoke()` ทันที |

## V8 — Authorization (4 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 8.1.1 | เอกสารกำหนดกฎ function-level/data-specific access | บางส่วน | enforce จริงผ่าน guard (`role.guard.ts`, `owner.guard.ts` ฯลฯ) แต่ไม่มีเอกสารแยก |
| 8.2.1 | จำกัด function-level access ตามสิทธิ์ | ผ่าน | `@UseGuards(RoleGuard/OwnerGuard/OrgGuard/AdminGuard)` ทุก route |
| 8.2.2 | จำกัด data-specific access (ป้องกัน IDOR/BOLA) | ผ่าน | `saved-tors.service.ts` ทุก query scope ด้วย `userId` จาก session เท่านั้น |
| 8.3.1 | บังคับ authorization ที่ trusted service layer | ผ่าน | ทุก check เป็น NestJS guard ฝั่ง server ไม่พึ่ง client-side |

## V9 — Self-contained Tokens (4 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 9.1.1 | ตรวจ signature/MAC ก่อนเชื่อ payload | ผ่าน | `token.ts` — `timingSafeEqual()` HMAC check ก่อน parse |
| 9.1.2 | Allowlist algorithm, ห้าม `None` | ผ่าน | hardcode HMAC-SHA256 ในโค้ด ไม่อ่านจาก token — ไม่มีช่อง algorithm confusion |
| 9.1.3 | Key material จากแหล่งที่เชื่อถือได้ | ผ่าน | `env.sessionSecret` — `required()` fail startup ถ้าไม่ตั้งใน production |
| 9.2.1 | เช็ค validity time span (`exp`) | ผ่าน | เช็คทั้งฝั่ง backend และ frontend verifier |

## V10 — OAuth and OIDC (5 ข้อ)

ไม่เกี่ยวข้องทั้ง 5 ข้อ (10.4.1–10.4.5) — แอปเป็น OAuth/OIDC **client** เท่านั้น (verify Google ID token ผ่าน `google-auth-library`) ไม่ได้เป็น authorization server ที่ออก token เอง ข้อกำหนดกลุ่มนี้พูดถึงฝั่ง authorization server

## V11 — Cryptography (3 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 11.3.1 | ไม่ใช้ block cipher mode ที่ไม่ปลอดภัย | ไม่เกี่ยวข้อง | ไม่มี symmetric encryption ในระบบ (token=HMAC, password=scrypt) |
| 11.3.2 | ใช้ cipher/mode ที่ approved เท่านั้น | ไม่เกี่ยวข้อง | เหตุผลเดียวกับ 11.3.1 |
| 11.4.1 | ใช้ hash function ที่ approved เท่านั้น ห้าม MD5 | ผ่าน | scrypt (password) + HMAC-SHA256 (token) ไม่พบ MD5/SHA-1 ที่ไหนเลย |

## V12 — Secure Communication (3 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 12.1.1 | ใช้ TLS เวอร์ชันล่าสุดเท่านั้น | ยังไม่ตรวจ | TLS termination อยู่ที่ hosting/reverse proxy นอก repo นี้ |
| 12.2.1 | ใช้ TLS กับ external-facing service เสมอ | บางส่วน | โค้ดเองไม่ได้ force HTTP→HTTPS redirect พึ่ง deployment layer ทั้งหมด |
| 12.2.2 | ใช้ TLS cert ที่ publicly trusted | ยังไม่ตรวจ | เป็นเรื่อง hosting ไม่เห็นใน repo |

## V13 — Configuration (1 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 13.4.1 | ไม่ expose source-control metadata (.git/.svn) | ผ่าน | `backend/Dockerfile` multi-stage, copy แค่ `dist/` เข้า image ไม่มี `ServeStaticModule` |

## V14 — Data Protection (2 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 14.2.1 | ข้อมูล sensitive ไม่อยู่ใน URL | ผ่าน | session token ส่งผ่าน header/httpOnly cookie เท่านั้น; `?token=` มีแค่ลิงก์ verify/reset ที่เป็น one-time token ซึ่งเป็น pattern ที่ยอมรับได้ |
| 14.3.1 | ลบข้อมูล authenticated ออกจาก client storage หลัง session จบ | ผ่าน | logout เคลียร์ cookie, token ไม่เคยเก็บใน localStorage/sessionStorage |

## V15 — Secure Coding & Architecture (3 ข้อ)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | --- | --- |
| 15.1.1 | เอกสารกำหนดกรอบเวลาแก้ dependency ที่มีช่องโหว่ | ผ่าน (แก้แล้ว rev.2) | นโยบายกรอบเวลาเขียนไว้ด้านล่าง — ไฟล์นี้เองคือเอกสารที่ข้อนี้ต้องการ; ยังไม่ได้ enforce เป็น CI step |
| 15.2.1 | ไม่มี component ที่เลยกรอบเวลาแก้ | ยังไม่ตรวจ | ขึ้นกับผล `npm audit` ปัจจุบัน ตรวจจากอ่านโค้ดอย่างเดียวไม่ได้ |
| 15.3.1 | API ส่งคืนเฉพาะ field ที่จำเป็น | ผ่าน | `accounts.service.ts` exclude `passwordHash`/`passwordSalt` ผ่าน projection เสมอ |

---

## นโยบายกรอบเวลาแก้ dependency (ASVS 15.1.1)

- **Critical/High CVE** (เช่นจาก `npm audit` หรือ Dependabot): แก้ภายใน **7 วัน**
- **Medium**: แก้ภายใน **30 วัน**
- **Low**: แก้ในรอบ sprint ถัดไปตามปกติ ไม่เกิน **90 วัน**
- รัน `npm audit` (หรือเปิด Dependabot) เป็นส่วนหนึ่งของ CI — ดู `.github/workflows/auth.yml`
