# Class diagram

The main backend classes (`backend/src`) and how they depend on each
other. NestJS creates these classes and injects their constructor
arguments, so an arrow here is a constructor dependency. Only the methods
the rest of the system calls are listed; private helpers are left out.

## Import pipeline: schedulers, sources and AI

```mermaid
classDiagram
    class SyncScheduler {
        <<abstract>>
        #label string
        -run() RunReport
        -alerts AdminAlertsService
        +onApplicationBootstrap()
        +onModuleDestroy()
    }
    class EgpScheduler
    class MeaScheduler
    class DataGovScheduler
    class GprocScheduler
    class ExtractionScheduler

    class EgpService {
        +sync() SyncResult
        +metrics() EgpMetrics
        +nearMisses() NearMiss[]
    }
    class MeaService {
        +sync() SyncResult
    }
    class DataGovService {
        +sync() SyncResult
    }
    class GprocService {
        +startCapture(projectNumbers) GprocRun
        +getRun(runId) GprocRun
        +refresh() string
        +refreshSteps() string
    }
    class EgpClient {
        +searchProjects(typeId, page, text)
        +announcements(projectId)
        +projectDetail(projectId)
        +contracts(projectId)
    }
    class MeaClient {
        +announcements(type)
        +detail(type, keyId)
    }
    class DataGovClient {
        +procurementPackages(start, rows)
        +projectLocation(resourceId, projectNo)
    }
    class GprocClient {
        +projectDetail(projectNumber)
        +procurementStep(...)
        +tenderDocuments(projectNumber, maxBytes)
        +invitationPdf(projectNumber)
    }
    class TorImportService {
        +import(source, records) ImportResult
    }
    class ExtractionService {
        +extractForTor(torId, actor) StoredExtraction
        +extractPending(limit) ExtractionRunResult
    }
    class VertexClient {
        +isConfigured bool
        +extractJson(instruction, prompt, files, schema)
    }
    class MatchingService {
        +rankOpportunitiesFor(userId) Opportunity[]
        +rankForTor(torId) RankedCompany[]
        +scoreForTor(torId, company) MatchResult
        +notifyMatches(torIds) number
        +refreshBudgetStatuses()
        +assessBudgetForTor(torId) BudgetAssessment
        +assessBidForTor(torId) BidInsight
    }
    class AdminAlertsService {
        +syncProblem(source, problem)
    }

    SyncScheduler <|-- EgpScheduler
    SyncScheduler <|-- MeaScheduler
    SyncScheduler <|-- DataGovScheduler
    SyncScheduler <|-- GprocScheduler
    SyncScheduler <|-- ExtractionScheduler
    SyncScheduler --> AdminAlertsService : after repeated failures

    EgpScheduler --> EgpService
    MeaScheduler --> MeaService
    DataGovScheduler --> DataGovService
    GprocScheduler --> GprocService
    ExtractionScheduler --> ExtractionService

    EgpService --> EgpClient
    MeaService --> MeaClient
    DataGovService --> DataGovClient
    GprocService --> GprocClient
    EgpService --> TorImportService
    MeaService --> TorImportService
    DataGovService --> TorImportService
    GprocService --> TorImportService

    TorImportService --> MatchingService : refresh budgets, notify matches
    ExtractionService --> VertexClient
    ExtractionService --> GprocClient : download TOR PDFs
    ExtractionService --> MatchingService : notify matches
```

## Domain services

```mermaid
classDiagram
    class DatabaseService {
        +users Collection
        +tors Collection
        +feedback Collection
        +torReports Collection
        +savedTors Collection
        +savedSearches Collection
        +notifications Collection
        +matchAlerts Collection
        +authTokens Collection
        +syncRuns Collection
        +auditLogEntries Collection
    }
    class AuthService {
        +signup(dto)
        +login(dto) Session
        +googleAuth(dto)
        +googleCompleteSignup(dto)
        +forgotPassword(dto)
        +resetPassword(dto)
        +verifyEmail(dto)
        +logout(userId)
    }
    class AccountLinksService {
        +send(user, purpose)
        +consume(token, purpose) ObjectId
    }
    class AccountsService {
        +findAll(status)
        +findAllUsers()
        +review(id, dto, actor)
        +updateUser(id, dto, actor)
        +setSuspended(id, suspended, actor)
        +findOwn(userId)
        +updateOwn(userId, dto)
    }
    class TorService {
        +create(dto, actor)
        +findAll(page, pageSize, source)
        +findOne(id)
        +update(id, dto, editor)
        +setOwner(id, ownerId, actor)
        +softDelete(id, actor)
        +restore(id, actor)
        +findDeleted()
        +findNotSoftware()
        +findFlagged(page, pageSize, flag)
    }
    class FeedbackService {
        +create(torId, dto)
        +findForTor(torId, status)
        +findAll(status)
        +review(id, status, actor)
        +countsByTor()
    }
    class ReportsService {
        +create(torId, dto, reporter)
        +findAll(query)
        +findOne(id)
        +setStatus(id, status, actor, fixed)
    }
    class OwnerService {
        +ownTors(ownerId)
    }
    class ProposalService {
        +draft(userId, torId, previousProposal) ProposalDraft
    }
    class NotificationsService {
        +create(userId, type, title, message, torId)
        +findOwn(userId)
        +getChannels(userId)
        +updateChannels(userId, dto)
        +sendTest(userId)
        +markRead(userId, id)
        +markAllRead(userId)
    }
    class SavedTorsService {
        +findOwn(userId)
        +save(userId, torId)
        +import(userId, torIds)
        +unsave(userId, torId)
    }
    class SavedSearchesService {
        +findOwn(userId)
        +create(userId, dto)
        +remove(userId, id)
    }
    class AuditService {
        +record(actor, action, detail)
        +list(query) AuditFeedPage
    }
    class MatchingService
    class VertexClient
    class SessionRevocationService

    AuthService --> DatabaseService
    AuthService --> AccountLinksService
    AuthService --> SessionRevocationService
    AccountsService --> NotificationsService
    AccountsService --> AuditService
    AccountsService --> SessionRevocationService
    TorService --> MatchingService
    TorService --> AuditService
    FeedbackService --> AuditService
    ReportsService --> AuditService
    OwnerService --> MatchingService
    OwnerService --> FeedbackService
    ProposalService --> VertexClient
    MatchingService --> NotificationsService
    AccountsService --> DatabaseService
    TorService --> DatabaseService
    NotificationsService --> DatabaseService
    SavedTorsService --> DatabaseService
    SavedSearchesService --> DatabaseService
    AuditService --> DatabaseService
```

Every service also depends on `DatabaseService`; only some of those arrows
are drawn.

## Pure functions behind matching

Scoring is plain functions, not a class, so it can be tested without a
database:

| Function | File | What it does |
| --- | --- | --- |
| `scoreMatch(tor, company)` | `matching/matching.scoring.ts` | 0-100 score from work type, eligibility (capital, past contract, certifications) and project size, with reasons and gaps |
| `rankCompanies(tor, companies)` | `matching/matching.scoring.ts` | Ranks every approved company for one TOR |
| `assessBudget(target, peers)` | `matching/budget-analysis.ts` | Compares a budget with the median of similar TORs |
| `assessBid(target, peers)` | `matching/bid-insight.ts` | Typical discount and competition from past awards |
| `isSoftwareProject(name, category)` | `common/software-filter.ts` | Keyword filter that decides what gets imported (FR-07) |
| `deliver(account, notification)` | `notifications/notification-delivery.ts` | Sends to email, LINE and Slack, whichever the account turned on |
