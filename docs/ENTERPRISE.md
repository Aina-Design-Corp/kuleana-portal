# How this repository is governed — and the enterprise pattern it is built for

*Demonstration only.* This document describes how the demonstration portal is
governed on GitHub today and how a program that adopted the pattern would be
provisioned. No government adoption, endorsement, partnership, or deployment is
claimed or implied. Facts about GitHub's platform are taken from GitHub Docs
(Enterprise Cloud) as read on 2026-09-07 and 2026-10-11.

**Status as of 2026-10-11.** The enterprise layer described below was exercised
on a thirty-day GitHub Enterprise Cloud trial in September and October 2026.
The trial ended without purchase; the organization runs standalone, and no
enterprise account exists today. The enterprise is established, under Āina
Design Corp's nonprofit licensing, when an adopting program needs its own
organization (section 4, step 0). It is called "the enterprise" throughout;
its name and address are stated when they exist, not before.

## Start here

If you run a program: the first two sections say who owns what and what
"transfer intact" means. If you are the technical lead: the licensing note, the
provisioning walkthrough, and the current-state table are yours.

## 1. Three layers, one rule about ownership

```
Enterprise account   (the pattern)           rules that bind every organization under it — established when a program needs it
└── Organization     Aina-Design-Corp        the people, teams, and repositories of one owner — live today
    └── Repository   kuleana-portal          this demonstration: register, checks, public pages — live today
```

- **The enterprise account** is the administrative layer above organizations:
  policies that every organization must follow, billing, an audit log of
  administrative actions, and GitHub's own compliance reports. Enterprise pages
  are visible only to the enterprise's own members and administrators, so the
  public face of the pattern is this repository and the demonstration site.
  GitHub offers two kinds of enterprise. This pattern uses an **enterprise with
  personal accounts**: the kind that can invite an existing organization (Āina
  Design Corp's) and lets each organization bind its own identity provider. The
  other kind, Enterprise Managed Users, cannot add an existing organization,
  and its accounts cannot create public content, so a public portal could not
  be built in it.
- **The organization** owns the repositories and the people. It is the unit
  GitHub lets an owner hand over: an organization can be removed from one
  enterprise and invited into another, with its repositories, history, and
  public pages intact.
- **The repository** holds the project register, the checks that run on every
  change, and the source of the public pages.

The rule that follows: **a program that adopts this pattern gets its own
organization inside the enterprise.** Its staff never become members of this
demonstration repository. They sign in with their own directory, work in their
own organization, and can take that organization with them at any time.

## 2. What the enterprise sets for every organization

An enterprise owner can enforce, across every organization in the enterprise:
the default level of access members have to repositories (set to none, so
access is granted deliberately, by team), who may create, delete, or transfer
repositories and change their visibility, whether private repositories may be
forked, who may invite outside collaborators, and two-factor sign-in for
everyone. The enterprise audit log keeps administrative and access events for
180 days, is queryable by API, and can be streamed to a storage account the
adopting program controls. GitHub's SOC 2 Type 2 report, ISO/IEC 27001:2022
certificate, and CSA STAR certification are downloadable from the enterprise's
compliance page and can accompany a program's architecture documentation.

Identity is configured per organization, never for the whole enterprise, and
that is a rule of the pattern rather than a preference: an enterprise-level
SAML configuration overrides every organization's own and disables
organization-level provisioning. With SAML left off at the enterprise, each
organization binds its own identity provider (GitHub lists Microsoft Entra ID,
Okta, and OneLogin for organization provisioning), adds and removes members by
SCIM, and maps its teams to the provider's groups. That is what keeps one
organization's sign-in independent of another's, and it lets a program's
directory and Āina Design Corp's coexist in one enterprise without touching
each other.

What the program's directory governs in this model is **membership**: who is
in the organization, on which team, and when they leave. People sign in with
GitHub accounts linked to their directory identities. Accounts owned outright
by the program are the managed-users kind of enterprise, with the limits noted
in section 1; a program that wants that model plans for it from the start.
One check before relying on group-to-team mapping: GitHub documents team
synchronization for Entra ID commercial tenants, so a program on a
government-cloud tenant confirms that feature with GitHub first (single
sign-on and provisioning are not affected).

## 3. Licensing — the nonprofit path

Āina Design Corp is a Hawaiʻi nonprofit corporation and an IRS 501(c)(3)
public charity. GitHub for Nonprofits offers a verified nonprofit organization
either the Team plan at no charge or a 25 percent discount on Enterprise
Cloud, claimed by an organization owner through GitHub's self-serve portal
with proof of nonprofit status. The two are alternatives, and they decide when
the enterprise is bought:

- **Organization on Free or Team (today).** Branch protection, `CODEOWNERS`,
  deployment environments with required reviewers, a two-factor requirement,
  and public pages built by workflow. Every control in section 5's "now"
  column is an organization or repository control and needs no enterprise.
- **Enterprise Cloud (the pattern).** Policies enforced across organizations,
  the 180-day audit log and its streaming, the compliance reports, and the
  one thing the identity steps depend on: organization-level SAML single
  sign-on, SCIM provisioning, and team synchronization, which GitHub offers
  only on Enterprise Cloud.

So the enterprise is established when a program needs its own organization and
its own directory, and not before. Seats are per member and bill to the
enterprise; the program's members, the provisioning service account (section
4, step 5), and the contractor's staff all count.

## 4. Provisioning an adopting program's organization

The order below is the order it happens in; each step names who acts.

