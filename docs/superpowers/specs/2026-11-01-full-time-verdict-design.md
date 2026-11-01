# Full-time verdict: design

Status: draft for the owner's approval (nothing is built).

## Intent and why

The owner watches his teams live and does not want to use the phone during the match. The two moments the site can serve are before and after. Today, after the whistle, he gets "Team A 2–1 Team B, Full time" and, if he opens the site, a table of numbers. He asked for the site to tell him the story instead: was the result deserved, and where did the match turn.

Chosen shape (owner's words, 1 Nov 2026): "Match sketch" + "Silent journalist" merged. After each match of a team he stars, **one notification replaces the plain final-score one**. It carries two written sentences (a verdict and the turning point). It opens a card with the win-probability curve over the 90 minutes, the verdict and a share image. Tone: a calm analyst. (The owner also asked for a tone picker in the site; see non-goals, it is a second step.)

Example notification (analyst tone):

> Barcelona 2–1 Real Madrid
> A stolen win: Real's chances were worth 2.4 goals, Barcelona's 0.9. The match turned in minute 78, when Barcelona's chance of winning went from 31% to 78%.

## Goals

1. One notification per starred team per finished match, through both existing doors (ntfy and Web Push), bilingual as the current ones are, with the score in the title and the two sentences in the body. Its link opens the card.
2. A card page for any finished match of the current season: curve, turning point, verdict, chances (xG) of both sides, saved as a PNG for sharing, Arabic right to left, 390 px phone.
3. Every number is computed from `data/` and **tested**: the page and the notification state how accurate the method is, measured on all finished matches, including when it is not very accurate.
4. The notification and the card never disagree (same source file).

## Non-goals

- Live in-match updates, goal alerts (owner declined these).
- A tone picker and a second tone (banter). Recorded as the next step; it doubles texts and tests.
- Predictions for coming matches; player ratings; changing how Web Push or ntfy deliver.
- Past seasons (current season only; the page says so in a past-season view, like the other current-season pages).

## Anti-goals (it fails even if it works)

- A verdict that sounds sure when the chances were close. There must be a "close call" wording, not a forced winner.
- Invented values: a match with no shot data gets no verdict and the old plain notification.
- A curve that ignores something the data has (red cards) without saying so.
- A longer or noisier notification stream: still at most one per team per match.

## Constraints (from CLAUDE.md)

Static site on GitHub Pages; optional sync step between `STORY START/END` markers, wrapped so a failure never stops the sync; asset registered in `FEATURES_JS`, raise `FEATURES_V`, `sh tests/regen.sh`; no secrets in the browser; no model names in commits; explicit staging; Arabic helpers (`two`, `nb`, `nm`, `INS.ar`); capture `D.id` before awaits; test recomputed independently from `data/`, plus Arabic, 390 px, leaving early, failing file; new tests added to `.github/workflows/tests.yml`; `tests/README.md` and CLAUDE.md updated.

## Approaches considered

1. **The sync writes the story (chosen).** A new step computes, per finished match of the current season, the curve, the turning point, the verdict and the sentences, and writes `data/story.json`. The notification builder and the card both read it. Trade-off: a new data file; computation in Python only; the browser only draws.
2. **The page computes, the notification is a teaser.** No new file, but the notification could not carry the verdict, which was the point. Rejected.
3. **Compute in both Python and JavaScript** (as Elo does). Allows a card for any match without a file, but doubles the work and risks two versions disagreeing. Rejected for now.

The owner chose approach 1 after seeing the example above (the method name itself was left to me: it is an internal choice).

## What the owner decided

- Delivery: one notification that replaces the plain final-score one (not two).
- Tone: calm analyst first.
- The example notification and card above.

## Design

### Data and timing

Shots (`*_sh.json`: `xg`, `mn`, `ma`, `ev`, `og`, team id) are present with the score for 397 of the latest 400 finished matches (checked 1 Nov 2026), so the verdict can go out with the score. Rule: if a finished match has no shot data, send the plain notification as today (no verdict, no wait), so nothing is delayed or lost. (If the builder finds shots often arrive a sync later, a short hold is allowed, but it must be measured first.)

### Verdict (what the chances say)

From the match's shots (own goals excluded from xG, counted in the score as the other side's goal, as Comebacks & collapses does) compute each side's chance of winning / drawing if the same shots were taken again (each shot scores with probability xG; Poisson approximation or exact Poisson-binomial). Words, decided before looking at test results and then not tuned to flatter them:

