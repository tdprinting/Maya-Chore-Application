# Maya's Ohana Stars 🌺⭐

A chore and rewards app for Maya (iPad) and her parents (iPhones). Maya finishes chores, bonus quests and
school work, adds a photo for bonus stars, and spends her stars in a prize shop. Mom and Dad get her
submissions instantly, approve them, build the weekly schedule, and keep a payday shopping list.

It's a web app you install on the home screen (a PWA), so one link works on the iPad and the iPhones.

## What's inside

**Maya's app (iPad)**
- Home: daily words of encouragement from Lilo the cat, the newest love note from Mom & Dad, today's progress, helping streak, level and savings goal
- Chores: today's list from the parents' schedule, big tap-to-finish cards, optional photo for bonus stars, a peek at the week
- Bonus quests: extra ways to earn (reading, Duolingo, typing games, choir practice, drawing, road crossing duty…), each limited per week
- School stars: snap a picture of great homework or a test for bonus stars
- Prize shop: buy prizes with stars (giant celebration animation 🎉), set a savings goal, and send wishes for things she finds online
- Trophies: levels, badges (Lilo's Best Friend, Reef Keeper, Super Big Sister, Laundromat Pro…), star history, pink or blue theme
- Small victory animations and sounds for every chore and approval

**Parent Hub (iPhone)**
- Inbox: approve or send back chores with the photo, adjust stars, add a cheer; handle prize picks and wish-list requests
- Schedule: pick chores for each day of the week; Maya's iPad updates live
- Chore and bonus catalogue: 33 chores and 15 bonus quests made for this house (Lilo, two reef tanks, the baby, laundromat trips), plus custom ones. Star values are suggested from time and effort, and you set the final number
- Prizes: payday shopping list with estimated total, and the prize catalogue
- Family: love notes, give or take stars, device codes, parent PIN, settings

## Try it right now (demo mode)

Without any setup the app runs in **demo mode**: data stays in one browser, and two tabs talk to each other
so you can play Maya in one tab and a parent in the other.

```bash
npm install
npm run dev
```

## Set it up for the family (one time, about 15 minutes, all free)

Syncing between the iPad and the iPhones needs a small hosted database. This app uses
[Supabase](https://supabase.com) (free tier) and is hosted on [Vercel](https://vercel.com) (free tier).

1. **Create the database**
   - Sign up at supabase.com and create a new project (any name, pick a region near you, save the database password somewhere).
   - Open **SQL Editor → New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), and press **Run**.
   - Open **Authentication → Sign In / Providers** and turn on **Allow anonymous sign-ins**. (Devices join your family with a code instead of an email and password.)
   - Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
2. **Put the app online**
   - Sign up at vercel.com with your GitHub account and choose **Add New → Project**, then import this repository.
   - Under **Environment Variables**, add `VITE_SUPABASE_URL` (the Project URL) and `VITE_SUPABASE_ANON_KEY` (the anon key).
   - Press **Deploy**. Vercel gives you a link like `https://maya-chore-application.vercel.app`.
3. **Install on your phone (parent)**
   - Open the link in Safari, tap **Share → Add to Home Screen**, then open the app from the home screen.
   - Tap **I'm a parent: set up our family**. Go to the **Family** tab: you'll see a kid code and a parent code. Set a **parent PIN** there too.
4. **Install on Maya's iPad**
   - Open the link in Safari, **Share → Add to Home Screen**, open it from the home screen, tap **I have a family code**, and enter the **kid code**.
5. **Second parent**: same as step 4 with the **parent code**.

On the iPad, the 🔒 Grown-ups button opens the Parent Hub with the PIN. On a parent phone, "Maya's view" shows what she sees.

### Notifications

When the app is open, new chores, prize picks and wishes pop up instantly with a sound, and the home-screen icon
shows a badge with the number waiting. Lock-screen push notifications while the app is closed are a possible next step
(they need a small server function and iOS 16.4+).

## Development

```bash
npm test        # unit tests for points, streaks, schedule logic
npm run build   # type-check and production build
```

- `src/kid/` – Maya's app; `src/parent/` – Parent Hub
- `src/backend.ts` – demo (localStorage) and Supabase backends with realtime sync
- `src/logic.ts` – point suggestions, balance, streaks, levels, badges
- `src/seed.ts` – starter chores, bonus quests and prizes
- `src/encouragement.ts` – daily words of encouragement
- `supabase/schema.sql` – database tables, security rules, photo storage

All data is shared through one `items` table scoped by family with row-level security; photos are stored in a
private storage bucket and shown with short-lived signed links.
