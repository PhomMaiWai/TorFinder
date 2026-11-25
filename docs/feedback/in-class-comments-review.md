# In-class comments: what the client asked for, and what we did about it

Source: in-class comment recordings from the progress review on 19 Oct
2026 (`In-class-comments-transcript.md`). The comments became epic #250 on
21 Oct, with one sub-issue each.

This page has two parts:

1. **[Feedback → decision → change](#feedback--decision--change)**: where
   each comment ended up, updated 25 Nov 2026.
2. **[Original analysis](#original-analysis-19-oct-2026)**: what we wrote on
   19 Oct, checked against `main` at `bc1e13a`, kept unchanged as the
   "before" picture.

## Feedback → decision → change

**Result: 14 of 16 comments delivered, 1 partial, 1 still open.** All but
two were merged within four weeks of the review (19 Oct → 18 Nov).

| # | Client comment | Our decision | Issue | Merged PR (date) | Status |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Don't put "closes today" first; show TORs with enough time to prepare | Default sort "Best time to prepare", plus a sort menu | #251 | #269 (26 Oct), #287 (28 Oct) | ✅ Done |
| 1.2 | After login, go to the dashboard, not the landing page | Logo and nav go to the signed-in home; the landing page stays for guests | #252 | #289 (28 Oct) | ✅ Done |
| 1.3 | Font is too small; follow what users know from e-GP | Raise the floor for small text across the app | #253 | #317 (11 Nov) | ✅ Done |
| 1.4 | Profile progress, LinkedIn style | Each missing profile item becomes a nudge with its benefit | #254 | #315 (11 Nov) | ✅ Done |
| 1.5 | Show the procurement step, not just a status | Five-stage model and timeline; stage on search cards | #211, #212 | #248, #249 (19 Oct) | ✅ Done |
| 2.1 | Notify early, at the plan stage | Match alerts from the plan/draft stage and again at invitation | #147, #148, #264 | #277 (28 Oct) | ✅ Done |
| 2.2 | Smart search: "find TORs like my past project" | "Find similar" with Vertex AI embeddings, keyword ranking as fallback | #255 | #314 (11 Nov) | ✅ Done |
| 2.3 | Competition insights: who wins, price vs reference | Market insights page from past awards | #256 | #313 (11 Nov) | ✅ Done |
| 2.4 | More graphs on the dashboard | Charts on the overview and insights pages | #257 | #359 (18 Nov) | ✅ Done |
| 2.5 | Explain the price/performance scoring formula | The AI extracts the evaluation criteria with their weights as text, shown on the TOR page and used in the proposal draft. Not yet split into structured weights | — | #268 (26 Oct) | 🟡 Partial |
| 2.6 | LINE notifications; users don't read email daily | LINE Messaging API with a one-time link code (LINE Notify is shut down) | #258 | #358 (18 Nov) | ✅ Done |
| 3.1 | Reuse proposal documents (the client: "really important") | Proposal library per company, coverage per TOR, starter pack; AI proposal draft | #259 | #355 (17 Nov), #268 (26 Oct) | ✅ Done |
| 3.2 | Certificates with issuer, date and a way to verify | Certificates as records: issuer, dates, verify link, file | #260 | #354 (17 Nov) | ✅ Done |
| 3.3 | Growth path for small companies | Low-competition agencies and right-sized jobs | #261 | #356 (17 Nov) | ✅ Done |
| 3.4 | Use the budget act as an earlier source | Researched; written up as a future data source, not built ([budget-bill.md](./budget-bill.md)) | #262 | #340 (17 Nov) | ✅ Done (research) |
| 3.5 | Follow the DGA standard and WCAG | Planned as a full audit; text size (1.3) and chart contrast done so far | #263 | — | ⏳ Open |

### What changed in how we plan because of the feedback

- **The backlog was re-ordered around the client.** The suggested order
  below (quick wins → insights → find similar → proposal library) is the
  order the work was merged in: quick wins in the week of 22 Oct, insights
  and find similar on 11 Nov, the library on 17 Nov.
- **Each comment got its own issue** under one epic (#250), so the board
  shows the feedback and its progress in one place.
- **Features came first, roles were cut later.** Ten new features were
  added for the bidder's side, and on 22 Nov the two roles that were not
  being used (Auditor, Project Owner) were removed (PRs #414 and #416). See
  [deliverables.md](../project/deliverables.md#decisions-that-changed-the-deliverables).

### Still to do

- **3.5 Accessibility audit** (#263), the only open item.
- **2.5 Structured scoring weights:** extract `price X%, technical Y%` as
  numbers and explain them to the bidder.
- **User acceptance test** (#232), so the next round of feedback comes from
  real users, not only the client review. The 12-task script is in
  [uat-script.md](./uat-script.md), and each task names the client comment it
  checks. Results go in [uat-log.md](./uat-log.md).

## Original analysis (19 Oct 2026)

Status key at the time: **Done** = already built, **Partial** = some of it
exists, **Missing** = not built.

### 1. Quick wins (small, UI only, low risk)

| # | Comment | Where we are | What to do |
|---|---|---|---|
| 1.1 | **Sorting**: a PM does not want "closes today" first. They want a good match with enough time to prepare, or one that just opened. | **Missing.** Search has no sort control. Results come in the backend's stage round-robin order, so a TOR closing today can sit at the top. | Default sort "Best time to prepare": open TORs with enough days left first, newest opened first; closing in under ~3 days pushed down; closed last. Add a sort menu: Time to prepare / Newly opened / Closing soon / Budget. |
| 1.2 | **After login, the TOR area should go to the dashboard**, not the landing page. Keep the landing page as the first impression. | **Partial.** Guest-only pages redirect a signed-in user, but the navbar logo and links still go to `/` (landing). | When signed in, the logo and "TorFinder" links go to `homeFor(role)` (dashboard / admin). Landing stays for guests. |
| 1.3 | **Font is too small.** The e-GP site is easier to read; build what the users already know (colours, style). | **Partial.** 39 uses of `text-2xs` (11px) and 103 of `text-xs` (12px), mostly badges, dates and labels. | Raise the floor: nothing under 13–14px for content; body text 16px; badges 12px minimum. Compare side by side with e-GP. |
| 1.4 | **Profile progress** (LinkedIn style): tell users what to add and what they get for it. | **Partial.** Dashboard and profile already show a completion %. | Turn each missing item into a nudge with its benefit ("Add your largest past contract → we can check experience requirements"). |
| 1.5 | **Process indicator instead of status**: show which step of the government cycle each TOR is in. | **Done** (#211, PR #248 and #249): five-stage model and timeline on the TOR page. | Also show a compact stage indicator on search cards (#212 filters). |

### 2. Medium features (a few days each, real value)

| # | Comment | Where we are | What to do |
|---|---|---|---|
| 2.1 | **Notify early**: tell me at the first stage (plan), not at the third, so I have time to prepare. | **Partial.** Plan and draft stages now exist. Match notifications (#148, OverCatX) score new TORs, but the plan stage is not imported as its own record. | Notify when a matching project first appears at plan or draft stage, and again when its invitation opens. Coordinate with #148. |
| 2.2 | **Smart search**: "I did this e-learning TOR, here is my profile, find something similar in other departments." Advanced filters should not be the main function. | **Missing.** Search is keyword + checkboxes. Matching uses fixed profile fields (work types, past contract, capital, certifications). | A "Find similar" box: paste a past project or TOR (or pick one), rank TORs by similarity (Vertex AI embeddings; already configured). Keep the filters, but collapsed. |
| 2.3 | **Competition insights**: who wins, winner price vs average price, win rate per agency, "hometown" companies, low-competition areas. | **Partial.** Awarded TORs carry the vendor, the awarded amount and the reference price (ราคากลาง), but nothing aggregates them. | A "Market insights" page with charts: top winners per agency, awarded vs reference price (discount %), number of distinct winners per agency (competition level). We do not have every bidder's price, only the winner's, so "average price" means "versus the reference price" until a source has bids. |
| 2.4 | **More graphs on the dashboard** (the client liked the visuals). | **Partial.** The dashboard has stat tiles and lists, but no charting library. | Add a chart library and use it for 2.3 plus dashboard trends (open TORs per week, budget by category). |
| 2.5 | **Price/performance criteria**: the scoring formula (lowest price gets full price score, others proportional) and weights. | **Partial.** The AI extracts `evaluationCriteria` as one line of text and the TOR page shows it. | Extract it as structured weights (price X%, technical Y%, …) and explain what it means for the bidder. |
| 2.6 | **LINE notifications**: Thai users do not check email every day. | **Missing.** Notifications are in-app only. | Use the LINE Messaging API (LINE Notify was shut down in 2025): a LINE Official Account, users link it from Profile. Needs an OA channel set up by the team. |

### 3. Large features (needs team planning)

| # | Comment | Where we are | What to do |
|---|---|---|---|
| 3.1 | **Proposal document reuse** (the client called it "really important"): keep CVs, certificates, past projects; split them into pieces; match them to the next TOR and draft what can be reused (30%, 50%…); version control so knowledge does not leave with a person. | **Missing.** | MVP: a "Proposal library" per company with reusable pieces (past projects, team CVs, certificates). On each TOR, show which of its qualifications the library already covers ("You can reuse 4 of 7 items") and export a starter pack. Later: AI draft generation and versions. |
| 3.2 | **Certificates** should record who issued them, the date, whether it can be verified (QR / issuer link), and whether the content matches the scope. Cybersecurity and AI certs matter most now. | **Partial.** Certifications are a fixed list (ISO 9001/14001/27001/20000, CMMI, dealer letter) with a yes/no each. | Store certificates as records: name, issuer, issued/expiry date, verify URL, file. Add pentest/VA and AI vendor certs (AWS, NVIDIA…). Part of 3.1. |
| 3.3 | **Growth path for small companies**: low-competition departments with small jobs to start with. | **Partial.** #229 (low-competition rule) exists, unassigned. | Built on 2.3: recommend agencies with few distinct winners and budgets within the company's past-contract size. |
| 3.4 | **More data sources**: the budget act and parliament budget meetings reveal projects before e-GP. | **Partial.** e-GP, process5, MEA and data.go.th are imported; MOL and DGA are planned (#205). | Research the budget bill documents (สำนักงบประมาณ) as an early-signal source. |
| 3.5 | **DGA website standards / WCAG** for government sites. | **Not checked.** | Run an accessibility audit (contrast, font size, keyboard, alt text) against the DGA standard. Pairs with 1.3. |

### Suggested order

1. 1.1 Sorting, 1.2 Dashboard after login, 1.3 Font size: one small PR each, visible at the next demo.
2. 2.3 + 2.4 Market insights with charts: the client spent the most time on this.
3. 2.2 Find similar.
4. 3.1 + 3.2 Proposal library MVP with structured certificates: needs a team decision on scope.
5. 2.1, 2.5, 2.6 with the issue owners (OverCatX for notifications).