0. **Establish the enterprise** (Āina Design Corp): purchase Enterprise Cloud
   with the nonprofit discount as an enterprise with personal accounts; invite
   the existing Āina Design Corp organization; set the policies in section 2;
   leave enterprise-level SAML off.
1. **Create the organization** from the enterprise's Organizations page (an
   enterprise owner). The new organization inherits every enforced policy, the
   audit log, and the compliance reports on creation.
2. **Baseline settings** (organization owner): profile and contact for the
   program, not the contractor; domain verification by the program's DNS
   administrator so notifications can be restricted to its addresses; default
   member access none; Actions limited to GitHub-provided and in-organization
   workflows; public Pages allowed.
3. **Teams** (organization owner): one per role the review process needs, for
   example administrators, a coordinator, and departmental approvers. Teams are
   empty until identity is live.
4. **The repository** (organization owner): create it from this demonstration
   as a *template*, never by transferring this repository. A template copy
   starts with a single commit and carries files only, so the program's record
   begins on its own first day with no sample data in its history. Then, as
   reviewed changes: adopt the production schema (v1.0); load the program's
   own data through the intake workflow; add a `CODEOWNERS` file that names
   which team must approve changes in which folder; add a ruleset on the main
   branch that requires a pull request, an approval, code-owner review, and the
   `validate` check, and that binds administrators too; add a deployment
   environment for the public pages whose required reviewers are the program's
   approvers (the release switch); keep any service credentials as
   environment-scoped secrets; grant each team its repository role.
5. **Identity** (the program's identity administrator with the organization
   owner): enable SAML single sign-on on the organization and test it without
   enforcing; turn on SCIM provisioning so accounts appear and disappear from
   the identity provider (GitHub's organization SCIM acts through a dedicated
   organization-owner account that holds a seat); enable team synchronization
   so identity-provider groups decide team membership; enforce single sign-on
   once every intended member has signed in once. Enforcement removes anyone
   who has not signed in through the provider, including the contractor's own
   staff, so the contractor's accounts are either issued as guest identities in
   the program's directory for the term, or single sign-on stays enabled but
   not enforced until the contractor leaves.
6. **A reviewer's first day**: added to a group in the identity provider;
   receives an invitation; signs in through the provider; lands on the right
   team with access to exactly one repository; approves a pull request and
   watches the checks and the deployment gate do the rest. None of it is a
   contractor action.
7. **Offboarding**: removal from the identity-provider group removes the
   account from the organization; the audit log records it; the repository
   history keeps every approval the person made, attributed to them.
8. **Exit**: the organization stays in the enterprise, leaves it to run
   standalone, or joins the program's own enterprise account of the same kind.
   Repositories, history, and public pages are unchanged in every case. Two
   details worth knowing: a managed-users enterprise cannot accept an existing
   organization, so a program that later wants that model plans a new
   organization rather than a move; and on GitHub's free plan, code-owner
   enforcement does not apply in private repositories, so a standalone
   organization keeping a private register would keep a paid plan for that one
   feature.

## 5. What this demonstration repository has today

Stated so that nobody reads the pattern above as a description of the demo.
Verified against the organization and repository settings on 2026-10-11.

| Control | In this repository now | In the pattern |
|---|---|---|
| Plan and enterprise | Organization on GitHub Free, standalone; no enterprise account (trial ended 2026-10-06) | Enterprise Cloud under nonprofit licensing, the organization inside it |
| Enterprise policies | None | Enforced across every organization |
| Default member access | Read | None; access by team |
| Main-branch protection | `validate` status check required | Ruleset: pull request, approval, code-owner review, `validate`, binds administrators |
| `CODEOWNERS` | Present: maintainers for the record, architecture owner for the rules; review requested, required once the main ruleset lands | Names the approving team per folder; enforced by the ruleset |
| Deployment gate | `PUBLISH_PAGES` variable and the `github-pages` environment with a branch policy | Same, plus required reviewers on the environment |
| Public pages | Built by workflow; custom domain kuleana.ainadesign.org | Built by workflow; the program's own address |
| Identity | Two-factor required; GitHub accounts | SAML single sign-on, SCIM, team sync on the program's provider (Enterprise Cloud) |

This table is updated when the demonstration's own controls change.

## 6. Boundaries

- The demonstration keeps fictional sample data and claims no adoption.
- No enterprise account exists today. The enterprise in this document is a
  pattern and a plan; its name, address, and membership are stated when they
  exist.
- Nothing here describes any government's systems, directories, or decisions;
  the walkthrough is the platform's mechanism, stated generically.
- Platform facts are GitHub's, cited from GitHub Docs; Āina Design Corp makes no
  certification claims of its own here.

## Sources

GitHub Docs, Enterprise Cloud (read 2026-09-07): About enterprise accounts ·
Adding organizations to your enterprise · Removing organizations from your
enterprise · Enforcing repository management policies in your enterprise ·
About the audit log for your enterprise · Streaming the audit log for your
enterprise · Accessing compliance reports for your enterprise · Managing your
role in an organization owned by your enterprise · About SCIM for organizations
· Enabling and testing SAML single sign-on for your organization · Enforcing
SAML single sign-on for your organization · Synchronizing a team with an
identity provider group · Creating a repository from a template · Transferring
a repository.

GitHub Docs (read 2026-10-11): Setting up a trial of GitHub Enterprise Cloud ·
GitHub for Nonprofits quickstart · Deciding whether to configure SAML for your
enterprise or your organizations · About SAML for enterprise IAM · About
Enterprise Managed Users.
