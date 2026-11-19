# Activity token and daily refresh

The deploy workflow (`.github/workflows/deploy.yml`) runs on every push to
`main`, every day at 05:17 UTC, and on demand (**Actions → Deploy to GitHub
Pages → Run workflow**). Each run:

1. refreshes `data/activity.json` from the GitHub API (`npm run activity`),
   reading a fine-grained Personal Access Token from the `ACTIVITY_TOKEN`
   secret;
2. runs the unit tests (`npm test`);
3. builds the site and deploys it to GitHub Pages;
4. checks the activity refresh (the `activity-health` job).

The refreshed snapshot only lives for that run's build. It is never committed
back: the committed `data/activity.json` is the fallback the site shows when a
fetch fails.

The fetch only ever keeps numbers and ISO dates. Its warnings name projects by
their slug (`rally-voley`) and never print a branch name, because the Actions
logs of a public repository are public.

---

## 1. Create the token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Click **Generate new token**.
3. Fill in the form:
   - **Token name**: `portfolio-activity` (or any name you recognise)
   - **Expiration**: 1 year (set a calendar reminder to renew before it expires)
   - **Resource owner**: `Jergasus`
   - **Repository access**: Select repositories — choose exactly these four:
     `questday`, `SakurAI`, `rally-voley`, `Yokaido`
   - **Permissions** (Repository permissions section):
     - **Contents**: Read-only
     - **Metadata**: Read-only (auto-selected; mandatory for fine-grained tokens)
     - Leave everything else at No access
4. Click **Generate token** and copy it immediately — GitHub shows it only once.

---

## 2. Add the token to the repository secret

Run this command once (paste the token when prompted, or pipe it in):

```sh
gh secret set ACTIVITY_TOKEN -R Jergasus/Jergasus.github.io
```

After that, every workflow run on `Jergasus/Jergasus.github.io` can read the
token as `${{ secrets.ACTIVITY_TOKEN }}`.

---

## 3. Regenerate the committed fallback snapshot

The file `data/activity.json` is a committed snapshot used as a fallback.
Refresh it locally whenever you want to update the baseline (e.g. when first
creating the token, or when updating after a long time offline):

```sh
ACTIVITY_TOKEN=<your-token> npm run activity
```

Review the diff — it should contain only numbers and ISO dates, nothing else
(the script drops anything else, and the build refuses a snapshot that holds
more):

```sh
git diff data/
```

If the diff looks clean, commit it:

```sh
git add data/activity.json
git commit -m "chore: refresh activity snapshot"
```

---

## 4. When a refresh fails

The site always deploys. What the refresh does depends on what went wrong:

| Situation | What the site shows | The run |
|---|---|---|
| Every repo fetched | Fresh numbers | Passes |
| Some repos failed | Those repos keep their numbers from the committed snapshot; the rest are fresh | **Fails** at `activity-health` |
| Every repo failed (expired or revoked token, GitHub down) | The committed snapshot | **Fails** at `activity-health` |
| Rally Voley's branch no longer exists | Fresh numbers, read from `main` | Passes, with a warning |
| No `ACTIVITY_TOKEN` secret | The committed snapshot | Passes, with a warning |

Each failure is a warning annotation on the run (`Activity refresh: …`), naming
the repo and the HTTP status.

### The "Run failed" email

When `activity-health` fails, GitHub sends a **Run failed: Deploy to GitHub
Pages** notification. It means the site is up, but its activity numbers are
older than they should be. It reaches the account that created the scheduled
workflow (or last changed its cron line), as long as Actions notifications are
on for that account (**GitHub → Settings → Notifications → Actions**).

To fix it, open the failed run, read the warnings on the `deploy` job, then:

- **401 for every repo**: the token expired or was revoked. Rotate it (section 5).
- **404 for one repo**: the repo was renamed or the token lost access to it.
  Check the token's repository list and `src/lib/activity-sources.ts`.
- **A 5xx status or a network error**: GitHub had a bad moment. Re-run the
  workflow; the next daily run will also retry on its own.

When the warning says Rally Voley's branch was not found, its numbers already
come from `main`. Point its `branch` in `src/lib/activity-sources.ts` at the
branch the work lives on now (usually `main`) so the warning stops.

---

## 5. Rotating the token

Fine-grained tokens expire. When GitHub sends the expiry warning email, or the
refresh starts failing with 401:

1. Follow section 1 to generate a new token with the same settings.
2. Run the `gh secret set` command from section 2 to overwrite the old secret.
3. Run the workflow once (**Actions → Deploy to GitHub Pages → Run workflow**,
   or `gh workflow run deploy.yml -R Jergasus/Jergasus.github.io`) and check
   that `activity-health` passes.
4. Delete the old token in **Settings → Developer settings → Personal access
   tokens**.

---

## 6. The daily run pauses after 60 days without commits

GitHub's documentation: "In a public repository, scheduled workflows are
automatically disabled when no repository activity has occurred in 60 days."
The daily runs themselves do not keep the repository active, so if nothing is
pushed for 60 days the daily refresh stops, silently: the site stays up but
its activity stops updating.

- Any commit pushed to `main` (a status or copy change counts) keeps it alive
  and also deploys.
- If it has been disabled, the **Actions** tab shows a banner on the **Deploy
  to GitHub Pages** workflow with an **Enable workflow** button. Or, from a
  terminal:

  ```sh
  gh workflow enable deploy.yml -R Jergasus/Jergasus.github.io
  ```

  Then run it once (section 5, step 3) so the site catches up straight away.
  From then on, run notifications go to whoever re-enabled it.

There is deliberately no bot that commits to keep the repository active, and
no automatic re-enable job: GitHub does not document that re-enabling an
already enabled workflow resets the 60-day count, so it would be a promise the
setup cannot keep.
