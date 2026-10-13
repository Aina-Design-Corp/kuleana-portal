# Coordinator runbook — the monthly cycle

You run the cycle. Nothing here requires more than a browser. Each numbered
step is one sitting; a normal month is four or five.

## The month at a glance

| When | Step | You do | Ends with |
|---|---|---|---|
| Any day | 1. Notices and figures | Record what has been publicly said; add released and spent figures when a department publishes them | Small reviewed changes, merged as they come |
| Day 1–10 | 2. Reports | Watch reports arrive from project leads (form, issue, or email) | `draft` records |
| Day 10–15 | 3. Review | Check each draft, return what needs work | `validated` records |
| Day 15–20 | 4. Send for approval | One publication pull request | Reviewer approval, merge, pages rebuilt |
| Day 20+ | 5. Follow up | Reminders, corrections, next month's list | A clean slate |

## Step 1 — Notices and figures

A public notice (a call for proposals, an award, a milestone, a news story)
goes on the project's page as soon as it is recorded, with its date, source,
and link. It does not wait for the cycle. Open the project's record in
`registry/FY2027.json`, add the entry under `reports` in date order, and
open a pull request; the checks run, a maintainer merges.

When a department publishes released or spent figures, add them the same
way. Budget facts are public already; released and spent amounts appear as
departments report them.

## Step 2 — Reports

Reports come in three ways: the direct-entry form (Document 4), the *Tell a
project's story* issue template, or an email you enter on the project's
behalf. Each becomes a `draft` change to the project's record: the story,
the results with their source notes, the place if given. Open it as a pull
request titled *Report: [project] [month]*. Nothing to do yet except notice
who has and has not reported.

A report that a project cannot enter itself — a crew with no form, a phone
call, notes from a site visit — you enter yourself, naming you as submitter
and the project lead as source.

## Step 3 — Review each draft

For each *Report* pull request:

1. Open **Files changed**. Read the record as a person would.
2. Check four things: the numbers make sense against the last period and
   the project's own baseline; the story and any photo have a named source
   and recorded consent; the moku is named (a record cannot publish without
   it); nothing personal beyond what the source approved.
3. The `validate` check has already run the rules. If it is red, the log
   names the record and the rule; send that sentence back to the submitter
   in plain words.
4. If it is right: **Approve**, set the record's `publicationStatus` to
   `validated` in the same pull request, and merge. If it is not: **Request
   changes** with what to fix, and tell the submitter by email. Returned
   drafts stay `draft`.

## Step 4 — Send for approval and publish

1. Open one **publication pull request** for the month using the template.
   It lists every record you are moving from `validated` to `published`.
2. The template's checklist is for you: each record validated; sources
   named; the moku named; nothing held is included.
3. Request review from the reviewers. They approve or return individual
   records (reviewer guide).
4. When the approval is in, **Merge**. The publishing job starts and then
   *waits*: a reviewer must click **Approve and deploy**. That click is the
   moment the pages change.
5. Open the public site and the data download. Confirm the month's records
   are there and nothing else changed.

## Step 5 — Follow up

- Projects that did not report: a reminder from you. Three silent months:
  raise it in conversation, not by escalation.
- Corrections that came in during the month: each is a Correction issue
  and a small pull request.
- Next month's list: who reports, who is carried by someone else, who gets
  a visit.

## Withdrawing something already published

A reviewer can move a record from `published` back to `validated` at any
time by pull request; the pages rebuild without it and the record of the
withdrawal is kept. You can prepare the pull request; only they approve it.

## If something looks wrong

Correction issue first, so the reason is on record; then the fix.
