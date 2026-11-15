# Google Play — Bjango

Package / application ID: `uk.co.mozzer.bjango`  
Version: `1.3.0` (versionCode **4**)  
Signed bundle: build it with `npm run bundle:aab` (writes `Bjango-release.aab` and `PlayStore_Assets/Bjango-release.aab`)  
Privacy policy URL: `https://shane-morris.netlify.app/privacy`

This build is **free**, **no in-app purchases**, with **AdMob ads**. Progress stays on the device. Banner on title/menus; full-screen ads between streets, never while you are aiming.

---

## 1. Create the app

- **App name:** `Bjango`
- **Default language:** English (United Kingdom) — `en-GB`
- **App or game:** Game
- **Free or paid:** Free
- **Declarations:** not in Designed for Families. Contains ads: **Yes**.

Do not create a second app. The AAB application ID is `uk.co.mozzer.bjango`.

---

## 2. Store listing

Character counts are checked against Play's limits.

- **App name (26/30):** `Bjango: The Gritty Western`
- **Short description (76/80):**
  `Hold to slow time. Bank bullets off skillets. Outdraw 30 streets of outlaws.`
- **Full description (2165/4000):**

```
Hold the glass and time crawls. A gold line shows exactly where your bullet will go – every bounce included. Drag it onto a skillet, a barrel hoop or a tin sign, let go, and watch the slug bank into the man hiding behind cover.

Bjango is a one-thumb western shooter built around slow, satisfying trick shots. No twitch aiming. Just you, six rounds and a street full of men reaching for their irons.

RED DUST COUNTY
• 30 streets across 7 chapters – dusty main streets, a lamplit saloon, red-rock canyons, the rail depot and the gallows
• Metal bounces the shot. Wood stops it. Bank around crates and fences to reach the men behind them
• Outlaws duck behind cover, pace the boardwalks and draw faster the further you ride
• Marshals take two hits – or one in the hat
• Line up two men and put one bullet through both
• Up to three stars a street. Clear it with a single bullet for all three

DAILY SHOWDOWN
• A new street every day, the same for everyone
• Win each day to keep your streak going

BOUNTY HUNT
• Endless waves of outlaws and a growing cash bounty
• Bank shots, headshots and doubles push your multiplier up to 4×
• Every third wave has a twist: Quick Draw, Iron Men or Pan Alley
• Your best bounty is kept on your phone

WANTED POSTERS AND THE GUNSMITH
• 16 Wanted Posters to claim, from First Draw to Legend of Red Dust
• Earn eight more revolver finishes with your stars – Silver, Gold, Charred, Jade, Devil Red, Legend and more

MADE TO FEEL GOOD
• Bullet-time slow-mo and a kill-cam on the last man standing
• Ricochets you can feel, with haptics on every bounce and hit
• Narrator and outlaw voices, recorded gunshots and the ping of lead off cast iron
• Shoot a passing tumbleweed for a little extra
• A hands-on tutorial teaches the draw and the bank shot in two streets

HOW TO PLAY
Hold. Drag until it says WILL HIT or BOUNCE WILL HIT. Let go.
Tap the cylinder to reload.

NO ACCOUNT, NO PURCHASES
• No sign-up and no in-app purchases
• Your stars, streak and bounty stay on your phone
• A banner on the title and menus, and an occasional full-screen ad between streets – never while you are aiming

A Red Dust picture. Portrait. One thumb.
```

- **Graphics:**
  - Hi-res icon: `PlayStore_Assets/App_Icon_512x512.png` (512×512, must match the launcher skillet)
  - Feature graphic: `PlayStore_Assets/Feature_Graphic_1024x500.png` (1024×500, 24-bit PNG, no alpha). Rebuild with `python3 scripts/make_feature_graphic.py` from `tools/feature-graphic.html`.
  - Phone screenshots (1080×1920, 9:16), captured from real play by `tools/store_screenshots.py`. Upload these, in order:
    1. `PlayStore_Assets/Screenshots-1.3.0/1_title.png`
    2. `PlayStore_Assets/Screenshots-1.3.0/2_bank_shot.png`
    3. `PlayStore_Assets/Screenshots-1.3.0/3_collateral.png`
    4. `PlayStore_Assets/Screenshots-1.3.0/4_scene_clear.png`
    5. `PlayStore_Assets/Screenshots-1.3.0/5_bounty_hunt.png`
    6. `PlayStore_Assets/Screenshots-1.3.0/6_daily_showdown.png`
    7. `PlayStore_Assets/Screenshots-1.3.0/7_streets.png`
    8. `PlayStore_Assets/Screenshots-1.3.0/8_wanted_posters.png`
    Remove the older sets (`Screenshots/`, `Screenshots-1.2.0/`) from the listing — they show the old HUD. Do not use `assets/ui/screenshot-phone.jpg` (it still says The Gritty Western, not Bjango).
- **Category:** Game → **Action** (second tag **Arcade** if asked). Not Casual-only. Not Kids.
- **Tags:** Western, Action, Arcade, Shooter, Single player
- **Contact:** `justsmk@gmail.com` · `https://shane-morris.netlify.app/privacy`

---

## 3. Store settings / questionnaire

### Target audience
- Appeals primarily to children? **No**
- Target age: **16+** (guns + stylised violence). Do **not** tick Designed for Families.

### Ads
- Contains ads? **Yes**
- Advertising ID: **Yes** — used by Google Mobile Ads
- Purposes: **Advertising or marketing** and **Fraud prevention, security, and compliance** only (same as Bingo)

AdMob app ID: `ca-app-pub-0970861679884235~4548340358`  
Banner: `ca-app-pub-0970861679884235/4436659719`  
Interstitial: `ca-app-pub-0970861679884235/9609095344`

### App access
- All functionality without login? **Yes**

### News / government / financial
- News? **No**
- Financial or real-money gaming? **No**
- Government? **No**

### IARC
- Category: **Game**
- Violence: **Yes** — cartoon / stylised shootouts, characters fall when hit. No realistic gore.
- Guns / weapons: **Yes** — player fires a revolver; enemies draw on you.
- Blood: mild / implied (dust and a red hit flash), not gore.
- Sexual content, drugs, gambling, hate: **No**
- User interaction: **No** chat, no UGC, no location sharing.
- Expected rating: **Teen / 16+**, not PEGI 3/7, not Families.

### Data safety
- **Device or other IDs (Advertising ID):** collected by Google Mobile Ads for advertising and fraud prevention. Shared with Google AdMob.
- **Approximate location:** derived from IP by Google Mobile Ads for ad serving and fraud prevention. Shared with Google AdMob.
- On-device (not collected): campaign save, stars, bounty high, gun finish
- Encrypted in transit: HTTPS for ads
- Account deletion: not applicable (no accounts)
- Independent security review: No

### Countries
All countries is fine. English listing is en-GB; you can add en-US copy later if you want.

---

## 4. Release

- Production (or closed testing first if you prefer)
- Release name: `1.3.0 (4)`
- Release notes (en-GB, 469/500):

```
A big polish and a round of fixes:
• No more black bars on tall phones – more sky, and the gun sits in your hand
• New steel-and-brass cylinder, pocket-watch draw timers and glowing hearts
• A banked bullet can now pass through two men, and the kill-cam plays on the final shot
• Marshals take two hits (or one in the hat), as the hints always said
• Daily Showdown and Bounty Hunt show their own streets
• Fixed slow-mo getting stuck, extra taps costing stars and more
```

Upload **one** AAB: `uk.co.mozzer.bjango` versionCode **4**. Run `npm run bundle:aab` first so the bundle carries this version and today's game files.
