# Budget documents as an early source of upcoming projects

Research for [#262](https://github.com/PhomMaiWai/TorFinder/issues/262)
(FR-04), from the client feedback at the October 2026 in-class review. The
client said that budgets are decided once a year, that the budget documents
and the council and parliament debates are public, and that both show
projects before they appear on e-GP. They also asked us not to rely on one
source.

The issue asked three questions about the สำนักงบประมาณ documents: what is
published, when, and whether projects can be matched to agencies. This note
answers them for the two budgets that matter to TorFinder. It also reports a
test run against the TORs already in our database.

## Short answer

- **There are two budget bills, not one.** TorFinder's main source,
  egp2.bangkok.go.th, belongs to the Bangkok Metropolitan Administration
  (BMA). BMA agencies are funded by Bangkok's own budget ordinance
  (ข้อบัญญัติงบประมาณรายจ่ายประจำปี of กรุงเทพมหานคร). The ordinance is
  prepared by **สำนักงบประมาณกรุงเทพมหานคร** and passed by the Bangkok
  council. The national budget act (พ.ร.บ.งบประมาณ) from the **national
  สำนักงบประมาณ** gives BMA only a block of subsidies. In FY2570 that block
  was 47 lines worth ฿29.0bn, and none of them is a BMA software project. For
  our users the Bangkok ordinance is the source that matters.
- **Both budgets are published as spreadsheets, not only as PDF.** Each one
  lists projects by name, with the agency, the amount, and for multi-year
  work the full schedule.
- **The draft is the early signal.** The final documents were published
  after the TORs they fund. The FY2570 drafts were published on 23 Jun 2026
  (national) and 26 Jun 2026 (Bangkok). That is 2½ to 4 months before the
  matching TORs reached e-GP.
- **Agencies match reliably, and some projects match exactly.** 71 of the 82
  BMA software TORs in our database matched an ordinance agency through our
  existing `isLikelySameAgency`. 19 matched one specific budget line, often
  at the exact baht amount. Most of the rest are maintenance contracts. The
  budget does not list those one by one: it groups them into lump-sum lines.

**Recommendation:** go ahead with a "planned projects" feed built from the
Bangkok draft ordinance. Treat the national draft as a secondary source for
national agencies based in Bangkok. Details are under
[What we would build](#what-we-would-build).

## 1. What is published

### Bangkok: สำนักงบประมาณกรุงเทพมหานคร

Everything is on the BMA open-data portal, data.bangkok.go.th. The portal
runs CKAN, so it has a JSON API. Each fiscal year has two packages.

| Package | FY2570 id | Published | Contents |
| --- | --- | --- | --- |
| ร่างข้อบัญญัติ งบประจำปี (excel) | `70-excel` | 26 Jun 2026 | Draft. 79 files: one XLS/XLSX per agency, plus revenue and a summary |
| ร่างข้อบัญญัติ งบประจำปี (pdf) | `70-pdf` | 13 Jul 2026 | The same draft as PDF |
| ข้อบัญญัติงบประมาณรายจ่ายประจำปี พ.ศ. 2570 | `2570` | 29 Oct 2026 | Final ordinance. 151 files: PDF and XLS/XLSX per agency |

There is one file per budget unit: each สำนัก, all 50 สำนักงานเขต,
มหาวิทยาลัยนวมินทราธิราช and การพาณิชย์. Every file has a
**รายละเอียด** sheet with these parts:

- **Line items.** Each has a budget code (`07199-14`), a name and an amount,
  for example "ค่าใช้จ่ายในการพัฒนาระบบรวมศูนย์การให้บริการประชาชน (BMA
  e-Service Smart Portal) 12,840,000 บาท".
- **Multi-year projects (รายการผูกพัน).** These also give the objective, the
  scope of work, the duration and the amount for each year. For example, the
  Oracle database service is ฿114M over 2569 to 2571, and ฿29.45M of that
  falls in 2570.
- **Lump sums for recurring costs.** These have a free-text note such as
  "ส่วนใหญ่เป็นค่าบำรุงรักษาระบบคอมพิวเตอร์และอุปกรณ์ระบบโปรแกรม".

The sheets are laid out for printing: names wrap across rows and the layout
varies between agencies. They still parse. A quick parser read 9,316 items
(฿71.4bn of the ฿93.9bn total) from 67 of the 72 FY2570 files.

The years before 2570 follow the same pattern. Drafts in Excel are on the
portal for FY2568 and FY2569, and FY2569's was published on 11 Jun 2025.

### National: สำนักงบประมาณ (bb.go.th)

| Document | FY2570 published | Format | Use to us |
| --- | --- | --- | --- |
| ร่าง พ.ร.บ. and 38 supporting volumes (เอกสารงบประมาณ ฉบับที่ 1–7) | 23 Jun 2026 | PDF | ฉบับที่ 3 has 19 volumes, one per ministry, with projects. Hard to parse |
| **ข้อมูลร่าง พ.ร.บ. … จำแนกรายจ่ายประจำ-รายจ่ายลงทุน (Excel Data Table)** | 23 Jun 2026 | XLSX | **The useful one.** Every line of the draft, one per row |
| ข้อมูล พ.ร.บ. … (Excel Data Table) | after enactment | XLSX | The same table for the final act |
| พ.ร.บ. and revised volumes (ฉบับปรับปรุง) | 30 Sep 2026 | PDF | Final figures after parliament's changes |
| Budget in Brief / Budget Statement (English) | 16 Sep 2026 | PDF | Summary only |

The FY2570 draft Excel table (on bb.go.th, under `topic.php?gid=1513&mid=1118`)
has **96,470 rows**, which add up to exactly the ฿3.788tn total. Its columns
are:

`min`, `min_name` (ministry code and name) · `agc`, `agc_name` (department
code and name, 3,289 departments) · `plan_name` · `output_name`
(ผลผลิต/โครงการ) · `act_name` · `objc` (budget type) · `cap_ncap`
(recurring or capital) · `item_name` · `p_total_bud` (amount).

There is no province column, but many capital items put the location in the
name, for example "…แขวงทุ่งสองห้อง เขตหลักสี่ กรุงเทพมหานคร".

Others have tried this before us. kaogeek's
[thailand-budget-pdf2csv](https://github.com/kaogeek/thailand-budget-pdf2csv)
uses OCR to turn the PDF volumes into CSV, and its last release was in 2021.
Now that the Excel table exists, we do not need it.

## 2. When it is published

FY2570 runs from 1 Oct 2026 to 30 Sep 2027.

| Date (2026) | National | Bangkok | e-GP (our data) |
| --- | --- | --- | --- |
| 11 Apr | Cabinet approves guidelines and a revised calendar (ว124) | | |
| 18 Jun | Cabinet approves the draft, ฿3.788tn | | |
| **23 Jun** | **Draft act, 38 volumes and the Excel table published** | | |
| **26 Jun** | | **Draft ordinance published as Excel** | |
| 29 Jun – 1 Jul | First reading in the House | | |
| 3–4 Aug | | Council first reading, ฿93,918.92M; special committee formed | |
| 10 Sep | | | e-Library (FY2570 item) opens for public comment |
| 30 Sep | Act in the Royal Gazette; revised volumes published | | |
| 19 Oct | | | Strategy information system (FY2570 item) opens for public comment |
| 29 Oct | | Final ordinance published | |

What this means for timing:

- **BMA starts procurement before its budget is final.** Two FY2570 line
  items were already on e-GP when the final ordinance was published. So only
  the *draft* comes early enough to help.
- **The draft gives a lead time of about 2½ to 4 months.** For the e-Library
  it was 76 days, and for the strategy system 115 days.
- **The draft is not the final word.** Committees cut and add items between
  the draft and the final version. For example, the tree-management system
  (฿13.16M, สำนักสิ่งแวดล้อม) appears only in the final ordinance. We should
  label items from the draft as *planned*, then confirm or drop them when the
  final ordinance is published.
- **The FY2570 national calendar was squeezed.** In a normal year the draft
  goes to the House in late May.

The client also mentioned **parliament and council debates**. Those
recordings and minutes show *why* items change. The change itself is easier
to get by comparing the draft with the final ordinance, which is the
approach we recommend. Reading meeting minutes is not worth it at this
stage.

## 3. Can projects be matched to agencies?

We tested this on real data. For Bangkok, we used the 82 BMA software TORs
in the local database, collected from egp2.bangkok.go.th between October
2025 and November 2026. We compared them with the FY2569 and FY2570 ordinances, using
the repo's own `isSoftwareProject` and `isLikelySameAgency` and a simple
Thai trigram title similarity.

| Step | Result |
| --- | --- |
| Ordinance software items (FY2570, `isSoftwareProject`) | 487 items, ฿771M, 61 agencies; 20 items ≥ ฿5M |
| TOR agency → ordinance agency | **71 / 82 (87%)** |
| TOR → one specific line (similarity ≥ 0.84) | **19 / 82 (23%)**, each checked by hand |

**Agency matching works.** e-GP stores BMA agencies as
`สำนักดิจิทัลกรุงเทพมหานคร · สำนักงานพัฒนาระบบสารสนเทศดิจิทัล`. The part
before `·` is exactly the name on the ordinance file. None of the 11 misses
is a real naming problem:

- 6 are agencies whose sheets our quick parser could not read (สำนักการแพทย์,
  สำนักงานเขตบางเขน).
- 3 are an extra space in "สำนักงานคณะกรรมการข้าราชการ กรุงเทพมหานคร".
- 2 are records stored in English.

**Project matching works for projects that the budget names.** Examples:

| Ordinance line (FY2570) | e-GP TOR | Amount |
| --- | --- | --- |
| ค่าใช้จ่ายในการเปิดให้บริการห้องสมุดออนไลน์ (e-Library) | ประกวดราคาจ้างโครงการเปิดให้บริการห้องสมุดออนไลน์ (e-Library)… | ฿2,700,000 in both |
| โครงการพัฒนาระบบสารสนเทศเพื่อบริหารยุทธศาสตร์การพัฒนากรุงเทพมหานคร | ประกวดราคาจ้างโครงการพัฒนาระบบสารสนเทศเพื่อบริหารยุทธศาสตร์… | ฿5,560,158 in both |
| ค่าบำรุงรักษาระบบเครือข่ายและโปรแกรมประยุกต์ (HCIS) | จ้างเหมาบำรุงรักษา…(HCIS) จำนวน 2 เดือน / 10 เดือน | ฿7.7M line; ฿1.1M + ฿6.6M contracts |
| เครื่องคอมพิวเตอร์ สำหรับงานสำนักงาน… (สำนักสิ่งแวดล้อม) | ประกวดราคาซื้อเครื่องคอมพิวเตอร์ สำหรับงานสำนักงาน… | ฿1,339,500 in both |

**Project matching does not work for maintenance contracts.** Most
สำนักดิจิทัลกรุงเทพมหานคร TORs are "จ้างบำรุงรักษาระบบเครือข่ายและโปรแกรม
ประยุกต์ ตามโครงการ X". The ordinance does not list those one by one: they
are paid from a single ค่าใช้สอย line described only as "ส่วนใหญ่เป็น
ค่าบำรุงรักษาระบบ…". This is a limit of the budget itself, so it is not
something we can fix. These contracts recur every year, so last year's TORs
predict them better than the budget does.

**National agencies.** Applying the same filters to the national table gives
1,825 software items (฿33.7bn) across 308 departments. 375 of them
(฿9.0bn) name Bangkok in the item or the department. Examples:

- พัฒนาระบบทะเบียนนักเรียนกลางแบบอิเล็กทรอนิกส์ (฿17.5M, สป.ศธ.)
- ระบบแพลตฟอร์มกลางเพื่อการบริการทางสังคม (฿23M, สป.พม.)
- Smart e-Signature (฿13.4M, กรมทางหลวง)

Each row carries a department code (`agc`). Matching by name would follow the
same rules as for BMA. We could not measure a lead time for these: our only
national source, the data.go.th contract tables, shows contracts that have
already been awarded.

### Gaps in our own filter

These came up during the test:

- `isSoftwareProject` accepts "ปรับปรุงระบบรวบรวมน้ำเสีย…". The filter
  excludes "บำบัดน้ำเสีย" but not "น้ำเสีย", so wastewater works get through.
- The ordinance lists some items twice: once in the summary and once in the
  detail. Before showing items we need to remove duplicates by agency, code
  and amount.

## What we would build

This is a proposal for the team to decide on. Nothing has been built yet.

1. **`bma-budget` source** (new module, the same shape as `datagov`).
   - Look up the `NN-excel` draft package through the CKAN API at
     `data.bangkok.go.th/api/3/action/package_show?id=70-excel`.
   - Download the agency files and parse the รายละเอียด sheets into line
     items `{fiscalYear, agency, code, name, amount, multiYear?}`.
   - Keep only items that pass `isSoftwareProject`.
   - Run once a year, in June, then once more when the final ordinance is
     published, to mark each item as confirmed or dropped.
2. **Store items as *planned projects*, not as TORs.** They have no deadline,
   no document and nothing to bid on yet. A "งบประมาณที่วางแผนไว้" section
   for each agency, or a "coming up" list, would show them without mixing
   them into search.
3. **Link a planned project to its TOR when the TOR arrives.** Use the same
   agency rule, plus title similarity and amount, so the planned item turns
   into "now open". Match alerts (FR-14) could then notify users at the
   *budget* stage. That is the next step after #264, which added alerts at
   the plan and draft stages.
4. **Later:** the national draft table, filtered with `namesBangkok`, for
   national agencies based in Bangkok.

Effort for step 1: the sheet layouts vary, so the parser is the main risk.
5 of the 72 agency files in the final FY2570 ordinance, and 7 in the
draft, need extra handling.

## Related sources not covered here

- **Annual procurement plans (แผนการจัดซื้อจัดจ้างประจำปี).** Under the
  Procurement Act B.E. 2560 s.11, agencies publish these on e-GP after the
  budget passes. Later than the draft budget, but already in e-GP's format.
  Worth checking for the plan stage of #264.
- **MOL and DGA**: these are covered by #153.

## Sources

- Bangkok draft ordinance FY2570 (Excel): https://data.bangkok.go.th/dataset/70-excel
- Bangkok ordinance FY2570 (final): https://data.bangkok.go.th/dataset/2570
- National draft act and volumes FY2570: https://www.bb.go.th/topic3.php?catID=1538&gid=860&mid=544
- National act and revised volumes FY2570: https://www.bb.go.th/topic3.php?catID=1542&gid=862&mid=545
- National draft Excel data table: https://www.bb.go.th/topic.php?gid=1513&mid=1118
- FY2570 budget calendar circular ว124 (11 Apr 2026): https://www.bb.go.th/topic-detail.php?id=18608&mid=1131&catID=0
- Royal Gazette publication of the FY2570 act: [Bangkok Biznews](https://www.bangkokbiznews.com/news/1254418), [Thansettakij](https://www.thansettakij.com/economy/670514)
- Bangkok council first reading, 3–4 Aug 2026: [Bangkok Biznews](https://www.bangkokbiznews.com/politics/1246043), [Thairath](https://www.thairath.co.th/news/politic/2959001)
- FY2570 calendar coverage: [Thai Post](https://www.thaipost.net/politics-news/978956/), [ThaiPublica](https://thaipublica.org/2026/06/the-government-presented-the-fiscal-year-2026-budget-to-parliament/)
- kaogeek/thailand-budget-pdf2csv: https://github.com/kaogeek/thailand-budget-pdf2csv

*Method: the files were downloaded on 12 Nov 2026 and parsed with throwaway
Python scripts. The filters are the repo's own `backend/src/common/software-filter.ts`,
`backend/src/tor/thai-locality.ts` and `backend/src/tor/tor-dedup.ts`, run
directly with Node. The TORs are the 98 non-test BMA records in the local
`tors` collection, collected 30 Oct 2025 to 11 Nov 2026.*
