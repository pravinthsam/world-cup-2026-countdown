# 🏆 FIFA World Cup 2026 Countdown & Tournament Hub

A premium, interactive single-page web application featuring live countdowns, match schedules, real-time results, points table, top scorers (Golden Boot) leaderboard, and a dynamic knockout stage bracket for the **FIFA World Cup 2026**.

🔗 **Live Page**: You can view the live application here: [https://pravinthsam.github.io/world-cup-2026-countdown/](https://pravinthsam.github.io/world-cup-2026-countdown/)

---

## ✨ Features

- **🕒 Match Countdown & Schedule**: Displays all upcoming matches with dynamic, real-time countdown timers.
- **🌍 Dynamic Timezone Conversion**: Automatically detects the user's timezone or allows manually picking from a curated list of world timezones, updating all match times instantly.
- **📊 Points Table (Standings)**: Real-time calculation of group-stage rankings with clear qualification badges showing which teams have qualified.
- **👟 Golden Boot Leaderboard**: Features a visual podium for the top 3 goal scorers and a clean, searchable list for the remaining top scorers.
- **🌳 Interactive Knockout Bracket**: Tree-style visualization of the tournament phases (from Round of 32 down to the Finals) supporting zooming (In / Out / 100%) and panning.

---

## 🛠️ Tech Stack

- **Structure**: Semantic HTML5
- **Styling**: Modern CSS3 (featuring HSL variables, backdrop filters, flexbox/grid layout)
- **Logic**: Vanilla ES6+ JavaScript
- **Icons**: Lucide Icons
- **Fonts**: Outfit (headings) & Inter (body)

---

## 🚀 Running Locally (Optional)

While the default way to access the hub is via the [live page](https://pravinthsam.github.io/world-cup-2026-countdown/), you can optionally run it locally. Because the application fetches remote JSON data, you should run it using a local development server to avoid CORS/Fetch errors when loading files in the browser.

Here are a few quick ways to spin up a local server in the repository directory:

### Option 1: Using Python (Recommended)
Since this workspace includes `uv`, you can run a Python HTTP server instantly:
```bash
uv run python -m http.server 8000
```
Then, open `http://localhost:8000` in your browser.

### Option 2: Using Node.js / npm
You can run a local server using `npx`:
```bash
npx serve
```
or
```bash
npx http-server
```

---

## 💾 Data Source Credit

All tournament schedule, results, and scorer data are retrieved directly from:
* **Repository**: [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) on GitHub.

The application fetches this live data from the remote repository's main branch. In case of network errors, it retries up to 3 times with exponential backoff before displaying a failure screen with a "Try Again" button.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