- the result side's chance-based win probability high → "deserved";
- middling → "a close call";
- low → "stolen" / "lucky" (for a draw: the same on the draw's side).

The builder sets the cut-offs and writes them in the file. **Test:** report how well the shot-based probabilities explain the 2025-26 results of all six leagues (Brier against the league rates), total xG against total goals per league, and what share of results land in each verdict word. State all of it on the page.

### Curve (how the chance of winning moved)

Win / draw / loss probability at each minute from: the pre-match strength (Elo's pre-match chances in `data/elo_own.json`, turned into expected goals for each side) and the score at that minute with the minutes left (stoppage time ends at 90 plus added minutes). Points at every goal plus a regular step. **Test:** calibration at minutes 30, 60 and 75 over all finished matches (predicted against actual, in bins), reported on the page. It ignores red cards unless the data holds them (the builder checks `data/` for card events; if not, the page says so).

### Turning point

The goal with the largest change in the winning side's probability (for a draw, the goal that changed the draw's probability most), reported with before and after percentages. A match with no goals says so.

### Sentences

Deterministic templates in English and Arabic (no AI, no external call). Numbers rounded as the page shows them. Length: the body fits two lines on a phone notification.

### Delivery

`notify_plan` builds the final-score message from `data/story.json` when the match has an entry, else exactly as now. Both channels (`ntfy`, `push`). State keys, the first-run rule, the 80-message cap and the failure stop stay as they are. The click link is the card's address. Existing notification tests expect the old text and must be updated alongside.

### Card page

New page `#/recap/<match id>` (feature file in `assets/`, registered in `FEATURES_JS`); reachable from the notification and from the Match centre of a finished match (a link; the Match centre otherwise stays as it is). Contains: score header, the curve (goals marked, the turning point highlighted), the verdict sentence, both sides' chances, a short "how accurate is this" note from the tests, a share button producing a PNG (`INS.cardKit.savePng`). The curve and verdict are drawn from `story.json`; the page computes nothing new.

## Left to the builder

File layout of `story.json` (keep it small: aim for 60 KB gzipped or less for a season), the cut-offs, the exact goal-rate conversion from Elo, template wording, where the link sits in the Match centre, and test fixtures. Anything that changes what the owner sees (new notification count, a delay, a dropped verdict) goes back to the owner.

## Calls I made (the owner can overrule any of these)

1. **Language.** Web Push sends one language, the device's own (the push body is already built per device language). ntfy has no device language, so its body is short and bilingual: score title, then one Arabic and one English line (verdict only; the turning point is on the card).
2. **Perspective.** The text is about the match, not about the receiving team: "A stolen win for Barcelona: ..." reads right for both fans. A draw says "a draw that the chances split: ..." / "a fair draw" (cut-offs decided with the others).
3. **Missing shots at notification time.** No hold and no second message: the plain notification goes out as today and the match is marked. The builder measures how often shots arrive in a later sync; if it is more than about 5%, the question comes back to the owner.
4. **Curve against verdict.** They answer different questions and may differ. The curve is what the scoreboard did to the chance of winning (pre-match strength + score + time left); the verdict is what the chances created say. The page says this in one line, and a "stolen" verdict beside a curve that jumped for the lucky side is exactly the story.
5. **Elo to goal rates.** Elo's three probabilities fix a goal difference, not two rates. The builder fixes the league's average total goals per match (per league, from earlier matches only) and solves for the two rates; the curve is checked for calibration at minutes 30, 60 and 75 and the result is printed on the page. A match with no Elo prediction (about 4 of 104 recent LaLiga matches) gets a verdict from its shots and no curve.
6. **Goals that do not add up to the score** (own goals, missing shots): no verdict and no curve; the plain notification goes out.
7. **Red cards.** `*_sh.json` has no card events; the builder checks the other files, and unless a file has them the card says red cards are ignored.
8. **Order and plumbing found by the review.** The STORY block must run and be committed before NOTIFY (which reads from the hub); `push_text` rebuilds the body from the key and device language, so the verdict has to travel in the key or a language-keyed payload; the click and push link become `#/recap/<id>`; `recap` goes in the past-season `NOT` list and `story` in `psCurOnly`; the notification tests (`t_notify.py`, `t_push.py`, `ui_push.js`) change with the text.
9. **Accuracy statement.** The page prints the measured numbers (calibration at 30/60/75, share of results per verdict word, xG against goals) and says in words whether they are good; the notification itself carries no accuracy line.

## Step 2: a tone to choose (owner approved 1 Nov 2026: "إي، ابدأ")

The owner asked in the brainstorm for a tone he can change in the site. Step 1 shipped the calm analyst. Step 2 adds **match banter**: the same facts and numbers, said with more heat (Gulf Arabic and plain English), for example "Daylight robbery! Hull City won it, but Manchester United's chances were worth 1.8 goals to 1.3." / "سرقوها! ...".

- `story_text(e, home, away, tone)` gets `tone` = "calm" (default) or "fun"; `data/story.json` entries carry `fx` next to `tx` (both stored, so the notification and the page still read one file; the file grows by about a third). Every number in an `fx` sentence equals the one in the `tx` sentence (tested on the whole real file).
- The choice sits in the Notifications card under "Your teams" (a two-button choice, saved in this browser as `plx_tone`, default calm). It travels in the sealed subscription message (`tone`), changing it re-sends the message like a change of starred teams. Web Push uses it per device; **the ntfy door stays calm** (its topics are public and do not know the reader). The recap page and its saved picture use the same choice.
- Anti-goals: no new claim in the banter that the calm text does not make; no different verdict word or number; default stays calm.
