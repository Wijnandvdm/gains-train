# Google Play

What to fill in on the Play Console, prepared so it's copy and paste. What's still to do is in
the TODO list of the [README](../README.md).

## The app

| Field | Value |
| --- | --- |
| App name | `Gains Train - Workout Tracker` (29 of 30 characters) |
| Package name | `io.github.wijnandvdm.gainstrain` (permanent once uploaded) |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free (a free app can never become paid) |
| Category | Health & Fitness |
| Privacy policy | `https://github.com/Wijnandvdm/gains-train/blob/main/PRIVACY.md` |

The upload: `scripts/android.sh --release` builds the signed app bundle
(`gains-train-<version>.aab`); set up the upload key first, see the top of that script.
Choose **Play App Signing** (the default): Google keeps the key that signs the app for
phones, you keep the upload key.

## Store listing

**Short description** (79 of 80 characters):

> Log gym workouts in a tap. No account, no internet: it all stays on your phone.

**Full description:**

> Gains Train is a workout tracker for the gym that keeps everything on your phone.
>
> LOG A SET IN ONE TAP
> Every set is prefilled with what you did last time. Tap Done, and the rest timer starts.
> Beat your record and you'll see it straight away.
>
> YOUR ROUTINE, READY
> Set up your training days once. When you open the app, the next day is ready to go.
>
> SEE YOUR PROGRESS
> Your history as a calendar, and per exercise your records and a chart of how you've grown.
>
> RIDE THE GAINS LINE
> A weekly streak with stations and tickets, plus a depot for holidays so a week off doesn't
> break it. Collect passport stamps for rides, weight hauled, records, streaks and exercises
> explored.
>
> 302 EXERCISES
> Each with a drawing, the muscles it works and how to do it. Add your own too.
>
> PRIVATE BY DESIGN
> No account, no ads, no tracking. The app doesn't even have internet access: your workouts
> never leave your phone. Back them up yourself whenever you like, as a zip of spreadsheets
> you can open anywhere, and restore them on a new phone. The app reminds you now and then.
>
> Exercise drawings: Workout Guide by Bryl Lim, based on Everkinetic, CC BY-SA 4.0.
> Instructions: free-exercise-db (public domain).

**Graphics** (still to make):

- App icon: 512 × 512 PNG, from `frontend/assets/icon-only.png`.
- Feature graphic: 1024 × 500 PNG or JPG.
- Phone screenshots: at least 2 (up to 8), for example the workout screen, a set being
  logged, History, Progress and the passport.

**Contact details:** an email address is required and shown publicly on the listing.

## App content

Play Console → your app → Policy → App content.

| Form | Answer |
| --- | --- |
| Privacy policy | The URL above |
| Ads | No, the app doesn't contain ads |
| App access | All functionality is available without special access (no login) |
| Content rating | See below |
| Target audience | 13 and older (tick 13–15, 16–17, 18+). Not under 13: that brings the Families policy |
| News app | No |
| Data safety | See below |
| Government app | No |
| Financial features | None |
| Health apps | Yes: tick **Activity and fitness** (fitness and workout tracking); no Health Connect |
| Advertising ID | No, the app doesn't use it |

**Content rating** questionnaire: category *All other app types*. Answer **no** to
everything: no violence, sexual content, bad language, drugs, gambling or scary content; users
can't talk to each other or share content; no location sharing; no digital purchases; no
web browser or search engine. Expected rating: Everyone / PEGI 3.

**Data safety:**

- Does your app collect or share any of the required user data types? **No.** Play counts
  data as collected only when it's sent off the phone, and the app has no internet access.
  The backup export is started by you and goes where you choose, which Play doesn't count as
  sharing.
- That's the whole form: with "No" it skips the questions about encryption and deletion.
  The listing then says "No data collected" and "No data shared with third parties".

## Before production: closed testing

New personal developer accounts must first run a closed test: at least **12 testers** opted
in for **14 days in a row**. Testing → Closed testing → create a track, upload the bundle,
add the testers' Google accounts (an email list), and share the opt-in link. Each tester
opts in and installs the app from Play. After the 14 days: Dashboard → Apply for production.
