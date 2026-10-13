# Contributing to the Green Fee Commons Report

This repository is for the people now tasked with tracking the Green Fee
projects and telling their stories — program staff, project leads, crews,
stewards, reporters, students — and for anyone who wants to take the method
and use it elsewhere. You do not need to know Git to contribute. Pick the
way in that fits you.

## Three ways in

| You want to | Do this | Who reviews |
|---|---|---|
| **Record something that was publicly said** about a project — a call for proposals, an award, a milestone, a result in the news | Open an issue with the **What has been reported** template. Give the date, the source, and a link. | A registry maintainer turns it into a reviewed change; it appears on the project's page once merged. |
| **Tell a project's story and report its results** — in the project's own words, with the numbers it keeps | Open an issue with the **Tell a project's story** template, or send the project lead the direct-entry form (Document 4). | The coordinator checks it; a reviewer approves it; then the page shows it. The record also needs its moku to publish. |
| **Correct a fact** that is wrong or out of date | Open an issue with the **Correction** template: which record, what it says, what it should say, and how you know. | A maintainer makes the fix as a reviewed change. The old value stays in the history, linked to your issue. Nothing is silently overwritten. |

If you are comfortable with Git: fork, edit `registry/FY2027.json`, run
`npm run validate`, and open a pull request. The template asks the same
questions the issues do.

## The rules every contribution meets

1. **A source on everything.** A notice has a link. A result has a source
   note (a crew log, a lab report, a monthly count). A story is in the
   project's own words with the project's consent to publish it.
2. **A person publishes, never software.** The checks run on their own; the
   decision to publish is always a person's, recorded with their name and
   the time.
3. **Nothing personal.** Your name and email on a submission are for
   follow-up and are never shown. Photos and quotes need the consent of the
   people in them.
4. **Blank is honest; zero is a claim.** Leave out what you do not have.
5. **Place is confirmed, not guessed.** Island and moku are set by the
   project. Where the report has read a place from a project's name, it says
   so and asks for confirmation; you can give it.
6. **Plain words, correct names.** Short sentences. Hawaiian place names with
   their ʻokina and kahakō. No platform vocabulary a project lead would not
   recognize.

## Who does what

- **Project leads** report. [`docs/handbook/project-lead-manual.md`](docs/handbook/project-lead-manual.md)
  is one page per task.
- **The coordinator** runs the monthly cycle: watches reports arrive, checks
  each draft, sends the month's publications for approval.
  [`docs/handbook/coordinator-runbook.md`](docs/handbook/coordinator-runbook.md).
- **Reviewers** approve what publishes and can withdraw it.
  [`docs/handbook/reviewer-guide.md`](docs/handbook/reviewer-guide.md).
- **Maintainers** (`.github/CODEOWNERS`) are asked to review every change
  to the record; the architecture owner reviews changes to the rules and
  the checks.

The same roles are taught as Moku Steward Training at
[Hui Koʻe ʻĀina](https://huikoeaina.ainadesign.org/), the network's
community learning hub, which also holds the rules the record follows.

## Taking the method elsewhere

Everything here is open: the code under MIT, the record and the writing
under CC BY 4.0 (see `LICENSE` and `LICENSE-CONTENT`). To run the same
report for another program, another funding year, or another moku:

1. Fork this repository, or install the toolkit it is built with
   (`Aina-Design-Corp/moku-geospatial-survey-toolkit`), which runs the same
   checks and build on any register.
2. Replace `registry/FY2027.json` with your own register, in the same shape
   (`schemas/registry.schema.json`; field by field in Document 2).
3. Keep the three gates and the notice on every page. Say whose record it
   is and who keeps it.
4. Credit this report as `LICENSE-CONTENT` asks.

Document 1 on the site walks through the copying steps in full.

## Asking

Open a discussion or an issue. Governance of the repository — teams,
protections, and the pattern a program would follow to run its own — is in
[`docs/ENTERPRISE.md`](docs/ENTERPRISE.md).
