# Priscilla Jefry Hakim - portfolio

A one-page portfolio site. The content is in **index.html**, the styling is in the **css** folder, the editor is in the **js** folder, and the pictures are in the **assets** folder.
There is nothing to install and nothing to build.

## Upload to GitHub and publish it
1. On github.com click **New repository**. Name it, for example, `portfolio`, and keep it **Public**.
2. Click **uploading an existing file**. Drag in **index.html** and the whole **css**, **js** and **assets** folders
   (drag the folders themselves, not the files one by one) and click **Commit changes**.
3. Open **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**,
   pick the **main** branch and the **/ (root)** folder, then **Save**.
4. After a minute or two your site is live at `https://YOUR-USERNAME.github.io/portfolio/`.

index.html must sit at the top level of the repository (not inside another folder).

Tip: the 3D lanyard card works best when the site is opened from its web address.
If you double-click index.html on your computer, the card may show a flat version. That is normal.

## Edit the projects from the website itself
1. Open the site and click the small pencil button in the bottom-left corner. Enter the editor password.
2. Click a project category. In the editor box you can rename, add, delete and reorder projects, and
   inside a project you can edit each page's heading, text, details and picture, add pages, delete pages and move pages.
3. Click **save & download zip**. Unzip it and upload everything inside it to GitHub (replace the old files).
   New pictures are included in the zip under `assets/projects/`.

Good to know:
- Your edits live only in your browser until you upload the zip, so nobody else can change the live site.
- Saving works on the published web address or a local server. If you opened index.html straight from your computer,
  the editor asks you to choose the site folder once so it can read the files.
- To change the password, unlock the editor, click **password**, then save and upload the zip.
- The password only hides the edit tools. It is not a secret vault, so don't reuse a password you use elsewhere.
- Deleting a page or project does not delete its picture file from GitHub. Remove old files from `assets/projects/` yourself if you want to.

## How to edit later by hand
Open **index.html** in a text editor (VS Code, Notepad, TextEdit in plain-text mode), use Find (Ctrl/Cmd + F)
to jump around, then upload the changed file to GitHub again (open the file on GitHub > pencil icon, or upload and replace).
The main blocks are marked with comments that start with `<!--`:

| What to change | Search for |
| --- | --- |
| Lanyard page | `GENERAL PAGE` |
| About me text | `ABOUT ME text` |
| "what i can help with" chips | `var SVC` |
| Education | `EDUCATION` |
| Experiences | `EXPERIENCES` |
| Tools and their descriptions | `TOOLS` |
| Projects, their slides, text and pictures | `PROJECTS DATA` |
| Contact page | `CONTACT PAGE` |

### Projects
In the PROJECTS DATA block every category has a list of projects and every project has its own slides.
Each slide has a heading `h` (null uses the project name), a picture `img`, a description `t`
and an optional bullet `list`. To add a project, copy a whole `{ "name": ..., "slides": [...] }` block
inside the category you want and edit it. Remove the `"img"` line to show the "add picture here" box.

### Pictures
Put the picture file in the **assets** folder (project pictures go in `assets/projects`) and use its path,
for example `"img": "assets/projects/my-picture.jpg"`. Use simple file names: lowercase, no spaces.

### Other notes
- Colours: open `css/base.css` and look for `--bg` and `--ink` (they switch with light and dark mode).
- Styling is split by page in the **css** folder: `base.css` (colours, fonts, home page), `fonts.css` (embedded fonts, leave alone),
  `general.css` (lanyard page), `about.css`, `cursor.css` (flower cursor), `projects.css`, `animations.css` (page transitions), `theme-toggle.css`.
- The lanyard card photo is stored inside index.html on purpose (it is drawn onto the 3D card).
  To change it, search for `class="photo"`.
- Sounds, the flower cursor and the animations are all in the same file, near the bottom.
