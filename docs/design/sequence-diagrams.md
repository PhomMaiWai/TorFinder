# Sequence diagrams

The main flows through the system, drawn from the code. "Next.js" means the
frontend server (pages, Server Actions and `/api/*` route handlers); the
browser never talks to the backend directly (see
[system-architecture.md](./system-architecture.md)).

1. [Sign in and call a protected route](#1-sign-in-and-call-a-protected-route)
2. [Company sign-up and admin approval](#2-company-sign-up-and-admin-approval)
3. [Scheduled import, AI extraction and match alerts](#3-scheduled-import-ai-extraction-and-match-alerts)
4. [A company opens its matched TORs](#4-a-company-opens-its-matched-tors)
5. [Public comment and moderation](#5-public-comment-and-moderation)
6. [Error report and "Fix this TOR"](#6-error-report-and-fix-this-tor)

## 1. Sign in and call a protected route

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant N as Next.js
    participant A as Backend AuthController
    participant G as Guard (Session/Role)
    participant R as SessionRevocationService
    participant DB as MongoDB

    U->>B: Enter email and password
    B->>N: POST /api/auth/login {email, password}
    N->>A: POST /api/auth/login
    A->>DB: users.findOne({email})
    A->>A: verifyPassword (salted hash)
    alt wrong password
        A-->>N: 401 อีเมลหรือรหัสผ่านไม่ถูกต้อง
    else email not verified / pending / rejected / suspended
        A-->>N: 403 with reason (code: email-unverified when unverified)
    else OK
        A->>DB: set lastLoginAt
        A-->>N: 200 {user, token}
        N-->>B: Set-Cookie torr_session (httpOnly, 7 days) + {user}
    end

    Note over B,N: Later, any protected page or action
    B->>N: GET /matches (cookie)
    N->>N: proxy.ts verifies HMAC and role locally
    N->>G: GET /api/matching/opportunities<br/>Authorization: Bearer token
    G->>G: verifySessionToken + check role
    G->>R: isValid(sub, iat)
    R->>DB: users.sessionMinIssuedAt (cached 30 s)
    alt token revoked or wrong role
        G-->>N: 401 / 403
    else allowed
        G-->>N: handler result
        N-->>B: rendered page
    end
```

Google sign-in follows the same shape through `POST /api/auth/google`. A
new Google user who chose "company" gets `{status: "needs-company-info"}`
back and finishes with `POST /api/auth/google/complete`.

## 2. Company sign-up and admin approval

```mermaid
sequenceDiagram
    autonumber
    actor C as Company
    participant N as Next.js
    participant Auth as AuthService
    participant AL as AccountLinksService
    participant Mail as Resend
    actor Ad as Admin
    participant Acc as AccountsService
    participant Notif as NotificationsService
    participant Audit as AuditService
    participant DB as MongoDB

    C->>N: Fill /signup/organization
    N->>Auth: POST /api/auth/signup (Server Action)
    Auth->>Auth: reject common passwords, hash
    Auth->>DB: users.insertOne(role org, status pending, emailVerified false)
    Auth->>AL: send(user, email-verify)
    AL->>DB: authTokens.insertOne(tokenHash, expiresAt)
    AL->>Mail: verification link
    Auth-->>N: 201 {status: pending}

    C->>N: Open link /verify-email?token=...
    N->>Auth: POST /api/auth/email/verify {token}
    Auth->>AL: consume(token)
    Auth->>DB: users.emailVerified = true
    Auth-->>N: {ok, status: pending}

    Ad->>N: /admin/accounts
    N->>Acc: GET /api/accounts?status=pending (AdminGuard)
    Acc-->>N: pending companies
    Ad->>N: Approve
    N->>Acc: PATCH /api/accounts/:id {status: approved}
    Acc->>DB: users.status = approved, reviewedAt
    par
        Acc->>Notif: create(approval, "บัญชีของคุณได้รับการอนุมัติแล้ว")
        Notif->>DB: notifications.insertOne
        Notif-->>C: email / LINE / Slack if turned on
    and
        Acc->>Audit: record(admin, อนุมัติบัญชีบริษัท)
    end
    Acc-->>N: updated account
```

A pending account cannot sign in (step 1 returns 403) until this flow ends.

## 3. Scheduled import, AI extraction and match alerts

```mermaid
sequenceDiagram
    autonumber
    participant S as EgpScheduler<br/>(every EGP_POLL_MINUTES)
    participant E as EgpService
    participant EC as EgpClient
    participant P as Bangkok e-GP API
    participant I as TorImportService
    participant M as MatchingService
    participant Notif as NotificationsService
    participant X as ExtractionScheduler<br/>(every AI_POLL_MINUTES)
    participant XS as ExtractionService
    participant V as Vertex AI (Gemini)
    participant DB as MongoDB

    S->>E: sync() (joins a run already in flight)
    E->>EC: searchProjects per type and keyword
    EC->>P: GET /Projects/GetProjectFromFilter
    P-->>EC: projects
    E->>E: keep software work only (isSoftwareProject)
    E->>EC: details for records not yet enriched (time budget)
    E->>I: import("egp", records)
    I->>I: drop records before 2022, collapse duplicates
    I->>DB: find same project from other sources
    I->>I: trust order manual > egp > mea > datagov
    I->>DB: tors.bulkWrite(upsert by sourceRef, keep lockedFields)
    I->>M: refreshBudgetStatuses()
    I->>M: notifyMatches(new ids)
    M->>DB: approved companies with matchAlerts on
    M->>M: scoreMatch per company, threshold, phase
    M->>DB: matchAlerts.insert (once per project and phase)
    M->>Notif: create(match, score)
    I-->>E: {fetched, imported, updated, skipped}
    E->>DB: syncRuns.insertOne
    alt run failed repeatedly or partly
        S->>S: AdminAlertsService.syncProblem
    end

    Note over X,V: Separately, only when VERTEX_PROJECT_ID is set
    X->>XS: extractPending()
    XS->>DB: next unread TORs with documents
    loop each TOR, up to the run's call budget
        XS->>XS: download PDFs (e-GP / gproc)
        XS->>V: PDFs + instruction + JSON schema
        V-->>XS: JSON fields + confidence
        XS->>DB: tors.extraction = result
        XS->>M: notifyMatches([tor])
    end
```

MEA, data.go.th and the national e-GP (gproc) follow the same path through
`TorImportService.import`. The details for each source are in
[pipeline.md](../pipeline.md).

## 4. A company opens its matched TORs

```mermaid
sequenceDiagram
    autonumber
    actor C as Company
    participant N as Next.js /matches
    participant MC as MatchingController
    participant M as MatchingService
    participant DB as MongoDB

    C->>N: Open /matches
    N->>MC: GET /api/matching/opportunities (SessionGuard)
    MC->>M: rankOpportunitiesFor(session.sub)
    M->>DB: users.findOne → company profile
    alt no company profile
        M-->>N: 404 บัญชีนี้ยังไม่มีข้อมูลบริษัท
    else
        M->>DB: listed TORs from the last 90 days, not at award stage
        M->>M: scoreMatch(tor, company) for each
        M->>M: drop closed ones, open first, then by score
        M-->>N: up to 100 TORs with match, reasons, gaps, eligibility
        N-->>C: ranked list
    end
    opt Company asks for a proposal draft
        C->>N: Paste an old proposal
        N->>MC: POST /api/ai/proposal-draft/:torId (OrgGuard, 5 per minute)
        Note right of MC: ProposalService sends TOR + profile + old proposal to Vertex AI
        MC-->>N: {sections, gaps}
    end
```

## 5. Public comment and moderation

```mermaid
sequenceDiagram
    autonumber
    actor P as Public visitor
    participant N as Next.js /tor/[id]
    participant F as FeedbackService
    actor Ad as Admin
    participant Audit as AuditService
    participant DB as MongoDB

    P->>N: Write a comment (10-5000 chars)
    N->>F: POST /api/tor/:torId/feedback (throttled)
    F->>DB: TOR + its feedback deadline
    alt hearing period is over
        F-->>N: 400 ปิดรับฟังความคิดเห็นสำหรับประกาศนี้แล้ว
    else
        F->>DB: feedback.insertOne(status รอตรวจสอบ)
        F-->>N: 201 comment (not shown publicly yet)
    end

    Ad->>N: /admin/moderation
    N->>F: GET /api/feedback?status=รอตรวจสอบ (AdminGuard)
    Ad->>N: Approve or reject
    N->>F: PATCH /api/feedback/:id {status}
    F->>DB: status, reviewedAt
    F->>Audit: record(admin, ...)

    P->>N: Open the TOR again
    N->>F: GET /api/tor/:torId/feedback
    F-->>N: approved comments only
```

## 6. Error report and "Fix this TOR"

```mermaid
sequenceDiagram
    autonumber
    actor R as Reader
    participant N as Next.js
    participant Rep as ReportsService
    actor Ad as Admin
    participant T as TorService
    participant Audit as AuditService
    participant DB as MongoDB

    R->>N: Report a problem on /tor/[id]
    N->>Rep: POST /api/tor/:torId/reports {reason, message}<br/>(Bearer token if signed in)
    Rep->>DB: torReports.insertOne(status open, reporter if signed in)
    Rep-->>N: 201 report

    Ad->>N: /admin/reports
    N->>Rep: GET /api/reports?status=open
    Ad->>N: "Fix this TOR"
    N->>Rep: GET /api/reports/:id (banner above the edit form)
    Ad->>N: Save corrected fields
    N->>T: PATCH /api/tor/:id {fields}
    T->>DB: update fields, add them to lockedFields, set lastEdited
    T->>Audit: record(admin, edit)
    N->>Rep: PATCH /api/reports/:id {status: resolved, fixed: true}
    Rep->>DB: status resolved, resolvedBy, resolvedAt
    Rep->>Audit: record(admin, แก้ไขประกาศตามเรื่องที่แจ้ง)
```

Because the fields are locked, the next import does not overwrite the
correction.
